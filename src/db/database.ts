import * as SQLite from 'expo-sqlite';
import { ACTIVITY_COLUMNS, CREATE_TABLES_SQL, LOCATION_COLUMNS, PROFILE_COLUMNS } from './schema';

const DB_NAME = 'runtracker.db';
const DB_VERSION = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function ensureColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
  columns: Record<string, string>
) {
  const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const names = new Set(existing.map((column) => column.name));
  for (const [name, definition] of Object.entries(columns)) {
    if (!names.has(name)) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(CREATE_TABLES_SQL);
  await ensureColumns(db, 'activities', ACTIVITY_COLUMNS);
  await ensureColumns(db, 'location_points', LOCATION_COLUMNS);
  await ensureColumns(db, 'profile', PROFILE_COLUMNS);

  const now = Date.now();
  await db.runAsync(
    `UPDATE activities
     SET updated_at = CASE WHEN updated_at = 0 THEN start_time ELSE updated_at END,
         sync_state = CASE WHEN synced = 1 THEN 'synced' ELSE sync_state END`
  );
  await db.execAsync(`
    DELETE FROM location_points
    WHERE id NOT IN (
      SELECT MIN(id) FROM location_points GROUP BY activity_id, timestamp
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_location_points_sample
      ON location_points (activity_id, timestamp);
  `);
  await db.runAsync(
    `UPDATE location_points
     SET point_key = activity_id || ':' || timestamp || ':' || id
     WHERE point_key IS NULL OR point_key = ''`
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO goals (id, activity_type, weekly_distance_meters, updated_at, sync_state)
     VALUES ('goal-running', 'running', 15000, ?, 'pending'),
            ('goal-cycling', 'cycling', 50000, ?, 'pending')`,
    now,
    now
  );
  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}

/** Shared, lazily-opened connection for UI and background tasks. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
