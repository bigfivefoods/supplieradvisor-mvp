/**
 * Single source of truth for company profile completeness.
 * Used by /api/business/profile, /api/business/summary, and /api/dashboard/summary
 * so the hub "My business, mastered" card matches the My Business sub-page and profile.
 */

export type CompletenessCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export type CompletenessResult = {
  pct: number;
  done: number;
  total: number;
  checks: CompletenessCheck[];
  /** Key → ok map for hub checklist UIs */
  map: Record<string, boolean>;
};

/**
 * Soft floor for directory / discover (was 60% — too strict; multi-company
 * workspaces rarely fill every hub field, so only 1 company appeared).
 * Full “strong” profiles still score higher; this is the minimum to show.
 */
export const DISCOVERABLE_MIN_COMPLETENESS_PCT = 25;

export function computeProfileCompleteness(
  p: Record<string, unknown> | null | undefined
): CompletenessResult {
  if (!p) {
    return { pct: 0, done: 0, total: 0, checks: [], map: {} };
  }

  const phone = p.phone || p.contact_phone || p.contact_number;
  const address = p.address || p.street;
  const description = p.description || p.short_description || p.about;
  const certs =
    (p.certifications as unknown[]) || (p.iso_certifications as unknown[]) || [];
  const industry =
    p.industry ||
    (Array.isArray(p.industries) ? (p.industries as unknown[])[0] : p.industries);

  const logo = p.logo_url;
  const bankOk = !!(p.account_number || p.bank_name);
  const verified =
    p.is_verified === true ||
    String(p.verification_status || '').toLowerCase() === 'verified';

  const checks: CompletenessCheck[] = [
    { key: 'trading_name', label: 'Trading name', ok: !!p.trading_name },
    { key: 'legal_name', label: 'Legal name', ok: !!p.legal_name },
    { key: 'email', label: 'Email', ok: !!p.email },
    { key: 'contact', label: 'Contact', ok: !!(p.contact_name || phone) },
    { key: 'contact_name', label: 'Contact name', ok: !!p.contact_name },
    { key: 'phone', label: 'Phone', ok: !!phone },
    { key: 'website', label: 'Website', ok: !!p.website },
    { key: 'industry', label: 'Industry', ok: !!industry },
    { key: 'location', label: 'Location', ok: !!(p.country && p.city) },
    { key: 'country', label: 'Country', ok: !!p.country },
    { key: 'city', label: 'City', ok: !!p.city },
    { key: 'address', label: 'Address', ok: !!address },
    {
      key: 'registration',
      label: 'Registration / VAT',
      ok: !!(p.registration_number || p.vat_number),
    },
    { key: 'description', label: 'Description', ok: !!description },
    {
      key: 'certs',
      label: 'Certifications',
      ok: Array.isArray(certs) && certs.length > 0,
    },
    { key: 'wallet', label: 'Wallet', ok: !!p.wallet_address },
    { key: 'logo', label: 'Logo', ok: !!logo },
    { key: 'banking', label: 'Banking', ok: bankOk },
    { key: 'verified', label: 'CIPC verified', ok: verified },
  ];

  // Hub checklist uses a stable subset (same keys as My Business overview historically)
  const hubKeys = [
    'trading_name',
    'legal_name',
    'email',
    'contact',
    'industry',
    'location',
    'address',
    'registration',
    'certs',
    'wallet',
    'logo',
  ] as const;

  const hubChecks = hubKeys.map((key) => {
    const found = checks.find((c) => c.key === key);
    return found || { key, label: key, ok: false };
  });

  const done = hubChecks.filter((c) => c.ok).length;
  const total = hubChecks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const map: Record<string, boolean> = {};
  for (const c of hubChecks) map[c.key] = c.ok;

  return {
    pct,
    done,
    total,
    // Full detailed checks for profile page
    checks,
    map,
  };
}

/**
 * Whether a company should appear in public directory / discover.
 *
 * Rules (lenient enough for real multi-company networks):
 *  1. Must have a trading or legal name
 *  2. Must not explicitly opt out (is_discoverable === false)
 *  3. Registered workspaces (active business_users) always qualify
 *  4. Else: completeness ≥ 25% OR has country / email / industry
 */
export function isEligibleForDiscovery(
  p: Record<string, unknown> | null | undefined,
  opts?: { isRegistered?: boolean }
): { ok: boolean; reason?: string; completeness: CompletenessResult } {
  const completeness = computeProfileCompleteness(p);
  if (!p) {
    return { ok: false, reason: 'No profile', completeness };
  }
  if (p.is_discoverable === false || p.is_discoverable === 'false') {
    return {
      ok: false,
      reason: 'Company opted out of discovery',
      completeness,
    };
  }

  const name = String(p.trading_name || p.legal_name || '').trim();
  if (name.length < 2) {
    return {
      ok: false,
      reason: 'Missing trading / legal name',
      completeness,
    };
  }

  // Active company workspaces always appear (unless opted out)
  if (opts?.isRegistered === true) {
    return { ok: true, completeness };
  }

  const hasCountry = !!String(p.country || '').trim();
  const hasEmail = !!String(p.email || '').trim();
  const industry =
    p.industry ||
    (Array.isArray(p.industries) ? (p.industries as unknown[])[0] : p.industries);
  const hasIndustry = !!industry;
  const hasSignal = hasCountry || hasEmail || hasIndustry;

  if (completeness.pct >= DISCOVERABLE_MIN_COMPLETENESS_PCT) {
    return { ok: true, completeness };
  }
  // Name + any real-world signal is enough to be findable
  if (hasSignal) {
    return { ok: true, completeness };
  }

  return {
    ok: false,
    reason: `Profile ${completeness.pct}% complete — add country, email, or industry (or reach ${DISCOVERABLE_MIN_COMPLETENESS_PCT}%+) to appear in search`,
    completeness,
  };
}

/** Detailed % using all profile-page fields (kept for profile page bar). */
export function computeDetailedCompleteness(
  p: Record<string, unknown> | null | undefined
): CompletenessResult {
  const base = computeProfileCompleteness(p);
  if (!p || base.checks.length === 0) return base;

  // Exclude composite keys already covered by atomic ones for the detailed bar
  const detailed = base.checks.filter(
    (c) => c.key !== 'contact' && c.key !== 'location'
  );
  const done = detailed.filter((c) => c.ok).length;
  const total = detailed.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const map: Record<string, boolean> = {};
  for (const c of detailed) map[c.key] = c.ok;

  return { pct, done, total, checks: detailed, map };
}
