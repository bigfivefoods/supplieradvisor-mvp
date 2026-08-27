/**
 * SupplierAdvisor platform company — admin & management console for the whole OS.
 *
 * This is not a normal tenant: it is the control plane company on supplieradvisor.com.
 * Owners (by email) can open system reports, management reports, and ops tooling.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { userIdMatchVariants } from '@/lib/auth/identity';
import {
  isPlatformOperatorEmail,
  isPlatformOperatorUserId,
  platformOwnerEmails,
  resolveEmailsForUserId,
} from '@/lib/system/platform-control';

export { platformOwnerEmails };
import { LIFETIME_PLAN_FOUNDER } from '@/lib/billing/lifetime';
import { MODULE_NAV } from '@/lib/chrome/module-nav';

/** Canonical trading name */
export const PLATFORM_COMPANY_TRADING_NAME = 'SupplierAdvisor';

/** Legal name stored on the profile */
export const PLATFORM_COMPANY_LEGAL_NAME = 'SupplierAdvisor (Pty) Ltd';

/** Metadata flag — single source of truth for detection */
export const PLATFORM_COMPANY_META_FLAG = 'is_platform_company';

/** Stable slug in metadata */
export const PLATFORM_COMPANY_SLUG = 'supplieradvisor';

/**
 * @deprecated Use platformOwnerEmails() — env PLATFORM_OWNER_EMAILS only.
 * Empty array kept so JSON fields do not leak personal inboxes from git.
 */
export const PLATFORM_OWNER_EMAILS: readonly string[] = [];

export type PlatformCompanyRow = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
  subscription_status: string | null;
  created_at: string | null;
};

export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = String(email).trim().toLowerCase();
  return platformOwnerEmails().includes(e);
}

export function allPlatformOwnerEmails(): string[] {
  return platformOwnerEmails();
}

export function isPlatformCompanyMetadata(
  metadata: unknown
): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }
  const m = metadata as Record<string, unknown>;
  return (
    m[PLATFORM_COMPANY_META_FLAG] === true ||
    m.platform_console === true ||
    String(m.slug || '').toLowerCase() === PLATFORM_COMPANY_SLUG
  );
}

export function isPlatformCompanyProfile(row: {
  trading_name?: string | null;
  legal_name?: string | null;
  metadata?: unknown;
}): boolean {
  if (isPlatformCompanyMetadata(row.metadata)) return true;
  const t = String(row.trading_name || '').trim();
  const l = String(row.legal_name || '').trim();
  return (
    /^supplier\s*advisor$/i.test(t) ||
    /^supplieradvisor$/i.test(t.replace(/\s+/g, '')) ||
    /^supplier\s*advisor/i.test(l)
  );
}

function adminOrServer(): SupabaseClient {
  try {
    return getSupabaseAdmin();
  } catch {
    return getSupabaseServer();
  }
}

/** Mutations must use service role when available (Privy auth has no Supabase session). */
function adminForWrite(): SupabaseClient {
  try {
    return getSupabaseAdmin();
  } catch (e) {
    console.error(
      '[platform-company] SUPABASE_SERVICE_ROLE_KEY required to create platform company'
    );
    throw e instanceof Error
      ? e
      : new Error('SUPABASE_SERVICE_ROLE_KEY required for platform company');
  }
}

/** Find existing SupplierAdvisor platform company, if any. */
export async function findPlatformCompany(
  supabase?: SupabaseClient
): Promise<PlatformCompanyRow | null> {
  const db = supabase || adminOrServer();

  // Prefer metadata flag
  try {
    const { data } = await db
      .from('profiles')
      .select(
        'id, trading_name, legal_name, email, metadata, subscription_status, created_at'
      )
      .contains('metadata', { [PLATFORM_COMPANY_META_FLAG]: true })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      return data as PlatformCompanyRow;
    }
  } catch {
    /* metadata contains may fail on some plans — fall through */
  }

  // Name match
  const { data: byName } = await db
    .from('profiles')
    .select(
      'id, trading_name, legal_name, email, metadata, subscription_status, created_at'
    )
    .or(
      `trading_name.ilike.SupplierAdvisor,trading_name.ilike.Supplier Advisor,legal_name.ilike.SupplierAdvisor%`
    )
    .order('id', { ascending: true })
    .limit(8);

  for (const row of byName || []) {
    if (isPlatformCompanyProfile(row)) {
      return row as PlatformCompanyRow;
    }
  }
  return null;
}

function platformEnabledModules(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const m of MODULE_NAV) {
    map[m.id] = true;
  }
  map.platform = true;
  map.home = true;
  map['my-business'] = true;
  map.guide = true;
  return map;
}

function platformMetadataBlob(
  existing?: Record<string, unknown> | null
): Record<string, unknown> {
  const prev = existing && typeof existing === 'object' ? { ...existing } : {};
  return {
    ...prev,
    [PLATFORM_COMPANY_META_FLAG]: true,
    platform_console: true,
    slug: PLATFORM_COMPANY_SLUG,
    platform_role: 'control_plane',
    owner_emails: allPlatformOwnerEmails(),
    enabled_modules: {
      ...(typeof prev.enabled_modules === 'object' &&
      prev.enabled_modules &&
      !Array.isArray(prev.enabled_modules)
        ? (prev.enabled_modules as Record<string, boolean>)
        : {}),
      ...platformEnabledModules(),
    },
  };
}

/**
 * Ensure the SupplierAdvisor platform company exists and designated owners
 * are attached when their user accounts already exist.
 */
export async function ensurePlatformCompany(opts?: {
  userId?: string | null;
  jwtEmails?: string[] | null;
}): Promise<{
  company: PlatformCompanyRow;
  created: boolean;
  ownersAttached: string[];
}> {
  const db = adminForWrite();
  const now = new Date().toISOString();
  let created = false;
  let company = await findPlatformCompany(db);

  if (!company) {
    // Only columns that exist on production profiles (no contact_email, etc.)
    const baseInsert: Record<string, unknown> = {
      trading_name: PLATFORM_COMPANY_TRADING_NAME,
      legal_name: PLATFORM_COMPANY_LEGAL_NAME,
      industry: 'Software · platform operations',
      business_type: 'platform',
      org_type: 'platform',
      relationship_type: 'platform',
      country: 'South Africa',
      city: 'Cape Town',
      website: 'https://www.supplieradvisor.com',
      email: allPlatformOwnerEmails()[0] || 'hello@supplieradvisor.com',
      contact_name: 'Craig',
      short_description:
        'SupplierAdvisor® platform control plane — system administration, management reports, and ops console for the entire network.',
      supplier_status: 'active',
      is_discoverable: false,
      verification_status: 'verified',
      subscription_status: 'lifetime',
      subscription_plan: LIFETIME_PLAN_FOUNDER,
      subscription_starts_at: now,
      claimed_at: now,
      created_at: now,
      updated_at: now,
      metadata: platformMetadataBlob(null),
    };
    if (opts?.userId) baseInsert.user_id = opts.userId;

    const selectCols =
      'id, trading_name, legal_name, email, metadata, subscription_status, created_at';

    let inserted: PlatformCompanyRow | null = null;
    let lastError: { message?: string } | null = null;

    // Progressive strip of optional columns if schema cache rejects any field
    const optionalKeys = [
      'relationship_type',
      'short_description',
      'is_discoverable',
      'subscription_plan',
      'subscription_starts_at',
      'claimed_at',
      'verification_status',
      'industry',
      'city',
      'website',
      'contact_name',
      'org_type',
    ];
    let attempt: Record<string, unknown> = { ...baseInsert };
    for (let i = 0; i < optionalKeys.length + 2; i++) {
      const { data, error } = await db
        .from('profiles')
        .insert(attempt)
        .select(selectCols)
        .single();
      if (!error && data) {
        inserted = data as PlatformCompanyRow;
        break;
      }
      lastError = error;
      const msg = error?.message || '';
      // Race: another request created it
      company = await findPlatformCompany(db);
      if (company) break;

      const colMatch = msg.match(
        /Could not find the '([^']+)' column/i
      ) || msg.match(/column ["']?(\w+)["']? of relation/i);
      if (colMatch?.[1] && colMatch[1] in attempt) {
        delete attempt[colMatch[1]];
        continue;
      }
      // Drop next optional key if schema error is vague
      if (/column|schema cache|PGRST204/i.test(msg) && optionalKeys.length) {
        const drop = optionalKeys.shift();
        if (drop && drop in attempt) {
          delete attempt[drop];
          continue;
        }
      }
      break;
    }

    if (!company && inserted) {
      company = inserted;
      created = true;
    } else if (!company) {
      company = await findPlatformCompany(db);
      if (!company) {
        throw new Error(
          lastError?.message ||
            'Failed to create SupplierAdvisor platform company'
        );
      }
    }
  } else {
    // Refresh flags / modules without clobbering the owner-edited profile.
    // Trading / legal name used to be forced back to "SupplierAdvisor" on every
    // /api/me/companies load, so Company → Profile saves never stuck.
    const meta = platformMetadataBlob(
      company.metadata as Record<string, unknown> | null
    );
    const updatePayload: Record<string, unknown> = {
      is_discoverable: false,
      relationship_type: 'platform',
      org_type: 'platform',
      business_type: 'platform',
      subscription_status: 'lifetime',
      subscription_plan: LIFETIME_PLAN_FOUNDER,
      metadata: meta,
      updated_at: now,
    };
    if (!String(company.trading_name || '').trim()) {
      updatePayload.trading_name = PLATFORM_COMPANY_TRADING_NAME;
    }
    if (!String(company.legal_name || '').trim()) {
      updatePayload.legal_name = PLATFORM_COMPANY_LEGAL_NAME;
    }
    let { error: upErr } = await db
      .from('profiles')
      .update(updatePayload)
      .eq('id', company.id);
    // Strip unknown columns on schema mismatch
    while (
      upErr &&
      /Could not find the '([^']+)' column/i.test(upErr.message || '')
    ) {
      const m = (upErr.message || '').match(
        /Could not find the '([^']+)' column/i
      );
      if (!m?.[1] || !(m[1] in updatePayload)) break;
      delete updatePayload[m[1]];
      const retry = await db
        .from('profiles')
        .update(updatePayload)
        .eq('id', company.id);
      upErr = retry.error;
    }

    const refreshed = await findPlatformCompany(db);
    if (refreshed) company = refreshed;
  }

  const ownersAttached = await attachPlatformOwners(db, company.id, {
    userId: opts?.userId,
    jwtEmails: opts?.jwtEmails,
  });

  return { company, created, ownersAttached };
}

/**
 * Attach owner memberships for designated emails (and current user if owner).
 */
export async function attachPlatformOwners(
  supabase: SupabaseClient,
  profileId: number,
  opts?: {
    userId?: string | null;
    /** Emails from the verified Privy JWT only — never a client body list. */
    jwtEmails?: string[] | null;
  }
): Promise<string[]> {
  const now = new Date().toISOString();
  const attached: string[] = [];
  const ownerEmails = allPlatformOwnerEmails();

  if (opts?.userId) {
    const jwtEmails = (opts.jwtEmails || [])
      .map((e) => String(e || '').trim().toLowerCase())
      .filter((e) => e.includes('@'));
    const stored = await resolveEmailsForUserId(opts.userId);
    const emails = [...new Set([...jwtEmails, ...stored])];
    const match =
      emails.find((e) => isPlatformOwnerEmail(e) || isPlatformOperatorEmail(e)) ||
      null;

    if (match || (await isPlatformOperatorUserId(opts.userId))) {
      const email = match || emails[0] || ownerEmails[0] || '';
      if (email) {
        await upsertOwnerMembership(supabase, {
          profileId,
          userId: opts.userId,
          email,
          now,
        });
        if (!attached.includes(email)) attached.push(email);
      }
    }
  }

  // Promote any existing memberships that use owner emails
  for (const email of ownerEmails) {
    const { data: rows } = await supabase
      .from('business_users')
      .select('id, user_id, email, invited_email, role, status')
      .or(`email.eq.${email},invited_email.eq.${email}`)
      .limit(20);

    for (const row of rows || []) {
      if (!row.user_id) continue;
      await upsertOwnerMembership(supabase, {
        profileId,
        userId: String(row.user_id),
        email,
        now,
      });
      if (!attached.includes(email)) attached.push(email);
    }
  }

  return attached;
}

async function upsertOwnerMembership(
  supabase: SupabaseClient,
  opts: {
    profileId: number;
    userId: string;
    email: string;
    now: string;
  }
) {
  const variants = userIdMatchVariants(opts.userId);
  const email = String(opts.email || '').toLowerCase().trim();

  // Match by user_id OR by owner email already on this profile
  const { data: existingRows } = await supabase
    .from('business_users')
    .select('id, role, status, user_id, email')
    .eq('profile_id', opts.profileId)
    .limit(50);

  const existing =
    (existingRows || []).find((r) =>
      variants.includes(String(r.user_id || ''))
    ) ||
    (existingRows || []).find(
      (r) =>
        String(r.email || '').toLowerCase() === email ||
        String((r as { invited_email?: string }).invited_email || '')
          .toLowerCase() === email
    );

  if (existing?.id) {
    const existingUid = String(existing.user_id || '').trim();
    if (existingUid && !variants.includes(existingUid)) {
      console.warn(
        '[platform-company] skip membership rewrite — row belongs to another user',
        existing.id
      );
      return;
    }
    const { error: upErr } = await supabase
      .from('business_users')
      .update({
        user_id: opts.userId,
        role: 'owner',
        status: 'active',
        email: email || existing.email,
        name: 'Platform owner',
        joined_at: opts.now,
        updated_at: opts.now,
      })
      .eq('id', existing.id);
    if (upErr) {
      console.warn(
        '[platform-company] membership update soft-fail',
        upErr.message
      );
    }
    return;
  }

  const row: Record<string, unknown> = {
    user_id: opts.userId,
    profile_id: opts.profileId,
    role: 'owner',
    status: 'active',
    email: email || null,
    name: 'Platform owner',
    joined_at: opts.now,
    created_at: opts.now,
  };

  let { error } = await supabase.from('business_users').insert(row);
  if (error && /joined_at|created_at|updated_at|name|column/i.test(error.message || '')) {
    // Minimal insert — some environments lack optional columns
    const retry = await supabase.from('business_users').insert({
      user_id: opts.userId,
      profile_id: opts.profileId,
      role: 'owner',
      status: 'active',
      email: email || null,
    });
    error = retry.error;
  }
  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      // Race: promote any row that just appeared
      await supabase
        .from('business_users')
        .update({
          user_id: opts.userId,
          role: 'owner',
          status: 'active',
          email: email || null,
        })
        .eq('profile_id', opts.profileId)
        .in('user_id', variants);
      return;
    }
    console.error(
      '[platform-company] membership insert failed',
      error.message,
      { profileId: opts.profileId, email, userId: opts.userId }
    );
    throw new Error(`Platform membership failed: ${error.message}`);
  }
}

/** User may open the platform admin console. */
export async function canAccessPlatformConsole(
  userId?: string | null
): Promise<{
  ok: boolean;
  via: 'operator' | 'owner' | null;
  companyId: number | null;
}> {
  if (!userId) return { ok: false, via: null, companyId: null };

  const company = await findPlatformCompany();
  const companyId = company?.id ?? null;

  if (await isPlatformOperatorUserId(userId)) {
    return { ok: true, via: 'operator', companyId };
  }

  if (companyId) {
    const db = adminOrServer();
    const variants = userIdMatchVariants(userId);
    const { data: mem } = await db
      .from('business_users')
      .select('role, status, email, invited_email')
      .eq('profile_id', companyId)
      .in('user_id', variants)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (
      mem &&
      (mem.role === 'owner' || mem.role === 'admin')
    ) {
      return { ok: true, via: 'owner', companyId };
    }
    // Email-based owner even before membership if they have the email on any membership
    const emails = await resolveEmailsForUserId(userId);
    if (emails.some((e) => isPlatformOwnerEmail(e))) {
      return { ok: true, via: 'owner', companyId };
    }
  } else {
    const emails = await resolveEmailsForUserId(userId);
    if (emails.some((e) => isPlatformOwnerEmail(e))) {
      return { ok: true, via: 'owner', companyId: null };
    }
  }

  return { ok: false, via: null, companyId };
}
