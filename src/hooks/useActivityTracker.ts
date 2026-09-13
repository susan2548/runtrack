import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  createActivity,
  deleteActivity,
  finishActivity,
  getActivityById,
  getLocationPointsByActivity,
  insertLocationPoint,
} from '../db/activityRepository';
import { getProfile } from '../db/profileRepository';
import { replaceSplits } from '../db/splitRepository';
import {
  clearActiveSessionSnapshot,
  getActiveSessionSnapshot,
  saveActiveSessionSnapshot,
} from '../db/sessionRepository';
import {
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from '../services/backgroundLocationTask';
import {
  ensureForegroundLocationPermission,
  getLocationPermissionState,
  requestBackgroundLocationPermission,
} from '../services/locationPermissions';
import { MAX_GPS_ACCURACY_METERS, summarizeActivityPoints } from '../utils/activityMetrics';
import { generateId } from '../utils/id';
import { haversineMeters, MovingAverage } from '../utils/geo';
import { caloriesForSlice, getMetValue } from '../constants/met';
import type { ActiveSessionSnapshot, ActivityType, LocationPoint, TrackerStatus } from '../types';

const SPEED_SMOOTHING_WINDOW = 5;
const TIMER_TICK_MS = 500;
const MAX_SPEED_MS: Record<ActivityType, number> = { running: 12, cycling: 35 };

interface TrackerState {
  status: TrackerStatus;
  activityType: ActivityType;
  activityId: string | null;
  distanceMeters: number;
  currentSpeedMs: number;
  maxSpeedMs: number;
  elapsedMs: number;
  caloriesKcal: number;
  accuracyMeters: number | null;
  permissionDenied: boolean;
  backgroundGranted: boolean;
  recovered: boolean;
  initializing: boolean;
  routePoints: LocationPoint[];
}

function initialState(): TrackerState {
  return {
    status: 'idle',
    activityType: 'running',
    activityId: null,
    distanceMeters: 0,
    currentSpeedMs: 0,
    maxSpeedMs: 0,
    elapsedMs: 0,
    caloriesKcal: 0,
    accuracyMeters: null,
    permissionDenied: false,
    backgroundGranted: false,
    recovered: false,
    initializing: true,
    routePoints: [],
  };
}

export function useActivityTracker() {
  const [state, setState] = useState<TrackerState>(initialState);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<LocationPoint | null>(null);
  const speedAverageRef = useRef(new MovingAverage(SPEED_SMOOTHING_WINDOW));
  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const caloriesRef = useRef(0);
  const weightKgRef = useRef(65);
  const activityTypeRef = useRef<ActivityType>('running');
  const activityIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const segmentRef = useRef(0);
  const sequenceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const tickElapsed = useCallback(() => {
    const pauseInProgress = pausedAtRef.current ? Date.now() - pausedAtRef.current : 0;
    const elapsed = Date.now() - startedAtRef.current - pausedAccumRef.current - pauseInProgress;
    setState((current) => ({ ...current, elapsedMs: Math.max(0, elapsed) }));
  }, []);

  const snapshot = useCallback(
    (status: 'tracking' | 'paused'): ActiveSessionSnapshot | null => {
      if (!activityIdRef.current) return null;
      return {
        activityId: activityIdRef.current,
        activityType: activityTypeRef.current,
        startedAt: startedAtRef.current,
        pausedAccumulatedMs: pausedAccumRef.current,
        pausedAt: pausedAtRef.current,
        segment: segmentRef.current,
        status,
      };
    },
    []
  );

  const handleLocationUpdate = useCallback(async (location: Location.LocationObject) => {
    const id = activityIdRef.current;
    if (!id) return;
    const { latitude, longitude, accuracy } = location.coords;
    if (accuracy !== null && accuracy > MAX_GPS_ACCURACY_METERS) {
      setState((current) => ({ ...current, accuracyMeters: accuracy }));
      return;
    }

    const point: LocationPoint = {
      point_key: generateId(),
      activity_id: id,
      sequence: sequenceRef.current++,
      segment: segmentRef.current,
      latitude,
      longitude,
      timestamp: location.timestamp,
      accuracy,
    };
    const inserted = await insertLocationPoint(point);
    if (!inserted) return;

    const previous = lastPointRef.current;
    let currentSpeedMs = 0;
    if (previous && previous.segment === point.segment) {
      const deltaMs = point.timestamp - previous.timestamp;
      const deltaMeters = haversineMeters(previous.latitude, previous.longitude, latitude, longitude);
      if (deltaMs > 0 && deltaMs <= 30_000 && deltaMeters >= 2) {
        const rawSpeed = deltaMeters / (deltaMs / 1000);
        if (rawSpeed <= MAX_SPEED_MS[activityTypeRef.current]) {
          currentSpeedMs = speedAverageRef.current.add(rawSpeed);
          distanceRef.current += deltaMeters;
          maxSpeedRef.current = Math.max(maxSpeedRef.current, currentSpeedMs);
          caloriesRef.current += caloriesForSlice(
            getMetValue(activityTypeRef.current, currentSpeedMs * 3.6),
            weightKgRef.current,
            deltaMs / 3_600_000
          );
        }
      }
    }
    lastPointRef.current = point;
    setState((current) => ({
      ...current,
      distanceMeters: distanceRef.current,
      currentSpeedMs,
      maxSpeedMs: maxSpeedRef.current,
      caloriesKcal: caloriesRef.current,
      accuracyMeters: accuracy,
      routePoints: [...current.routePoints.slice(-799), point],
    }));
  }, []);

  const startWatching = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
      (location) => void handleLocationUpdate(location)
    );
  }, [handleLocationUpdate]);

  const stopWatching = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    await stopBackgroundLocationUpdates().catch(() => {});
  }, []);

  const enableBackgroundTracking = useCallback(async () => {
    const granted = await requestBackgroundLocationPermission();
    setState((current) => ({ ...current, backgroundGranted: granted }));
    if (granted && activityIdRef.current) await startBackgroundLocationUpdates().catch(() => {});
    return granted;
  }, []);

  const setActivityType = useCallback((type: ActivityType) => {
    if (activityIdRef.current) return;
    activityTypeRef.current = type;
    setState((current) => ({ ...current, activityType: type }));
  }, []);

  const start = useCallback(async () => {
    const granted = await ensureForegroundLocationPermission();
    if (!granted) {
      setState((current) => ({ ...current, permissionDenied: true }));
      return null;
    }

    const [profile, permissions] = await Promise.all([getProfile(), getLocationPermissionState()]);
    weightKgRef.current = profile.weight_kg;
    const id = generateId();
    const now = Date.now();
    activityIdRef.current = id;
    distanceRef.current = 0;
    maxSpeedRef.current = 0;
    caloriesRef.current = 0;
    lastPointRef.current = null;
    speedAverageRef.current.reset();
    startedAtRef.current = now;
    pausedAccumRef.current = 0;
    pausedAtRef.current = null;
    segmentRef.current = 0;
    sequenceRef.current = 0;

    await createActivity(id, activityTypeRef.current, now);
    const activeSnapshot = snapshot('tracking');
    if (activeSnapshot) await saveActiveSessionSnapshot(activeSnapshot);
    setState({
      ...initialState(),
      initializing: false,
      status: 'tracking',
      activityId: id,
      activityType: activityTypeRef.current,
      backgroundGranted: permissions.backgroundGranted,
    });
    timerRef.current = setInterval(tickElapsed, TIMER_TICK_MS);
    await startWatching();
    if (permissions.backgroundGranted) await startBackgroundLocationUpdates().catch(() => {});
    return { activityId: id, backgroundGranted: permissions.backgroundGranted };
  }, [snapshot, startWatching, tickElapsed]);

  const pause = useCallback(async () => {
    await stopWatching();
    clearTimer();
    pausedAtRef.current = Date.now();
    const activeSnapshot = snapshot('paused');
    if (activeSnapshot) await saveActiveSessionSnapshot(activeSnapshot);
    setState((current) => ({ ...current, status: 'paused', currentSpeedMs: 0 }));
  }, [clearTimer, snapshot, stopWatching]);

  const resume = useCallback(async () => {
    if (pausedAtRef.current !== null) {
      pausedAccumRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    segmentRef.current += 1;
    lastPointRef.current = null;
    const activeSnapshot = snapshot('tracking');
    if (activeSnapshot) await saveActiveSessionSnapshot(activeSnapshot);
    setState((current) => ({ ...current, status: 'tracking', recovered: false }));
    timerRef.current = setInterval(tickElapsed, TIMER_TICK_MS);
    await startWatching();
    if (state.backgroundGranted) await startBackgroundLocationUpdates().catch(() => {});
  }, [snapshot, startWatching, state.backgroundGranted, tickElapsed]);

  const finish = useCallback(async () => {
    await stopWatching();
    clearTimer();
    const id = activityIdRef.current;
    if (!id) return null;
    const endTime = Date.now();
    const pauseInProgress = pausedAtRef.current ? endTime - pausedAtRef.current : 0;
    const pausedDuration = pausedAccumRef.current + pauseInProgress;
    const points = await getLocationPointsByActivity(id);
    const summary = summarizeActivityPoints(id, activityTypeRef.current, points, weightKgRef.current, endTime);
    await replaceSplits(id, summary.splits);
    await finishActivity(id, {
      end_time: endTime,
      moving_time_ms: summary.movingTimeMs,
      paused_duration_ms: pausedDuration,
      total_distance: summary.distanceMeters,
      avg_speed: summary.avgSpeedMs,
      max_speed: summary.maxSpeedMs,
      calories_burned: summary.caloriesKcal,
    });
    await clearActiveSessionSnapshot();
    activityIdRef.current = null;
    setState((current) => ({ ...current, status: 'finished', activityId: null, recovered: false }));
    return id;
  }, [clearTimer, stopWatching]);

  const discard = useCallback(async () => {
    await stopWatching();
    clearTimer();
    const id = activityIdRef.current;
    if (id) await deleteActivity(id);
    await clearActiveSessionSnapshot();
    activityIdRef.current = null;
    setState({ ...initialState(), initializing: false });
  }, [clearTimer, stopWatching]);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      const activeSnapshot = await getActiveSessionSnapshot();
      if (!mounted || !activeSnapshot) {
        if (mounted) setState((current) => ({ ...current, initializing: false }));
        return;
      }
      const [activity, points, profile, permissions] = await Promise.all([
        getActivityById(activeSnapshot.activityId),
        getLocationPointsByActivity(activeSnapshot.activityId),
        getProfile(),
        getLocationPermissionState(),
      ]);
      if (!activity || activity.end_time !== null) {
        await clearActiveSessionSnapshot();
        if (mounted) setState((current) => ({ ...current, initializing: false }));
        return;
      }

      const summary = summarizeActivityPoints(activity.id, activity.type, points, profile.weight_kg);
      activityIdRef.current = activity.id;
      activityTypeRef.current = activity.type;
      weightKgRef.current = profile.weight_kg;
      startedAtRef.current = activeSnapshot.startedAt;
      pausedAccumRef.current = activeSnapshot.pausedAccumulatedMs;
      pausedAtRef.current = activeSnapshot.pausedAt;
      segmentRef.current = activeSnapshot.segment;
      sequenceRef.current = points.length;
      distanceRef.current = summary.distanceMeters;
      maxSpeedRef.current = summary.maxSpeedMs;
      caloriesRef.current = summary.caloriesKcal;
      lastPointRef.current = points.at(-1) ?? null;
      setState({
        status: activeSnapshot.status,
        activityType: activity.type,
        activityId: activity.id,
        distanceMeters: summary.distanceMeters,
        currentSpeedMs: 0,
        maxSpeedMs: summary.maxSpeedMs,
        elapsedMs: 0,
        caloriesKcal: summary.caloriesKcal,
        accuracyMeters: points.at(-1)?.accuracy ?? null,
        permissionDenied: false,
        backgroundGranted: permissions.backgroundGranted,
        recovered: true,
        initializing: false,
        routePoints: points.slice(-800),
      });
      if (activeSnapshot.status === 'tracking') {
        timerRef.current = setInterval(tickElapsed, TIMER_TICK_MS);
        await startWatching().catch((error) => console.warn('[useActivityTracker] recovery watch failed', error));
        if (permissions.backgroundGranted) await startBackgroundLocationUpdates().catch(() => {});
      }
      tickElapsed();
    };
    void restore();
    return () => {
      mounted = false;
      clearTimer();
      subscriptionRef.current?.remove();
    };
  }, [clearTimer, startWatching, tickElapsed]);

  return {
    ...state,
    setActivityType,
    start,
    pause,
    resume,
    finish,
    discard,
    enableBackgroundTracking,
  };
}
