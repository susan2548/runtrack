import { getDb } from './database';
import type { Activity, ActivityType, LocationPoint, SyncState } from '../types';

const ACTIVE_ACTIVITY_KEY = 'active_activity_id';

export async function createActivity(
  id: string,
  type: ActivityType,
  startTime: number,
  routePlanId: string | null = null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO activities
      (id, type, start_time, updated_at, sync_state, route_plan_id)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    id,
    type,
    startTime,
    startTime,
    routePlanId
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
    ACTIVE_ACTIVITY_KEY,
    id
  );
}

export interface FinishActivityData {
  end_time: number;
  moving_time_ms: number;
  paused_duration_ms: number;
  total_distance: number;
  avg_speed: number;
  max_speed: number;
  calories_burned: number;
}

export async function finishActivity(id: string, data: FinishActivityData): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE activities
     SET end_time = ?, moving_time_ms = ?, paused_duration_ms = ?, total_distance = ?,
         avg_speed = ?, max_speed = ?, calories_burned = ?, updated_at = ?, sync_state = 'pending'
     WHERE id = ?`,
    data.end_time,
    data.moving_time_ms,
    data.paused_duration_ms,
    data.total_distance,
    data.avg_speed,
    data.max_speed,
    data.calories_burned,
    Date.now(),
    id
  );
  await db.runAsync('DELETE FROM app_state WHERE key = ?', ACTIVE_ACTIVITY_KEY);
}

export async function updateActivityDetails(id: string, title: string | null, notes: string | null) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE activities SET title = ?, notes = ?, updated_at = ?, sync_state = 'pending' WHERE id = ?`,
    title,
    notes,
    Date.now(),
    id
  );
}

export async function insertLocationPoint(point: LocationPoint): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO location_points
      (point_key, activity_id, sequence, segment, latitude, longitude, timestamp, accuracy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    point.point_key,
    point.activity_id,
    point.sequence,
    point.segment,
    point.latitude,
    point.longitude,
    point.timestamp,
    point.accuracy
  );
  return result.changes > 0;
}

export async function getActiveActivityId(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?',
    ACTIVE_ACTIVITY_KEY
  );
  return row?.value ?? null;
}

export async function getActivityById(id: string): Promise<Activity | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Activity>('SELECT * FROM activities WHERE id = ? AND deleted_at IS NULL', id)) ?? null;
}

export async function getActivityIncludingDeleted(id: string): Promise<Activity | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Activity>('SELECT * FROM activities WHERE id = ?', id)) ?? null;
}

export async function getAllActivities(): Promise<Activity[]> {
  const db = await getDb();
  return db.getAllAsync<Activity>(
    'SELECT * FROM activities WHERE deleted_at IS NULL AND end_time IS NOT NULL ORDER BY start_time DESC'
  );
}

export async function getLocationPointsByActivity(activityId: string): Promise<LocationPoint[]> {
  const db = await getDb();
  return db.getAllAsync<LocationPoint>(
    'SELECT * FROM location_points WHERE activity_id = ? ORDER BY timestamp ASC',
    activityId
  );
}

export async function getPendingActivities(): Promise<Activity[]> {
  const db = await getDb();
  return db.getAllAsync<Activity>(
    `SELECT * FROM activities
     WHERE sync_state != 'synced' AND (end_time IS NOT NULL OR deleted_at IS NOT NULL)
     ORDER BY updated_at ASC`
  );
}

export async function setActivitySyncState(id: string, state: SyncState): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE activities SET sync_state = ?, synced = ? WHERE id = ?', state, state === 'synced' ? 1 : 0, id);
}

export async function upsertRemoteActivity(activity: Activity): Promise<void> {
  const db = await getDb();
  const local = await getActivityIncludingDeleted(activity.id);
  if (local && local.updated_at > activity.updated_at && local.sync_state !== 'synced') return;
  await db.runAsync(
    `INSERT INTO activities
      (id, type, title, notes, start_time, end_time, moving_time_ms, paused_duration_ms,
       total_distance, avg_speed, max_speed, calories_burned, updated_at, deleted_at,
       route_plan_id, sync_state, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 1)
     ON CONFLICT(id) DO UPDATE SET
       type=excluded.type, title=excluded.title, notes=excluded.notes, start_time=excluded.start_time,
       end_time=excluded.end_time, moving_time_ms=excluded.moving_time_ms,
       paused_duration_ms=excluded.paused_duration_ms, total_distance=excluded.total_distance,
       avg_speed=excluded.avg_speed, max_speed=excluded.max_speed,
       calories_burned=excluded.calories_burned, updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at, route_plan_id=excluded.route_plan_id,
       sync_state='synced', synced=1`,
    activity.id,
    activity.type,
    activity.title,
    activity.notes,
    activity.start_time,
    activity.end_time,
    activity.moving_time_ms,
    activity.paused_duration_ms,
    activity.total_distance,
    activity.avg_speed,
    activity.max_speed,
    activity.calories_burned,
    activity.updated_at,
    activity.deleted_at,
    activity.route_plan_id
  );
}

export async function upsertRemoteLocationPoints(points: LocationPoint[]): Promise<void> {
  if (!points.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const point of points) await insertLocationPoint(point);
  });
}

/** Soft-delete so the deletion can be mirrored to another signed-in device. */
export async function deleteActivity(id: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `UPDATE activities SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE id = ?`,
    now,
    now,
    id
  );
  await db.runAsync('DELETE FROM app_state WHERE key = ? AND value = ?', ACTIVE_ACTIVITY_KEY, id);
}

export async function getAllLocationPoints(limit = 20000): Promise<LocationPoint[]> {
  const db = await getDb();
  return db.getAllAsync<LocationPoint>(
    `SELECT lp.* FROM location_points lp
     JOIN activities a ON a.id = lp.activity_id
     WHERE a.deleted_at IS NULL
     ORDER BY lp.timestamp DESC LIMIT ?`,
    limit
  );
}

export async function clearActivityData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM splits');
    await db.runAsync('DELETE FROM location_points');
    await db.runAsync('DELETE FROM activities');
    await db.runAsync('DELETE FROM app_state');
  });
}
