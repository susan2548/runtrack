import { getDb } from './database';
import type { MapCoordinate, RoutePlan, RoutePlanWithWaypoints, RouteWaypoint } from '../types';

export async function getRoutePlans(): Promise<RoutePlan[]> {
  const db = await getDb();
  return db.getAllAsync<RoutePlan>('SELECT * FROM route_plans ORDER BY updated_at DESC');
}

export async function getRoutePlan(id: string): Promise<RoutePlanWithWaypoints | null> {
  const db = await getDb();
  const plan = await db.getFirstAsync<RoutePlan>('SELECT * FROM route_plans WHERE id = ?', id);
  if (!plan) return null;
  const waypoints = await db.getAllAsync<RouteWaypoint>(
    'SELECT * FROM route_waypoints WHERE route_plan_id = ? ORDER BY sequence ASC',
    id
  );
  return { ...plan, waypoints };
}

export async function saveRoutePlan(
  id: string,
  name: string,
  distanceMeters: number,
  points: MapCoordinate[]
): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO route_plans (id, name, distance_meters, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, distance_meters=excluded.distance_meters, updated_at=excluded.updated_at`,
      id,
      name.trim() || 'My route',
      distanceMeters,
      now,
      now
    );
    await db.runAsync('DELETE FROM route_waypoints WHERE route_plan_id = ?', id);
    for (let sequence = 0; sequence < points.length; sequence += 1) {
      const point = points[sequence];
      await db.runAsync(
        `INSERT INTO route_waypoints (id, route_plan_id, sequence, latitude, longitude)
         VALUES (?, ?, ?, ?, ?)`,
        `${id}:${sequence}`,
        id,
        sequence,
        point.latitude,
        point.longitude
      );
    }
  });
}

export async function deleteRoutePlan(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM route_plans WHERE id = ?', id);
}
