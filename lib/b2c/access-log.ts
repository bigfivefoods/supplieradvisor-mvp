/**
 * SA Member access tracking — stored on platform_b2c_profiles.metadata.access.
 * No extra tables. Used by the SupplierAdvisor platform console report.
 */
import type { B2cMembership, B2cProfile } from '@/lib/b2c/types';

export const B2C_SESSION_GAP_MS = 30 * 60 * 1000;
export const B2C_ACCESS_WRITE_THROTTLE_MS = 45 * 1000;
const RECENT_CAP = 25;

export type B2cAccessDisplay = 'standalone' | 'browser' | 'unknown';

export type B2cAccessVisit = {
  at: string;
  surface: string;
  path?: string;
  display?: B2cAccessDisplay;
  brand?: string;
  ms?: number;
};

export type B2cAccessSurfaceSlot = {
  last_at: string;
  visits: number;
  active_ms: number;
};

export type B2cAccessState = {
  first_seen_at: string;
  last_seen_at: string;
  last_login_at: string;
  session_started_at: string;
  session_count: number;
  visit_count: number;
  total_active_ms: number;
  last_session_ms: number;
  last_surface: string;
  last_path?: string;
  last_display?: B2cAccessDisplay;
  surfaces: Record<string, B2cAccessSurfaceSlot>;
  recent: B2cAccessVisit[];
};

export type B2cAccessTouch = {
  at?: string | Date;
  surface?: string | null;
  path?: string | null;
  display?: string | null;
  source?: string | null;
  brand?: string | null;
};

export const SURFACE_LABELS: Record<string, string> = {
  sa_member: 'SA Member app',
  gym: 'GymAdvisor PWA',
  physio: 'PhysioAdvisor',
  dental: 'DentalAdvisor',
  medical: 'MedicalAdvisor',
  psychiatry: 'PsychiatryAdvisor',
  hire: 'HireAdvisor',
  retail: 'RetailAdvisor',
  other: 'Other site',
};

export function surfaceLabel(surface?: string | null): string {
  const key = String(surface || '').trim();
  if (!key) return '—';
  return SURFACE_LABELS[key] || key;
}

export function displayLabel(display?: string | null): string {
  if (display === 'standalone') return 'Installed PWA';
  if (display === 'browser') return 'Browser / site';
  return '—';
}

export function normalizeDisplay(
  raw?: string | null,
  source?: string | null
): B2cAccessDisplay {
  const d = String(raw || '').toLowerCase();
  if (d === 'standalone' || d === 'pwa' || d === 'installed') return 'standalone';
  if (d === 'browser' || d === 'web' || d === 'tab') return 'browser';
  const src = String(source || '').toLowerCase();
  if (src === 'pwa' || src === 'standalone') return 'standalone';
  if (src === 'web' || src === 'browser') return 'browser';
  return 'unknown';
}

export function normalizeSurface(
  raw?: string | null,
  path?: string | null
): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  const p = String(path || '').toLowerCase();
  if (
    s === 'sa_member' ||
    s === 'member' ||
    s === 'wallet' ||
    s === 'me' ||
    s === '/me'
  ) {
    return 'sa_member';
  }
  if (s === 'gym' || s === 'fitgraph' || s === 'vuka') return 'gym';
  if (s === 'physio' || s === 'physiograph') return 'physio';
  if (s === 'dental' || s === 'dentalgraph') return 'dental';
  if (s === 'medical' || s === 'medicalgraph') return 'medical';
  if (s === 'psychiatry' || s === 'psychiatrygraph') return 'psychiatry';
  if (s === 'hire' || s === 'hiregraph') return 'hire';
  if (s === 'retail' || s === 'retailgraph') return 'retail';
  if (p.includes('/fitgraph')) return 'gym';
  if (p.includes('/physiograph')) return 'physio';
  if (p.includes('/dentalgraph')) return 'dental';
  if (p.includes('/medicalgraph')) return 'medical';
  if (p.includes('/psychiatrygraph')) return 'psychiatry';
  if (p.includes('/hire')) return 'hire';
  if (p.includes('/retail')) return 'retail';
  if (p === '/me' || p.startsWith('/me/')) return 'sa_member';
  if (s) return s.replace(/[^a-z0-9_]+/g, '_').slice(0, 32);
  return 'sa_member';
}

function emptyAccess(): B2cAccessState {
  return {
    first_seen_at: '',
    last_seen_at: '',
    last_login_at: '',
    session_started_at: '',
    session_count: 0,
    visit_count: 0,
    total_active_ms: 0,
    last_session_ms: 0,
    last_surface: '',
    surfaces: {},
    recent: [],
  };
}

export function parseAccessState(meta: unknown): B2cAccessState {
  const root =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};
  const raw = root.access;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyAccess();
  const a = raw as Record<string, unknown>;
  const surfaces: Record<string, B2cAccessSurfaceSlot> = {};
  if (a.surfaces && typeof a.surfaces === 'object' && !Array.isArray(a.surfaces)) {
    for (const [k, v] of Object.entries(a.surfaces as Record<string, unknown>)) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const slot = v as Record<string, unknown>;
      surfaces[k] = {
        last_at: String(slot.last_at || ''),
        visits: Math.max(0, Number(slot.visits) || 0),
        active_ms: Math.max(0, Number(slot.active_ms) || 0),
      };
    }
  }
  const recent: B2cAccessVisit[] = [];
  if (Array.isArray(a.recent)) {
    for (const item of a.recent) {
      if (!item || typeof item !== 'object') continue;
      const v = item as Record<string, unknown>;
      if (!v.at) continue;
      recent.push({
        at: String(v.at),
        surface: String(v.surface || ''),
        path: v.path ? String(v.path) : undefined,
        display: normalizeDisplay(v.display as string),
        brand: v.brand ? String(v.brand) : undefined,
        ms: Number.isFinite(Number(v.ms)) ? Number(v.ms) : undefined,
      });
    }
  }
  return {
    first_seen_at: String(a.first_seen_at || ''),
    last_seen_at: String(a.last_seen_at || ''),
    last_login_at: String(a.last_login_at || ''),
    session_started_at: String(a.session_started_at || ''),
    session_count: Math.max(0, Number(a.session_count) || 0),
    visit_count: Math.max(0, Number(a.visit_count) || 0),
    total_active_ms: Math.max(0, Number(a.total_active_ms) || 0),
    last_session_ms: Math.max(0, Number(a.last_session_ms) || 0),
    last_surface: String(a.last_surface || ''),
    last_path: a.last_path ? String(a.last_path) : undefined,
    last_display: a.last_display
      ? normalizeDisplay(String(a.last_display))
      : undefined,
    surfaces,
    recent,
  };
}

export function applyAccessTouch(
  meta: unknown,
  touch: B2cAccessTouch
): { access: B2cAccessState; changed: boolean } {
  const nowDate = touch.at ? new Date(touch.at) : new Date();
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) {
    return { access: parseAccessState(meta), changed: false };
  }
  const now = nowDate.toISOString();
  const path = String(touch.path || '')
    .trim()
    .slice(0, 180);
  const surface = normalizeSurface(touch.surface, path);
  const display = normalizeDisplay(touch.display, touch.source);
  const brand = String(touch.brand || '')
    .trim()
    .slice(0, 80);

  const prev = parseAccessState(meta);
  const lastMs = prev.last_seen_at ? Date.parse(prev.last_seen_at) : 0;
  const samePlace =
    prev.last_surface === surface &&
    (prev.last_path || '') === path &&
    (prev.last_display || 'unknown') === display;
  if (
    lastMs &&
    nowMs - lastMs >= 0 &&
    nowMs - lastMs < B2C_ACCESS_WRITE_THROTTLE_MS &&
    samePlace
  ) {
    return { access: prev, changed: false };
  }

  const gap = lastMs ? nowMs - lastMs : B2C_SESSION_GAP_MS + 1;
  const continuing = Boolean(lastMs && gap > 0 && gap < B2C_SESSION_GAP_MS);

  let sessionCount = prev.session_count || 0;
  let lastLogin = prev.last_login_at;
  let sessionStarted = prev.session_started_at;
  let lastSessionMs = prev.last_session_ms || 0;
  let totalMs = prev.total_active_ms || 0;
  let add = 0;

  if (continuing) {
    add = gap;
    totalMs += add;
    lastSessionMs = Math.max(
      0,
      nowMs - Date.parse(sessionStarted || prev.last_seen_at || now)
    );
  } else {
    if (sessionStarted && lastMs) {
      lastSessionMs = Math.max(0, lastMs - Date.parse(sessionStarted));
    }
    sessionCount += 1;
    lastLogin = now;
    sessionStarted = now;
    lastSessionMs = 0;
  }

  const surfaces = { ...prev.surfaces };
  const slot = surfaces[surface] || { last_at: now, visits: 0, active_ms: 0 };
  surfaces[surface] = {
    last_at: now,
    visits: slot.visits + 1,
    active_ms: slot.active_ms + add,
  };

  const visit: B2cAccessVisit = {
    at: now,
    surface,
    path: path || undefined,
    display,
    brand: brand || undefined,
    ms: add || undefined,
  };
  const recent = [visit, ...(prev.recent || [])].slice(0, RECENT_CAP);

  return {
    changed: true,
    access: {
      first_seen_at: prev.first_seen_at || now,
      last_seen_at: now,
      last_login_at: lastLogin || now,
      session_started_at: sessionStarted || now,
      session_count: sessionCount,
      visit_count: (prev.visit_count || 0) + 1,
      total_active_ms: totalMs,
      last_session_ms: lastSessionMs,
      last_surface: surface,
      last_path: path || undefined,
      last_display: display,
      surfaces,
      recent,
    },
  };
}

export function touchB2cAccessOnProfile(
  profile: B2cProfile,
  touch: B2cAccessTouch
): { profile: B2cProfile; changed: boolean } {
  const { access, changed } = applyAccessTouch(profile.metadata || {}, touch);
  if (!changed) return { profile, changed: false };
  return {
    changed: true,
    profile: {
      ...profile,
      metadata: { ...(profile.metadata || {}), access },
    },
  };
}

export function formatDurationMs(ms?: number | null): string {
  const n = Math.max(0, Number(ms) || 0);
  if (!n) return '—';
  const s = Math.round(n / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 48) return rm ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function kindSiteLabel(kind?: string | null): string {
  const k = String(kind || '').toLowerCase();
  if (k === 'gym') return 'Gym';
  if (k === 'physio') return 'Physio';
  if (k === 'dental') return 'Dental';
  if (k === 'medical') return 'Medical';
  if (k === 'psychiatry') return 'Psychiatry';
  if (k === 'hire') return 'Hire';
  if (k === 'retail') return 'Retail';
  if (k === 'account') return 'Brand';
  return k || 'Site';
}

export function sitesFromMemberships(
  memberships: B2cMembership[] | null | undefined
): Array<{
  kind: string;
  kind_label: string;
  brand: string;
  company_id: number;
  path: string;
  linked_at: string | null;
  last_used_at: string | null;
}> {
  const out: Array<{
    kind: string;
    kind_label: string;
    brand: string;
    company_id: number;
    path: string;
    linked_at: string | null;
    last_used_at: string | null;
  }> = [];
  for (const m of memberships || []) {
    if (!m || m.active === false) continue;
    const brand = String(m.brand || m.company_name || '').trim();
    out.push({
      kind: m.kind,
      kind_label: kindSiteLabel(m.kind),
      brand: brand || `Company #${m.company_id}`,
      company_id: Number(m.company_id) || 0,
      path: String(m.portal_path || ''),
      linked_at: m.linked_at || null,
      last_used_at: m.last_used_at || null,
    });
  }
  return out;
}
