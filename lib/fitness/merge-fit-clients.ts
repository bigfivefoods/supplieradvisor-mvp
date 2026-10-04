/**
 * Merge duplicate gym members, keeping every field and retargeting
 * subscriptions, bookings, goals, messages, and portal tokens.
 */
import type {
  FitBooking,
  FitClient,
  FitSubscription,
  FitgraphStore,
} from '@/lib/fitness/fitgraph';
import { rememberRemovedFitgraphIds } from '@/lib/fitness/fitgraph-merge';

const WEAK_NAME_TOKENS = new Set([
  'van',
  'von',
  'de',
  'den',
  'der',
  'du',
  'da',
  'di',
  'le',
  'la',
  'the',
  'of',
  'and',
  'st',
  'mc',
  'mac',
  'was',
  'member',
  'previously',
  'wanted',
  'join',
  'again',
  'returning',
  'client',
  'saw',
  'driving',
  'it',
  'literally',
  'did',
  'come',
  'me',
  'in',
  'dream',
  'friend',
  'facebook',
  'instagram',
  'google',
  'heard',
  'about',
]);

export function foldPersonName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '');
}

export function normalizePersonName(name: string): string {
  return foldPersonName(name)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function personNameTokens(name: string): string[] {
  return foldPersonName(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function strongNameTokens(name: string): string[] {
  return personNameTokens(name).filter(
    (t) => t.length > 1 && !WEAK_NAME_TOKENS.has(t)
  );
}

function digits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function emailKey(value?: string | null): string {
  const e = String(value || '').trim().toLowerCase();
  return e.includes('@') ? e : '';
}

function phoneKey(value?: string | null): string {
  const d = digits(value);
  if (d.length < 9) return '';
  return d.slice(-9);
}

function accountKey(c: FitClient): string {
  const d = digits(c.debit_bank?.account_number);
  return d.length >= 8 ? d : '';
}

function saIdKey(value?: string | null): string {
  const d = digits(value);
  return d.length === 13 ? d : '';
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  let prev = Array.from({ length: short.length + 1 }, (_, i) => i);
  for (let j = 1; j <= long.length; j++) {
    const cur = [j];
    for (let i = 1; i <= short.length; i++) {
      cur[i] =
        short[i - 1] === long[j - 1]
          ? prev[i - 1]
          : 1 + Math.min(prev[i - 1], prev[i], cur[i - 1]);
    }
    prev = cur;
  }
  return prev[short.length];
}

function namesLookLikeSamePerson(aName: string, bName: string): boolean {
  const na = normalizePersonName(aName);
  const nb = normalizePersonName(bName);
  if (na && na === nb && na.split(' ').length >= 2) return true;
  const sa = strongNameTokens(aName);
  const sb = strongNameTokens(bName);
  if (sa.length < 2 || sb.length < 2) return false;
  const [short, long] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  if (short.every((t) => long.includes(t))) return true;
  const firstA = sa[0];
  const firstB = sb[0];
  const lastA = sa[sa.length - 1];
  const lastB = sb[sb.length - 1];
  if (firstA === firstB && lastA === lastB) return true;
  if (
    firstA === firstB &&
    Math.min(lastA.length, lastB.length) >= 5 &&
    editDistance(lastA, lastB) <= 1
  ) {
    return true;
  }
  if (
    lastA === lastB &&
    Math.min(firstA.length, firstB.length) >= 4 &&
    (firstA.startsWith(firstB) || firstB.startsWith(firstA))
  ) {
    return true;
  }
  if (
    lastA === lastB &&
    Math.min(firstA.length, firstB.length) >= 6 &&
    editDistance(firstA, firstB) <= 1
  ) {
    return true;
  }
  return false;
}

export function clientsAreSamePerson(a: FitClient, b: FitClient): boolean {
  if (a.id === b.id) return true;
  const ida = saIdKey(a.id_number);
  const idb = saIdKey(b.id_number);
  if (ida && idb) return ida === idb;
  const ea = emailKey(a.email);
  const eb = emailKey(b.email);
  if (ea && eb && ea !== eb) return false;
  if (ea && ea === eb) return true;
  const pa = phoneKey(a.phone);
  const pb = phoneKey(b.phone);
  if (pa && pb && pa !== pb) return false;
  if (pa && pa === pb) return true;
  const aa = accountKey(a);
  const ab = accountKey(b);
  if (aa && ab && aa !== ab) return false;
  if (aa && aa === ab) return true;
  return namesLookLikeSamePerson(a.name, b.name);
}

function pickText(
  a?: string | null,
  b?: string | null
): string | undefined {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x) return y || undefined;
  if (!y || x === y) return x || undefined;
  if (y.includes(x)) return y;
  if (x.includes(y)) return x;
  return x;
}

function joinText(
  a?: string | null,
  b?: string | null
): string | undefined {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x) return y || undefined;
  if (!y || x === y || x.includes(y)) return x;
  if (y.includes(x)) return y;
  return `${x} · ${y}`;
}

function preferDate(a?: string | null, b?: string | null, mode: 'min' | 'max' = 'min') {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x) return y || undefined;
  if (!y) return x;
  if (mode === 'max') return x >= y ? x : y;
  return x <= y ? x : y;
}

function uniqBy<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = keyFn(row);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

function displayNameScore(name: string, preferred: Set<string>): number {
  const norm = normalizePersonName(name);
  const tokens = personNameTokens(name);
  const strong = strongNameTokens(name);
  let score = Math.min(strong.length, 4) * 10;
  score -= Math.max(0, tokens.length - 4) * 8;
  if (preferred.has(norm)) score += 80;
  return score;
}

function keeperScore(c: FitClient, preferred: Set<string>): number {
  let s = displayNameScore(c.name, preferred);
  s += (c.contracts || []).length * 20;
  if (c.debit_bank?.account_number) s += 40;
  if (saIdKey(c.id_number)) s += 30;
  if (c.portal_token) s += 25;
  if (c.platform_user_id) s += 25;
  if (c.photo_url) s += 15;
  if (emailKey(c.email)) s += 12;
  if (phoneKey(c.phone)) s += 8;
  if (c.passport) s += 10;
  if (c.identity) s += 10;
  if (c.health) s += 6;
  if (c.family?.length) s += 6;
  if (c.active !== false) s += 18;
  const st = String(c.membership_status || 'active');
  if (st !== 'expired' && st !== 'cancelled' && st !== 'merged') s += 8;
  if (String(c.id).startsWith('vuka_cli_')) s += 4;
  return s;
}

function pickKeeper(group: FitClient[], preferred: Set<string>): FitClient {
  return [...group].sort((a, b) => {
    const d = keeperScore(b, preferred) - keeperScore(a, preferred);
    if (d) return d;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  })[0];
}

function mergeFamily(a: FitClient['family'], b: FitClient['family']) {
  return uniqBy([...(a || []), ...(b || [])], (m) => {
    if (m.id) return `id:${m.id}`;
    return `nm:${normalizePersonName(m.name)}|${m.relationship || ''}`;
  });
}

function mergeContracts(a: FitClient, b: FitClient) {
  return uniqBy([...(a.contracts || []), ...(b.contracts || [])], (c) => {
    if (c.source_id) return `src:${c.source_id}`;
    if (c.id) return `id:${c.id}`;
    return `at:${c.submitted_at || ''}|${c.kind}|${c.debit_amount_zar || ''}`;
  }).slice(-20);
}

function mergeJoinEvents(a: FitClient, b: FitClient) {
  return uniqBy([...(a.join_events || []), ...(b.join_events || [])], (e) => {
    if (e.id) return `id:${e.id}`;
    return `${e.kind}|${e.at}|${e.title}`;
  });
}

function mergeClientRecord(
  keeper: FitClient,
  donor: FitClient,
  preferred: Set<string>
): FitClient {
  const next: FitClient = { ...keeper };
  const names = [keeper.name, donor.name].filter(Boolean);
  next.name = [...names].sort(
    (x, y) => displayNameScore(y, preferred) - displayNameScore(x, preferred)
  )[0] || keeper.name;
  next.email = pickText(keeper.email, donor.email);
  next.phone = pickText(keeper.phone, donor.phone);
  next.id_number = pickText(keeper.id_number, donor.id_number);
  next.photo_url = pickText(keeper.photo_url, donor.photo_url);
  next.occupation = pickText(keeper.occupation, donor.occupation);
  next.heard_about = pickText(keeper.heard_about, donor.heard_about);
  next.employer_student_number = pickText(
    keeper.employer_student_number,
    donor.employer_student_number
  );
  next.address = pickText(keeper.address, donor.address);
  next.gp_contact = pickText(keeper.gp_contact, donor.gp_contact);
  next.next_of_kin = pickText(keeper.next_of_kin, donor.next_of_kin);
  next.next_of_kin_phone = pickText(
    keeper.next_of_kin_phone,
    donor.next_of_kin_phone
  );
  next.next_of_kin_relationship = pickText(
    keeper.next_of_kin_relationship,
    donor.next_of_kin_relationship
  );
  next.emergency_contact = pickText(
    keeper.emergency_contact,
    donor.emergency_contact
  );
  next.date_of_birth = pickText(keeper.date_of_birth, donor.date_of_birth);
  next.notes = joinText(keeper.notes, donor.notes);
  next.platform_user_id =
    keeper.platform_user_id || donor.platform_user_id || null;
  next.invite_token = pickText(keeper.invite_token, donor.invite_token);
  next.invite_status = pickText(keeper.invite_status, donor.invite_status);
  next.invite_email = pickText(keeper.invite_email, donor.invite_email);
  next.invite_sent_at = pickText(keeper.invite_sent_at, donor.invite_sent_at);
  next.invite_accepted_at = pickText(
    keeper.invite_accepted_at,
    donor.invite_accepted_at
  );
  next.invite_expires_at = pickText(
    keeper.invite_expires_at,
    donor.invite_expires_at
  );
  next.crm_customer_id = keeper.crm_customer_id ?? donor.crm_customer_id;
  next.coach_id = keeper.coach_id || donor.coach_id || null;
  next.membership_plan_id =
    keeper.membership_plan_id || donor.membership_plan_id || null;
  next.agreed_rate_zar =
    keeper.agreed_rate_zar != null
      ? keeper.agreed_rate_zar
      : donor.agreed_rate_zar;
  next.private_rate_zar =
    keeper.private_rate_zar != null
      ? keeper.private_rate_zar
      : donor.private_rate_zar;
  next.private_client =
    keeper.private_client === true || donor.private_client === true;
  next.contract_kind = keeper.contract_kind || donor.contract_kind;
  next.share_schedule = keeper.share_schedule || donor.share_schedule;
  next.share_feedback = keeper.share_feedback || donor.share_feedback;
  next.booking_soft_block =
    keeper.booking_soft_block === true || donor.booking_soft_block === true;
  next.no_show_count = Math.max(
    Number(keeper.no_show_count || 0),
    Number(donor.no_show_count || 0)
  );
  next.attended_count = Math.max(
    Number(keeper.attended_count || 0),
    Number(donor.attended_count || 0)
  );
  next.last_no_show_at = preferDate(
    keeper.last_no_show_at,
    donor.last_no_show_at,
    'max'
  );
  next.popia_consent_at = preferDate(
    keeper.popia_consent_at,
    donor.popia_consent_at,
    'min'
  );
  next.membership_frozen_at =
    keeper.membership_frozen_at || donor.membership_frozen_at;
  next.membership_freeze_until =
    keeper.membership_freeze_until || donor.membership_freeze_until;
  next.start_date = preferDate(keeper.start_date, donor.start_date, 'min');
  next.end_date = preferDate(keeper.end_date, donor.end_date, 'max');
  next.purchased_programme_ids = [
    ...new Set([
      ...(keeper.purchased_programme_ids || []),
      ...(donor.purchased_programme_ids || []),
    ]),
  ];
  next.family = mergeFamily(keeper.family, donor.family);
  next.contracts = mergeContracts(keeper, donor);
  next.join_events = mergeJoinEvents(keeper, donor);
  next.identity = keeper.identity || donor.identity;
  if (keeper.passport || donor.passport) {
    next.passport = {
      ...(donor.passport || {}),
      ...(keeper.passport || {}),
    };
  }
  if (keeper.medical || donor.medical) {
    next.medical = {
      ...(donor.medical || {}),
      ...(keeper.medical || {}),
    };
  }
  if (keeper.health || donor.health) {
    next.health = {
      ...(donor.health || {}),
      ...(keeper.health || {}),
      injured: keeper.health?.injured === true || donor.health?.injured === true,
      injury_notes: joinText(
        keeper.health?.injury_notes,
        donor.health?.injury_notes
      ),
    };
  }
  if (keeper.debit_bank || donor.debit_bank) {
    const bank = {
      ...(donor.debit_bank || {}),
      ...(keeper.debit_bank || {}),
    };
    next.debit_bank = {
      account_holder:
        pickText(bank.account_holder, donor.debit_bank?.account_holder) ||
        bank.account_holder ||
        '',
      bank_name:
        pickText(bank.bank_name, donor.debit_bank?.bank_name) ||
        bank.bank_name ||
        '',
      account_number:
        pickText(bank.account_number, donor.debit_bank?.account_number) ||
        bank.account_number ||
        '',
      branch_code:
        pickText(bank.branch_code, donor.debit_bank?.branch_code) ||
        bank.branch_code ||
        '',
      account_type: bank.account_type || donor.debit_bank?.account_type || 'cheque',
      debit_order_authorised:
        bank.debit_order_authorised === true ||
        donor.debit_bank?.debit_order_authorised === true,
      authorised_at: bank.authorised_at || donor.debit_bank?.authorised_at,
      updated_at: bank.updated_at || donor.debit_bank?.updated_at || keeper.updated_at,
    };
  }
  next.wearable = keeper.wearable?.garmin?.connected
    ? keeper.wearable
    : donor.wearable?.garmin?.connected
      ? donor.wearable
      : keeper.wearable || donor.wearable;
  const tokens = [
    keeper.portal_token,
    donor.portal_token,
    ...(keeper.portal_token_aliases || []),
    ...(donor.portal_token_aliases || []),
  ]
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const uniqueTokens = [...new Set(tokens)];
  next.portal_token = uniqueTokens[0] || keeper.portal_token || donor.portal_token;
  next.portal_token_aliases = uniqueTokens.slice(1);
  next.active = true;
  const statuses = [keeper.membership_status, donor.membership_status].map(
    (s) => String(s || 'active')
  );
  next.membership_status = statuses.includes('active')
    ? 'active'
    : statuses.includes('trial')
      ? 'trial'
      : statuses.includes('paused')
        ? 'paused'
        : 'active';
  next.created_at = preferDate(keeper.created_at, donor.created_at, 'min') ||
    keeper.created_at;
  next.code = keeper.code || donor.code;
  return next;
}

const CLIENT_ID_ARRAYS: Array<keyof FitgraphStore> = [
  'subscriptions',
  'bookings',
  'check_ins',
  'pt_packs',
  'class_feedback',
  'gym_sales',
  'watch_sessions',
  'goals',
  'journey_events',
  'member_stories',
  'consent_shares',
  'programme_enrollments',
  'programme_logs',
];

function remapClientId(store: FitgraphStore, fromId: string, toId: string) {
  if (fromId === toId) return;
  for (const key of CLIENT_ID_ARRAYS) {
    const rows = store[key] as Array<{ client_id?: string | null }> | undefined;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row && row.client_id === fromId) row.client_id = toId;
    }
  }
  for (const row of store.garmin_oauth_pending || []) {
    if (row.client_id === fromId) row.client_id = toId;
  }
  for (const row of store.desk_notices || []) {
    if (row.person_id === fromId) row.person_id = toId;
  }
  for (const row of store.visit_notes || []) {
    if (row.person_id === fromId) row.person_id = toId;
  }
  for (const row of store.outcome_scores || []) {
    if (row.person_id === fromId) row.person_id = toId;
  }
  for (const row of store.treatment_plans || []) {
    if (row.person_id === fromId) row.person_id = toId;
  }
  for (const thread of store.threads || []) {
    for (const p of thread.participants || []) {
      if (p.role === 'member' && p.ref_id === fromId) p.ref_id = toId;
    }
    for (const m of thread.messages || []) {
      if (m.author_role === 'member' && m.author_ref_id === fromId) {
        m.author_ref_id = toId;
      }
      if (Array.isArray(m.read_by)) {
        m.read_by = m.read_by.map((k) =>
          k === `member:${fromId}` ? `member:${toId}` : k
        );
      }
    }
  }
}

const BOOKING_RANK: Record<string, number> = {
  attended: 4,
  booked: 3,
  waitlist: 2,
  no_show: 1,
  cancelled: 0,
};

function dedupeAfterMerge(store: FitgraphStore) {
  const subs = new Map<string, FitSubscription>();
  for (const s of store.subscriptions || []) {
    const k = `${s.client_id}|${s.plan_id}`;
    const prev = subs.get(k);
    if (!prev) {
      subs.set(k, s);
      continue;
    }
    const prevLive = prev.status === 'active' || prev.status === 'trialing';
    const nextLive = s.status === 'active' || s.status === 'trialing';
    const keep =
      nextLive && !prevLive
        ? s
        : prevLive && !nextLive
          ? prev
          : (s.charged_zar != null ? s : prev);
    if (keep === s && prev.charged_zar != null && s.charged_zar == null) {
      s.charged_zar = prev.charged_zar;
    }
    if (keep === prev && s.charged_zar != null && prev.charged_zar == null) {
      prev.charged_zar = s.charged_zar;
    }
    keep.notes = joinText(prev.notes, s.notes);
    keep.auto_renew = prev.auto_renew !== false && s.auto_renew !== false;
    subs.set(k, keep);
  }
  store.subscriptions = [...subs.values()];

  const books = new Map<string, FitBooking>();
  for (const b of store.bookings || []) {
    const k = `${b.client_id}|${b.session_id}`;
    const prev = books.get(k);
    if (!prev) {
      books.set(k, b);
      continue;
    }
    const keep =
      (BOOKING_RANK[b.status] || 0) >= (BOOKING_RANK[prev.status] || 0)
        ? b
        : prev;
    books.set(k, keep);
  }
  store.bookings = [...books.values()];
}

export function clusterDuplicateClients(clients: FitClient[]): FitClient[][] {
  const n = clients.length;
  const parent = clients.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[b] = a;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (clientsAreSamePerson(clients[i], clients[j])) union(i, j);
    }
  }
  const groups = new Map<number, FitClient[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = groups.get(r) || [];
    list.push(clients[i]);
    groups.set(r, list);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

export function mergeDuplicateFitClients(
  store: FitgraphStore,
  opts?: { now?: string; preferredNames?: string[] }
): { store: FitgraphStore; changed: boolean; merged: number } {
  const now = opts?.now || new Date().toISOString();
  const preferred = new Set(
    (opts?.preferredNames || []).map((n) => normalizePersonName(n)).filter(Boolean)
  );
  const clusters = clusterDuplicateClients(store.clients || []);
  if (!clusters.length) return { store, changed: false, merged: 0 };
  let merged = 0;
  const drop = new Set<string>();
  for (const group of clusters) {
    const keeper = pickKeeper(group, preferred);
    let next = { ...keeper };
    for (const donor of group) {
      if (donor.id === keeper.id) continue;
      next = mergeClientRecord(next, donor, preferred);
      remapClientId(store, donor.id, keeper.id);
      drop.add(donor.id);
      merged += 1;
    }
    next.updated_at = now;
    const idx = store.clients.findIndex((c) => c.id === keeper.id);
    if (idx >= 0) store.clients[idx] = next;
  }
  if (drop.size) {
    rememberRemovedFitgraphIds(store, 'clients', drop);
    store.clients = store.clients.filter((c) => !drop.has(c.id));
    dedupeAfterMerge(store);
  }
  return { store, changed: merged > 0, merged };
}

/** Known desk typos that must fold even when emails differ. */
const CLIENT_NAME_FOLDS: Array<{ aliases: string[]; canonical: string }> = [
  {
    aliases: ['athalah hembert', 'athaliah hembert'],
    canonical: 'Athaliah Hembert',
  },
];

/**
 * Fold known duplicate names into one person and retarget their rows.
 * Runs even after the member-merge stamp so a leftover typo cannot stick.
 */
export function absorbKnownClientAliases(
  store: FitgraphStore,
  opts?: { now?: string }
): { store: FitgraphStore; changed: boolean } {
  const now = opts?.now || new Date().toISOString();
  if (!Array.isArray(store.clients) || !store.clients.length) {
    return { store, changed: false };
  }
  let changed = false;
  for (const fold of CLIENT_NAME_FOLDS) {
    const aliasSet = new Set(fold.aliases);
    const canonicalNorm = normalizePersonName(fold.canonical);
    const preferred = new Set([canonicalNorm]);
    const group = store.clients.filter((c) =>
      aliasSet.has(normalizePersonName(c.name))
    );
    if (!group.length) continue;
    const namedCanonical = group.filter(
      (c) => normalizePersonName(c.name) === canonicalNorm
    );
    const keeper = namedCanonical.length
      ? pickKeeper(namedCanonical, preferred)
      : pickKeeper(group, preferred);
    let next = { ...keeper };
    const drop = new Set<string>();
    for (const donor of group) {
      if (donor.id === keeper.id) continue;
      next = mergeClientRecord(next, donor, preferred);
      remapClientId(store, donor.id, keeper.id);
      drop.add(donor.id);
    }
    if (next.name !== fold.canonical) {
      next.name = fold.canonical;
    }
    if (drop.size || next.name !== keeper.name) {
      next.updated_at = now;
      changed = true;
    }
    const idx = store.clients.findIndex((c) => c.id === keeper.id);
    if (idx >= 0) store.clients[idx] = next;
    if (drop.size) {
      rememberRemovedFitgraphIds(store, 'clients', drop);
      store.clients = store.clients.filter((c) => !drop.has(c.id));
      dedupeAfterMerge(store);
      changed = true;
    }
  }
  return { store, changed };
}
