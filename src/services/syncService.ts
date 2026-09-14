import {
  getLocationPointsByActivity,
  getPendingActivities,
  setActivitySyncState,
  upsertRemoteActivity,
  upsertRemoteLocationPoints,
} from '../db/activityRepository';
import { getGoals, getPendingGoals, setGoalSyncState, upsertRemoteGoal } from '../db/goalRepository';
import { getProfile, mergeRemoteProfile, setProfileSynced } from '../db/profileRepository';
import { getSplitsByActivity, upsertRemoteSplits } from '../db/splitRepository';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { toRemoteActivity } from './syncPayloads';
import type { Activity, Goal, LocationPoint, ProfileSex, Split } from '../types';

const UPLOAD_CHUNK_SIZE = 500;
const RETRY_DELAYS_MS = [0, 500, 1500];

export type SyncStatus =
  | { state: 'skipped'; reason: 'offline' | 'not-configured' | 'signed-out' }
  | { state: 'idle'; uploaded: number; downloaded: number }
  | { state: 'error'; message: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function describeSyncError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const message = typeof value.message === 'string' ? value.message : '';
    const details = typeof value.details === 'string' ? value.details : '';
    const hint = typeof value.hint === 'string' ? value.hint : '';
    const code = typeof value.code === 'string' ? `[${value.code}]` : '';
    const summary = [code, message, details, hint].filter(Boolean).join(' ');
    if (summary) return summary.slice(0, 320);
  }
  return 'The server returned an unreadable error';
}

function throwSyncError(step: string, error: unknown): void {
  if (error) throw new Error(`${step}: ${describeSyncError(error)}`);
}

function profileSex(value: unknown): ProfileSex {
  return value === 'female' || value === 'male' ? value : 'unspecified';
}

function fromRemoteActivity(row: Record<string, unknown>): Activity {
  return {
    id: String(row.id),
    type: row.type as Activity['type'],
    title: (row.title as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    start_time: Number(row.start_time),
    end_time: row.end_time === null ? null : Number(row.end_time),
    moving_time_ms: Number(row.moving_time_ms ?? 0),
    paused_duration_ms: Number(row.paused_duration_ms ?? 0),
    total_distance: Number(row.total_distance ?? 0),
    avg_speed: Number(row.avg_speed ?? 0),
    max_speed: Number(row.max_speed ?? 0),
    calories_burned: Number(row.calories_burned ?? 0),
    updated_at: Number(row.updated_at ?? 0),
    deleted_at: row.deleted_at === null ? null : Number(row.deleted_at),
    sync_state: 'synced',
    route_plan_id: (row.route_plan_id as string | null) ?? null,
  };
}

async function pullRemote(userId: string): Promise<number> {
  const [activitiesResult, pointsResult, splitsResult, goalsResult, profileResult] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', userId).limit(10000),
    supabase.from('location_points').select('*').eq('user_id', userId).limit(20000),
    supabase.from('splits').select('*').eq('user_id', userId).limit(10000),
    supabase.from('goals').select('*').eq('user_id', userId).limit(20),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);
  throwSyncError('Download activities', activitiesResult.error);
  throwSyncError('Download GPS points', pointsResult.error);
  throwSyncError('Download splits', splitsResult.error);
  throwSyncError('Download goals', goalsResult.error);
  throwSyncError('Download profile', profileResult.error);

  const activities = (activitiesResult.data ?? []).map((row) => fromRemoteActivity(row));
  for (const activity of activities) await upsertRemoteActivity(activity);

  const points: LocationPoint[] = (pointsResult.data ?? []).map((row) => ({
    point_key: String(row.point_key ?? row.id),
    activity_id: String(row.activity_id),
    sequence: Number(row.sequence ?? 0),
    segment: Number(row.segment ?? 0),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    timestamp: Number(row.timestamp),
    accuracy: row.accuracy === null ? null : Number(row.accuracy),
  }));
  await upsertRemoteLocationPoints(points);

  const splits: Split[] = (splitsResult.data ?? []).map((row) => ({
    id: String(row.id), activity_id: String(row.activity_id), split_index: Number(row.split_index),
    distance_meters: Number(row.distance_meters), duration_ms: Number(row.duration_ms),
    avg_speed: Number(row.avg_speed), updated_at: Number(row.updated_at), sync_state: 'synced',
  }));
  await upsertRemoteSplits(splits);

  for (const row of goalsResult.data ?? []) {
    await upsertRemoteGoal({
      id: `goal-${String(row.activity_type)}`, activity_type: row.activity_type as Goal['activity_type'],
      weekly_distance_meters: Number(row.weekly_distance_meters),
      updated_at: Number(row.updated_at), sync_state: 'synced',
    });
  }
  if (profileResult.data) {
    const remoteProfileUpdatedAt = typeof profileResult.data.updated_at === 'number'
      ? profileResult.data.updated_at
      : Date.parse(String(profileResult.data.updated_at));
    await mergeRemoteProfile({
      weight_kg: Number(profileResult.data.weight_kg),
      height_cm: Number(profileResult.data.height_cm ?? 170),
      age: Number(profileResult.data.age ?? 30),
      sex: profileSex(profileResult.data.sex),
      display_name: profileResult.data.display_name,
      avatar_data: typeof profileResult.data.avatar_data === 'string' ? profileResult.data.avatar_data : null,
      updated_at: Number.isFinite(remoteProfileUpdatedAt) ? remoteProfileUpdatedAt : 0,
    });
  }
  return activities.length;
}

async function pushActivity(activity: Activity, userId: string) {
  const payload = toRemoteActivity(activity, userId);
  const { error } = await supabase.from('activities').upsert(payload);
  throwSyncError('Upload activity', error);
  if (!activity.deleted_at) {
    const [points, splits] = await Promise.all([
      getLocationPointsByActivity(activity.id),
      getSplitsByActivity(activity.id),
    ]);
    for (let index = 0; index < points.length; index += UPLOAD_CHUNK_SIZE) {
      const chunk = points.slice(index, index + UPLOAD_CHUNK_SIZE).map((point) => ({
        point_key: point.point_key, user_id: userId, activity_id: point.activity_id,
        sequence: point.sequence, segment: point.segment, latitude: point.latitude,
        longitude: point.longitude, timestamp: point.timestamp, accuracy: point.accuracy,
      }));
      const result = await supabase.from('location_points').upsert(chunk, { onConflict: 'point_key' });
      throwSyncError('Upload GPS points', result.error);
    }
    if (splits.length) {
      const result = await supabase.from('splits').upsert(splits.map((split) => ({
        id: split.id,
        user_id: userId,
        activity_id: split.activity_id,
        split_index: split.split_index,
        distance_meters: split.distance_meters,
        duration_ms: split.duration_ms,
        avg_speed: split.avg_speed,
        updated_at: split.updated_at,
      })));
      throwSyncError('Upload splits', result.error);
    }
  }
  await setActivitySyncState(activity.id, 'synced');
}

async function pushLocal(userId: string): Promise<number> {
  const [activities, goals, profile] = await Promise.all([getPendingActivities(), getPendingGoals(), getProfile()]);
  for (const activity of activities) await pushActivity(activity, userId);
  for (const goal of goals) {
    const { error } = await supabase.from('goals').upsert({
      id: `${userId}:${goal.activity_type}`, user_id: userId, activity_type: goal.activity_type,
      weekly_distance_meters: goal.weekly_distance_meters, updated_at: goal.updated_at,
    });
    throwSyncError('Upload goals', error);
    await setGoalSyncState(goal.id, 'synced');
  }
  if (profile.sync_state !== 'synced') {
    const { error } = await supabase.from('profiles').upsert({
      id: userId, weight_kg: profile.weight_kg, display_name: profile.display_name,
      height_cm: profile.height_cm, age: profile.age, sex: profile.sex, avatar_data: profile.avatar_data,
      updated_at: new Date(profile.updated_at ?? Date.now()).toISOString(),
    });
    throwSyncError('Upload profile', error);
    await setProfileSynced();
  }
  return activities.length + goals.length;
}

async function syncOnce(userId: string) {
  const downloaded = await pullRemote(userId);
  const uploaded = await pushLocal(userId);
  return { uploaded, downloaded };
}

export async function syncAll(userId: string | null, isOnline: boolean): Promise<SyncStatus> {
  if (!isSupabaseConfigured) return { state: 'skipped', reason: 'not-configured' };
  if (!isOnline) return { state: 'skipped', reason: 'offline' };
  if (!userId) return { state: 'skipped', reason: 'signed-out' };

  let lastError: unknown;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    try {
      const result = await syncOnce(userId);
      return { state: 'idle', ...result };
    } catch (error) {
      lastError = error;
    }
  }
  return { state: 'error', message: describeSyncError(lastError) };
}

export async function exportCloudReadySnapshot() {
  return { profile: await getProfile(), goals: await getGoals() };
}
