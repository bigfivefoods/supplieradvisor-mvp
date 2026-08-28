/**
 * Member account ledger on company metadata.member_accounts.
 */
import {
  readFitgraphFromMetadata,
  subscriptionChargeZar,
} from '@/lib/fitness/fitgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readHiregraphFromMetadata } from '@/lib/hire/hiregraph';
import {
  emptyMemberAccountStore,
  chargeBalance,
  type AdvisorAccountKind,
  type AdvisorAccountModule,
  type MemberAccountCharge,
  type MemberAccountPayment,
  type MemberAccountStore,
  type MemberAccountSuggestion,
  type MemberAccountSummary,
  type MemberChargeSource,
} from '@/lib/b2c/member-account-types';

export function newMemberAccountId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readMemberAccountStore(
  meta: Record<string, unknown>
): MemberAccountStore {
  const raw = meta.member_accounts;
  if (!raw || typeof raw !== 'object') return emptyMemberAccountStore();
  const o = raw as Record<string, unknown>;
  const charges = Array.isArray(o.charges)
    ? (o.charges as MemberAccountCharge[]).filter((c) => c && c.id)
    : [];
  const payments = Array.isArray(o.payments)
    ? (o.payments as MemberAccountPayment[]).filter((p) => p && p.id)
    : [];
  return {
    charges,
    payments,
    updated_at: o.updated_at ? String(o.updated_at) : undefined,
  };
}

export function writeMemberAccountStore(
  meta: Record<string, unknown>,
  store: MemberAccountStore
): Record<string, unknown> {
  return {
    ...meta,
    member_accounts: {
      charges: store.charges.slice(0, 8000),
      payments: store.payments.slice(0, 8000),
      updated_at: new Date().toISOString(),
    },
  };
}

export function chargeMatchesMember(
  c: MemberAccountCharge,
  opts: {
    kind?: AdvisorAccountKind | null;
    ref_id?: string | null;
    email?: string | null;
    userId?: string | null;
  }
): boolean {
  if (opts.kind && c.kind !== opts.kind) return false;
  const ref = String(opts.ref_id || '').trim();
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  const uid = String(opts.userId || '').trim();
  if (!ref && !email && !uid) return false;
  if (ref && String(c.ref_id) === ref) return true;
  if (uid && c.member_user_id && c.member_user_id === uid) return true;
  if (email && c.member_email && String(c.member_email).toLowerCase() === email)
    return true;
  return false;
}

export function chargesForMember(
  store: MemberAccountStore,
  opts: {
    kind?: AdvisorAccountKind | null;
    ref_id?: string | null;
    email?: string | null;
    userId?: string | null;
  }
): MemberAccountCharge[] {
  return store.charges.filter((c) => chargeMatchesMember(c, opts));
}

export function paymentsForCharges(
  store: MemberAccountStore,
  chargeIds: string[]
): MemberAccountPayment[] {
  const set = new Set(chargeIds);
  return store.payments.filter((p) =>
    (p.charge_ids || []).some((id) => set.has(id))
  );
}

export function paymentsForMember(
  store: MemberAccountStore,
  opts: {
    kind?: AdvisorAccountKind | null;
    ref_id?: string | null;
    email?: string | null;
    userId?: string | null;
  }
): MemberAccountPayment[] {
  const charges = chargesForMember(store, opts);
  const ids = new Set(charges.map((c) => c.id));
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  const uid = String(opts.userId || '').trim();
  const ref = String(opts.ref_id || '').trim();
  const seen = new Set<string>();
  const out: MemberAccountPayment[] = [];
  for (const p of store.payments) {
    if (!p?.id || seen.has(p.id)) continue;
    const hit =
      (p.charge_ids || []).some((id) => ids.has(id)) ||
      (ref && p.ref_id === ref) ||
      (uid && p.member_user_id === uid) ||
      (email &&
        p.member_email &&
        String(p.member_email).toLowerCase() === email);
    if (!hit) continue;
    if (opts.kind && p.kind && p.kind !== opts.kind) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out.sort((a, b) =>
    String(b.paid_at || '').localeCompare(String(a.paid_at || ''))
  );
}

/** Oldest open charges that the amount can cover in full (FIFO). */
export function openChargesCoveredByAmount(
  charges: MemberAccountCharge[],
  amountZar: number
): MemberAccountCharge[] {
  const open = charges
    .filter((c) => c.status === 'open' || c.status === 'pending_pop')
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const picked: MemberAccountCharge[] = [];
  let left = Math.round((Number(amountZar) || 0) * 100) / 100;
  for (const c of open) {
    const amt = Math.round((Number(c.amount_zar) || 0) * 100) / 100;
    if (!(amt > 0) || left + 0.009 < amt) break;
    picked.push(c);
    left = Math.round((left - amt) * 100) / 100;
  }
  return picked;
}

export function summarizeCharges(
  companyId: number,
  brand: string,
  kind: AdvisorAccountKind,
  refId: string,
  charges: MemberAccountCharge[]
): MemberAccountSummary {
  const open = charges.filter((c) => c.status === 'open');
  const pending = charges.filter((c) => c.status === 'pending_pop');
  const paid = charges.filter((c) => c.status === 'paid');
  const named = charges.find((c) => c.member_name)?.member_name || 'Member';
  return {
    company_id: companyId,
    brand,
    kind,
    ref_id: refId,
    member_name: named,
    open_zar: open.reduce((n, c) => n + chargeBalance(c), 0),
    pending_zar: pending.reduce((n, c) => n + (Number(c.amount_zar) || 0), 0),
    paid_zar: paid.reduce((n, c) => n + (Number(c.amount_zar) || 0), 0),
    open_count: open.length,
    pending_count: pending.length,
  };
}

export function existingSourceIds(store: MemberAccountStore): Set<string> {
  const s = new Set<string>();
  for (const c of store.charges) {
    if (c.source_id && c.status !== 'void') s.add(c.source_id);
  }
  return s;
}

/** True if this suggestion was already billed (including legacy combined gym month ids). */
export function isSuggestionBilled(billed: Set<string>, sourceId: string): boolean {
  if (billed.has(sourceId)) return true;
  const m = /^mem:([^:]+):(\d{4}-\d{2}):(class|private)$/.exec(sourceId);
  if (m && billed.has(`mem:${m[1]}:${m[2]}`)) return true;
  return false;
}

export type GymAccountPerson = {
  ref_id: string;
  name: string;
  email?: string | null;
  platform_user_id?: string | null;
  group: 'member' | 'private' | 'left';
  private_client: boolean;
  membership: boolean;
  active: boolean;
  status?: string | null;
};

const LEFT_STATUSES = new Set([
  'cancelled',
  'ended',
  'expired',
  'left',
  'inactive',
]);

export function gymAccountPeople(
  meta: Record<string, unknown>
): GymAccountPerson[] {
  const store = readFitgraphFromMetadata(meta);
  const live = new Set(
    (store.subscriptions || [])
      .filter(
        (s) =>
          s.status === 'active' ||
          s.status === 'trialing' ||
          s.status === 'past_due'
      )
      .map((s) => s.client_id)
  );
  return (store.clients || [])
    .map((c) => {
      const membership = live.has(c.id) || Boolean(c.membership_plan_id);
      const left =
        c.active === false ||
        LEFT_STATUSES.has(String(c.membership_status || '').toLowerCase());
      const privateClient =
        c.private_client === true || c.contract_kind === 'private';
      const group: GymAccountPerson['group'] = left
        ? 'left'
        : privateClient
          ? 'private'
          : 'member';
      return {
        ref_id: c.id,
        name: c.name,
        email: c.email || null,
        platform_user_id: c.platform_user_id || null,
        group,
        private_client: privateClient,
        membership,
        active: c.active !== false,
        status: c.membership_status || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function clinicLike(store: {
  patients?: Array<{
    id: string;
    name: string;
    email?: string;
  }>;
  services?: Array<{ id: string; name: string; price_zar?: number }>;
  appointments?: Array<{
    id: string;
    service_id: string;
    date: string;
    start_time: string;
    materials?: Array<{
      billable?: boolean;
      quantity?: number;
      unit_price?: number;
    }>;
  }>;
  bookings?: Array<{
    id: string;
    appointment_id: string;
    patient_id: string;
    status: string;
  }>;
}): MemberAccountSuggestion[] {
  const out: MemberAccountSuggestion[] = [];
  const patients = store.patients || [];
  const services = store.services || [];
  const appointments = store.appointments || [];
  const bookings = store.bookings || [];
  for (const b of bookings) {
    if (String(b.status) !== 'attended') continue;
    const patient = patients.find((p) => p.id === b.patient_id);
    const appt = appointments.find((a) => a.id === b.appointment_id);
    if (!patient || !appt) continue;
    const svc = services.find((s) => s.id === appt.service_id);
    const materialsZar = (appt.materials || []).reduce((n, l) => {
      if (l.billable === false) return n;
      return n + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
    }, 0);
    const amount = Number(svc?.price_zar || 0) + materialsZar;
    if (!(amount > 0)) continue;
    out.push({
      source: 'visit',
      source_id: `visit:${b.id}`,
      kind: 'medical',
      ref_id: patient.id,
      member_name: patient.name,
      member_email: patient.email || null,
      description: `${svc?.name || 'Visit'} · ${appt.date}`,
      amount_zar: amount,
      due_date: appt.date,
    });
  }
  return out;
}

export function collectSuggestions(
  module: AdvisorAccountModule,
  meta: Record<string, unknown>
): MemberAccountSuggestion[] {
  const today = new Date().toISOString().slice(0, 10);

  if (module === 'fitgraph') {
    const store = readFitgraphFromMetadata(meta);
    const out: MemberAccountSuggestion[] = [];
    const plans = store.membership_plans || [];
    const month = today.slice(0, 7);
    const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleString(
      'en-ZA',
      { month: 'long', year: 'numeric' }
    );
    for (const client of store.clients || []) {
      if (client.active === false) continue;
      const liveSubs = (store.subscriptions || []).filter(
        (s) =>
          s.client_id === client.id &&
          (s.status === 'active' ||
            s.status === 'trialing' ||
            s.status === 'past_due')
      );
      const plan = plans.find(
        (p) => p.id === (liveSubs[0]?.plan_id || client.membership_plan_id)
      );
      const isMember = Boolean(liveSubs.length || client.membership_plan_id);
      const classZar = liveSubs.length
        ? liveSubs.reduce((n, s) => {
            const p = plans.find((x) => x.id === s.plan_id);
            return n + subscriptionChargeZar(s, p);
          }, 0)
        : isMember
          ? client.agreed_rate_zar != null &&
            Number.isFinite(Number(client.agreed_rate_zar))
            ? Number(client.agreed_rate_zar)
            : Number(plan?.price_zar) || 0
          : 0;
      const privateZar =
        (client.private_client === true || client.contract_kind === 'private') &&
        Number(client.private_rate_zar) > 0
          ? Number(client.private_rate_zar)
          : 0;
      const classNames = liveSubs
        .map((s) => plans.find((p) => p.id === s.plan_id)?.name)
        .filter((n): n is string => Boolean(n));
      const classLabel = classNames.length
        ? classNames.join(' + ')
        : plan?.name || 'Membership';
      const base = {
        kind: 'gym' as const,
        ref_id: client.id,
        member_name: client.name,
        member_email: client.email || null,
        due_date: today,
        source: 'subscription' as const,
      };
      if (classZar > 0) {
        out.push({
          ...base,
          source_id: `mem:${client.id}:${month}:class`,
          description: `${classLabel} · ${monthLabel}`,
          amount_zar: classZar,
        });
      }
      if (privateZar > 0) {
        out.push({
          ...base,
          source_id: `mem:${client.id}:${month}:private`,
          description: `Private · ${monthLabel}`,
          amount_zar: privateZar,
        });
      }
    }
    return out;
  }

  if (module === 'retailgraph') return [];

  if (module === 'hiregraph') {
    const store = readHiregraphFromMetadata(meta);
    const skip = new Set([
      'draft',
      'cancelled',
      'paid',
    ]);
    const out: MemberAccountSuggestion[] = [];
    for (const b of store.bookings || []) {
      if (skip.has(String(b.status || '').toLowerCase())) continue;
      const amount = Number(b.customer_pays_zar || b.rental_zar || 0);
      if (!(amount > 0)) continue;
      const ref = String(b.crm_customer_id || b.customer_id || '');
      if (!ref) continue;
      out.push({
        source: 'hire',
        source_id: `hire:${b.id}`,
        kind: 'hire',
        ref_id: ref,
        member_name: b.customer_name || 'Hirer',
        member_email: null,
        description: `${b.item_title || 'Hire'} · ${b.code || b.id}`,
        amount_zar: amount,
        due_date: b.start_date || null,
      });
    }
    return out;
  }

  let store: ReturnType<typeof readMedicalgraphFromMetadata> | null = null;
  let kind: AdvisorAccountKind = 'medical';
  if (module === 'physiograph') {
    store = readPhysiographFromMetadata(meta) as never;
    kind = 'physio';
  } else if (module === 'dentalgraph') {
    store = readDentalgraphFromMetadata(meta) as never;
    kind = 'dental';
  } else if (module === 'psychiatrygraph') {
    store = readPsychiatrygraphFromMetadata(meta) as never;
    kind = 'psychiatry';
  } else if (module === 'vetgraph') {
    store = readVetgraphFromMetadata(meta) as never;
    kind = 'vet';
  } else {
    store = readMedicalgraphFromMetadata(meta);
    kind = 'medical';
  }
  return clinicLike(store).map((s) => ({ ...s, kind }));
}

export function suggestionToCharge(
  s: MemberAccountSuggestion,
  createdBy?: string | null
): MemberAccountCharge {
  return {
    id: newMemberAccountId('mac'),
    kind: s.kind,
    ref_id: s.ref_id,
    member_name: s.member_name,
    member_email: s.member_email || null,
    description: s.description,
    amount_zar: Math.round(s.amount_zar * 100) / 100,
    status: 'open',
    due_date: s.due_date || null,
    created_at: new Date().toISOString(),
    created_by: createdBy || null,
    source: s.source,
    source_id: s.source_id,
  };
}

export function addCharge(
  store: MemberAccountStore,
  charge: MemberAccountCharge
): MemberAccountStore {
  return { ...store, charges: [charge, ...store.charges] };
}

export function patchCharge(
  store: MemberAccountStore,
  chargeId: string,
  patch: Partial<MemberAccountCharge>
): MemberAccountStore {
  return {
    ...store,
    charges: store.charges.map((c) =>
      c.id === chargeId ? { ...c, ...patch } : c
    ),
  };
}

export function addPayment(
  store: MemberAccountStore,
  payment: MemberAccountPayment
): MemberAccountStore {
  return { ...store, payments: [payment, ...store.payments] };
}

export function patchPayment(
  store: MemberAccountStore,
  paymentId: string,
  patch: Partial<MemberAccountPayment>
): MemberAccountStore {
  return {
    ...store,
    payments: store.payments.map((p) =>
      p.id === paymentId ? { ...p, ...patch } : p
    ),
  };
}

export function applyConfirmedPayment(
  store: MemberAccountStore,
  payment: MemberAccountPayment
): MemberAccountStore {
  const ids = new Set(payment.charge_ids);
  return {
    charges: store.charges.map((c) =>
      ids.has(c.id) && c.status !== 'void' && c.status !== 'paid'
        ? { ...c, status: 'paid' as const }
        : c
    ),
    payments: [
      payment,
      ...store.payments.filter((p) => p.id !== payment.id),
    ],
    updated_at: new Date().toISOString(),
  };
}

export function markChargesPendingPop(
  store: MemberAccountStore,
  chargeIds: string[]
): MemberAccountStore {
  const ids = new Set(chargeIds);
  return {
    ...store,
    charges: store.charges.map((c) =>
      ids.has(c.id) && c.status === 'open'
        ? { ...c, status: 'pending_pop' as const }
        : c
    ),
  };
}

export function reopenCharges(
  store: MemberAccountStore,
  chargeIds: string[]
): MemberAccountStore {
  const ids = new Set(chargeIds);
  return {
    ...store,
    charges: store.charges.map((c) =>
      ids.has(c.id) && c.status === 'pending_pop'
        ? { ...c, status: 'open' as const }
        : c
    ),
  };
}

export function openChargesByIds(
  store: MemberAccountStore,
  chargeIds: string[]
): MemberAccountCharge[] {
  const ids = new Set(chargeIds);
  return store.charges.filter(
    (c) => ids.has(c.id) && (c.status === 'open' || c.status === 'pending_pop')
  );
}

export type { MemberChargeSource };
