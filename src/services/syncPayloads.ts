import type { Activity } from '../types';

export function toRemoteActivity(activity: Activity, userId: string) {
  // SQLite rows can still contain legacy/local-only columns (for example
  // `synced`) that are not part of the TypeScript type. Whitelist the cloud
  // schema instead of spreading the row so those columns never reach PostgREST.
  return {
    id: activity.id,
    user_id: userId,
    type: activity.type,
    title: activity.title,
    notes: activity.notes,
    start_time: activity.start_time,
    end_time: activity.end_time,
    moving_time_ms: activity.moving_time_ms,
    paused_duration_ms: activity.paused_duration_ms,
    total_distance: activity.total_distance,
    avg_speed: activity.avg_speed,
    max_speed: activity.max_speed,
    calories_burned: activity.calories_burned,
    updated_at: activity.updated_at,
    deleted_at: activity.deleted_at,
  };
}
