/**
 * VUKA Fitness desk roster — clients + monthly memberships.
 * Applied only for that gym when the catalog loads.
 */
import {
  defaultPublicSettings,
  type FitClient,
  type FitgraphStore,
  type FitMembershipPlan,
  type FitSubscription,
} from '@/lib/fitness/fitgraph';
import { VUKA_MEMBERSHIP_PLANS } from '@/lib/fitness/vuka-class-catalog';
import { allocateMemberToClass } from '@/lib/fitness/class-allocate';
import generated from '@/lib/fitness/vuka-contracts.generated.json';
import {
  applyContractSubmissions,
  type FitContractSubmission,
} from '@/lib/fitness/member-contract';
import {
  clientsAreSamePerson,
  mergeDuplicateFitClients,
  normalizePersonName,
} from '@/lib/fitness/merge-fit-clients';

export {
  clientsAreSamePerson,
  mergeDuplicateFitClients,
  normalizePersonName,
} from '@/lib/fitness/merge-fit-clients';

export type VukaRosterRow = {
  name: string;
  amount_zar: number;
  /** Desk class code: 5AM MWF, BC, KAKB, PILATES, KIDS, 5AM T TH, 6:00 AM */
  class_hint?: string;
  note?: string;
};

/** Unique billed members (Malan Snyman listed once). */
export const VUKA_ROSTER: VukaRosterRow[] = [
  { name: 'Aimee Le Roux', amount_zar: 770.5 },
  { name: 'Athalah Hembert', amount_zar: 770.5 },
  { name: 'Bandile Ntombola', amount_zar: 713 },
  { name: 'Barbara Pretorius', amount_zar: 816.5 },
  { name: 'Bibi Ayesha Yusuf', amount_zar: 574 },
  { name: 'Brett van Niekerk', amount_zar: 354 },
  { name: 'Buyi Makhoba-Dlamini', amount_zar: 828 },
  { name: 'Chantel Ormsby', amount_zar: 736 },
  { name: 'Charlene Lloyds-Ellis', amount_zar: 529 },
  { name: 'Cherie Montile', amount_zar: 448.5 },
  { name: 'Cherri Cannon-Payne', amount_zar: 460 },
  { name: 'Cheryl Marwick', amount_zar: 851 },
  { name: 'Chris Halford', amount_zar: 736 },
  { name: 'Christine J Brown', amount_zar: 775, class_hint: '5AM MWF' },
  { name: 'Dianne OConnor', amount_zar: 770.5 },
  { name: 'Grant Underwood', amount_zar: 770.5 },
  { name: 'Jacques van Rooyen', amount_zar: 471.5 },
  { name: 'JenLyric Easthorpe', amount_zar: 530 },
  { name: 'Jennifer Pike', amount_zar: 448.5 },
  { name: 'Jill Brown', amount_zar: 851 },
  { name: 'JM Van Deventer', amount_zar: 730, class_hint: 'BC' },
  { name: 'Jordan Anastasis', amount_zar: 736 },
  { name: 'Just Maskell', amount_zar: 775 },
  { name: 'Karin Lindsay', amount_zar: 816.5 },
  { name: 'Keriann Naidoo', amount_zar: 1265 },
  { name: 'Kirstin Williams', amount_zar: 471.5 },
  { name: 'Lorraine Naidoo', amount_zar: 1140 },
  { name: 'Lynn Clark', amount_zar: 471.5 },
  { name: 'Lynn Horan', amount_zar: 437 },
  { name: 'Lynne Clarke', amount_zar: 471.5 },
  { name: 'Malan Snyman', amount_zar: 471.5, class_hint: 'BC' },
  { name: 'Mariam Mulla', amount_zar: 770.5 },
  { name: 'Matt Ducass', amount_zar: 437, class_hint: 'BC' },
  { name: 'Melanie Bothma', amount_zar: 770.5, class_hint: 'KAKB' },
  { name: 'Mercedee Uys', amount_zar: 471.5 },
  { name: 'Michelle Haripersadh', amount_zar: 713 },
  { name: 'Michelle Bennett', amount_zar: 736 },
  { name: 'Michelle Kieck', amount_zar: 471.5 },
  { name: 'Nadia Isaac Marais', amount_zar: 530 },
  { name: 'Naseeba Goolam', amount_zar: 460 },
  { name: 'Nonku Masikane', amount_zar: 908.5 },
  { name: 'Nqobile Mkhize', amount_zar: 471.5, class_hint: 'BC' },
  { name: 'Nyasha Luvuno', amount_zar: 908.5, class_hint: '5AM MWF' },
  { name: 'Phindile Dlamini', amount_zar: 828 },
  { name: 'Razina Gangat', amount_zar: 908.5 },
  { name: 'Rivash Rubychand', amount_zar: 770.5 },
  { name: 'Rochelle Oosthuizen', amount_zar: 471.5 },
  { name: 'Romaana Phillip', amount_zar: 713 },
  { name: 'Ronel Veldsman', amount_zar: 1500 },
  { name: 'Roscoe Sprong', amount_zar: 471.5 },
  { name: 'Roxanne Meyer', amount_zar: 471.5 },
  { name: 'Sue Freese', amount_zar: 855, class_hint: 'PILATES' },
  { name: 'Sue Westhorpe', amount_zar: 855, class_hint: 'PILATES' },
  { name: 'Saru Mahomva', amount_zar: 471.5, class_hint: 'BC' },
  { name: 'Sashika Rubychand', amount_zar: 475 },
  {
    name: 'Shaun Roberts',
    amount_zar: 530,
    class_hint: 'KIDS',
    note: 'ZACH kids Gym',
  },
  { name: 'Taki Anastasis', amount_zar: 736 },
  { name: 'Tina Sewgolam', amount_zar: 713 },
  { name: 'Tom Bloy', amount_zar: 713, class_hint: '5AM T TH' },
  { name: 'Wendy K Couling', amount_zar: 574, class_hint: 'BC' },
  { name: 'Wesleigh Myburgh', amount_zar: 1100 },
  { name: 'Yenziwe Ndlovu', amount_zar: 236, class_hint: '6:00 AM' },
  { name: 'Yune van Niekerk', amount_zar: 354 },
  { name: 'Yunis Leandre Herbert', amount_zar: 1200, class_hint: '5AM T TH' },
];

export function rosterSlug(name: string): string {
  return normalizePersonName(name).replace(/\s+/g, '_').slice(0, 42);
}

const NEAR = 5;

function planByCode(code: string) {
  return VUKA_MEMBERSHIP_PLANS.find((p) => p.code === code) || null;
}

/** Map desk shorthand (5AM MWF, BC, KAKB, …) onto a catalog class. */
export function matchClassHint(
  hint?: string
): (typeof VUKA_MEMBERSHIP_PLANS)[number] | null {
  const h = String(hint || '').trim();
  if (!h) return null;
  if (/kids/i.test(h)) return planByCode('VUKA_KIDS');
  if (/pilates/i.test(h)) return planByCode('VUKA_PILATES_2');
  if (/5\s*am.*m\s*w\s*f|mwf|m\/w\/f|fsf/i.test(h)) {
    return planByCode('VUKA_FSF_5AM');
  }
  if (/5\s*am.*t.*th|t\s*\/?\s*th|gents/i.test(h)) {
    return planByCode('VUKA_GENTS_5AM');
  }
  if (/6\s*(:00)?\s*am/i.test(h)) return planByCode('VUKA_KB_6AM');
  if (/kakb|kb\s*16|4:?30\s*pm|kettle/i.test(h)) {
    return planByCode('VUKA_KB_1630');
  }
  if (/\bbc\b|boot/i.test(h)) return planByCode('VUKA_BOOT_1730');
  return null;
}

export function matchCatalogPlan(
  amount: number,
  hint?: string
): (typeof VUKA_MEMBERSHIP_PLANS)[number] | null {
  const fromHint = matchClassHint(hint);
  if (fromHint) {
    if (/pilates/i.test(hint || '')) {
      const pilates = VUKA_MEMBERSHIP_PLANS.filter((p) =>
        String(p.code || '').startsWith('VUKA_PILATES')
      );
      const byAmt = pilates.find(
        (p) => Math.abs(Number(p.price_zar) - amount) <= NEAR
      );
      if (byAmt) return byAmt;
    }
    return fromHint;
  }
  if (/kids/i.test(hint || '')) {
    const kids = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_KIDS');
    if (kids) return kids;
  }
  const exact = VUKA_MEMBERSHIP_PLANS.filter(
    (p) => Math.abs(Number(p.price_zar) - amount) < 0.005
  );
  if (exact.length === 1) return exact[0];
  const near = VUKA_MEMBERSHIP_PLANS.filter(
    (p) => Math.abs(Number(p.price_zar) - amount) <= NEAR
  );
  if (near.length === 1) return near[0];
  return null;
}

export function isVukaDeskPlan(p: {
  id?: string;
  code?: string | null;
}): boolean {
  return (
    String(p.id || '').startsWith('vuka_pln_desk_') ||
    String(p.code || '').startsWith('VUKA_DESK_')
  );
}

/** Drop synthetic desk rates and any subs pointing at them. */
export function removeVukaDeskPlans(store: FitgraphStore): boolean {
  const drop = new Set(
    (store.membership_plans || [])
      .filter((p) => isVukaDeskPlan(p))
      .map((p) => p.id)
  );
  if (!drop.size) return false;
  store.membership_plans = store.membership_plans.filter((p) => !drop.has(p.id));
  store.subscriptions = (store.subscriptions || []).filter(
    (s) => !drop.has(s.plan_id)
  );
  for (const c of store.clients || []) {
    if (c.membership_plan_id && drop.has(c.membership_plan_id)) {
      c.membership_plan_id = null;
    }
  }
  return true;
}

function resolvePlan(
  store: FitgraphStore,
  amount: number,
  hint: string | undefined
): FitMembershipPlan | null {
  const catalog = matchCatalogPlan(amount, hint);
  if (!catalog) return null;
  return (
    store.membership_plans.find(
      (p) => p.id === catalog.id || p.code === catalog.code
    ) || null
  );
}

export const VUKA_BILLED_CLASS_IMPORT = '2026-08-20-classcodes-v2';
export const VUKA_MEMBER_MERGE = '2026-08-20-merge';

export const VUKA_CONTRACTS_IMPORT = `${String(
  (generated as { import_version?: string }).import_version || '2026-08-19'
)}-bank`;
export const VUKA_CONTRACT_SUBMISSIONS = ((
  generated as { submissions?: FitContractSubmission[] }
).submissions || []) as FitContractSubmission[];

function attachContractRates(
  store: FitgraphStore,
  now: string
): boolean {
  const today = now.slice(0, 10);
  let changed = false;
  for (const client of store.clients || []) {
    if (client.active === false) continue;
    const latest = [...(client.contracts || [])].sort((a, b) =>
      String(b.submitted_at || '').localeCompare(String(a.submitted_at || ''))
    )[0];
    if (!latest || latest.kind === 'private') continue;
    const amount = Number(latest.debit_amount_zar || latest.class_amount_zar || 0);
    if (!(amount > 0)) continue;
    const plan = resolvePlan(store, amount, latest.class_option || undefined);
    if (!plan) continue;
    if (client.membership_plan_id !== plan.id) {
      client.membership_plan_id = plan.id;
      client.updated_at = now;
      changed = true;
    }
    const slug = rosterSlug(client.name);
    const subId = `vuka_sub_${slug}`;
    const existingSub = store.subscriptions.find(
      (s) =>
        s.id === subId ||
        (s.client_id === client.id &&
          s.plan_id === plan.id &&
          (s.status === 'active' || s.status === 'trialing'))
    );
    if (!existingSub) {
      const sub: FitSubscription = {
        id: subId,
        client_id: client.id,
        plan_id: plan.id,
        status: 'active',
        started_at: client.start_date || today,
        auto_renew: true,
        charged_zar: amount,
        notes: 'Group contract',
        created_at: now,
        updated_at: now,
      };
      store.subscriptions.push(sub);
      changed = true;
    } else if (existingSub.status === 'cancelled') {
      existingSub.status = 'active';
      existingSub.charged_zar = amount;
      existingSub.updated_at = now;
      changed = true;
    }
  }
  return changed;
}

function findRosterClient(
  store: FitgraphStore,
  row: VukaRosterRow
): FitClient | undefined {
  const slug = rosterSlug(row.name);
  const probe: FitClient = {
    id: `vuka_cli_${slug}`,
    code: '',
    name: row.name,
    created_at: '',
    updated_at: '',
  };
  return (store.clients || []).find(
    (c) => c.id === probe.id || clientsAreSamePerson(c, probe)
  );
}

function upsertBilledRoster(
  store: FitgraphStore,
  now: string,
  opts?: { createOnly?: boolean }
): boolean {
  const today = now.slice(0, 10);
  const createOnly = opts?.createOnly === true;
  let changed = false;
  for (const row of VUKA_ROSTER) {
    let client = findRosterClient(store, row);
    if (!client) {
      const slug = rosterSlug(row.name);
      client = {
        id: `vuka_cli_${slug}`,
        code: `VUKA-${String((store.clients || []).length + 1).padStart(3, '0')}`,
        name: row.name,
        membership_status: 'active',
        active: true,
        start_date: today,
        notes: row.note || undefined,
        created_at: now,
        updated_at: now,
      };
      store.clients = [...(store.clients || []), client];
      changed = true;
      if (createOnly && row.class_hint) {
        const plan = resolvePlan(store, row.amount_zar, row.class_hint);
        if (plan) {
          allocateMemberToClass(store, {
            clientId: client.id,
            planId: plan.id,
            chargedZar: row.amount_zar,
            member: true,
            bookUpcoming: true,
            now,
          });
        }
      }
      continue;
    }
    if (createOnly) continue;
    if (client.active === false) continue;
    if (client.name !== row.name) {
      client.name = row.name;
      client.updated_at = now;
      changed = true;
    }
    if (row.note && !(client.notes || '').includes(row.note)) {
      client.notes = client.notes ? `${client.notes} · ${row.note}` : row.note;
      client.updated_at = now;
      changed = true;
    }
  }
  return changed;
}

function clientHasLiveClass(store: FitgraphStore, clientId: string): boolean {
  const client = (store.clients || []).find((c) => c.id === clientId);
  if (client?.membership_plan_id) return true;
  return (store.subscriptions || []).some(
    (s) =>
      s.client_id === clientId &&
      (s.status === 'active' || s.status === 'trialing')
  );
}

function applyBilledClassAllocations(
  store: FitgraphStore,
  now: string
): boolean {
  if (store.settings?.vuka_billed_class_import === VUKA_BILLED_CLASS_IMPORT) {
    return false;
  }
  let changed = false;
  for (const row of VUKA_ROSTER) {
    const plan = resolvePlan(store, row.amount_zar, row.class_hint);
    if (!plan) continue;
    const client = findRosterClient(store, row);
    if (!client) continue;
    if (client.active === false) continue;
    if (!row.class_hint && clientHasLiveClass(store, client.id)) continue;
    const result = allocateMemberToClass(store, {
      clientId: client.id,
      planId: plan.id,
      chargedZar: row.amount_zar,
      member: true,
      privateClient: client.private_client === true,
      coachId: client.coach_id || plan.default_coach_id || null,
      bookUpcoming: Boolean(row.class_hint),
      now,
    });
    if (!('error' in result)) changed = true;
  }
  if (!store.settings) store.settings = defaultPublicSettings();
  store.settings.vuka_billed_class_import = VUKA_BILLED_CLASS_IMPORT;
  return true;
}

export function vukaDeskSettled(store: FitgraphStore): boolean {
  const s = store.settings;
  return Boolean(
    s &&
      s.vuka_calendar_manual === true &&
      s.vuka_contracts_import === VUKA_CONTRACTS_IMPORT &&
      s.vuka_member_merge === VUKA_MEMBER_MERGE &&
      s.vuka_billed_class_import === VUKA_BILLED_CLASS_IMPORT
  );
}

export function ensureVukaRoster(
  store: FitgraphStore,
  opts?: { now?: string }
): { store: FitgraphStore; changed: boolean; added: number } {
  const now = opts?.now || new Date().toISOString();
  let changed = removeVukaDeskPlans(store);
  const contractsLive =
    store.settings?.vuka_contracts_import === VUKA_CONTRACTS_IMPORT;
  if (contractsLive) {
    if (upsertBilledRoster(store, now, { createOnly: true })) changed = true;
    if (store.settings?.vuka_member_merge !== VUKA_MEMBER_MERGE) {
      const merged = mergeDuplicateFitClients(store, {
        now,
        preferredNames: VUKA_ROSTER.map((r) => r.name),
      });
      if (merged.changed) changed = true;
      if (!store.settings) store.settings = defaultPublicSettings();
      store.settings.vuka_member_merge = VUKA_MEMBER_MERGE;
      changed = true;
    }
    if (store.settings?.vuka_billed_class_import !== VUKA_BILLED_CLASS_IMPORT) {
      if (applyBilledClassAllocations(store, now)) changed = true;
    }
    return { store, changed, added: 0 };
  }
  const replace =
    store.settings?.vuka_contracts_import !== VUKA_CONTRACTS_IMPORT;
  const applied = applyContractSubmissions(store, VUKA_CONTRACT_SUBMISSIONS, {
    now,
    replaceRoster: replace,
    importVersion: VUKA_CONTRACTS_IMPORT,
  });
  changed = changed || applied.changed;
  if (upsertBilledRoster(store, now)) changed = true;
  const merged = mergeDuplicateFitClients(store, {
    now,
    preferredNames: VUKA_ROSTER.map((r) => r.name),
  });
  if (merged.changed) changed = true;
  if (!store.settings) store.settings = defaultPublicSettings();
  if (store.settings.vuka_member_merge !== VUKA_MEMBER_MERGE) {
    store.settings.vuka_member_merge = VUKA_MEMBER_MERGE;
    changed = true;
  }
  if (attachContractRates(store, now)) changed = true;
  if (applyBilledClassAllocations(store, now)) changed = true;
  return { store, changed, added: applied.added };
}
