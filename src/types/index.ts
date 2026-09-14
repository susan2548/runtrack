export type ActivityType = 'running' | 'cycling';
export type SyncState = 'pending' | 'synced' | 'error';
export type ProfileSex = 'female' | 'male' | 'unspecified';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string | null;
  notes: string | null;
  start_time: number;
  end_time: number | null;
  moving_time_ms: number;
  paused_duration_ms: number;
  total_distance: number;
  avg_speed: number;
  max_speed: number;
  calories_burned: number;
  updated_at: number;
  deleted_at: number | null;
  sync_state: SyncState;
  route_plan_id: string | null;
}

export interface LocationPoint {
  id?: number;
  point_key: string;
  activity_id: string;
  sequence: number;
  segment: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
}

export interface Split {
  id: string;
  activity_id: string;
  split_index: number;
  distance_meters: number;
  duration_ms: number;
  avg_speed: number;
  updated_at: number;
  sync_state: SyncState;
}

export interface Goal {
  id: string;
  activity_type: ActivityType;
  weekly_distance_meters: number;
  updated_at: number;
  sync_state: SyncState;
}

export type TrackerStatus = 'idle' | 'tracking' | 'paused' | 'finished';

export interface ActiveSessionSnapshot {
  activityId: string;
  activityType: ActivityType;
  startedAt: number;
  pausedAccumulatedMs: number;
  pausedAt: number | null;
  segment: number;
  status: 'tracking' | 'paused';
  routePlanId: string | null;
}

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteWaypoint extends MapCoordinate {
  id: string;
  route_plan_id: string;
  sequence: number;
}

export interface RoutePlan {
  id: string;
  name: string;
  distance_meters: number;
  created_at: number;
  updated_at: number;
}

export interface RoutePlanWithWaypoints extends RoutePlan {
  waypoints: RouteWaypoint[];
}

export interface Profile {
  id: 1;
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: ProfileSex;
  display_name: string | null;
  avatar_data: string | null;
  user_id: string | null;
  onboarding_completed: number;
  updated_at: number | null;
  sync_state: SyncState;
}
