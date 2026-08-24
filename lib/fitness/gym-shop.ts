/**
 * GymAdvisor paid shop — memberships and programmes.
 * Card / Apple Pay collects on SupplierAdvisor Paystack. When the gym has
 * a payout bank, Paystack splits 1% admin to SA; otherwise SA holds funds.
 */
import {
  evaluateMemberAccess,
  issueClientPortalToken,
  newId,
  sessionBookingCount,
  type FitBooking,
  type FitClient,
  type FitgraphStore,
  type FitMembershipPlan,
  type FitSubscription,
} from '@/lib/fitness/fitgraph';
import type { FitProgramme } from '@/lib/fitness/movements';
import { enrollClientOnProgramme } from '@/lib/fitness/programme-follow';

export type GymSaleKind = 'membership' | 'programme' | 'product';

export function parseGymSaleKind(raw: unknown): GymSaleKind {
  const v = String(raw || '');
  if (v === 'programme') return 'programme';
  if (v === 'product') return 'product';
  return 'membership';
}
export type GymSaleStatus = 'pending' | 'paid' | 'failed';

export type GymSale = {
  id: string;
  kind: GymSaleKind;
  plan_id?: string | null;
  programme_id?: string | null;
  product_id?: string | null;
  session_id?: string | null;
  label?: string | null;
  amount_zar: number;
  name: string;
  email: string;
  phone?: string | null;
  client_id?: string | null;
  status: GymSaleStatus;
  paystack_ref: string;
  created_at: string;
  paid_at?: string | null;
};

export type GymShopItem = {
  kind: GymSaleKind;
  id: string;
  code?: string;
  name: string;
  description?: string;
  price_zar: number;
  billing: string;
  image_url?: string | null;
  video_url?: string | null;
  group?: 'goods' | 'service';
  class_credits?: number | null;
  programme_id?: string | null;
  schedule_label?: string;
  audience?: string;
  addon?: boolean;
  location?: string;
  weekly_class_limit?: number | null;
  unlocks_all?: boolean;
};

export function gymPeriodEnd(
  billing: string,
  from = new Date()
): string {
  const d = new Date(from.getTime());
  const b = String(billing || 'monthly').toLowerCase();
  if (b === 'weekly') d.setDate(d.getDate() + 7);
  else if (b === 'annual') d.setFullYear(d.getFullYear() + 1);
  else if (b === 'pack') d.setDate(d.getDate() + 90);
  else if (b === 'drop_in') d.setDate(d.getDate() + 1);
  else if (b === 'once') d.setDate(d.getDate() + 90);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function publicMembershipShop(
  store: FitgraphStore
): GymShopItem[] {
  return (store.membership_plans || [])
    .filter(
      (p) =>
        p.active !== false &&
        p.public !== false &&
        Number(p.price_zar) > 0
    )
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .map((p) => ({
      kind: 'membership' as const,
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      price_zar: Number(p.price_zar) || 0,
      billing: p.billing,
      image_url: p.image_url || null,
      video_url: p.video_url || null,
      class_credits: p.class_credits,
      programme_id: p.programme_id || null,
      schedule_label: p.schedule_label,
      audience: p.audience,
      addon: p.addon === true,
      location: p.location,
      weekly_class_limit: p.weekly_class_limit ?? null,
      unlocks_all: p.unlocks_all_classes === true,
      group: 'service',
    }));
}

export function publicProgrammeShop(store: FitgraphStore): GymShopItem[] {
  return (store.programmes || [])
    .filter(
      (p) =>
        p.active !== false &&
        p.public === true &&
        p.personal_for_coach !== true &&
        Number(p.price_zar) > 0
    )
    .map((p) => {
      const weeks = p.weeks
        ? `${p.weeks}-week programme`
        : (p.blocks || []).length
          ? 'Training programme'
          : '';
      const desc = [weeks, p.description].filter(Boolean).join(' · ');
      return {
        kind: 'programme' as const,
        id: p.id,
        name: p.name,
        description: desc || p.description,
        price_zar: Number(p.price_zar) || 0,
        billing: p.billing || 'once',
        group: 'service' as const,
      };
    });
}

export function gymShopCatalog(store: FitgraphStore): GymShopItem[] {
  return [...publicMembershipShop(store), ...publicProgrammeShop(store)];
}

export type GymShopCoach = {
  id: string;
  name: string;
  photo_url?: string | null;
  specialties?: string[];
  bio?: string;
  rate_zar?: number | null;
  rate_basis?: string | null;
};

export function publicShopCoaches(store: FitgraphStore): GymShopCoach[] {
  if (store.settings?.show_coaches === false) return [];
  return (store.coaches || [])
    .filter((c) => c.active !== false)
    .map((c) => ({
      id: c.id,
      name: c.name,
      photo_url: c.photo_url || null,
      specialties: (c.specialties || []).filter(Boolean),
      bio: String(c.public_bio || c.bio || '').trim() || undefined,
      rate_zar:
        c.rate_zar != null && Number.isFinite(Number(c.rate_zar))
          ? Number(c.rate_zar)
          : null,
      rate_basis: c.rate_basis || null,
    }));
}

export function gymRequiresPaidMembership(store: FitgraphStore): boolean {
  if (store.settings?.require_paid_membership === false) return false;
  if (store.settings?.require_paid_membership === true) return true;
  return publicMembershipShop(store).length > 0;
}

export function clientHasPaidAccess(
  store: FitgraphStore,
  client: FitClient | null | undefined
): boolean {
  if (!client || client.active === false) return false;
  const access = evaluateMemberAccess(store, client);
  if (access.level === 'blocked') return false;
  const hasPaidSub = (store.subscriptions || []).some(
    (s) =>
      s.client_id === client.id &&
      (s.status === 'active' || s.status === 'trialing')
  );
  if (hasPaidSub) return true;
  return (
    client.membership_status === 'active' && Boolean(client.membership_plan_id)
  );
}

export function readGymSales(store: FitgraphStore): GymSale[] {
  return Array.isArray(store.gym_sales) ? store.gym_sales : [];
}

export function memberPurchaseHistory(
  store: FitgraphStore,
  client: { id: string; email?: string | null }
): Array<{
  id: string;
  kind: GymSaleKind;
  label: string;
  amount_zar: number;
  at: string;
}> {
  const email = String(client.email || '').trim().toLowerCase();
  return readGymSales(store)
    .filter(
      (s) =>
        s.status === 'paid' &&
        (s.client_id === client.id ||
          (email && String(s.email || '').toLowerCase() === email))
    )
    .sort((a, b) =>
      String(b.paid_at || b.created_at).localeCompare(String(a.paid_at || a.created_at))
    )
    .slice(0, 40)
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      label:
        s.label ||
        (s.kind === 'programme'
          ? 'Programme'
          : s.kind === 'product'
            ? 'Product'
            : 'Membership'),
      amount_zar: s.amount_zar,
      at: s.paid_at || s.created_at,
    }));
}

export function findGymSaleByRef(
  store: FitgraphStore,
  reference: string
): GymSale | null {
  const ref = String(reference || '').trim();
  if (!ref) return null;
  return readGymSales(store).find((s) => s.paystack_ref === ref) || null;
}

export function upsertGymSale(
  store: FitgraphStore,
  sale: GymSale
): FitgraphStore {
  const list = readGymSales(store);
  const i = list.findIndex((s) => s.id === sale.id || s.paystack_ref === sale.paystack_ref);
  const next = i >= 0 ? list.map((s, idx) => (idx === i ? sale : s)) : [sale, ...list];
  return { ...store, gym_sales: next.slice(0, 200) };
}

export function resolveShopItem(
  store: FitgraphStore,
  kind: GymSaleKind,
  id: string
):
  | { ok: true; item: GymShopItem }
  | { ok: false; error: string } {
  const catalog = gymShopCatalog(store);
  const item = catalog.find((x) => x.kind === kind && x.id === id);
  if (!item) {
    return { ok: false, error: 'That membership or programme is not for sale' };
  }
  if (item.price_zar <= 0) {
    return { ok: false, error: 'Price is not set' };
  }
  return { ok: true, item };
}

export function findOrCreateShopClient(
  store: FitgraphStore,
  opts: {
    name: string;
    email: string;
    phone?: string | null;
    companyId: number;
    now?: string;
  }
): { store: FitgraphStore; client: FitClient } {
  const now = opts.now || new Date().toISOString();
  const email = opts.email.trim().toLowerCase();
  const existing = store.clients.find(
    (c) =>
      c.email &&
      c.email.toLowerCase() === email &&
      c.active !== false
  );
  if (existing) {
    return { store, client: existing };
  }
  const client: FitClient = {
    id: newId('cli'),
    code: `W-${store.clients.length + 1}`,
    name: opts.name.trim() || email.split('@')[0] || 'Member',
    email,
    phone: opts.phone || undefined,
    membership_status: 'trial',
    portal_token: issueClientPortalToken(opts.companyId),
    active: true,
    notes: 'Created via paid gym shop',
    purchased_programme_ids: [],
    created_at: now,
    updated_at: now,
  };
  return {
    store: { ...store, clients: [client, ...store.clients] },
    client,
  };
}

export function applyPaidGymSale(
  store: FitgraphStore,
  sale: GymSale,
  opts: { companyId: number; now?: string }
): { store: FitgraphStore; sale: GymSale; client: FitClient } {
  const listed =
    findGymSaleByRef(store, sale.paystack_ref || '') ||
    readGymSales(store).find((s) => s.id === sale.id) ||
    null;
  if (listed?.status === 'paid') {
    const email = String(listed.email || sale.email || '')
      .trim()
      .toLowerCase();
    const client =
      store.clients.find((c) => c.id === listed.client_id) ||
      store.clients.find(
        (c) => c.email && c.email.toLowerCase() === email && c.active !== false
      );
    if (client) {
      return { store, sale: listed, client };
    }
  }
  const now = opts.now || new Date().toISOString();
  const today = now.slice(0, 10);
  let next = store;
  const found = findOrCreateShopClient(next, {
    name: sale.name,
    email: sale.email,
    phone: sale.phone,
    companyId: opts.companyId,
    now,
  });
  next = found.store;
  let client = found.client;
  const ci = next.clients.findIndex((c) => c.id === client.id);

  if (sale.kind === 'membership' && sale.plan_id) {
    const plan = next.membership_plans.find((p) => p.id === sale.plan_id);
    const periodEnd = plan ? gymPeriodEnd(plan.billing) : gymPeriodEnd('monthly');
    const existingSame = (next.subscriptions || []).find(
      (s) =>
        s.client_id === client.id &&
        s.plan_id === sale.plan_id &&
        (s.status === 'active' || s.status === 'trialing')
    );
    let subscriptions = [...(next.subscriptions || [])];
    if (existingSame) {
      subscriptions = subscriptions.map((s) =>
        s.id === existingSame.id
          ? {
              ...s,
              status: 'active' as const,
              current_period_end: periodEnd,
              class_credits_remaining: plan?.class_credits ?? s.class_credits_remaining,
              updated_at: now,
              notes: s.notes
                ? `${s.notes}; renewed ${sale.paystack_ref}`
                : `Paid ${sale.paystack_ref}`,
            }
          : s
      );
    } else {
      const sub: FitSubscription = {
        id: newId('sub'),
        client_id: client.id,
        plan_id: sale.plan_id,
        status: 'active',
        started_at: today,
        current_period_end: periodEnd,
        class_credits_remaining: plan?.class_credits ?? null,
        auto_renew: plan?.billing === 'monthly' || plan?.billing === 'annual',
        notes: `Paid ${sale.paystack_ref}`,
        created_at: now,
        updated_at: now,
      };
      subscriptions = [sub, ...subscriptions];
    }
    next = { ...next, subscriptions };
    const programmes = new Set(client.purchased_programme_ids || []);
    if (plan?.programme_id) programmes.add(plan.programme_id);
    if (plan?.programme_id) {
      const enrollments = [...(next.programme_enrollments || [])];
      enrollClientOnProgramme(
        enrollments,
        {
          client_id: client.id,
          programme_id: plan.programme_id,
          coach_id: client.coach_id,
          source: 'purchased',
          start_date: today,
        },
        now,
        newId
      );
      next = { ...next, programme_enrollments: enrollments };
    }
    const keepPrimary =
      plan?.addon === true &&
      client.membership_plan_id &&
      client.membership_plan_id !== sale.plan_id;
    client = {
      ...client,
      membership_plan_id: keepPrimary ? client.membership_plan_id : sale.plan_id,
      membership_status: 'active',
      end_date: periodEnd,
      purchased_programme_ids: [...programmes],
      updated_at: now,
    };
  }

  if (sale.kind === 'product') {
    /* Retail / inventory purchase — recorded on gym_sales only. */
  }

  if (sale.kind === 'programme' && sale.programme_id) {
    const programmes = new Set(client.purchased_programme_ids || []);
    programmes.add(sale.programme_id);
    client = {
      ...client,
      purchased_programme_ids: [...programmes],
      updated_at: now,
    };
    const enrollments = [...(next.programme_enrollments || [])];
    enrollClientOnProgramme(
      enrollments,
      {
        client_id: client.id,
        programme_id: sale.programme_id,
        coach_id: client.coach_id,
        source: 'purchased',
        start_date: today,
      },
      now,
      newId
    );
    next = { ...next, programme_enrollments: enrollments };
  }

  if (sale.session_id) {
    const session = next.sessions.find((s) => s.id === sale.session_id);
    const already = next.bookings.some(
      (b) =>
        b.session_id === sale.session_id &&
        b.client_id === client.id &&
        (b.status === 'booked' || b.status === 'waitlist')
    );
    if (session && session.status === 'scheduled' && !already) {
      const cap = session.capacity ?? 999;
      const count = sessionBookingCount(next, session.id);
      const booking: FitBooking = {
        id: newId('bkg'),
        session_id: session.id,
        client_id: client.id,
        status: count >= cap ? 'waitlist' : 'booked',
        booked_at: now,
        source: 'website',
        guest_name: client.name,
        guest_email: client.email,
      };
      next = { ...next, bookings: [booking, ...next.bookings] };
    }
  }

  if (ci >= 0) {
    const clients = [...next.clients];
    clients[ci] = client;
    next = { ...next, clients };
  }

  const paid: GymSale = {
    ...sale,
    status: 'paid',
    client_id: client.id,
    paid_at: now,
  };
  next = upsertGymSale(next, paid);
  return { store: next, sale: paid, client };
}

export function isGymSalePaystack(data: Record<string, unknown>): boolean {
  const ref = String(data.reference || '');
  if (ref.startsWith('gym-sale-')) return true;
  const meta = data.metadata;
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  return String(m.product || '').toLowerCase() === 'gym_sale';
}

export type { FitMembershipPlan, FitProgramme };
