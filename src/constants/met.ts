import type { ActivityType, ProfileSex } from '../types';

export interface CalorieProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: ProfileSex;
}

/**
 * MET (Metabolic Equivalent of Task) lookup tables, approximated from the
 * Compendium of Physical Activities. Each entry is the upper bound of a
 * speed bucket (km/h) mapped to its MET value; the last bucket has no upper
 * bound and applies to anything faster.
 */
const RUNNING_MET_TABLE: Array<{ maxSpeedKmh: number; met: number }> = [
  { maxSpeedKmh: 6.4, met: 6.0 },
  { maxSpeedKmh: 8.0, met: 8.3 },
  { maxSpeedKmh: 9.7, met: 9.8 },
  { maxSpeedKmh: 10.8, met: 10.5 },
  { maxSpeedKmh: 11.3, met: 11.0 },
  { maxSpeedKmh: 12.1, met: 11.5 },
  { maxSpeedKmh: 13.8, met: 11.8 },
  { maxSpeedKmh: 14.5, met: 12.3 },
  { maxSpeedKmh: 16.1, met: 12.8 },
  { maxSpeedKmh: 17.7, met: 14.5 },
  { maxSpeedKmh: Infinity, met: 16.0 },
];

const CYCLING_MET_TABLE: Array<{ maxSpeedKmh: number; met: number }> = [
  { maxSpeedKmh: 16.0, met: 4.0 },
  { maxSpeedKmh: 19.0, met: 6.8 },
  { maxSpeedKmh: 22.5, met: 8.0 },
  { maxSpeedKmh: 25.7, met: 10.0 },
  { maxSpeedKmh: 30.6, met: 12.0 },
  { maxSpeedKmh: Infinity, met: 15.8 },
];

/** MET value for the given activity type at the given instantaneous speed. */
export function getMetValue(type: ActivityType, speedKmh: number): number {
  const table = type === 'running' ? RUNNING_MET_TABLE : CYCLING_MET_TABLE;
  const bucket = table.find((row) => speedKmh <= row.maxSpeedKmh);
  return bucket ? bucket.met : table[table.length - 1].met;
}

/**
 * Resting energy from Mifflin-St Jeor. The neutral option uses the midpoint
 * of the male/female constants rather than guessing a sex for the user.
 */
export function restingCaloriesPerHour(profile: CalorieProfile): number {
  const sexConstant = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78;
  const dailyKcal =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    sexConstant;
  return Math.max(800, dailyKcal) / 24;
}

/** Personalized MET estimate; numeric input keeps legacy activities/tests compatible. */
export function caloriesForSlice(
  met: number,
  profileOrWeight: CalorieProfile | number,
  durationHours: number
): number {
  const restingKcalPerHour = typeof profileOrWeight === 'number'
    ? profileOrWeight
    : restingCaloriesPerHour(profileOrWeight);
  return met * restingKcalPerHour * durationHours;
}
