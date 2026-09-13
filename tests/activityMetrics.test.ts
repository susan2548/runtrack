import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStreak, isUsablePoint, startOfWeek, summarizeActivityPoints } from '../src/utils/activityMetrics';
import type { LocationPoint } from '../src/types';

function point(index: number, overrides: Partial<LocationPoint> = {}): LocationPoint {
  return {
    point_key: `point-${index}`,
    activity_id: 'activity-1',
    sequence: index,
    segment: 0,
    latitude: 13.7563,
    longitude: 100.5 + index * 0.001,
    timestamp: 1_700_000_000_000 + index * 20_000,
    accuracy: 5,
    ...overrides,
  };
}

test('rejects low-quality GPS samples', () => {
  assert.equal(isUsablePoint(point(0, { accuracy: 80 })), false);
  assert.equal(isUsablePoint(point(0, { accuracy: 12 })), true);
});

test('builds one-kilometre splits from valid running points', () => {
  const points = Array.from({ length: 12 }, (_, index) => point(index));
  const summary = summarizeActivityPoints('activity-1', 'running', points, 65, 123);
  assert.ok(summary.distanceMeters > 1000);
  assert.equal(summary.splits[0]?.split_index, 1);
  assert.equal(summary.splits[0]?.distance_meters, 1000);
  assert.ok(summary.avgSpeedMs > 0);
  assert.ok(summary.caloriesKcal > 0);
});

test('does not connect GPS points across pause segments', () => {
  const summary = summarizeActivityPoints(
    'activity-1',
    'running',
    [point(0), point(1, { segment: 1 })],
    65
  );
  assert.equal(summary.distanceMeters, 0);
});

test('ignores physically impossible running speed', () => {
  const summary = summarizeActivityPoints(
    'activity-1',
    'running',
    [point(0), point(1, { timestamp: 1_700_000_001_000 })],
    65
  );
  assert.equal(summary.distanceMeters, 0);
});

test('calculates a consecutive daily streak', () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  assert.equal(calculateStreak([{ start_time: today.getTime() }, { start_time: yesterday.getTime() }]), 2);
});

test('week starts on Monday', () => {
  const monday = new Date(startOfWeek());
  assert.equal(monday.getDay(), 1);
  assert.equal(monday.getHours(), 0);
});
