/**
 * Platform control plane — not shown as product marketing copy.
 *
 * Government department registration (DBE / PEU / DoH) and programme-module
 * assignment for those orgs require a platform operator identity.
 *
 * Configure via env PLATFORM_OPERATOR_EMAILS (comma-separated). Defaults are
 * used when unset so production operators can work without redeploying secrets.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { userIdMatchVariants } from '@/lib/auth/identity';

/** Default operators — override with PLATFORM_OPERATOR_EMAILS in env. */
const DEFAULT_OPERATOR_EMAILS = [
  'craig@bigfivefoods.com',
  'craig@bigfivegroup.africa',
  'craig@supplieradvisor.com',
];

export function platformOperatorEmails(): string[] {
  const raw = process.env.PLATFORM_OPERATOR_EMAILS || '';
  const fromEnv = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const list = fromEnv.length ? fromEnv : DEFAULT_OPERATOR_EMAILS;
  return [...new Set(list)];
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

export async function resolveEmailsForUserId(
  userId: string
): Promise<string[]> {
  try {
    const supabase = getSupabaseServer();
    const variants = userIdMatchVariants(userId);
    const { data } = await supabase
      .from('business_users')
      .select('email, invited_email')
      .in('user_id', variants)
      .limit(20);
    const out = new Set<string>();
    for (const row of data || []) {
      if (row.email) out.add(String(row.email).toLowerCase());
      if (row.invited_email) out.add(String(row.invited_email).toLowerCase());
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
  'schools',
  'network',
  'intelligence',
  'suppliers',
] as const;

/** Modules a government health org may enable (plus always-on). */
export const GOV_HEALTH_MODULE_IDS = [
  'health',
  'network',
  'intelligence',
  'suppliers',
] as const;

export function allowedModulesForGovernment(
  kind: 'education' | 'health'
): string[] {
  return kind === 'health'
    ? [...GOV_HEALTH_MODULE_IDS]
    : [...GOV_EDUCATION_MODULE_IDS];
}

/**
 * Clamp enabled_modules map for government orgs so only programme modules
 * (education OR health) plus always-on can be on.
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
  for (const [k, v] of Object.entries(map)) {
    if (allowed.has(k)) next[k] = Boolean(v);
    else next[k] = false;
  }
  // Ensure programme module is on
  if (kind === 'health') next.health = true;
  else next.schools = true;
  next.home = true;
  next['my-business'] = true;
  next.guide = true;
  return next;
}

/** User-facing message — never list operator emails. */
export const GOV_PENDING_MESSAGE =
  'This department registration is pending platform activation. Programme tools unlock after approval.';

export const GOV_MODULE_LOCK_MESSAGE =
  'Programme modules for government departments are managed centrally and cannot be changed here.';
