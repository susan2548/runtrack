import { getDb } from './database';
import type { Profile } from '../types';

const DEFAULT_WEIGHT_KG = 65;

export async function getProfile(): Promise<Profile> {
  const db = await getDb();
  const row = await db.getFirstAsync<Profile>('SELECT * FROM profile WHERE id = 1');
  if (row) return row;

  const created: Profile = {
    id: 1,
    weight_kg: DEFAULT_WEIGHT_KG,
    display_name: null,
    user_id: null,
    onboarding_completed: 0,
    updated_at: Date.now(),
    sync_state: 'pending',
  };
  await db.runAsync(
    `INSERT INTO profile
      (id, weight_kg, display_name, user_id, onboarding_completed, updated_at, sync_state)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
    created.weight_kg,
    created.display_name,
    created.user_id,
    created.onboarding_completed,
    created.updated_at,
    created.sync_state
  );
  return created;
}

export async function updateProfile(fields: {
  weightKg?: number;
  displayName?: string | null;
  onboardingCompleted?: boolean;
}): Promise<void> {
  const db = await getDb();
  const current = await getProfile();
  await db.runAsync(
    `UPDATE profile
     SET weight_kg = ?, display_name = ?, onboarding_completed = ?, updated_at = ?, sync_state = 'pending'
     WHERE id = 1`,
    fields.weightKg ?? current.weight_kg,
    fields.displayName === undefined ? current.display_name : fields.displayName,
    fields.onboardingCompleted === undefined
      ? current.onboarding_completed
      : fields.onboardingCompleted
        ? 1
        : 0,
    Date.now()
  );
}

export async function setWeightKg(weightKg: number): Promise<void> {
  return updateProfile({ weightKg });
}

export async function completeOnboarding(weightKg: number): Promise<void> {
  return updateProfile({ weightKg, onboardingCompleted: true });
}

export async function setLinkedUser(userId: string | null, displayName: string | null): Promise<void> {
  const db = await getDb();
  await getProfile();
  await db.runAsync(
    `UPDATE profile
     SET user_id = ?, display_name = COALESCE(display_name, ?), updated_at = ?, sync_state = 'pending'
     WHERE id = 1`,
    userId,
    displayName,
    Date.now()
  );
}

export async function setProfileSynced(): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE profile SET sync_state = 'synced' WHERE id = 1");
}

export async function mergeRemoteProfile(remote: Pick<Profile, 'weight_kg' | 'display_name' | 'updated_at'>) {
  const db = await getDb();
  const local = await getProfile();
  if ((local.updated_at ?? 0) > (remote.updated_at ?? 0) && local.sync_state !== 'synced') return;
  await db.runAsync(
    `UPDATE profile
     SET weight_kg = ?, display_name = ?, updated_at = ?, sync_state = 'synced'
     WHERE id = 1`,
    remote.weight_kg,
    remote.display_name,
    remote.updated_at
  );
}
