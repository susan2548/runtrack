import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export interface AuthResult {
  ok: boolean;
  code?: AuthErrorCode;
  error?: string;
  needsEmailConfirmation?: boolean;
}

export type AuthErrorCode =
  | 'not_configured'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'already_registered'
  | 'password_too_short'
  | 'rate_limited'
  | 'network'
  | 'unknown';

function authFailure(error: unknown): AuthResult {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown authentication error');
  const normalized = message.toLowerCase();
  let code: AuthErrorCode = 'unknown';

  if (normalized.includes('invalid login credentials')) code = 'invalid_credentials';
  else if (normalized.includes('email not confirmed')) code = 'email_not_confirmed';
  else if (normalized.includes('already registered') || normalized.includes('already been registered')) code = 'already_registered';
  else if (normalized.includes('password') && (normalized.includes('short') || normalized.includes('least'))) code = 'password_too_short';
  else if (normalized.includes('rate limit') || normalized.includes('too many requests')) code = 'rate_limited';
  else if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('connection')) code = 'network';

  return { ok: false, code, error: message };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, code: 'not_configured', error: 'Supabase is not configured yet (see .env.example)' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (error) return authFailure(error);
    return { ok: true, needsEmailConfirmation: !data.session };
  } catch (error) {
    return authFailure(error);
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, code: 'not_configured', error: 'Supabase is not configured yet (see .env.example)' };
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return error ? authFailure(error) : { ok: true };
  } catch (error) {
    return authFailure(error);
  }
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  if (!isSupabaseConfigured) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}
