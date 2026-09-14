import assert from 'node:assert/strict';
import test from 'node:test';
import { caloriesForSlice, restingCaloriesPerHour } from '../src/constants/met';

test('personalized calorie estimate uses sex, height and age', () => {
  const shared = { weightKg: 65, heightCm: 170, age: 30 };
  const male = restingCaloriesPerHour({ ...shared, sex: 'male' });
  const female = restingCaloriesPerHour({ ...shared, sex: 'female' });
  const older = restingCaloriesPerHour({ ...shared, age: 60, sex: 'male' });

  assert.ok(male > female);
  assert.ok(male > older);
});

test('personalized MET calories scale with activity intensity and duration', () => {
  const profile = { weightKg: 70, heightCm: 175, age: 35, sex: 'unspecified' as const };
  const easyHalfHour = caloriesForSlice(6, profile, 0.5);
  const hardHour = caloriesForSlice(12, profile, 1);

  assert.ok(easyHalfHour > 0);
  assert.ok(hardHour > easyHalfHour * 3.9);
});
