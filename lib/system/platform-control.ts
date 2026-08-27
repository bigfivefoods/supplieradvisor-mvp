/**
 * Platform control plane — not shown as product marketing copy.
 *
 * Government department registration (DBE / PEU / DoH) and programme-module
 * assignment for those orgs require a platform operator identity.
 *
 * Configure via env PLATFORM_OPERATOR_EMAILS (comma-separated).
 * Empty when unset — never hard-code personal inboxes in the repo.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { userIdMatchVariants } from '@/lib/auth/identity';
import { GOVERNMENT_CORE_MODULE_IDS } from '@/lib/business/company-modules';

function parseEmailList(raw: string): string[] {
  return [
    ...new Set(
      String(raw || '')
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((e) => e.includes('@'))
    ),
  ];
}

/**
 * Platform operators from env only (PLATFORM_OPERATOR_EMAILS).
 * Empty when unset — never hard-code personal inboxes in the repo.
 */
export function platformOperatorEmails(): string[] {
  return parseEmailList(process.env.PLATFORM_OPERATOR_EMAILS || '');
}

/** Designated platform-company owners from env PLATFORM_OWNER_EMAILS (falls back to operator list). */
export function platformOwnerEmails(): string[] {
  const owners = parseEmailList(process.env.PLATFORM_OWNER_EMAILS || '');
  if (owners.length) return owners;
  return platformOperatorEmails();
}

export function isPlatformOperatorEmail(
  email?: string | null
): boolean {
  if (!email) return false;
  const e = String(email).trim().toLowerCase();
  return platformOperatorEmails().includes(e);
}

/**
 * Resolve whether this Privy user is a platform operator (by membership emails).
 */
export async function isPlatformOperatorUserId(
  userId?: string | null
): Promise<boolean> {
  if (!userId) return false;
  const emails = await resolveEmailsForUserId(userId);
  return emails.some((e) => isPlatformOperatorEmail(e));
}

function dbForIdentity() {
  // Prefer service role so Privy-only sessions still resolve emails under RLS
  try {
    return getSupabaseAdmin();
  } catch {
    return getSupabaseServer();
  }
}

export async function resolveEmailsForUserId(
  userId: string
): Promise<string[]> {
  try {
    const supabase = dbForIdentity();
    const variants = userIdMatchVariants(userId);
    const out = new Set<string>();

    const { data } = await supabase
      .from('business_users')
      .select('email, invited_email')
      .in('user_id', variants)
      .limit(40);
    for (const row of data || []) {
      if (row.email) out.add(String(row.email).toLowerCase());
      if (row.invited_email) out.add(String(row.invited_email).toLowerCase());
    }

    // Also pick up emails on profiles owned by this user
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('user_id', variants)
        .limit(20);
      for (const p of profiles || []) {
        if (p.email) out.add(String(p.email).toLowerCase());
      }
    } catch {
      /* soft */
    }

    return [...out];
  } catch {
    return [];
  }
}

/** Org types that are governmental programme departments */
export function isGovernmentOrgType(
  orgType?: string | null,
  businessType?: string | null
): boolean {
  const t = `${orgType || ''} ${businessType || ''}`.toLowerCase();
  return (
    t.includes('government_education') ||
    t.includes('government_health') ||
    t.includes('government') ||
    t === 'dbe' ||
    t === 'peu' ||
    t === 'doh' ||
    t.includes('department_of_health')
  );
}

/**
 * Education department agency types available for self-registration.
 * (No generic "other government" — only education programme offices.)
 */
export const PUBLIC_EDUCATION_AGENCY_TYPES = [
  'dbe',
  'peu',
  'provincial_nsnp',
  'district',
] as const;

/**
 * Health department agency types available for self-registration.
 */
export const PUBLIC_HEALTH_AGENCY_TYPES = [
  'department_of_health',
  'provincial_health',
] as const;

/** Modules a government education org may enable (plus always-on). */
export const GOV_EDUCATION_MODULE_IDS = [
  ...GOVERNMENT_CORE_MODULE_IDS,
  'schools',
] as const;

/** Modules a government health org may enable (plus always-on). */
export const GOV_HEALTH_MODULE_IDS = [
  ...GOVERNMENT_CORE_MODULE_IDS,
  'health',
] as const;

export function allowedModulesForGovernment(
  kind: 'education' | 'health'
): string[] {
  return kind === 'health'
    ? [...GOV_HEALTH_MODULE_IDS]
    : [...GOV_EDUCATION_MODULE_IDS];
}

/**
 * Clamp enabled_modules for government orgs:
 *  - programme vertical (schools XOR health) stays on
 *  - Core OS hubs (Finance, Inventory, People, …) keep the company's ticks
 *  - other industry Advisors stay off
 */
export function clampGovernmentModules(
  map: Record<string, boolean>,
  kind: 'education' | 'health'
): Record<string, boolean> {
  const allowed = new Set([
    'home',
    'my-business',
    'guide',
    ...allowedModulesForGovernment(kind),
  ]);
  const next: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(map || {})) {
    if (allowed.has(k)) next[k] = Boolean(v);
    else next[k] = false;
  }
  if (kind === 'health') {
    next.health = true;
    next.schools = false;
  } else {
    next.schools = true;
    next.health = false;
  }
  next.home = true;
  next['my-business'] = true;
  next.guide = true;
  return next;
}

/** User-facing message — never list operator emails. */
export const GOV_PENDING_MESSAGE =
  'This department registration is pending platform activation. Programme tools unlock after approval.';

export const GOV_MODULE_LOCK_MESSAGE =
  'Public-sector packaging stays government process (SchoolAdvisor / Health) and cannot be switched to a private company here. You can still turn on Core OS hubs such as Finance.';
