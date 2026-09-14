import { caloriesForSlice, getMetValue, type CalorieProfile } from '../constants/met';
import type { ActivityType, LocationPoint, MapCoordinate, Split } from '../types';
import { haversineMeters } from './geo';

export const MAX_GPS_ACCURACY_METERS = 50;
export const SPLIT_DISTANCE_METERS = 1000;
export const OFF_ROUTE_THRESHOLD_METERS = 80;
const MAX_SAMPLE_GAP_MS = 30_000;

const MAX_SPEED_MS: Record<ActivityType, number> = {
  running: 12,
  cycling: 35,
};

export function isUsablePoint(point: LocationPoint) {
  return point.accuracy === null || point.accuracy <= MAX_GPS_ACCURACY_METERS;
}

export function calculateRouteDistance(points: MapCoordinate[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineMeters(
      points[index - 1].latitude,
      points[index - 1].longitude,
      points[index].latitude,
      points[index].longitude
    );
  }
  return total;
}

/** Approximate point-to-polyline distance using a local equirectangular projection. */
export function distanceToRouteMeters(point: MapCoordinate, route: MapCoordinate[]): number {
  if (!route.length) return Number.POSITIVE_INFINITY;
  if (route.length === 1) {
    return haversineMeters(point.latitude, point.longitude, route[0].latitude, route[0].longitude);
  }
  const earthRadius = 6_371_000;
  const referenceLatitude = (point.latitude * Math.PI) / 180;
  const project = (coordinate: MapCoordinate) => ({
    x: ((coordinate.longitude - point.longitude) * Math.PI / 180) * earthRadius * Math.cos(referenceLatitude),
    y: ((coordinate.latitude - point.latitude) * Math.PI / 180) * earthRadius,
  });
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    const start = project(route[index - 1]);
    const end = project(route[index]);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(start.x * dx + start.y * dy) / lengthSquared));
    const closestX = start.x + projection * dx;
    const closestY = start.y + projection * dy;
    minimum = Math.min(minimum, Math.hypot(closestX, closestY));
  }
  return minimum;
}

export interface ActivitySummary {
  distanceMeters: number;
  movingTimeMs: number;
  avgSpeedMs: number;
  maxSpeedMs: number;
  caloriesKcal: number;
  splits: Split[];
}

export function summarizeActivityPoints(
  activityId: string,
  type: ActivityType,
  points: LocationPoint[],
  calorieProfile: CalorieProfile | number,
  updatedAt = Date.now()
): ActivitySummary {
  const sorted = [...points].filter(isUsablePoint).sort((a, b) => a.timestamp - b.timestamp);
  let distanceMeters = 0;
  let movingTimeMs = 0;
  let maxSpeedMs = 0;
  let caloriesKcal = 0;
  let splitDistance = 0;
  let splitDuration = 0;
  let splitIndex = 1;
  const splits: Split[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.segment !== current.segment) continue;

    const deltaMs = current.timestamp - previous.timestamp;
    if (deltaMs <= 0 || deltaMs > MAX_SAMPLE_GAP_MS) continue;
    const deltaMeters = haversineMeters(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude
    );
    if (deltaMeters < 2) continue;

    const speedMs = deltaMeters / (deltaMs / 1000);
    if (!Number.isFinite(speedMs) || speedMs > MAX_SPEED_MS[type]) continue;

    distanceMeters += deltaMeters;
    movingTimeMs += deltaMs;
    maxSpeedMs = Math.max(maxSpeedMs, speedMs);
    caloriesKcal += caloriesForSlice(getMetValue(type, speedMs * 3.6), calorieProfile, deltaMs / 3_600_000);
    splitDistance += deltaMeters;
    splitDuration += deltaMs;

    while (splitDistance >= SPLIT_DISTANCE_METERS) {
      const overflow = splitDistance - SPLIT_DISTANCE_METERS;
      const ratio = SPLIT_DISTANCE_METERS / splitDistance;
      const duration = Math.round(splitDuration * ratio);
      splits.push({
        id: `${activityId}:split:${splitIndex}`,
        activity_id: activityId,
        split_index: splitIndex,
        distance_meters: SPLIT_DISTANCE_METERS,
        duration_ms: duration,
        avg_speed: SPLIT_DISTANCE_METERS / Math.max(duration / 1000, 0.001),
        updated_at: updatedAt,
        sync_state: 'pending',
      });
      splitIndex += 1;
      splitDistance = overflow;
      splitDuration = Math.max(0, splitDuration - duration);
    }
  }

  if (splitDistance >= 100) {
    splits.push({
      id: `${activityId}:split:${splitIndex}`,
      activity_id: activityId,
      split_index: splitIndex,
      distance_meters: splitDistance,
      duration_ms: splitDuration,
      avg_speed: splitDistance / Math.max(splitDuration / 1000, 0.001),
      updated_at: updatedAt,
      sync_state: 'pending',
    });
  }

  return {
    distanceMeters,
    movingTimeMs,
    avgSpeedMs: distanceMeters / Math.max(movingTimeMs / 1000, 0.001),
    maxSpeedMs,
    caloriesKcal,
    splits,
  };
}

export function startOfWeek(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const day = date.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - distanceFromMonday);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function calculateStreak(activities: { start_time: number }[]) {
  const days = new Set(
    activities.map((activity) => {
      const date = new Date(activity.start_time);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  );
  if (!days.size) return 0;

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
