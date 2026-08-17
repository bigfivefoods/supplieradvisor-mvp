/**
 * VUKA Fitness desk roster — clients + monthly memberships.
 * Applied only for that gym when the catalog loads.
 */
import type {
  FitClient,
  FitgraphStore,
  FitMembershipPlan,
  FitSubscription,
} from '@/lib/fitness/fitgraph';
import { VUKA_MEMBERSHIP_PLANS } from '@/lib/fitness/vuka-class-catalog';

export type VukaRosterRow = {
  name: string;
  amount_zar: number;
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
  { name: 'Christine J Brown', amount_zar: 775 },
  { name: 'Dianne OConnor', amount_zar: 770.5 },
  { name: 'Grant Underwood', amount_zar: 770.5 },
  { name: 'Jacques van Rooyen', amount_zar: 471.5 },
  { name: 'JenLyric Easthorpe', amount_zar: 530 },
  { name: 'Jennifer Pike', amount_zar: 448.5 },
  { name: 'Jill Brown', amount_zar: 851 },
  { name: 'JM Van Deventer', amount_zar: 730 },
  { name: 'Jordan Anastasis', amount_zar: 736 },
  { name: 'Just Maskell', amount_zar: 775 },
  { name: 'Karin Lindsay', amount_zar: 816.5 },
  { name: 'Keriann Naidoo', amount_zar: 1265 },
  { name: 'Kirstin Williams', amount_zar: 471.5 },
  { name: 'Lorraine Naidoo', amount_zar: 1140 },
  { name: 'Lynn Clark', amount_zar: 471.5 },
  { name: 'Lynn Horan', amount_zar: 437 },
  { name: 'Lynne Clarke', amount_zar: 471.5 },
  { name: 'Malan Snyman', amount_zar: 471.5 },
  { name: 'Mariam Mulla', amount_zar: 770.5 },
  { name: 'Matt Ducass', amount_zar: 437 },
  { name: 'Melanie Bothma', amount_zar: 770.5 },
  { name: 'Mercedee Uys', amount_zar: 471.5 },
  { name: 'Michelle Haripersadh', amount_zar: 713 },
  { name: 'Michelle Bennett', amount_zar: 736 },
  { name: 'Michelle Kieck', amount_zar: 471.5 },
  { name: 'Nadia Isaac Marais', amount_zar: 530 },
  { name: 'Naseeba Goolam', amount_zar: 460 },
  { name: 'Nonku Masikane', amount_zar: 908.5 },
  { name: 'Nqobile Mkhize', amount_zar: 471.5 },
  { name: 'Nyasha Luvuno', amount_zar: 908.5 },
  { name: 'Phindile Dlamini', amount_zar: 828 },
  { name: 'Razina Gangat', amount_zar: 908.5 },
  { name: 'Rivash Rubychand', amount_zar: 770.5 },
  { name: 'Rochelle Oosthuizen', amount_zar: 471.5 },
  { name: 'Romaana Phillip', amount_zar: 713 },
  { name: 'Ronel Veldsman', amount_zar: 1500 },
  { name: 'Roscoe Sprong', amount_zar: 471.5 },
  { name: 'Roxanne Meyer', amount_zar: 471.5 },
  { name: 'Sue Freese', amount_zar: 855 },
  { name: 'Sue (S Westhorpe)', amount_zar: 855 },
  { name: 'Saru Mahomva', amount_zar: 471.5 },
  { name: 'Sashika Rubychand', amount_zar: 475 },
  {
    name: 'Shaun Roberts',
    amount_zar: 530,
    note: 'ZACH kids Gym',
  },
  { name: 'Taki Anastasis', amount_zar: 736 },
  { name: 'Tina Sewgolam', amount_zar: 713 },
  { name: 'Tom Bloy', amount_zar: 713 },
  { name: 'Wendy K Couling', amount_zar: 574 },
  { name: 'Wesleigh Myburgh', amount_zar: 1100 },
  { name: 'Yenziwe Ndlovu', amount_zar: 236 },
  { name: 'Yune van Niekerk', amount_zar: 354 },
  { name: 'Yunis Leandre Herbert', amount_zar: 1200 },
];

export function normalizePersonName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function rosterSlug(name: string): string {
  return normalizePersonName(name).replace(/\s+/g, '_').slice(0, 42);
}

const NEAR = 5;

export function matchCatalogPlan(
  amount: number,
  hint?: string
): (typeof VUKA_MEMBERSHIP_PLANS)[number] | null {
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

export function ensureVukaRoster(
  store: FitgraphStore,
  opts?: { now?: string }
): { store: FitgraphStore; changed: boolean; added: number } {
  const now = opts?.now || new Date().toISOString();
  const today = now.slice(0, 10);
  let changed = removeVukaDeskPlans(store);
  let added = 0;

  for (const row of VUKA_ROSTER) {
    const slug = rosterSlug(row.name);
    const key = normalizePersonName(row.name);
    let client = store.clients.find(
      (c) =>
        c.id === `vuka_cli_${slug}` ||
        normalizePersonName(c.name) === key
    );
    if (!client) {
      client = {
        id: `vuka_cli_${slug}`,
        code: `VUKA-${String(added + 1).padStart(3, '0')}`,
        name: row.name,
        notes: row.note
          ? `Roster import · ${row.note} · R${row.amount_zar.toFixed(2)}/pm`
          : `Roster import · R${row.amount_zar.toFixed(2)}/pm`,
        membership_status: 'active',
        active: true,
        start_date: today,
        created_at: now,
        updated_at: now,
      };
      store.clients.push(client);
      changed = true;
      added += 1;
    } else if (client.active === false) {
      client.active = true;
      client.membership_status = 'active';
      client.updated_at = now;
      changed = true;
    }

    const billed = `R${row.amount_zar.toFixed(2)}/pm`;
    const note = [row.note, billed, 'Roster import'].filter(Boolean).join(' · ');
    if (!client.notes || !client.notes.includes(billed)) {
      client.notes = note;
      client.updated_at = now;
      changed = true;
    }

    const plan = resolvePlan(store, row.amount_zar, row.note);
    if (!plan) {
      if (client.membership_plan_id) {
        const held = store.membership_plans.find(
          (p) => p.id === client.membership_plan_id
        );
        if (!held || isVukaDeskPlan(held)) {
          client.membership_plan_id = null;
          client.updated_at = now;
          changed = true;
        }
      }
      store.subscriptions = (store.subscriptions || []).filter(
        (s) => !(s.client_id === client.id && s.id === `vuka_sub_${slug}`)
      );
      continue;
    }

    if (client.membership_plan_id !== plan.id) {
      client.membership_plan_id = plan.id;
      client.updated_at = now;
      changed = true;
    }

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
        started_at: today,
        auto_renew: true,
        notes: note,
        created_at: now,
        updated_at: now,
      };
      store.subscriptions.push(sub);
      changed = true;
    }
  }

  return { store, changed, added };
}
