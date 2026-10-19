/**
 * Company and user shape for the staging seed.
 * Median 8, minimum 5, and 5% of companies at 20 users cannot total 25000
 * users across 5000 companies. This generator follows that shape.
 * The 25000 and 100000 figures are recorded in the plan text and are not forced.
 */

export const COMPANY_COUNT = 5000;
export const LOW_COMPANIES = 2250;
export const MID_COMPANIES = 2500;
export const TAIL_COMPANIES = 250;
export const USERS_LOW = 5;
export const USERS_MID = 8;
export const USERS_TAIL = 20;
export const WHALE_COUNT = 4;
export const PEER_COUNT = 500;
export const WHALE_MULTIPLIER = 100;
export const S2_SCALE = 3;
export const S2_TAIL_MULTIPLIER = 10;

export const BASE_VOLUME = {
  customers: 200,
  products: 100,
  customer_invoices: 1200,
  purchase_orders: 500,
  journal_entries: 3000,
  journal_lines: 9000,
  bank_transactions: 2000,
  activity_log: 20000,
  stock_levels: 200,
};

/** Documented runnable shape. 500 companies and 2,500 users is 5 users each. */
export const SMALL_PRESET = {
  name: 'small',
  companies: 500,
  users: 2500,
  activityPerCompany: 20,
};

export const VOLUME_TABLES = Object.keys(BASE_VOLUME);

function parseCount(flag, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${flag} must be an integer from ${min} to ${max}`);
  }
  return value;
}

/**
 * Default (no preset, no flags) keeps the 5,000-company shape.
 * `--preset small` is 500 companies, 2,500 users, 20 activity rows per company.
 * An explicit flag wins over the preset.
 */
export function resolveSeedSize(input = {}) {
  const presetName = input.preset ? String(input.preset) : '';
  if (presetName && presetName !== SMALL_PRESET.name) throw new Error('preset must be small');
  const preset = presetName === SMALL_PRESET.name ? SMALL_PRESET : null;
  const companies = parseCount(
    'companies',
    input.companies ?? preset?.companies ?? COMPANY_COUNT,
    1,
    COMPANY_COUNT
  );
  const users =
    input.users == null && preset == null
      ? null
      : parseCount('users', input.users ?? preset.users, companies, companies * USERS_TAIL);
  const activityPerCompany =
    input.activityPerCompany == null && preset == null
      ? null
      : parseCount(
          'activity-per-company',
          input.activityPerCompany ?? preset.activityPerCompany,
          1,
          BASE_VOLUME.activity_log
        );
  return { preset: presetName, companies, users, activityPerCompany };
}

export function bucketCounts(companies = COMPANY_COUNT) {
  const tail = Math.round(companies * (TAIL_COMPANIES / COMPANY_COUNT));
  const low = Math.round(companies * (LOW_COMPANIES / COMPANY_COUNT));
  const mid = companies - low - tail;
  if (low < 0 || mid < 0 || tail < 0) throw new Error('company buckets do not fit');
  return { low, mid, tail };
}

export function peerCount(size = resolveSeedSize({})) {
  const resolved = size.companies ? size : resolveSeedSize(size);
  return Math.round(resolved.companies * (PEER_COUNT / COMPANY_COUNT));
}

export function usersForCompany(ordinal, size = resolveSeedSize({})) {
  const resolved = size.companies ? size : resolveSeedSize(size);
  if (resolved.users == null) {
    const { low, mid } = bucketCounts(resolved.companies);
    if (ordinal <= low) return USERS_LOW;
    if (ordinal <= low + mid) return USERS_MID;
    return USERS_TAIL;
  }
  const base = Math.floor(resolved.users / resolved.companies);
  const extra = resolved.users % resolved.companies;
  return base + (ordinal <= extra ? 1 : 0);
}

export function userCountSql(size = resolveSeedSize({})) {
  const resolved = size.companies ? size : resolveSeedSize(size);
  if (resolved.users == null) {
    const { low, mid } = bucketCounts(resolved.companies);
    return `CASE WHEN n <= ${low} THEN ${USERS_LOW} WHEN n <= ${low + mid} THEN ${USERS_MID} ELSE ${USERS_TAIL} END`;
  }
  const base = Math.floor(resolved.users / resolved.companies);
  const extra = resolved.users % resolved.companies;
  if (extra === 0) return String(base);
  return `${base} + CASE WHEN n <= ${extra} THEN 1 ELSE 0 END`;
}

export function userCounts(size = resolveSeedSize({})) {
  const resolved = size.companies ? size : resolveSeedSize(size);
  const counts = [];
  for (let n = 1; n <= resolved.companies; n += 1) counts.push(usersForCompany(n, resolved));
  return counts;
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function isWhale(ordinal) {
  return ordinal <= WHALE_COUNT;
}

export function isHeavyTail(ordinal) {
  return ordinal % 20 === 0;
}

export function volumeFor(table, ordinal, profile, size) {
  const base = BASE_VOLUME[table];
  if (base == null) throw new Error(`unknown table ${table}`);
  if (table === 'activity_log' && size && size.activityPerCompany != null) {
    return size.activityPerCompany;
  }
  if (isWhale(ordinal)) {
    const typical = profile === 's2' ? base * S2_SCALE : base;
    return typical * WHALE_MULTIPLIER;
  }
  if (profile === 's2' && isHeavyTail(ordinal)) return base * S2_TAIL_MULTIPLIER;
  if (profile === 's2') return base * S2_SCALE;
  return base;
}

export function moduleCount(ordinal) {
  return 3 + ((ordinal - 1) % 4);
}

export function moduleBytes(ordinal) {
  if (ordinal % 50 === 0) return 400 * 1024;
  if (ordinal % 10 === 0) return 50 * 1024;
  return 5 * 1024;
}

export function buildPlan(profile, sizeInput = {}) {
  if (profile !== 's1' && profile !== 's2') {
    throw new Error('profile must be s1 or s2');
  }
  const size = resolveSeedSize(sizeInput);
  const counts = userCounts(size);
  const tailCompanies = counts.filter((n) => n >= USERS_TAIL).length;
  const totals = {};
  for (const table of VOLUME_TABLES) {
    let sum = 0;
    for (let n = 1; n <= size.companies; n += 1) sum += volumeFor(table, n, profile, size);
    totals[table] = sum;
  }
  let heavyTail = 0;
  let moduleByteMedianBand = 0;
  for (let n = 1; n <= size.companies; n += 1) {
    if (!isWhale(n) && profile === 's2' && isHeavyTail(n)) heavyTail += 1;
    if (moduleBytes(n) === 5 * 1024) moduleByteMedianBand += 1;
  }
  return {
    profile,
    preset: size.preset,
    companies: size.companies,
    activityPerCompany: size.activityPerCompany,
    peers: peerCount(size),
    users: counts.reduce((sum, n) => sum + n, 0),
    medianUsers: median(counts),
    minUsers: Math.min(...counts),
    maxUsers: Math.max(...counts),
    tailCompanies,
    whales: WHALE_COUNT,
    heavyTailCompanies: profile === 's2' ? heavyTail : 0,
    pendingUsers: Math.floor(counts.reduce((sum, n) => sum + n, 0) / 20),
    totals,
    moduleByteMedianBand,
    statedUserTargets: { s1: 25000, s2: 100000 },
  };
}

export function formatPlan(plan) {
  const lines = [
    `profile ${plan.profile}`,
    ...(plan.preset ? [`preset ${plan.preset}`] : []),
    `companies ${plan.companies}`,
    `peers ${plan.peers}`,
    `users ${plan.users}`,
    `median_users ${plan.medianUsers}`,
    `min_users ${plan.minUsers}`,
    `max_users ${plan.maxUsers}`,
    `tail_companies ${plan.tailCompanies}`,
    `whales ${plan.whales}`,
    `heavy_tail_companies ${plan.heavyTailCompanies}`,
    `pending_users ${plan.pendingUsers}`,
    `emails @loadtest.invalid only`,
    `stated_s1_users ${plan.statedUserTargets.s1}`,
    `stated_s2_users ${plan.statedUserTargets.s2}`,
    plan.companies === COMPANY_COUNT && plan.medianUsers === 8 && plan.activityPerCompany == null
      ? 'note user shape is median 8, minimum 5, 5 percent at 20; that is not 25000 or 100000'
      : 'note size flags override the default company and user shape; other tables keep the per-company base, including whales',
    ...(plan.activityPerCompany != null ? [`activity_per_company ${plan.activityPerCompany}`] : []),
  ];
  for (const [table, total] of Object.entries(plan.totals)) {
    lines.push(`rows ${table} ${total}`);
  }
  lines.push('dry-run does not connect');
  return `${lines.join('\n')}\n`;
}
