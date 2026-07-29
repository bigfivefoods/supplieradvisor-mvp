/**
 * Department-mandated NSNP menu: DBE/PEU sets it; schools & SPs follow it live.
 * Menu adherence % rates schools on how closely serve days match the prescribed cycle.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCatalogueContext } from '@/lib/schools/approved-catalogue';

export type MenuCycleItem = {
  day: number; // 1=Mon … 7=Sun (ISO-style Mon-first for school week)
  meal_type?: string; // breakfast | lunch (NSNP two-meal day)
  dish?: string;
  approved_product_ids?: number[];
  notes?: string;
};

export type AgencyMenu = {
  id: number;
  name: string;
  description?: string | null;
  cycle_days?: number;
  items: MenuCycleItem[];
  active?: boolean;
  agency_profile_id?: number | null;
  is_agency_menu?: boolean;
  mandatory?: boolean;
  published_at?: string | null;
  agency_name?: string | null;
};

/** JS getDay(): 0=Sun … 6=Sat → our menu day 1=Mon … 7=Sun */
export function menuDayFromDate(isoDate: string): number {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 1;
  const js = d.getDay(); // 0 Sun
  return js === 0 ? 7 : js;
}

export function parseMenuItems(raw: unknown): MenuCycleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const o = it as Record<string, unknown>;
      const day = Number(o.day);
      if (!Number.isFinite(day) || day < 1 || day > 7) return null;
      const ids = Array.isArray(o.approved_product_ids)
        ? o.approved_product_ids
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0)
        : [];
      const mt = String(o.meal_type || 'lunch').toLowerCase();
      return {
        day,
        meal_type: mt === 'breakfast' ? 'breakfast' : mt === 'snack' ? 'snack' : 'lunch',
        dish: String(o.dish || '').trim(),
        approved_product_ids: ids,
        notes: o.notes != null ? String(o.notes) : undefined,
      };
    })
    .filter(Boolean) as MenuCycleItem[];
}

/** Unique approved product ids prescribed across the whole week (for SP ordering guide) */
export function productsPrescribedOnMenu(items: MenuCycleItem[]): number[] {
  return [
    ...new Set(
      items.flatMap((i) => i.approved_product_ids || []).filter((n) => n > 0)
    ),
  ];
}

/**
 * Load the active mandated menu for the company's department (or agency's own).
 */
export async function loadMandatedMenu(
  supabase: SupabaseClient,
  companyId: number
): Promise<{
  menu: AgencyMenu | null;
  agencyProfileId: number | null;
  agencyName: string | null;
  canEdit: boolean;
}> {
  const ctx = await resolveCatalogueContext(supabase, companyId);
  const agencyId = ctx.agencyProfileId;
  if (!agencyId) {
    return {
      menu: null,
      agencyProfileId: null,
      agencyName: null,
      canEdit: false,
    };
  }

  const { data } = await supabase
    .from('school_menu_cycles')
    .select('*')
    .eq('agency_profile_id', agencyId)
    .eq('active', true)
    .order('published_at', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      menu: null,
      agencyProfileId: agencyId,
      agencyName: ctx.agencyName,
      canEdit: ctx.canEdit,
    };
  }

  return {
    menu: {
      id: Number(data.id),
      name: String(data.name),
      description: data.description != null ? String(data.description) : null,
      cycle_days: Number(data.cycle_days || 7),
      items: parseMenuItems(data.items),
      active: data.active !== false,
      agency_profile_id: Number(data.agency_profile_id),
      is_agency_menu: data.is_agency_menu !== false,
      mandatory: data.mandatory !== false,
      published_at:
        data.published_at != null ? String(data.published_at) : null,
      agency_name: ctx.agencyName,
    },
    agencyProfileId: agencyId,
    agencyName: ctx.agencyName,
    canEdit: ctx.canEdit,
  };
}

/**
 * % of feeding days that followed the department menu for that weekday.
 * With 2 meals/day, a day is matched if logged dish matches breakfast OR lunch
 * (or products used appear on either meal's approved list).
 * Optional: if both breakfast+lunch are prescribed, partial credit if one matches
 * (still counts as ok for day-level score — schools log one menu_name typically).
 */
export function computePrescribedMenuAdherencePct(
  feeding: Array<{
    feed_date?: string | null;
    menu_name?: string | null;
    served_meals?: number | null;
    product_ids?: number[] | null;
  }>,
  menuItems: MenuCycleItem[]
): {
  pct: number;
  matched: number;
  total: number;
  byDay: Array<{
    feed_date: string;
    prescribed: string;
    logged: string;
    ok: boolean;
  }>;
} {
  const byWeekday = new Map<number, MenuCycleItem[]>();
  for (const it of menuItems) {
    if (!byWeekday.has(it.day)) byWeekday.set(it.day, []);
    byWeekday.get(it.day)!.push(it);
  }

  const days = feeding.filter((f) => Number(f.served_meals || 0) > 0);
  if (!days.length || !menuItems.length) {
    return { pct: 0, matched: 0, total: 0, byDay: [] };
  }

  let matched = 0;
  const byDay: Array<{
    feed_date: string;
    prescribed: string;
    logged: string;
    ok: boolean;
  }> = [];

  for (const f of days) {
    const date = String(f.feed_date || '').slice(0, 10);
    if (!date) continue;
    const wd = menuDayFromDate(date);
    const prescribed = byWeekday.get(wd) || [];
    if (!prescribed.length) continue;

    const breakfast = prescribed.filter((p) => p.meal_type === 'breakfast');
    const lunch = prescribed.filter(
      (p) => p.meal_type === 'lunch' || !p.meal_type
    );
    const dishes = [
      ...breakfast.map((p) => (p.dish ? `B: ${p.dish}` : '')),
      ...lunch.map((p) => (p.dish ? `L: ${p.dish}` : '')),
    ]
      .filter(Boolean)
      .join(' · ');
    const productSet = new Set(
      prescribed.flatMap((p) => p.approved_product_ids || [])
    );
    const logged = String(f.menu_name || '').trim();
    const usedProducts = Array.isArray(f.product_ids) ? f.product_ids : [];

    let ok = false;
    if (logged) {
      const logLow = logged.toLowerCase();
      ok = prescribed.some((p) => {
        const d = String(p.dish || '')
          .toLowerCase()
          .trim();
        if (!d) return false;
        return logLow === d || logLow.includes(d) || d.includes(logLow);
      });
    }
    if (!ok && usedProducts.length && productSet.size) {
      ok = usedProducts.some((id) => productSet.has(Number(id)));
    }

    if (ok) matched += 1;
    byDay.push({
      feed_date: date,
      prescribed: dishes || `Day ${wd}`,
      logged:
        logged ||
        (usedProducts.length ? `products:${usedProducts.join(',')}` : '—'),
      ok,
    });
  }

  const total = byDay.length;
  const pct = total > 0 ? Math.round((matched / total) * 1000) / 10 : 0;
  return { pct, matched, total, byDay };
}

/**
 * Enrich feeding rows with product_ids from kitchen stock issues / receipts on that day.
 */
export async function attachProductsToFeedingDays(
  supabase: SupabaseClient,
  schoolProfileId: number,
  feeding: Array<Record<string, unknown>>,
  from: string,
  to: string
): Promise<
  Array<Record<string, unknown> & { product_ids?: number[] }>
> {
  const dates = feeding
    .map((f) => String(f.feed_date || '').slice(0, 10))
    .filter(Boolean);
  if (!dates.length) return feeding as Array<Record<string, unknown> & { product_ids?: number[] }>;

  // Receipts in period (proxy for what kitchen used / received around serve)
  const { data: receipts } = await supabase
    .from('school_kitchen_receipts')
    .select('received_at, lines')
    .eq('school_profile_id', schoolProfileId)
    .gte('received_at', from)
    .lte('received_at', to)
    .limit(500);

  const productsByDate = new Map<string, Set<number>>();
  for (const r of receipts || []) {
    const d = String(r.received_at || '').slice(0, 10);
    if (!d) continue;
    if (!productsByDate.has(d)) productsByDate.set(d, new Set());
    for (const line of (Array.isArray(r.lines) ? r.lines : []) as Array<{
      approved_product_id?: number;
    }>) {
      const pid = Number(line.approved_product_id);
      if (Number.isFinite(pid) && pid > 0) {
        productsByDate.get(d)!.add(pid);
      }
    }
  }

  return feeding.map((f) => {
    const d = String(f.feed_date || '').slice(0, 10);
    const set = productsByDate.get(d);
    return {
      ...f,
      product_ids: set ? [...set] : [],
    };
  });
}

export async function schoolMenuAdherenceForPeriod(
  supabase: SupabaseClient,
  companyId: number,
  schoolProfileId: number,
  from: string,
  to: string
): Promise<{
  pct: number;
  matched: number;
  total: number;
  menu: AgencyMenu | null;
  byDay: Array<{
    feed_date: string;
    prescribed: string;
    logged: string;
    ok: boolean;
  }>;
}> {
  const { menu } = await loadMandatedMenu(supabase, companyId);
  const { data: feeding } = await supabase
    .from('school_feeding_days')
    .select('feed_date, served_meals, menu_name')
    .eq('school_profile_id', schoolProfileId)
    .gte('feed_date', from)
    .lte('feed_date', to)
    .limit(500);

  const enriched = await attachProductsToFeedingDays(
    supabase,
    schoolProfileId,
    (feeding || []) as Array<Record<string, unknown>>,
    from,
    to
  );

  if (!menu || !menu.items.length) {
    return {
      pct: 0,
      matched: 0,
      total: 0,
      menu: null,
      byDay: [],
    };
  }

  const result = computePrescribedMenuAdherencePct(
    enriched.map((f) => ({
      feed_date: String(f.feed_date || ''),
      menu_name: f.menu_name != null ? String(f.menu_name) : null,
      served_meals: Number(f.served_meals || 0),
      product_ids: f.product_ids,
    })),
    menu.items
  );

  return { ...result, menu };
}
