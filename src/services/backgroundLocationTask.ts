import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getActiveActivityId, insertLocationPoint } from '../db/activityRepository';
import { getActiveSessionSnapshot } from '../db/sessionRepository';
import { generateId } from '../utils/id';
import { MAX_GPS_ACCURACY_METERS } from '../utils/activityMetrics';

export const BACKGROUND_LOCATION_TASK = 'RUNTRACKER_BACKGROUND_LOCATION_TASK';

// Must run at module scope (imported once from index.ts) so it is registered
// before the JS bundle finishes loading, per expo-task-manager's requirement.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[backgroundLocationTask] error:', error.message);
    return;
  }

  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  if (!locations?.length) return;

  // The task can fire after the tracking screen has unmounted (app backgrounded/killed),
  // so it looks up the active activity id from SQLite rather than from React state.
  const activityId = await getActiveActivityId();
  if (!activityId) return;
  const snapshot = await getActiveSessionSnapshot();
  if (!snapshot || snapshot.status !== 'tracking') return;

  for (let index = 0; index < locations.length; index++) {
    const loc = locations[index];
    if (loc.coords.accuracy !== null && loc.coords.accuracy > MAX_GPS_ACCURACY_METERS) continue;
    await insertLocationPoint({
      point_key: generateId(),
      activity_id: activityId,
      sequence: loc.timestamp + index,
      segment: snapshot.segment,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: loc.timestamp,
      accuracy: loc.coords.accuracy,
    });
  }
});

/**
 * Starts native background location delivery. Requires a development build —
 * throws in Expo Go — so callers should treat failure as "foreground-only" rather than fatal.
 */
export async function startBackgroundLocationUpdates(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  ).catch(() => false);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    deferredUpdatesInterval: 3000,
    deferredUpdatesDistance: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'RunTracker is tracking your activity',
      notificationBody: 'GPS is recording your route in the background',
    },
  });
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  ).catch(() => false);
  if (started) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
