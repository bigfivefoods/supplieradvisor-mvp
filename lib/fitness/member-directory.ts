/**
 * GymAdvisor® member book — roles, filters, counts, validation, duplicates.
 * The live book is company_module_stores.data.clients (module = fitgraph).
 * Every count and filter here is derived from that JSON. Nothing is hard-coded.
 */
import type {
  FitClient,
  FitMembershipPlan,
  FitSubscription,
  FitgraphStore,
} from '@/lib/fitness/fitgraph';

export type MemberRole = 'private' | 'class' | 'both' | 'neither';
export type MemberStatusFilter = 'active' | 'inactive' | 'all';
export type DuplicateReason = 'email' | 'phone' | 'name_dob' | 'id_number';

export type ClassAssignment = {
  class_type_id: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type MemberDirectoryCounts = {
  people: number;
  active: number;
  inactive: number;
  private: number;
  class: number;
  both: number;
  neither: number;
};

export type MemberDirectoryFacets = {
  all: number;
  private: number;
  class: number;
  both: number;
  neither: number;
  active: number;
  inactive: number;
};

export type MemberListQuery = {
  role?: MemberRole | 'all';
  status?: MemberStatusFilter;
  classId?: string;
  coachId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  today?: string;
};

export type MemberListRow = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  phone_e164: string | null;
  phone_invalid: boolean;
  role: MemberRole;
  active: boolean;
  private_client_stored: boolean;
  private_client: boolean;
  private_mismatch: 'flagged_without_coach' | 'assigned_without_flag' | null;
  coach_ids: string[];
  coach_names: string[];
  class_type_ids: string[];
  class_labels: string[];
  plan_ids: string[];
  membership_status?: string;
};

export type MemberDirectoryResult = {
  clients: FitClient[];
  rows: MemberListRow[];
  subscriptions: FitSubscription[];
  counts: MemberDirectoryCounts;
  facets: MemberDirectoryFacets;
  matching: number;
  page: number;
  pageSize: number;
  pages: number;
  classOptions: Array<{ id: string; label: string }>;
  coachOptions: Array<{ id: string; name: string }>;
};

export type DuplicateHit = {
  client_id: string;
  name: string;
  code: string;
  reasons: DuplicateReason[];
  manual_review: boolean;
};

export type MemberFieldIssue = { field: string; message: string };

export type NormalizedMemberFields = {
  name?: string;
  email?: string;
  phone?: string;
  id_number?: string;
  date_of_birth?: string | null;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  emergency_contact?: string;
  membership_status?: string;
};

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

const MEMBERSHIP_STATUS_OK = new Set([
  'active',
  'paused',
  'expired',
  'cancelled',
  'trial',
  'frozen',
  'merged',
]);

/**
 * Review rules for the dry-run only. These are not member records and are
 * never inserted into a gym book.
 * Bianca Westhorpe-Pottow: two book rows of the same person — propose a merge.
 * Hawa Ismail and Zubeida Akoob share a contact — never auto-merge.
 */
export const KNOWN_DUPLICATE_NAME_GROUPS: string[][] = [
  ['bianca westhorpe pottow', 'bianca westhorpe-pottow'],
];

export const MANUAL_REVIEW_SHARED_CONTACTS: Array<{
  names: string[];
  reason: string;
}> = [
  {
    names: ['hawa ismail', 'zubeida akoob'],
    reason:
      'Hawa Ismail and Zubeida Akoob share a contact. Review by hand. Do not auto-merge.',
  },
];

export class PossibleDuplicateError extends Error {
  duplicates: DuplicateHit[];
  constructor(duplicates: DuplicateHit[]) {
    super('possible duplicate');
    this.name = 'PossibleDuplicateError';
    this.duplicates = duplicates;
  }
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function normalizePersonNameKey(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeEmail(raw?: string | null): string | null {
  const e = String(raw || '').trim().toLowerCase();
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

export function phoneDigits(raw?: string | null): string {
  return String(raw || '').replace(/\D/g, '');
}

export function normalizePhoneE164(
  raw?: string | null
): { ok: true; e164: string | null } | { ok: false; reason: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { ok: true, e164: null };
  const digits = phoneDigits(trimmed);
  if (digits.length < 8 || digits.length > 15) {
    return {
      ok: false,
      reason: `Phone has ${digits.length} digit${digits.length === 1 ? '' : 's'}`,
    };
  }
  let national = digits;
  if (trimmed.startsWith('+')) {
    national = digits;
  } else if (digits.startsWith('27') && digits.length >= 11) {
    national = digits;
  } else if (digits.startsWith('0') && digits.length === 10) {
    national = `27${digits.slice(1)}`;
  } else if (digits.length === 9) {
    national = `27${digits}`;
  }
  if (national.length < 8 || national.length > 15) {
    return { ok: false, reason: 'Phone is not a valid number' };
  }
  return { ok: true, e164: `+${national}` };
}

export function saIdLooksValid(raw?: string | null): boolean {
  const digits = phoneDigits(raw);
  if (!digits) return true;
  if (digits.length !== 13) return false;
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  if (!Number.isFinite(yy)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let n = Number(digits[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

function unique(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const v = String(id || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function isMemberActive(client: FitClient): boolean {
  if ((client as { _deleted?: boolean })._deleted) return false;
  if (client.active === false) return false;
  const st = String(client.membership_status || 'active');
  return st !== 'expired' && st !== 'cancelled' && st !== 'merged';
}

export function liveBookClients(store: FitgraphStore): FitClient[] {
  const removed = new Set(store.removed_ids?.clients || []);
  return (store.clients || []).filter((c) => {
    if (!c || !c.id) return false;
    if ((c as { _deleted?: boolean })._deleted) return false;
    if (removed.has(c.id)) return false;
    return true;
  });
}

/** Private coaches. A class plan's default coach is not a private assignment. */
export function privateCoachIds(client: FitClient): string[] {
  const listed = unique(client.coach_ids || []);
  if (listed.length) return listed;
  if (client.private_client === true && client.coach_id) return [client.coach_id];
  return [];
}

export function isPrivateClient(client: FitClient): boolean {
  return privateCoachIds(client).length > 0;
}

export function privateFlagMismatch(
  client: FitClient
): 'flagged_without_coach' | 'assigned_without_flag' | null {
  const assigned = privateCoachIds(client).length > 0;
  const flagged = client.private_client === true;
  if (flagged && !assigned) return 'flagged_without_coach';
  if (!flagged && unique(client.coach_ids || []).length > 0) {
    return 'assigned_without_flag';
  }
  return null;
}

export function subscriptionIsCurrent(
  sub: FitSubscription,
  today: string
): boolean {
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  const end = String(sub.ends_on || '').slice(0, 10);
  if (end && end < today) return false;
  const start = String(sub.started_at || '').slice(0, 10);
  if (start && start > today) return false;
  return true;
}

export function livePlanIds(
  client: FitClient,
  store: FitgraphStore,
  today: string
): string[] {
  const ids: string[] = [];
  for (const sub of store.subscriptions || []) {
    if (sub.client_id !== client.id) continue;
    if (!subscriptionIsCurrent(sub, today)) continue;
    const plan = (store.membership_plans || []).find((p) => p.id === sub.plan_id);
    if (plan?.addon === true) continue;
    ids.push(sub.plan_id);
  }
  if (!ids.length && client.membership_plan_id) {
    const plan = (store.membership_plans || []).find(
      (p) => p.id === client.membership_plan_id
    );
    if (plan && plan.addon !== true && plan.active !== false) {
      ids.push(plan.id);
    }
  }
  return unique(ids);
}

export function derivedClassTypeIds(
  client: FitClient,
  store: FitgraphStore,
  today: string
): string[] {
  const ids: string[] = [];
  for (const planId of livePlanIds(client, store, today)) {
    const plan = (store.membership_plans || []).find((p) => p.id === planId);
    ids.push(...(plan?.class_type_ids || []));
  }
  return unique(ids);
}

function assignmentOpen(row: ClassAssignment, today: string): boolean {
  const start = String(row.start_date || '').slice(0, 10);
  const end = String(row.end_date || '').slice(0, 10);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

/** Explicit ids, or the plan's class types when the client has no explicit list. */
export function effectiveClassTypeIds(
  client: FitClient,
  store: FitgraphStore,
  today: string
): string[] {
  const explicit = Array.isArray(client.class_type_ids)
    ? unique(client.class_type_ids)
    : null;
  const base = explicit == null ? derivedClassTypeIds(client, store, today) : explicit;
  const dated = new Map(
    (client.class_assignments || []).map((row) => [row.class_type_id, row])
  );
  return base.filter((id) => {
    const row = dated.get(id);
    if (!row) return true;
    return assignmentOpen(row, today);
  });
}

export function isClassMember(
  client: FitClient,
  store: FitgraphStore,
  today: string
): boolean {
  if (livePlanIds(client, store, today).length > 0) return true;
  if (effectiveClassTypeIds(client, store, today).length > 0) return true;
  return false;
}

export function memberRole(
  client: FitClient,
  store: FitgraphStore,
  today = todayIso()
): MemberRole {
  const priv = isPrivateClient(client);
  const onClass = isClassMember(client, store, today);
  if (priv && onClass) return 'both';
  if (priv) return 'private';
  if (onClass) return 'class';
  return 'neither';
}

type Fact = {
  client: FitClient;
  role: MemberRole;
  active: boolean;
  classIds: Set<string>;
  coachIds: Set<string>;
  search: string;
};

function planById(store: FitgraphStore, id: string): FitMembershipPlan | undefined {
  return (store.membership_plans || []).find((p) => p.id === id);
}

function buildFacts(store: FitgraphStore, today: string): Fact[] {
  const className = new Map(
    (store.class_types || []).map((t) => [t.id, t.name])
  );
  const coachName = new Map((store.coaches || []).map((c) => [c.id, c.name]));
  return liveBookClients(store).map((client) => {
    const plans = livePlanIds(client, store, today);
    const types = effectiveClassTypeIds(client, store, today);
    const classIds = new Set<string>([...plans, ...types]);
    if (client.membership_plan_id) classIds.add(client.membership_plan_id);
    const coachIds = new Set<string>(privateCoachIds(client));
    if (client.coach_id) coachIds.add(client.coach_id);
    for (const planId of plans) {
      const coach = planById(store, planId)?.default_coach_id;
      if (coach) coachIds.add(coach);
    }
    const labels = [
      ...plans.map((id) => planById(store, id)?.name || ''),
      ...types.map((id) => className.get(id) || ''),
      ...[...coachIds].map((id) => coachName.get(id) || ''),
    ];
    const search = [
      client.name,
      client.code,
      client.email,
      client.phone,
      client.id_number,
      client.membership_status,
      ...labels,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return {
      client,
      role: memberRole(client, store, today),
      active: isMemberActive(client),
      classIds,
      coachIds,
      search,
    };
  });
}

function matchesFact(
  fact: Fact,
  opts: {
    role?: MemberRole | 'all';
    status?: MemberStatusFilter;
    classId?: string;
    coachId?: string;
    q?: string;
  }
): boolean {
  const role = opts.role && opts.role !== 'all' ? opts.role : '';
  if (role && fact.role !== role) return false;
  if (opts.status === 'active' && !fact.active) return false;
  if (opts.status === 'inactive' && fact.active) return false;
  if (opts.classId && !fact.classIds.has(opts.classId)) return false;
  if (opts.coachId && !fact.coachIds.has(opts.coachId)) return false;
  const q = String(opts.q || '').trim().toLowerCase();
  if (q && !fact.search.includes(q)) return false;
  return true;
}

function emptyCounts(): MemberDirectoryCounts {
  return {
    people: 0,
    active: 0,
    inactive: 0,
    private: 0,
    class: 0,
    both: 0,
    neither: 0,
  };
}

export function memberDirectoryCounts(facts: Fact[]): MemberDirectoryCounts {
  const counts = emptyCounts();
  counts.people = facts.length;
  for (const fact of facts) {
    if (fact.active) counts.active += 1;
    else counts.inactive += 1;
    counts[fact.role] += 1;
  }
  return counts;
}

function rowFor(fact: Fact, store: FitgraphStore, today: string): MemberListRow {
  const client = fact.client;
  const phone = normalizePhoneE164(client.phone);
  const coachIds = privateCoachIds(client);
  const planIds = livePlanIds(client, store, today);
  const typeIds = effectiveClassTypeIds(client, store, today);
  return {
    id: client.id,
    code: client.code,
    name: client.name,
    email: client.email,
    phone: client.phone,
    phone_e164: phone.ok ? phone.e164 : null,
    phone_invalid: !phone.ok,
    role: fact.role,
    active: fact.active,
    private_client_stored: client.private_client === true,
    private_client: fact.role === 'private' || fact.role === 'both',
    private_mismatch: privateFlagMismatch(client),
    coach_ids: coachIds,
    coach_names: coachIds.map(
      (id) => store.coaches.find((c) => c.id === id)?.name || 'Coach'
    ),
    class_type_ids: typeIds,
    class_labels: [
      ...planIds.map((id) => planById(store, id)?.name || 'Class'),
      ...typeIds.map(
        (id) => store.class_types.find((t) => t.id === id)?.name || 'Class'
      ),
    ],
    plan_ids: planIds,
    membership_status: client.membership_status,
  };
}

export function queryMemberDirectory(
  store: FitgraphStore,
  query: MemberListQuery = {}
): MemberDirectoryResult {
  const today = query.today || todayIso();
  const facts = buildFacts(store, today).sort((a, b) => {
    const byName = a.client.name.localeCompare(b.client.name, 'en');
    if (byName) return byName;
    return a.client.id.localeCompare(b.client.id);
  });
  const counts = memberDirectoryCounts(facts);
  const status = query.status || 'active';
  const role = query.role || 'all';
  const classId = String(query.classId || '');
  const coachId = String(query.coachId || '');
  const q = String(query.q || '');
  const base = { classId, coachId, q };
  const facets: MemberDirectoryFacets = {
    all: facts.filter((f) => matchesFact(f, { ...base, status, role: 'all' }))
      .length,
    private: facts.filter((f) =>
      matchesFact(f, { ...base, status, role: 'private' })
    ).length,
    class: facts.filter((f) =>
      matchesFact(f, { ...base, status, role: 'class' })
    ).length,
    both: facts.filter((f) => matchesFact(f, { ...base, status, role: 'both' }))
      .length,
    neither: facts.filter((f) =>
      matchesFact(f, { ...base, status, role: 'neither' })
    ).length,
    active: facts.filter((f) =>
      matchesFact(f, { ...base, role, status: 'active' })
    ).length,
    inactive: facts.filter((f) =>
      matchesFact(f, { ...base, role, status: 'inactive' })
    ).length,
  };
  const matched = facts.filter((f) =>
    matchesFact(f, { ...base, role, status })
  );
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Math.trunc(Number(query.pageSize) || PAGE_SIZE_DEFAULT))
  );
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.trunc(Number(query.page) || 1)));
  const slice = matched.slice((page - 1) * pageSize, page * pageSize);
  const clients = slice.map((f) => f.client);
  const idSet = new Set(clients.map((c) => c.id));
  const classOptions = [
    ...(store.membership_plans || [])
      .filter((p) => p.active !== false && p.addon !== true)
      .map((p) => ({
        id: p.id,
        label: p.schedule_label ? `${p.name} · ${p.schedule_label}` : p.name,
      })),
    ...(store.class_types || [])
      .filter((t) => t.active !== false)
      .map((t) => ({ id: t.id, label: t.name })),
  ].sort((a, b) => a.label.localeCompare(b.label));
  const coachOptions = (store.coaches || [])
    .filter((c) => c.active !== false)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    clients,
    rows: slice.map((f) => rowFor(f, store, today)),
    subscriptions: (store.subscriptions || []).filter((s) => idSet.has(s.client_id)),
    counts,
    facets,
    matching: matched.length,
    page,
    pageSize,
    pages,
    classOptions,
    coachOptions,
  };
}

export function membersForCoach(
  store: FitgraphStore,
  coachId: string,
  today = todayIso()
): { privateClients: MemberListRow[]; classMembers: MemberListRow[] } {
  const facts = buildFacts(store, today).filter((f) => f.coachIds.has(coachId));
  const rows = facts.map((f) => rowFor(f, store, today));
  return {
    privateClients: rows.filter(
      (r) => r.role === 'private' || r.role === 'both'
    ),
    classMembers: rows.filter((r) => r.role === 'class' || r.role === 'both'),
  };
}

export function validateMemberFields(
  input: {
    name?: string;
    email?: string;
    phone?: string;
    id_number?: string;
    date_of_birth?: string | null;
    next_of_kin?: string;
    next_of_kin_phone?: string;
    next_of_kin_relationship?: string;
    emergency_contact?: string;
    membership_status?: string;
  },
  opts?: { requireName?: boolean }
):
  | { ok: true; value: NormalizedMemberFields }
  | { ok: false; issues: MemberFieldIssue[] } {
  const issues: MemberFieldIssue[] = [];
  const value: NormalizedMemberFields = {};
  if (input.name !== undefined || opts?.requireName) {
    const name = String(input.name || '').trim().replace(/\s+/g, ' ');
    if (opts?.requireName && name.length < 2) {
      issues.push({ field: 'name', message: 'Enter the member’s full name' });
    } else if (name && (name.length < 2 || name.length > 120)) {
      issues.push({ field: 'name', message: 'Name must be 2–120 characters' });
    } else if (name && !/^[\p{L}][\p{L}\s.'’-]*$/u.test(name)) {
      issues.push({
        field: 'name',
        message: 'Name can use letters, spaces, hyphens and apostrophes',
      });
    } else if (name) {
      value.name = name;
    }
  }
  if (input.email !== undefined) {
    const raw = String(input.email || '').trim();
    if (!raw) {
      value.email = '';
    } else {
      const email = normalizeEmail(raw);
      if (!email) issues.push({ field: 'email', message: 'Enter a valid email' });
      else value.email = email;
    }
  }
  if (input.phone !== undefined) {
    const phone = normalizePhoneE164(input.phone);
    if (!phone.ok) issues.push({ field: 'phone', message: phone.reason });
    else value.phone = phone.e164 || '';
  }
  if (input.id_number !== undefined) {
    const id = String(input.id_number || '').trim();
    if (!id) value.id_number = '';
    else if (phoneDigits(id).length === 13) {
      if (!saIdLooksValid(id)) {
        issues.push({
          field: 'id_number',
          message: 'ID number is not a valid South African ID',
        });
      } else value.id_number = phoneDigits(id);
    } else if (id.length < 5 || id.length > 24) {
      issues.push({
        field: 'id_number',
        message: 'ID or passport number looks too short',
      });
    } else value.id_number = id;
  }
  if (input.date_of_birth !== undefined) {
    const dob = String(input.date_of_birth || '').trim().slice(0, 10);
    if (!dob) value.date_of_birth = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) {
      issues.push({ field: 'date_of_birth', message: 'Birthday must be YYYY-MM-DD' });
    } else if (dob > todayIso() || dob < '1900-01-01') {
      issues.push({ field: 'date_of_birth', message: 'Birthday is out of range' });
    } else value.date_of_birth = dob;
  }
  if (input.next_of_kin_phone !== undefined && String(input.next_of_kin_phone || '').trim()) {
    const phone = normalizePhoneE164(input.next_of_kin_phone);
    if (!phone.ok) {
      issues.push({ field: 'next_of_kin_phone', message: phone.reason });
    } else value.next_of_kin_phone = phone.e164 || '';
  } else if (input.next_of_kin_phone !== undefined) {
    value.next_of_kin_phone = '';
  }
  if (input.next_of_kin !== undefined) {
    value.next_of_kin = String(input.next_of_kin || '').trim();
  }
  if (input.next_of_kin_relationship !== undefined) {
    value.next_of_kin_relationship = String(input.next_of_kin_relationship || '').trim();
  }
  if (input.emergency_contact !== undefined) {
    value.emergency_contact = String(input.emergency_contact || '').trim();
  }
  const kin = value.next_of_kin ?? String(input.next_of_kin || '').trim();
  const kinPhone = String(input.next_of_kin_phone || '').trim();
  const emergency = value.emergency_contact ?? String(input.emergency_contact || '').trim();
  if ((kinPhone || value.next_of_kin_relationship) && !kin && !emergency) {
    issues.push({
      field: 'next_of_kin',
      message: 'Add the emergency contact’s name',
    });
  }
  if (input.membership_status !== undefined && String(input.membership_status || '').trim()) {
    const status = String(input.membership_status).trim();
    if (!MEMBERSHIP_STATUS_OK.has(status)) {
      issues.push({ field: 'membership_status', message: 'Unknown membership status' });
    } else value.membership_status = status;
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, value };
}

function nameDobKey(client: Pick<FitClient, 'name' | 'date_of_birth'>): string {
  const name = normalizePersonNameKey(client.name);
  const dob = String(client.date_of_birth || '').slice(0, 10);
  if (!name || !dob) return '';
  return `${name}|${dob}`;
}

function manualReviewPair(a: FitClient, b: FitClient): string | null {
  const left = normalizePersonNameKey(a.name);
  const right = normalizePersonNameKey(b.name);
  for (const rule of MANUAL_REVIEW_SHARED_CONTACTS) {
    const names = rule.names.map((n) => normalizePersonNameKey(n));
    if (names.includes(left) && names.includes(right) && left !== right) {
      return rule.reason;
    }
  }
  return null;
}

export function findPossibleDuplicates(
  store: FitgraphStore,
  candidate: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    date_of_birth?: string | null;
    id_number?: string;
  }
): DuplicateHit[] {
  const except = String(candidate.id || '');
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhoneE164(candidate.phone);
  const phoneKey = phone.ok ? phone.e164 : '';
  const dobKey = nameDobKey({
    name: candidate.name || '',
    date_of_birth: candidate.date_of_birth,
  });
  const idKey =
    phoneDigits(candidate.id_number).length === 13
      ? phoneDigits(candidate.id_number)
      : '';
  const hits: DuplicateHit[] = [];
  for (const client of liveBookClients(store)) {
    if (client.id === except) continue;
    const reasons: DuplicateReason[] = [];
    if (email && normalizeEmail(client.email) === email) reasons.push('email');
    const theirs = normalizePhoneE164(client.phone);
    if (phoneKey && theirs.ok && theirs.e164 === phoneKey) reasons.push('phone');
    if (dobKey && nameDobKey(client) === dobKey) reasons.push('name_dob');
    const theirId = phoneDigits(client.id_number);
    if (idKey && theirId.length === 13 && theirId === idKey) reasons.push('id_number');
    if (!reasons.length) continue;
    const manual = manualReviewPair(
      { ...client, name: client.name },
      {
        ...client,
        name: candidate.name || client.name,
        id: candidate.id || 'new',
      } as FitClient
    );
    hits.push({
      client_id: client.id,
      name: client.name,
      code: client.code,
      reasons,
      manual_review: Boolean(manual),
    });
  }
  return hits;
}

export type MemberCleanupReport = {
  dry_run: true;
  merges: Array<{
    keeper_id: string;
    keeper_name: string;
    donor_ids: string[];
    donor_names: string[];
    reasons: string[];
  }>;
  manual_reviews: Array<{
    client_ids: string[];
    names: string[];
    reason: string;
  }>;
  private_flag_fixes: Array<{
    id: string;
    name: string;
    action: 'clear_flag' | 'set_flag';
    detail: string;
  }>;
  phone_normalisations: Array<{
    id: string;
    name: string;
    from: string;
    to: string;
  }>;
  invalid_phones: Array<{
    id: string;
    name: string;
    phone: string;
    reason: string;
  }>;
  class_type_backfill: Array<{
    id: string;
    name: string;
    class_type_ids: string[];
  }>;
  counts: MemberDirectoryCounts;
};

function keeperOf(group: FitClient[]): FitClient {
  return [...group].sort((a, b) => {
    const score = (c: FitClient) => {
      let s = 0;
      if (c.portal_token) s += 20;
      if (c.platform_user_id) s += 20;
      if (normalizeEmail(c.email)) s += 8;
      if (privateCoachIds(c).length) s += 6;
      if (c.active !== false) s += 4;
      s += (c.contracts || []).length;
      return s;
    };
    const d = score(b) - score(a);
    if (d) return d;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  })[0];
}

function clusterClients(clients: FitClient[]): FitClient[][] {
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
  const index = new Map<string, number>();
  const link = (key: string, i: number) => {
    if (!key) return;
    const prev = index.get(key);
    if (prev == null) index.set(key, i);
    else union(prev, i);
  };
  clients.forEach((client, i) => {
    const email = normalizeEmail(client.email);
    if (email) link(`e:${email}`, i);
    const phone = normalizePhoneE164(client.phone);
    if (phone.ok && phone.e164) link(`p:${phone.e164}`, i);
    const dob = nameDobKey(client);
    if (dob) link(`d:${dob}`, i);
    const id = phoneDigits(client.id_number);
    if (id.length === 13 && saIdLooksValid(id)) link(`i:${id}`, i);
    const name = normalizePersonNameKey(client.name);
    for (const group of KNOWN_DUPLICATE_NAME_GROUPS) {
      if (group.map((n) => normalizePersonNameKey(n)).includes(name)) {
        link(`known:${group[0]}`, i);
      }
    }
  });
  const groups = new Map<number, FitClient[]>();
  clients.forEach((client, i) => {
    const root = find(i);
    const list = groups.get(root) || [];
    list.push(client);
    groups.set(root, list);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

function clusterHasManualPair(group: FitClient[]): string | null {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const reason = manualReviewPair(group[i], group[j]);
      if (reason) return reason;
    }
  }
  return null;
}

export function buildMemberCleanupReport(
  store: FitgraphStore,
  today = todayIso()
): MemberCleanupReport {
  const clients = liveBookClients(store);
  const manual: MemberCleanupReport['manual_reviews'] = [];
  const seenManual = new Set<string>();
  const pushManual = (group: FitClient[], reason: string) => {
    const ids = group.map((c) => c.id).sort();
    const key = ids.join('|');
    if (seenManual.has(key)) return;
    seenManual.add(key);
    manual.push({
      client_ids: ids,
      names: group.map((c) => c.name),
      reason,
    });
  };
  for (const rule of MANUAL_REVIEW_SHARED_CONTACTS) {
    const wanted = rule.names.map((n) => normalizePersonNameKey(n));
    const found = clients.filter((c) =>
      wanted.includes(normalizePersonNameKey(c.name))
    );
    if (found.length >= 2) pushManual(found, rule.reason);
  }
  const merges: MemberCleanupReport['merges'] = [];
  for (const group of clusterClients(clients)) {
    const blocked = clusterHasManualPair(group);
    if (blocked) {
      pushManual(group, blocked);
      continue;
    }
    const keeper = keeperOf(group);
    const donors = group.filter((c) => c.id !== keeper.id);
    merges.push({
      keeper_id: keeper.id,
      keeper_name: keeper.name,
      donor_ids: donors.map((c) => c.id),
      donor_names: donors.map((c) => c.name),
      reasons: ['Same email, phone, ID, birthday or known duplicate name'],
    });
  }
  const private_flag_fixes: MemberCleanupReport['private_flag_fixes'] = [];
  const phone_normalisations: MemberCleanupReport['phone_normalisations'] = [];
  const invalid_phones: MemberCleanupReport['invalid_phones'] = [];
  const class_type_backfill: MemberCleanupReport['class_type_backfill'] = [];
  for (const client of clients) {
    const mismatch = privateFlagMismatch(client);
    if (mismatch === 'flagged_without_coach') {
      private_flag_fixes.push({
        id: client.id,
        name: client.name,
        action: 'clear_flag',
        detail: 'private_client is set and no coach is assigned',
      });
    } else if (mismatch === 'assigned_without_flag') {
      private_flag_fixes.push({
        id: client.id,
        name: client.name,
        action: 'set_flag',
        detail: 'Coaches are assigned. Set private_client to match.',
      });
    }
    if (String(client.phone || '').trim()) {
      const phone = normalizePhoneE164(client.phone);
      if (!phone.ok) {
        invalid_phones.push({
          id: client.id,
          name: client.name,
          phone: String(client.phone),
          reason: phone.reason,
        });
      } else if (phone.e164 && phone.e164 !== String(client.phone).trim()) {
        phone_normalisations.push({
          id: client.id,
          name: client.name,
          from: String(client.phone).trim(),
          to: phone.e164,
        });
      }
    }
    const explicit = client.class_type_ids;
    const derived = derivedClassTypeIds(client, store, today);
    if ((explicit == null || explicit.length === 0) && derived.length) {
      class_type_backfill.push({
        id: client.id,
        name: client.name,
        class_type_ids: derived,
      });
    }
  }
  const counts = memberDirectoryCounts(buildFacts(store, today));
  return {
    dry_run: true,
    merges,
    manual_reviews: manual,
    private_flag_fixes,
    phone_normalisations,
    invalid_phones,
    class_type_backfill,
    counts,
  };
}

export function formatMemberCleanupReport(report: MemberCleanupReport): string {
  const lines: string[] = [];
  lines.push('GymAdvisor® member clean-up — DRY RUN');
  lines.push('No data was written. Apply only after this report is approved.');
  lines.push('');
  lines.push(
    `People ${report.counts.people} · active ${report.counts.active} · inactive ${report.counts.inactive}`
  );
  lines.push(
    `Private client ${report.counts.private} · Class member ${report.counts.class} · Both ${report.counts.both} · Neither ${report.counts.neither}`
  );
  lines.push('');
  lines.push(`Proposed merges (${report.merges.length})`);
  if (!report.merges.length) lines.push('  none');
  for (const row of report.merges) {
    lines.push(
      `  keep ${row.keeper_name} (${row.keeper_id}) ← ${row.donor_names.join(', ')} [${row.donor_ids.join(', ')}]`
    );
  }
  lines.push('');
  lines.push(`Manual review — do not auto-merge (${report.manual_reviews.length})`);
  if (!report.manual_reviews.length) lines.push('  none');
  for (const row of report.manual_reviews) {
    lines.push(`  ${row.names.join(' / ')} — ${row.reason}`);
  }
  lines.push('');
  lines.push(`Private-client flag reconciled to coach assignment (${report.private_flag_fixes.length})`);
  if (!report.private_flag_fixes.length) lines.push('  none');
  for (const row of report.private_flag_fixes) {
    lines.push(`  ${row.action} ${row.name} (${row.id}) — ${row.detail}`);
  }
  lines.push('');
  lines.push(`Phone normalisation (${report.phone_normalisations.length})`);
  if (!report.phone_normalisations.length) lines.push('  none');
  for (const row of report.phone_normalisations) {
    lines.push(`  ${row.name}: ${row.from} → ${row.to}`);
  }
  lines.push('');
  lines.push(`Invalid phones — flagged, not changed (${report.invalid_phones.length})`);
  if (!report.invalid_phones.length) lines.push('  none');
  for (const row of report.invalid_phones) {
    lines.push(`  ${row.name}: "${row.phone}" — ${row.reason}`);
  }
  lines.push('');
  lines.push(`Class types to copy from the plan (${report.class_type_backfill.length})`);
  if (!report.class_type_backfill.length) lines.push('  none');
  for (const row of report.class_type_backfill) {
    lines.push(`  ${row.name}: ${row.class_type_ids.join(', ')}`);
  }
  lines.push('');
  lines.push('End of dry run.');
  return lines.join('\n');
}

export type MemberQualityIssue = {
  id: string;
  name: string;
  kind:
    | 'flagged_without_coach'
    | 'assigned_without_flag'
    | 'invalid_phone'
    | 'missing_email'
    | 'missing_phone'
    | 'missing_emergency'
    | 'duplicate';
  detail: string;
};

export function memberQualityIssues(
  store: FitgraphStore,
  today = todayIso()
): MemberQualityIssue[] {
  const issues: MemberQualityIssue[] = [];
  const report = buildMemberCleanupReport(store, today);
  for (const row of report.private_flag_fixes) {
    issues.push({
      id: row.id,
      name: row.name,
      kind: row.action === 'clear_flag' ? 'flagged_without_coach' : 'assigned_without_flag',
      detail: row.detail,
    });
  }
  for (const row of report.invalid_phones) {
    issues.push({
      id: row.id,
      name: row.name,
      kind: 'invalid_phone',
      detail: `${row.phone} — ${row.reason}`,
    });
  }
  for (const client of liveBookClients(store)) {
    if (!normalizeEmail(client.email)) {
      issues.push({
        id: client.id,
        name: client.name,
        kind: 'missing_email',
        detail: 'No valid email',
      });
    }
    if (!String(client.phone || '').trim()) {
      issues.push({
        id: client.id,
        name: client.name,
        kind: 'missing_phone',
        detail: 'No phone',
      });
    }
    const emergency =
      String(client.emergency_contact || '').trim() ||
      String(client.next_of_kin || '').trim();
    if (!emergency) {
      issues.push({
        id: client.id,
        name: client.name,
        kind: 'missing_emergency',
        detail: 'No emergency contact',
      });
    }
  }
  for (const group of report.merges) {
    issues.push({
      id: group.keeper_id,
      name: group.keeper_name,
      kind: 'duplicate',
      detail: `Possible duplicate of ${group.donor_names.join(', ')}`,
    });
  }
  for (const group of report.manual_reviews) {
    issues.push({
      id: group.client_ids[0] || 'review',
      name: group.names.join(' / '),
      kind: 'duplicate',
      detail: group.reason,
    });
  }
  return issues;
}
