/**
 * B2C profile persistence — platform_b2c_profiles with soft fallback.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import {
  newMembershipId,
  type B2cMembership,
  type B2cProfile,
} from '@/lib/b2c/types';

function emptyProfile(userId: string, email?: string | null): B2cProfile {
  return {
    user_id: userId,
    email: email || null,
    full_name: null,
    phone: null,
    photo_url: null,
    memberships: [],
    metadata: {},
  };
}

function rowToProfile(row: Record<string, unknown>): B2cProfile {
  const memberships = Array.isArray(row.memberships)
    ? (row.memberships as B2cMembership[])
    : [];
  return {
    user_id: String(row.user_id),
    email: row.email ? String(row.email) : null,
    full_name: row.full_name ? String(row.full_name) : null,
    phone: row.phone ? String(row.phone) : null,
    photo_url: row.photo_url ? String(row.photo_url) : null,
    memberships: memberships.filter((m) => m && m.active !== false),
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function loadB2cProfile(
  userId: string
): Promise<B2cProfile | null> {
  const canonical = getCanonicalUserId(userId);
  if (!canonical) return null;
  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(canonical);

  for (const id of variants) {
    const { data, error } = await supabase
      .from('platform_b2c_profiles')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();
    if (error) {
      if (
        error.message?.includes('platform_b2c_profiles') ||
        error.code === '42P01'
      ) {
        return null; // table not migrated yet
      }
      continue;
    }
    if (data) return rowToProfile(data as Record<string, unknown>);
  }
  return null;
}

export async function ensureB2cProfile(
  userId: string,
  opts?: { email?: string | null; full_name?: string | null; phone?: string | null }
): Promise<B2cProfile> {
  const canonical = getCanonicalUserId(userId)!;
  const existing = await loadB2cProfile(canonical);
  if (existing) {
    // Soft-update contact if empty
    let dirty = false;
    if (opts?.email && !existing.email) {
      existing.email = opts.email;
      dirty = true;
    }
    if (opts?.full_name && !existing.full_name) {
      existing.full_name = opts.full_name;
      dirty = true;
    }
    if (opts?.phone && !existing.phone) {
      existing.phone = opts.phone;
      dirty = true;
    }
    if (dirty) await saveB2cProfile(existing);
    return existing;
  }

  const profile = emptyProfile(canonical, opts?.email);
  if (opts?.full_name) profile.full_name = opts.full_name;
  if (opts?.phone) profile.phone = opts.phone;
  await saveB2cProfile(profile);
  return profile;
}

export async function saveB2cProfile(profile: B2cProfile): Promise<void> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const payload = {
    user_id: profile.user_id,
    email: profile.email || null,
    full_name: profile.full_name || null,
    phone: profile.phone || null,
    photo_url: profile.photo_url || null,
    memberships: profile.memberships || [],
    metadata: profile.metadata || {},
    updated_at: now,
    created_at: profile.created_at || now,
  };
  const { error } = await supabase
    .from('platform_b2c_profiles')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) {
    if (
      error.message?.includes('platform_b2c_profiles') ||
      error.code === '42P01'
    ) {
      throw new Error(
        'B2C profiles table missing — run migration 20260812_platform_b2c_profiles.sql'
      );
    }
    throw new Error(error.message);
  }
}

export function upsertMembership(
  profile: B2cProfile,
  membership: Omit<B2cMembership, 'id' | 'linked_at'> & {
    id?: string;
    linked_at?: string;
  }
): B2cProfile {
  const list = [...(profile.memberships || [])];
  const idx = list.findIndex(
    (m) =>
      m.kind === membership.kind &&
      m.company_id === membership.company_id &&
      m.ref_id === membership.ref_id
  );
  const now = new Date().toISOString();
  const row: B2cMembership = {
    id: membership.id || list[idx]?.id || newMembershipId(membership.kind),
    kind: membership.kind,
    company_id: membership.company_id,
    company_name: membership.company_name,
    brand: membership.brand,
    portal_token: membership.portal_token,
    portal_path: membership.portal_path,
    checkin_path: membership.checkin_path,
    ref_id: membership.ref_id,
    ref_label: membership.ref_label,
    email: membership.email,
    capabilities: membership.capabilities,
    linked_at: membership.linked_at || list[idx]?.linked_at || now,
    last_used_at: now,
    active: true,
  };
  if (idx >= 0) list[idx] = row;
  else list.unshift(row);
  return { ...profile, memberships: list };
}

export function removeMembership(
  profile: B2cProfile,
  membershipId: string
): B2cProfile {
  return {
    ...profile,
    memberships: (profile.memberships || []).map((m) =>
      m.id === membershipId ? { ...m, active: false } : m
    ),
  };
}
