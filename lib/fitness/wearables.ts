/**
 * Watch / wearable session ingest for GymAdvisor members.
 *
 * Garmin Connect Developer Program (OAuth 2.0 + ping/pull Activity API)
 * can push workout data after a class when the gym has Garmin credentials.
 * Apple Watch and Wear OS cannot be read from a web PWA — members log
 * those sessions here after class (duration, HR, calories, distance).
 */
import { createHash, randomBytes } from 'crypto';
import { newId, type FitgraphStore } from '@/lib/fitness/fitgraph';
import { applyGoalToStore, logGoalActual } from '@/lib/fitness/member-goals';
import type {
  FitWatchSession,
  GarminConnection,
} from '@/lib/fitness/wearable-types';

export type {
  FitWatchSession,
  GarminConnection,
  GarminOauthPending,
  WatchSource,
} from '@/lib/fitness/wearable-types';

export const GARMIN_AUTHORIZE_URL =
  process.env.GARMIN_AUTHORIZE_URL ||
  'https://connect.garmin.com/oauth2Confirm';
export const GARMIN_TOKEN_URL =
  process.env.GARMIN_TOKEN_URL ||
  'https://diauth.garmin.com/di-oauth2-service/oauth/token';
export const GARMIN_API_BASE =
  process.env.GARMIN_API_BASE || 'https://apis.garmin.com/wellness-api/rest';

export function garminConfigured(): boolean {
  return Boolean(
    String(process.env.GARMIN_CLIENT_ID || '').trim() &&
      String(process.env.GARMIN_CLIENT_SECRET || '').trim()
  );
}

export function newPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function garminRedirectUri(origin?: string): string {
  const fromEnv = String(process.env.GARMIN_REDIRECT_URI || '').trim();
  if (fromEnv) return fromEnv;
  const base = String(
    origin || process.env.NEXT_PUBLIC_APP_URL || 'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
  return `${base}/api/public/fitgraph/garmin/callback`;
}

export function publicWearableStatus(client: {
  wearable?: { garmin?: GarminConnection | null } | null;
}): {
  garmin_available: boolean;
  garmin_connected: boolean;
  last_sync_at: string | null;
} {
  const g = client.wearable?.garmin;
  return {
    garmin_available: garminConfigured(),
    garmin_connected: Boolean(g?.connected && g.access_token),
    last_sync_at: g?.last_sync_at || null,
  };
}

export function matchWatchToSession(
  store: FitgraphStore,
  clientId: string,
  startedAt: string,
  durationMin?: number | null
): { session_id: string | null; booking_id: string | null } {
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) {
    return { session_id: null, booking_id: null };
  }
  const date = startedAt.slice(0, 10);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const window = Math.max(20, Number(durationMin) || 45) + 30;
  let best: { session_id: string; booking_id: string | null; delta: number } | null =
    null;
  for (const s of store.sessions || []) {
    if (s.date !== date || s.status === 'cancelled') continue;
    const [h, m] = String(s.start_time || '00:00')
      .slice(0, 5)
      .split(':')
      .map(Number);
    const slot = (h || 0) * 60 + (m || 0);
    const delta = Math.abs(slot - startMin);
    if (delta > window) continue;
    const booking = (store.bookings || []).find(
      (b) =>
        b.session_id === s.id &&
        b.client_id === clientId &&
        b.status !== 'cancelled'
    );
    if (!best || delta < best.delta) {
      best = { session_id: s.id, booking_id: booking?.id || null, delta };
    }
  }
  return best
    ? { session_id: best.session_id, booking_id: best.booking_id }
    : { session_id: null, booking_id: null };
}

export function applyWatchSessionToStore(
  store: FitgraphStore,
  input: Omit<FitWatchSession, 'id' | 'created_at'> & {
    id?: string;
    created_at?: string;
  }
): FitWatchSession {
  const now = input.created_at || new Date().toISOString();
  const row: FitWatchSession = {
    id: input.id || newId('wch'),
    client_id: input.client_id,
    booking_id: input.booking_id ?? null,
    session_id: input.session_id ?? null,
    source: input.source || 'manual',
    started_at: input.started_at,
    duration_min: input.duration_min ?? null,
    distance_km: input.distance_km ?? null,
    calories: input.calories ?? null,
    avg_hr: input.avg_hr ?? null,
    max_hr: input.max_hr ?? null,
    activity_type: input.activity_type || null,
    garmin_activity_id: input.garmin_activity_id || null,
    created_at: now,
  };
  const list = [...(store.watch_sessions || [])];
  if (
    row.garmin_activity_id &&
    list.some((x) => x.garmin_activity_id === row.garmin_activity_id)
  ) {
    return list.find((x) => x.garmin_activity_id === row.garmin_activity_id)!;
  }
  list.unshift(row);
  store.watch_sessions = list.slice(0, 400);

  const goals = (store.goals || []).filter(
    (g) => g.client_id === row.client_id && g.status === 'active'
  );
  for (const g of goals) {
    let value: number | null = null;
    const kind = String(g.kind || '');
    if (kind === 'run_5k' && row.distance_km != null) {
      if (row.distance_km >= 4.5 && row.distance_km <= 5.6 && row.duration_min) {
        value = row.duration_min;
      }
    } else if (
      (kind === 'distance' || String(g.unit || '').toLowerCase() === 'km') &&
      row.distance_km != null
    ) {
      value = row.distance_km;
    } else if (
      kind === 'workouts_week' &&
      String(g.unit || '').toLowerCase().includes('session')
    ) {
      continue;
    }
    if (value == null) continue;
    const next = logGoalActual(g, value, {
      note: `Watch · ${row.source}${
        row.activity_type ? ` · ${row.activity_type}` : ''
      }`,
      source: String(row.source),
      nowIso: now,
    });
    applyGoalToStore(store, next, `${g.title} from watch`);
  }
  return row;
}

export type GarminActivity = {
  activityId?: string | number;
  activityName?: string;
  activityType?: string | { typeKey?: string };
  startTimeInSeconds?: number;
  durationInSeconds?: number;
  distanceInMeters?: number;
  activeKilocalories?: number;
  calories?: number;
  averageHeartRateInBeatsPerMinute?: number;
  maxHeartRateInBeatsPerMinute?: number;
};

export function garminActivityToWatchInput(
  clientId: string,
  activity: GarminActivity
): Omit<FitWatchSession, 'id' | 'created_at'> | null {
  const startSec = Number(activity.startTimeInSeconds);
  if (!Number.isFinite(startSec) || startSec <= 0) return null;
  const started = new Date(startSec * 1000).toISOString();
  const durationSec = Number(activity.durationInSeconds) || 0;
  const meters = Number(activity.distanceInMeters);
  const type =
    typeof activity.activityType === 'string'
      ? activity.activityType
      : activity.activityType?.typeKey || activity.activityName || null;
  return {
    client_id: clientId,
    source: 'garmin',
    started_at: started,
    duration_min: durationSec > 0 ? Math.round((durationSec / 60) * 10) / 10 : null,
    distance_km: Number.isFinite(meters)
      ? Math.round((meters / 1000) * 100) / 100
      : null,
    calories:
      Number(activity.activeKilocalories || activity.calories) || null,
    avg_hr: Number(activity.averageHeartRateInBeatsPerMinute) || null,
    max_hr: Number(activity.maxHeartRateInBeatsPerMinute) || null,
    activity_type: type,
    garmin_activity_id: activity.activityId != null ? String(activity.activityId) : null,
  };
}

export async function exchangeGarminToken(opts: {
  code?: string;
  refresh_token?: string;
  code_verifier?: string;
  redirect_uri: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user_id?: string;
}> {
  const id = String(process.env.GARMIN_CLIENT_ID || '').trim();
  const secret = String(process.env.GARMIN_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('Garmin Connect is not configured');
  const body = new URLSearchParams();
  if (opts.refresh_token) {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', opts.refresh_token);
  } else {
    body.set('grant_type', 'authorization_code');
    body.set('code', String(opts.code || ''));
    body.set('redirect_uri', opts.redirect_uri);
    if (opts.code_verifier) body.set('code_verifier', opts.code_verifier);
  }
  const res = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      String(data.error_description || data.error || 'Garmin token exchange failed')
    );
  }
  return {
    access_token: String(data.access_token || ''),
    refresh_token: data.refresh_token ? String(data.refresh_token) : undefined,
    expires_in: Number(data.expires_in) || undefined,
    token_type: data.token_type ? String(data.token_type) : 'Bearer',
    user_id: data.userId
      ? String(data.userId)
      : data.user_id
        ? String(data.user_id)
        : undefined,
  };
}

export async function fetchGarminUserId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GARMIN_API_BASE}/user/id`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { userId?: string };
    return data.userId ? String(data.userId) : null;
  } catch {
    return null;
  }
}

export async function pullGarminActivities(
  accessToken: string,
  fromSec: number,
  toSec: number
): Promise<GarminActivity[]> {
  const url = `${GARMIN_API_BASE}/activities?uploadStartTimeInSeconds=${Math.floor(
    fromSec
  )}&uploadEndTimeInSeconds=${Math.floor(toSec)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Garmin activities ${res.status}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) return data as GarminActivity[];
  if (Array.isArray((data as { activities?: GarminActivity[] }).activities)) {
    return (data as { activities: GarminActivity[] }).activities;
  }
  return [];
}

export async function ensureGarminAccess(
  garmin: GarminConnection,
  redirectUri: string
): Promise<GarminConnection> {
  if (!garmin.access_token) throw new Error('Garmin is not connected');
  const exp = garmin.expires_at ? new Date(garmin.expires_at).getTime() : 0;
  if (exp && exp - Date.now() > 60_000) return garmin;
  if (!garmin.refresh_token) return garmin;
  const tok = await exchangeGarminToken({
    refresh_token: garmin.refresh_token,
    redirect_uri: redirectUri,
  });
  return {
    ...garmin,
    connected: true,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || garmin.refresh_token,
    token_type: tok.token_type || garmin.token_type,
    expires_at: tok.expires_in
      ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
      : garmin.expires_at,
    user_id: tok.user_id || garmin.user_id,
  };
}
