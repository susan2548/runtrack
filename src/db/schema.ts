export const CREATE_TABLES_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  moving_time_ms INTEGER NOT NULL DEFAULT 0,
  paused_duration_ms INTEGER NOT NULL DEFAULT 0,
  total_distance REAL NOT NULL DEFAULT 0,
  avg_speed REAL NOT NULL DEFAULT 0,
  max_speed REAL NOT NULL DEFAULT 0,
  calories_burned REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  route_plan_id TEXT,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS location_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  point_key TEXT,
  activity_id TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  segment INTEGER NOT NULL DEFAULT 0,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  accuracy REAL,
  FOREIGN KEY (activity_id) REFERENCES activities (id)
);

CREATE INDEX IF NOT EXISTS idx_location_points_activity ON location_points (activity_id);

CREATE TABLE IF NOT EXISTS splits (
  id TEXT PRIMARY KEY NOT NULL,
  activity_id TEXT NOT NULL,
  split_index INTEGER NOT NULL,
  distance_meters REAL NOT NULL,
  duration_ms INTEGER NOT NULL,
  avg_speed REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (activity_id) REFERENCES activities (id)
);

CREATE INDEX IF NOT EXISTS idx_splits_activity ON splits (activity_id);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  activity_type TEXT NOT NULL UNIQUE,
  weekly_distance_meters REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS route_plans (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  distance_meters REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_waypoints (
  id TEXT PRIMARY KEY NOT NULL,
  route_plan_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  FOREIGN KEY (route_plan_id) REFERENCES route_plans (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_route_waypoints_plan
  ON route_waypoints (route_plan_id, sequence);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  weight_kg REAL NOT NULL DEFAULT 65,
  height_cm REAL NOT NULL DEFAULT 170,
  age INTEGER NOT NULL DEFAULT 30,
  sex TEXT NOT NULL DEFAULT 'unspecified',
  display_name TEXT,
  avatar_data TEXT,
  user_id TEXT,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER,
  sync_state TEXT NOT NULL DEFAULT 'pending'
);
`;

export const ACTIVITY_COLUMNS: Record<string, string> = {
  title: 'TEXT',
  notes: 'TEXT',
  moving_time_ms: 'INTEGER NOT NULL DEFAULT 0',
  paused_duration_ms: 'INTEGER NOT NULL DEFAULT 0',
  updated_at: 'INTEGER NOT NULL DEFAULT 0',
  deleted_at: 'INTEGER',
  sync_state: "TEXT NOT NULL DEFAULT 'pending'",
  route_plan_id: 'TEXT',
};

export const LOCATION_COLUMNS: Record<string, string> = {
  point_key: 'TEXT',
  sequence: 'INTEGER NOT NULL DEFAULT 0',
  segment: 'INTEGER NOT NULL DEFAULT 0',
};

export const PROFILE_COLUMNS: Record<string, string> = {
  height_cm: 'REAL NOT NULL DEFAULT 170',
  age: 'INTEGER NOT NULL DEFAULT 30',
  sex: "TEXT NOT NULL DEFAULT 'unspecified'",
  avatar_data: 'TEXT',
  onboarding_completed: 'INTEGER NOT NULL DEFAULT 0',
  sync_state: "TEXT NOT NULL DEFAULT 'pending'",
};
