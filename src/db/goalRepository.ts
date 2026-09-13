import { getDb } from './database';
import type { ActivityType, Goal, SyncState } from '../types';

export async function getGoals(): Promise<Goal[]> {
  const db = await getDb();
  return db.getAllAsync<Goal>('SELECT * FROM goals ORDER BY activity_type DESC');
}

export async function getGoal(type: ActivityType): Promise<Goal> {
  const db = await getDb();
  const row = await db.getFirstAsync<Goal>('SELECT * FROM goals WHERE activity_type = ?', type);
  if (row) return row;
  const fallback = type === 'running' ? 15000 : 50000;
  const goal: Goal = {
    id: `goal-${type}`,
    activity_type: type,
    weekly_distance_meters: fallback,
    updated_at: Date.now(),
    sync_state: 'pending',
  };
  await upsertGoal(type, fallback);
  return goal;
}

export async function upsertGoal(type: ActivityType, weeklyDistanceMeters: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO goals (id, activity_type, weekly_distance_meters, updated_at, sync_state)
     VALUES (?, ?, ?, ?, 'pending')
     ON CONFLICT(activity_type) DO UPDATE SET
       weekly_distance_meters=excluded.weekly_distance_meters,
       updated_at=excluded.updated_at,
       sync_state='pending'`,
    `goal-${type}`,
    type,
    weeklyDistanceMeters,
    Date.now()
  );
}

export async function getPendingGoals(): Promise<Goal[]> {
  const db = await getDb();
  return db.getAllAsync<Goal>("SELECT * FROM goals WHERE sync_state != 'synced'");
}

export async function setGoalSyncState(id: string, state: SyncState) {
  const db = await getDb();
  await db.runAsync('UPDATE goals SET sync_state = ? WHERE id = ?', state, id);
}

export async function upsertRemoteGoal(goal: Goal) {
  const db = await getDb();
  const local = await db.getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', goal.id);
  if (local && local.updated_at > goal.updated_at && local.sync_state !== 'synced') return;
  await db.runAsync(
    `INSERT INTO goals (id, activity_type, weekly_distance_meters, updated_at, sync_state)
     VALUES (?, ?, ?, ?, 'synced')
     ON CONFLICT(activity_type) DO UPDATE SET
       weekly_distance_meters=excluded.weekly_distance_meters,
       updated_at=excluded.updated_at,
       sync_state='synced'`,
    goal.id,
    goal.activity_type,
    goal.weekly_distance_meters,
    goal.updated_at
  );
}
