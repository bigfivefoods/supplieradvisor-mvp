/**
 * Gym membership onboarding contracts (group class vs private).
 * PAR-Q + identity live on the member profile for the gym owner only.
 */
import { applyMemberDebitBank } from '@/lib/fitness/member-debit-bank';
import {
  newId,
  type FitClient,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import { appendJoinEvent } from '@/lib/fitness/member-profile';

function normalizePersonName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function rosterSlug(name: string): string {
  return normalizePersonName(name).replace(/\s+/g, '_').slice(0, 42);
}

export const CONTRACT_KINDS = ['group', 'private'] as const;
export type FitContractKind = (typeof CONTRACT_KINDS)[number];

export const HEARD_ABOUT_OPTIONS = [
  'FRIEND',
  'INSTAGRAM',
  'FACEBOOK',
  'GOOGLE',
  'OTHER',
] as const;

export const PARQ_QUESTIONS: Array<{ key: keyof FitParqAnswers; label: string }> = [
  {
    key: 'heart_condition',
    label:
      'Has your doctor ever said that you have a heart condition and that you should only perform physical activity recommended by a doctor?',
  },
  {
    key: 'chest_pain_activity',
    label: 'Do you feel pain in your chest when you perform physical activity?',
  },
  {
    key: 'chest_pain_rest',
    label:
      'In the past month, have you had chest pain when you were not performing any physical activity?',
  },
  {
    key: 'dizziness_unconscious',
    label:
      'Do you lose your balance because of dizziness or do you ever lose consciousness?',
  },
  {
    key: 'taking_medication',
    label: 'Are you currently taking any medication?',
  },
  {
    key: 'other_reason',
    label: 'Do you know of any other reason why you should not engage in physical activity?',
  },
  {
    key: 'pain_injuries',
    label:
      'Have you ever had any pain or injuries (ankle, knee, hip, back, shoulder, etc.)?',
  },
  {
    key: 'surgeries_12m',
    label: 'Have you had any surgeries in the past 12 months?',
  },
  {
    key: 'chronic_disease',
    label:
      'Has a medical doctor ever diagnosed you with a chronic disease, such as coronary heart disease, coronary artery disease, hypertension (high blood pressure), high cholesterol or diabetes?',
  },
];

export type FitParqAnswers = {
  heart_condition?: boolean | null;
  chest_pain_activity?: boolean | null;
  chest_pain_rest?: boolean | null;
  dizziness_unconscious?: boolean | null;
  taking_medication?: boolean | null;
  other_reason?: boolean | null;
  pain_injuries?: boolean | null;
  surgeries_12m?: boolean | null;
  chronic_disease?: boolean | null;
};

export type FitMemberContract = {
  id: string;
  kind: FitContractKind;
  submitted_at?: string | null;
  heard_about?: string | null;
  employer_student_number?: string | null;
  occupation?: string | null;
  class_option?: string | null;
  class_amount_zar?: number | null;
  debit_amount_zar?: number | null;
  terms_accepted?: boolean;
  parq_accepted?: boolean;
  parq?: FitParqAnswers;
  parq_explanation?: string | null;
  signature_name?: string | null;
  signature_urls?: string[];
  source?: 'onboarding' | 'jotform_import' | 'desk';
  source_id?: string | null;
};

export type FitContractSubmission = {
  kind: FitContractKind | string;
  submitted_at?: string | null;
  heard_about?: string | null;
  name: string;
  id_number?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  start_date?: string | null;
  occupation?: string | null;
  employer_student_number?: string | null;
  medical_aid?: string | null;
  medical_aid_plan?: string | null;
  emergency_contact?: string | null;
  address?: string | null;
  gp?: string | null;
  parq?: FitParqAnswers;
  parq_explanation?: string | null;
  signature_urls?: string[];
  terms_accepted?: boolean;
  parq_accepted?: boolean;
  class_option?: string | null;
  class_amount_zar?: number | null;
  debit_amount_zar?: number | null;
  account_holder?: string | null;
  account_type?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  source?: FitMemberContract['source'];
  source_id?: string | null;
  signature_name?: string | null;
};

export function emptyParq(): FitParqAnswers {
  return {};
}

export function parqYesCount(p?: FitParqAnswers | null): number {
  if (!p) return 0;
  return PARQ_QUESTIONS.filter((q) => p[q.key] === true).length;
}

export function dobFromSaId(idNumber?: string | null): string | null {
  const idn = String(idNumber || '').replace(/\D/g, '');
  if (idn.length !== 13) return null;
  const yy = Number(idn.slice(0, 2));
  const mm = Number(idn.slice(2, 4));
  const dd = Number(idn.slice(4, 6));
  if (!yy && !mm && !dd) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = yy <= 26 ? 2000 + yy : 1900 + yy;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function personKey(row: {
  id_number?: string | null;
  email?: string | null;
  name?: string | null;
}): string {
  const idn = String(row.id_number || '').replace(/\D/g, '');
  if (idn.length === 13) return `id:${idn}`;
  const email = String(row.email || '').trim().toLowerCase();
  if (email.includes('@')) return `em:${email}`;
  return `nm:${normalizePersonName(row.name || '')}`;
}

function asKind(v: unknown): FitContractKind {
  return String(v || '') === 'private' ? 'private' : 'group';
}

export function contractFromSubmission(
  sub: FitContractSubmission,
  now: string
): FitMemberContract {
  return {
    id: sub.source_id ? `con_${sub.source_id}` : newId('con'),
    kind: asKind(sub.kind),
    submitted_at: sub.submitted_at || now.slice(0, 10),
    heard_about: sub.heard_about || null,
    employer_student_number: sub.employer_student_number || null,
    occupation: sub.occupation || null,
    class_option: sub.class_option || null,
    class_amount_zar:
      sub.class_amount_zar != null ? Number(sub.class_amount_zar) : null,
    debit_amount_zar:
      sub.debit_amount_zar != null ? Number(sub.debit_amount_zar) : null,
    terms_accepted: sub.terms_accepted !== false,
    parq_accepted: sub.parq_accepted !== false,
    parq: sub.parq || {},
    parq_explanation: sub.parq_explanation || null,
    signature_urls: Array.isArray(sub.signature_urls)
      ? sub.signature_urls.filter(Boolean)
      : [],
    signature_name: sub.signature_name || null,
    source: sub.source || 'onboarding',
    source_id: sub.source_id || null,
  };
}

function fill(cur: string | null | undefined, next?: string | null): string | undefined {
  const n = String(next || '').trim();
  if (!n) return cur || undefined;
  if (!String(cur || '').trim()) return n;
  return cur || undefined;
}

export function applyContractToClient(
  client: FitClient,
  sub: FitContractSubmission,
  now: string
): FitClient {
  const next: FitClient = { ...client };
  if (sub.name && (!next.name || next.name === 'Client')) next.name = sub.name;
  next.email = fill(next.email, sub.email);
  next.phone = fill(next.phone, sub.phone);
  next.id_number = fill(next.id_number, sub.id_number);
  next.date_of_birth =
    fill(next.date_of_birth, sub.date_of_birth) ||
    fill(next.date_of_birth, dobFromSaId(sub.id_number)) ||
    next.date_of_birth;
  next.occupation = fill(next.occupation, sub.occupation);
  next.heard_about = fill(next.heard_about, sub.heard_about);
  next.employer_student_number = fill(
    next.employer_student_number,
    sub.employer_student_number
  );
  next.address = fill(next.address, sub.address);
  next.gp_contact = fill(next.gp_contact, sub.gp);
  next.emergency_contact = fill(next.emergency_contact, sub.emergency_contact);
  if (sub.emergency_contact && !next.next_of_kin) {
    next.next_of_kin = sub.emergency_contact;
  }
  if (sub.start_date && !next.start_date) next.start_date = sub.start_date;
  const kind = asKind(sub.kind);
  next.contract_kind = kind;
  if (kind === 'private') next.private_client = true;

  const medical = { ...(next.medical || {}) };
  if (sub.address) medical.address = medical.address || sub.address;
  if (sub.gp) medical.gp_name = medical.gp_name || sub.gp;
  if (sub.medical_aid || sub.medical_aid_plan) {
    medical.medical_aid = {
      ...(medical.medical_aid || {}),
      ...(sub.medical_aid ? { scheme_name: sub.medical_aid } : {}),
      ...(sub.medical_aid_plan ? { plan_name: sub.medical_aid_plan } : {}),
    };
  }
  next.medical = medical;

  if (kind === 'group' && (sub.account_number || sub.bank_name)) {
    const scratch: FitClient = {
      ...next,
      debit_bank: next.debit_bank,
    };
    const applied = applyMemberDebitBank(
      scratch,
      {
        account_holder: sub.account_holder || sub.name,
        bank_name: sub.bank_name || 'Other',
        account_number: sub.account_number || '',
        branch_code: '',
        account_type: /sav/i.test(String(sub.account_type || ''))
          ? 'savings'
          : 'cheque',
        debit_order_authorised: true,
      },
      now
    );
    if (applied.ok) next.debit_bank = scratch.debit_bank;
  }

  const parq = sub.parq || {};
  const injured =
    parq.pain_injuries === true ||
    parq.surgeries_12m === true ||
    parq.heart_condition === true ||
    parq.chronic_disease === true;
  if (injured || sub.parq_explanation) {
    next.health = {
      ...(next.health || {}),
      injured: injured || next.health?.injured === true,
      injury_notes:
        next.health?.injury_notes || sub.parq_explanation || '',
      updated_at: now,
      updated_by: 'contract',
    };
  }

  const row = contractFromSubmission(sub, now);
  const existing = next.contracts || [];
  const already = existing.some(
    (c) =>
      (row.source_id && c.source_id === row.source_id) ||
      c.id === row.id
  );
  next.contracts = already ? existing : [...existing, row].slice(-20);
  const same =
    JSON.stringify({ ...client, updated_at: '', join_events: [] }) ===
    JSON.stringify({ ...next, updated_at: '', join_events: [] });
  next.updated_at = same ? client.updated_at : now;
  return next;
}

export function applyContractSubmissions(
  store: FitgraphStore,
  submissions: FitContractSubmission[],
  opts?: { now?: string; replaceRoster?: boolean; importVersion?: string }
): { store: FitgraphStore; changed: boolean; added: number; people: number } {
  const now = opts?.now || new Date().toISOString();
  const today = now.slice(0, 10);
  let changed = false;
  let added = 0;
  if (opts?.replaceRoster) {
    for (const c of store.clients || []) {
      if (!String(c.id).startsWith('vuka_cli_')) continue;
      if (c.active === false && c.membership_status === 'expired') continue;
      c.active = false;
      c.membership_status = 'expired';
      c.updated_at = now;
      changed = true;
    }
    for (const s of store.subscriptions || []) {
      if (!String(s.id).startsWith('vuka_sub_')) continue;
      if (s.status === 'cancelled' || s.status === 'expired') continue;
      s.status = 'cancelled';
      s.cancel_at = today;
      s.updated_at = now;
      changed = true;
    }
    if (!store.settings) {
      store.settings = {
        timezone: 'Africa/Johannesburg',
        currency: 'ZAR',
      };
    }
    if (opts.importVersion) {
      store.settings.vuka_contracts_import = opts.importVersion;
      changed = true;
    }
  }

  const groups = new Map<string, FitContractSubmission[]>();
  for (const sub of submissions) {
    if (!sub?.name) continue;
    const k = personKey(sub);
    const list = groups.get(k) || [];
    list.push(sub);
    groups.set(k, list);
  }

  for (const [, list] of groups) {
    const ordered = [...list].sort((a, b) =>
      String(b.submitted_at || '').localeCompare(String(a.submitted_at || ''))
    );
    const latest = ordered[0];
    const slug = rosterSlug(latest.name);
    const key = personKey(latest);
    let client = (store.clients || []).find((c) => {
      if (c.id === `vuka_cli_${slug}`) return true;
      if (latest.id_number && c.id_number === latest.id_number) return true;
      if (
        latest.email &&
        c.email &&
        c.email.toLowerCase() === latest.email.toLowerCase()
      ) {
        return true;
      }
      return personKey(c) === key;
    });
    if (!client) {
      client = {
        id: `vuka_cli_${slug}`,
        code: `VUKA-${String((store.clients || []).length + 1).padStart(3, '0')}`,
        name: latest.name,
        membership_status: 'active',
        active: true,
        start_date: latest.start_date || today,
        created_at: now,
        updated_at: now,
      };
      store.clients = [...(store.clients || []), client];
      added += 1;
      changed = true;
    }
    const before = JSON.stringify(client);
    let next = {
      ...client,
      active: true,
      membership_status:
        client.membership_status === 'expired' || client.active === false
          ? 'active'
          : client.membership_status || 'active',
    };
    for (const sub of [...ordered].reverse()) {
      next = applyContractToClient(next, sub, now);
    }
    const titled = asKind(latest.kind) === 'private'
      ? 'Private contract on file'
      : 'Group contract on file';
    if (!(next.join_events || []).some((e) => e.title === titled)) {
      next.join_events = appendJoinEvent(next, {
        at: now,
        kind: 'membership_started',
        title: titled,
        source: 'system',
      });
    }
    if (before !== JSON.stringify(next)) {
      const idx = store.clients.findIndex((c) => c.id === next.id);
      if (idx >= 0) store.clients[idx] = next;
      else store.clients.push(next);
      changed = true;
    }
  }

  return { store, changed, added, people: groups.size };
}
