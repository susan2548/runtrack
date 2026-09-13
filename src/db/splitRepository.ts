import { getDb } from './database';
import type { Split } from '../types';

export async function replaceSplits(activityId: string, splits: Split[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM splits WHERE activity_id = ?', activityId);
    for (const split of splits) {
      await db.runAsync(
        `INSERT INTO splits
          (id, activity_id, split_index, distance_meters, duration_ms, avg_speed, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        split.id,
        split.activity_id,
        split.split_index,
        split.distance_meters,
        split.duration_ms,
        split.avg_speed,
        split.updated_at,
        split.sync_state
      );
    }
  });
}

export async function getSplitsByActivity(activityId: string): Promise<Split[]> {
  const db = await getDb();
  return db.getAllAsync<Split>('SELECT * FROM splits WHERE activity_id = ? ORDER BY split_index ASC', activityId);
}

export async function upsertRemoteSplits(splits: Split[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const split of splits) {
      await db.runAsync(
        `INSERT INTO splits
          (id, activity_id, split_index, distance_meters, duration_ms, avg_speed, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
         ON CONFLICT(id) DO UPDATE SET
           distance_meters=excluded.distance_meters, duration_ms=excluded.duration_ms,
           avg_speed=excluded.avg_speed, updated_at=excluded.updated_at, sync_state='synced'`,
        split.id,
        split.activity_id,
        split.split_index,
        split.distance_meters,
        split.duration_ms,
        split.avg_speed,
        split.updated_at
      );
    }
  });
}
