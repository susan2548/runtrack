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
import type { Activity, Goal, LocationPoint, Split } from '../types';

const UPLOAD_CHUNK_SIZE = 500;
const RETRY_DELAYS_MS = [0, 500, 1500];

export type SyncStatus =
  | { state: 'skipped'; reason: 'offline' | 'not-configured' | 'signed-out' }
  | { state: 'idle'; uploaded: number; downloaded: number }
  | { state: 'error'; message: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toRemoteActivity(activity: Activity, userId: string) {
  return { ...activity, user_id: userId, sync_state: undefined };
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
  const firstError = [activitiesResult.error, pointsResult.error, splitsResult.error, goalsResult.error, profileResult.error].find(Boolean);
  if (firstError) throw firstError;

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
      display_name: profileResult.data.display_name,
      updated_at: Number.isFinite(remoteProfileUpdatedAt) ? remoteProfileUpdatedAt : 0,
    });
  }
  return activities.length;
}

async function pushActivity(activity: Activity, userId: string) {
  const payload = toRemoteActivity(activity, userId);
  delete (payload as { sync_state?: unknown }).sync_state;
  const { error } = await supabase.from('activities').upsert(payload);
  if (error) throw error;
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
      if (result.error) throw result.error;
    }
    if (splits.length) {
      const result = await supabase.from('splits').upsert(splits.map((split) => ({ ...split, user_id: userId, sync_state: undefined })));
      if (result.error) throw result.error;
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
    if (error) throw error;
    await setGoalSyncState(goal.id, 'synced');
  }
  if (profile.sync_state !== 'synced') {
    const { error } = await supabase.from('profiles').upsert({
      id: userId, weight_kg: profile.weight_kg, display_name: profile.display_name,
      updated_at: new Date(profile.updated_at ?? Date.now()).toISOString(),
    });
    if (error) throw error;
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
  return { state: 'error', message: lastError instanceof Error ? lastError.message : 'Sync failed for an unknown reason' };
}

export async function exportCloudReadySnapshot() {
  return { profile: await getProfile(), goals: await getGoals() };
}
