/**
 * Platform console: who signed in as SA Member, last login, sites / PWAs, duration.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { B2cMembership } from '@/lib/b2c/types';
import {
  displayLabel,
  formatDurationMs,
  parseAccessState,
  sitesFromMemberships,
  surfaceLabel,
} from '@/lib/b2c/access-log';

export type SaMemberAccessSite = {
  kind: string;
  kind_label: string;
  brand: string;
  company_id: number;
  path: string;
  linked_at: string | null;
  last_used_at: string | null;
};

export type SaMemberAccessRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  signed_up_at: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  last_surface: string | null;
  last_surface_label: string | null;
  last_path: string | null;
  last_display: string | null;
  last_display_label: string | null;
  session_count: number;
  visit_count: number;
  total_active_ms: number;
  last_session_ms: number;
  avg_session_ms: number;
  total_active_label: string;
  last_session_label: string;
  avg_session_label: string;
  sites: SaMemberAccessSite[];
  site_summary: string;
  tracked: boolean;
};

export type SaMemberAccessReport = {
  at: string;
  note: string;
  summary: {
    total: number;
    new_7d: number;
    new_30d: number;
    active_24h: number;
    active_7d: number;
    pwa_last: number;
    with_sites: number;
    avg_session_ms: number;
    total_active_ms: number;
  };
  members: SaMemberAccessRow[];
};

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

function laterIso(...vals: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = 0;
  for (const v of vals) {
    if (!v) continue;
    const ms = Date.parse(v);
    if (!Number.isFinite(ms)) continue;
    if (ms >= bestMs) {
      bestMs = ms;
      best = v;
    }
  }
  return best;
}

export async function loadSaMemberAccessReport(): Promise<SaMemberAccessReport> {
  const empty: SaMemberAccessReport = {
    at: new Date().toISOString(),
    note: 'No SA Member wallets loaded.',
    summary: {
      total: 0,
      new_7d: 0,
      new_30d: 0,
      active_24h: 0,
      active_7d: 0,
      pwa_last: 0,
      with_sites: 0,
      avg_session_ms: 0,
      total_active_ms: 0,
    },
    members: [],
  };

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('platform_b2c_profiles')
    .select(
      'user_id, email, full_name, phone, memberships, metadata, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(4000);

  if (error) {
    const missing =
      error.code === '42P01' ||
      /platform_b2c_profiles|does not exist/i.test(error.message || '');
    return {
      ...empty,
      note: missing
        ? 'B2C profiles table is not on this database yet.'
        : error.message || 'Could not load SA Member wallets.',
    };
  }

  const since7 = daysAgoIso(7);
  const since30 = daysAgoIso(30);
  const since24 = daysAgoIso(1);
  const members: SaMemberAccessRow[] = [];

  for (const raw of data || []) {
    const row = raw as Record<string, unknown>;
    const memberships = Array.isArray(row.memberships)
      ? (row.memberships as B2cMembership[])
      : [];
    const metadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const access = parseAccessState(metadata);
    const tracked = Boolean(access.last_seen_at);
    const sites = sitesFromMemberships(memberships);
    const siteUsed = sites
      .map((s) => s.last_used_at)
      .filter(Boolean) as string[];
    const signedUp = row.created_at ? String(row.created_at) : null;
    const updated = row.updated_at ? String(row.updated_at) : null;
    const lastSeen = laterIso(
      access.last_seen_at,
      updated,
      ...siteUsed
    );
    const lastLogin = access.last_login_at || access.first_seen_at || signedUp;
    const sessionCount = access.session_count || 0;
    const totalMs = access.total_active_ms || 0;
    const avgMs =
      sessionCount > 0 ? Math.round(totalMs / sessionCount) : 0;
    const lastSurface = access.last_surface || null;
    const lastDisplay = access.last_display || null;
    const city = metadata.city ? String(metadata.city) : null;

    members.push({
      user_id: String(row.user_id || ''),
      name: row.full_name ? String(row.full_name) : null,
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      city,
      signed_up_at: signedUp,
      last_login_at: lastLogin,
      last_seen_at: lastSeen,
      last_surface: lastSurface,
      last_surface_label: lastSurface ? surfaceLabel(lastSurface) : null,
      last_path: access.last_path || null,
      last_display: lastDisplay,
      last_display_label: lastDisplay ? displayLabel(lastDisplay) : null,
      session_count: sessionCount,
      visit_count: access.visit_count || 0,
      total_active_ms: totalMs,
      last_session_ms: access.last_session_ms || 0,
      avg_session_ms: avgMs,
      total_active_label: formatDurationMs(totalMs),
      last_session_label: formatDurationMs(access.last_session_ms),
      avg_session_label: formatDurationMs(avgMs),
      sites,
      site_summary: sites
        .map((s) => `${s.brand} (${s.kind_label})`)
        .join(' · '),
      tracked,
    });
  }

  members.sort((a, b) => {
    const am = Date.parse(a.last_seen_at || '') || 0;
    const bm = Date.parse(b.last_seen_at || '') || 0;
    if (bm !== am) return bm - am;
    return Date.parse(b.signed_up_at || '') - Date.parse(a.signed_up_at || '');
  });

  let new7d = 0;
  let new30d = 0;
  let active24h = 0;
  let active7d = 0;
  let pwaLast = 0;
  let withSites = 0;
  let totalActive = 0;
  let sessioned = 0;
  let sessionMs = 0;

  for (const m of members) {
    if (m.signed_up_at && m.signed_up_at >= since7) new7d += 1;
    if (m.signed_up_at && m.signed_up_at >= since30) new30d += 1;
    if (m.last_seen_at && m.last_seen_at >= since24) active24h += 1;
    if (m.last_seen_at && m.last_seen_at >= since7) active7d += 1;
    if (m.last_display === 'standalone') pwaLast += 1;
    if (m.sites.length) withSites += 1;
    totalActive += m.total_active_ms;
    if (m.session_count > 0) {
      sessioned += 1;
      sessionMs += m.total_active_ms;
    }
  }

  return {
    at: new Date().toISOString(),
    note:
      'Duration is time in the app while the wallet is open (30-minute session gap). Older wallets show last profile activity until they open SA Member again.',
    summary: {
      total: members.length,
      new_7d: new7d,
      new_30d: new30d,
      active_24h: active24h,
      active_7d: active7d,
      pwa_last: pwaLast,
      with_sites: withSites,
      avg_session_ms: sessioned ? Math.round(sessionMs / sessioned) : 0,
      total_active_ms: totalActive,
    },
    members,
  };
}
