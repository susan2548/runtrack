import * as Location from 'expo-location';

export interface PermissionResult {
  granted: boolean; // foreground granted (required to track at all)
  backgroundGranted: boolean; // background granted (required to keep tracking while app is minimized/locked)
}

/** Ask only for the permission needed to show GPS and record while the app is open. */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  return foreground.status === 'granted';
}

/** Call only after an in-app explanation; Android 11+ opens system settings. */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted';
}

export async function getLocationPermissionState(): Promise<PermissionResult> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return {
    granted: foreground.status === 'granted',
    backgroundGranted: background.status === 'granted',
  };
}
