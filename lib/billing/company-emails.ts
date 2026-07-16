/**
 * Resolve outbound emails for a company profile.
 * profiles.contact_email is NOT a real column in prod — use email + team members only.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

const DEFAULT_ROLES = [
  'owner',
  'admin',
  'operations',
  'ops',
  'sales',
  'finance',
] as const;

/**
 * Collect unique valid emails for a company.
 * Never selects non-existent profile columns (avoids PostgREST 400 on contact_email).
 */
export async function resolveCompanyEmails(
  profileId: number,
  opts?: {
    /** Also include invited_email on team rows */
    includeInvited?: boolean;
    roleAllowlist?: string[];
    limit?: number;
  }
): Promise<{ emails: string[]; tradingName: string | null }> {
  const supabase = getSupabaseServer();
  const emails = new Set<string>();
  let tradingName: string | null = null;
  const limit = opts?.limit ?? 10;
  const roles = (opts?.roleAllowlist || [...DEFAULT_ROLES]).map((r) =>
    r.toLowerCase()
  );
  const includeInvited = opts?.includeInvited !== false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, trading_name')
    .eq('id', profileId)
    .maybeSingle();

  if (profile?.trading_name) tradingName = String(profile.trading_name);
  if (profile?.email && String(profile.email).includes('@')) {
    emails.add(String(profile.email).toLowerCase());
  }

  const { data: members } = await supabase
    .from('business_users')
    .select('email, invited_email, role, status')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .limit(20);

  for (const m of members || []) {
    const role = String(m.role || '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (roles.includes(role) || !role) {
      if (m.email && String(m.email).includes('@')) {
        emails.add(String(m.email).toLowerCase());
      }
      if (
        includeInvited &&
        m.invited_email &&
        String(m.invited_email).includes('@')
      ) {
        emails.add(String(m.invited_email).toLowerCase());
      }
    }
  }

  return {
    emails: [...emails].slice(0, limit),
    tradingName,
  };
}

/** First usable email for single-recipient sends (trial/expiry). */
export async function resolvePrimaryCompanyEmail(
  profileId: number,
  profileEmail?: string | null
): Promise<string | null> {
  if (profileEmail && String(profileEmail).includes('@')) {
    return String(profileEmail).toLowerCase();
  }
  const { emails } = await resolveCompanyEmails(profileId, { limit: 1 });
  return emails[0] || null;
}
