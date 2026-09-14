import assert from 'node:assert/strict';
import test from 'node:test';
import { toRemoteActivity } from '../src/services/syncPayloads';
import type { Activity } from '../src/types';

test('activity upload excludes SQLite-only sync columns', () => {
  const activity = {
    id: 'activity-1',
    type: 'running',
    title: 'Morning run',
    notes: null,
    start_time: 1000,
    end_time: 2000,
    moving_time_ms: 1000,
    paused_duration_ms: 0,
    total_distance: 250,
    avg_speed: 3.5,
    max_speed: 4,
    calories_burned: 20,
    updated_at: 2000,
    deleted_at: null,
    sync_state: 'pending',
    route_plan_id: null,
    // Simulates an old SQLite column that remains on rows at runtime.
    synced: 0,
  } as Activity & { synced: number };

  const payload = toRemoteActivity(activity, 'user-1');

  assert.equal(payload.user_id, 'user-1');
  assert.equal(payload.id, activity.id);
  assert.equal('synced' in payload, false);
  assert.equal('sync_state' in payload, false);
  assert.equal('route_plan_id' in payload, false);
});
