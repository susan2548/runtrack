import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Activity, LocationPoint } from '../types';

interface RouteReplayNativeModule {
  createAndShareReplay(payload: string): Promise<string>;
}

const routeReplayModule = Platform.OS === 'android'
  ? requireOptionalNativeModule<RouteReplayNativeModule>('RouteReplay')
  : null;

export function canShareRouteReplayVideo(): boolean {
  return routeReplayModule !== null;
}

export async function createAndShareRouteReplay(activity: Activity, points: LocationPoint[]): Promise<string> {
  if (!routeReplayModule) {
    throw new Error('Route Replay video is available in the Android standalone build.');
  }

  const maxVideoPoints = 900;
  const sampledPoints = points.length <= maxVideoPoints
    ? points
    : Array.from({ length: maxVideoPoints }, (_, index) => points[Math.round(index * (points.length - 1) / (maxVideoPoints - 1))]);

  return routeReplayModule.createAndShareReplay(JSON.stringify({
    id: activity.id,
    title: activity.title || (activity.type === 'running' ? 'My run' : 'My ride'),
    activityType: activity.type,
    distanceMeters: activity.total_distance,
    durationMs: activity.moving_time_ms || ((activity.end_time ?? activity.start_time) - activity.start_time),
    points: sampledPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
  }));
}
