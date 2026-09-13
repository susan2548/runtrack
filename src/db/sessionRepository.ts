import { getDb } from './database';
import type { ActiveSessionSnapshot } from '../types';

const SNAPSHOT_KEY = 'active_session_snapshot';

export async function saveActiveSessionSnapshot(snapshot: ActiveSessionSnapshot): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
    SNAPSHOT_KEY,
    JSON.stringify(snapshot)
  );
}

export async function getActiveSessionSnapshot(): Promise<ActiveSessionSnapshot | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', SNAPSHOT_KEY);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as ActiveSessionSnapshot;
  } catch {
    return null;
  }
}

export async function clearActiveSessionSnapshot(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM app_state WHERE key = ?', SNAPSHOT_KEY);
}
