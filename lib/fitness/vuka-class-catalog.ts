/**
 * VUKA Fitness (company 110) class timetable + membership rates.
 * Applied only to that gym. Other GymAdvisor tenants are untouched.
 */
import {
  addDaysIso,
  coachPortalEmails,
  namesMatchForPortalSignIn,
  newId,
  weekdayOf,
  type FitClassType,
  type FitCoach,
  type FitgraphStore,
  type FitMembershipPlan,
  type FitSession,
  type FitSubscription,
  type FitClient,
  type FitBooking,
  subscriptionChargeZar,
} from '@/lib/fitness/fitgraph';
import {
  gymRequiresDebitBank,
  memberDebitBankComplete,
} from '@/lib/fitness/member-debit-bank';
import {
  SYS_COACH_AWAY_CODE,
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
} from '@/lib/fitness/session-times';
import { ensureDemoShopProgramme } from '@/lib/fitness/demo-shop-programme';
import { shopCoachFirstName, vukaShopCoachRank } from '@/lib/fitness/gym-shop';

export const VUKA_COMPANY_ID = 110;

const VUKA_NAME_RE = /^vuka(\s+fitness)?$/i;

export function isVukaFitnessCompany(opts: {
  companyId?: number | null;
  tradingName?: string | null;
  legalName?: string | null;
}): boolean {
  const id = opts.companyId != null ? Number(opts.companyId) : NaN;
  if (Number.isFinite(id) && id === VUKA_COMPANY_ID) return true;
  const names = [opts.tradingName, opts.legalName]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  return names.some((n) => VUKA_NAME_RE.test(n) || /^vuka\s*fitness/i.test(n));
}

export type VukaAudience = 'all' | 'gents' | 'women' | 'kids';

export type VukaSlot = {
  series_id: string;
  class_type_id: string;
  weekdays: number[];
  start_time: string;
  duration_min: number;
  location?: string;
  public_notes?: string;
  capacity: number;
  public: boolean;
};

const CLS = {
  fsf: 'vuka_cls_fsf',
  gents: 'vuka_cls_gents',
  kb: 'vuka_cls_kb',
  bums: 'vuka_cls_bums',
  bootBeg: 'vuka_cls_boot_beg',
  boot: 'vuka_cls_boot',
  tech: 'vuka_cls_tech',
  multi: 'vuka_cls_multi',
  kids: 'vuka_cls_kids',
  pilates: 'vuka_cls_pilates',
} as const;

const SER = {
  fsf5: 'vuka_ser_fsf_5am',
  gents5: 'vuka_ser_gents_5am',
  kb6: 'vuka_ser_kb_6am',
  bums8: 'vuka_ser_bums_8am',
  kb1630: 'vuka_ser_kb_1630',
  bootBeg: 'vuka_ser_boot_beg_1630',
  boot1730: 'vuka_ser_boot_1730',
  tech: 'vuka_ser_tech_fri',
  multi: 'vuka_ser_multi_sat',
  kids: 'vuka_ser_kids_mon',
  pilMon: 'vuka_ser_pilates_mon',
  pilTue: 'vuka_ser_pilates_tue',
  pilWed: 'vuka_ser_pilates_wed',
  pilThu: 'vuka_ser_pilates_thu',
} as const;

const BOOTCAMP_LOCATION = '50 Hosking Rd, Athlone (outdoors)';
const PILATES_SERIES = [SER.pilMon, SER.pilTue, SER.pilWed, SER.pilThu];

export const VUKA_CLASS_TYPES: Array<
  Omit<FitClassType, 'created_at'> & { created_at?: string }
> = [
  {
    id: CLS.fsf,
    code: 'VUKA_FSF',
    name: 'Functional Strength & Fitness',
    category: 'Strength',
    default_duration_min: 60,
    capacity: 16,
    description: 'Morning functional strength and fitness.',
    active: true,
  },
  {
    id: CLS.gents,
    code: 'VUKA_GENTS',
    name: 'Gents Only Functional Strength & Fitness',
    category: 'Strength',
    default_duration_min: 60,
    capacity: 12,
    description: 'Men-only functional strength and fitness.',
    active: true,
  },
  {
    id: CLS.kb,
    code: 'VUKA_KB',
    name: 'Kettlebell Conditioning and Fitness',
    category: 'Conditioning',
    default_duration_min: 60,
    capacity: 14,
    description: 'Kettlebell conditioning and fitness.',
    active: true,
  },
  {
    id: CLS.bums,
    code: 'VUKA_BUMS',
    name: 'Bums & Tums Fitness',
    category: 'Private',
    default_duration_min: 60,
    capacity: 8,
    description: 'Private women-only class.',
    active: true,
  },
  {
    id: CLS.bootBeg,
    code: 'VUKA_BOOT_BEG',
    name: 'Bootcamp (Beginner)',
    category: 'Conditioning',
    default_duration_min: 60,
    capacity: 20,
    description: `Outdoor beginner bootcamp. ${BOOTCAMP_LOCATION}.`,
    active: true,
  },
  {
    id: CLS.boot,
    code: 'VUKA_BOOT',
    name: 'Bootcamp',
    category: 'Conditioning',
    default_duration_min: 60,
    capacity: 20,
    description: `Outdoor bootcamp. ${BOOTCAMP_LOCATION}.`,
    active: true,
  },
  {
    id: CLS.tech,
    code: 'VUKA_TECH',
    name: 'Friday Tech Class',
    category: 'Conditioning',
    default_duration_min: 45,
    capacity: 16,
    description: 'Add-on Friday technique class.',
    active: true,
  },
  {
    id: CLS.multi,
    code: 'VUKA_MULTI',
    name: 'Saturday Multi Fitness',
    category: 'Conditioning',
    default_duration_min: 60,
    capacity: 16,
    description: 'Add-on Saturday multi-fitness.',
    active: true,
  },
  {
    id: CLS.kids,
    code: 'VUKA_KIDS',
    name: 'Kids Gym',
    category: 'Kids',
    default_duration_min: 45,
    capacity: 12,
    description: 'Monday kids gym. Sibling 50% off.',
    active: true,
  },
  {
    id: CLS.pilates,
    code: 'VUKA_PILATES',
    name: 'Pilates',
    category: 'Pilates',
    default_duration_min: 45,
    capacity: 12,
    description: 'Group pilates. Mon 5:30pm · Tue 8am · Wed 5:30pm · Thu 8am.',
    active: true,
  },
];

type VukaPlanDraft = Omit<FitMembershipPlan, 'created_at'> & {
  created_at?: string;
};

function plan(
  partial: Omit<
    VukaPlanDraft,
    'billing' | 'public' | 'active' | 'access' | 'catalog' | 'class_credits'
  > & {
    series_ids: string[];
    schedule_label: string;
  }
): VukaPlanDraft {
  return {
    ...partial,
    billing: 'monthly',
    public: true,
    active: true,
    access: 'classes',
    catalog: 'vuka',
    class_credits: null,
  };
}

export const VUKA_MEMBERSHIP_PLANS: VukaPlanDraft[] = [
  plan({
    id: 'vuka_pln_fsf_5am',
    code: 'VUKA_FSF_5AM',
    name: 'Functional Strength & Fitness · 5am M/W/F',
    price_zar: 910,
    description:
      'Functional Strength & Fitness. 5:00am Monday, Wednesday and Friday. Incl. VAT.',
    class_type_ids: [CLS.fsf],
    series_ids: [SER.fsf5],
    schedule_label: '5:00am Mon / Wed / Fri',
    sort_order: 10,
  }),
  plan({
    id: 'vuka_pln_gents_5am',
    code: 'VUKA_GENTS_5AM',
    name: 'Gents Only Functional Strength · 5am T/Th',
    price_zar: 775,
    description:
      'Gents-only Functional Strength & Fitness. 5:00am Tuesday and Thursday. Incl. VAT.',
    class_type_ids: [CLS.gents],
    series_ids: [SER.gents5],
    schedule_label: '5:00am Tue / Thu',
    audience: 'gents',
    sort_order: 20,
  }),
  plan({
    id: 'vuka_pln_kb_6am',
    code: 'VUKA_KB_6AM',
    name: 'Kettlebell Conditioning · 6am T/Th',
    price_zar: 775,
    description:
      'Kettlebell Conditioning and Fitness. 6:00am Tuesday and Thursday. Incl. VAT.',
    class_type_ids: [CLS.kb],
    series_ids: [SER.kb6],
    schedule_label: '6:00am Tue / Thu',
    sort_order: 30,
  }),
  plan({
    id: 'vuka_pln_bums_8am',
    code: 'VUKA_BUMS_8AM',
    name: 'Bums & Tums · private · women · 8am T/Th',
    price_zar: 775,
    description:
      'Private women-only Bums & Tums Fitness. 8:00am Tuesday and Thursday. Incl. VAT.',
    class_type_ids: [CLS.bums],
    series_ids: [SER.bums8],
    schedule_label: '8:00am Tue / Thu',
    audience: 'women',
    sort_order: 40,
  }),
  plan({
    id: 'vuka_pln_kb_1630',
    code: 'VUKA_KB_1630',
    name: 'Kettlebell Conditioning · 4:30pm M/W',
    price_zar: 775,
    description:
      'Kettlebell Conditioning and Fitness. 4:30pm Monday and Wednesday. Incl. VAT.',
    class_type_ids: [CLS.kb],
    series_ids: [SER.kb1630],
    schedule_label: '4:30pm Mon / Wed',
    sort_order: 50,
  }),
  plan({
    id: 'vuka_pln_boot_beg',
    code: 'VUKA_BOOT_BEG',
    name: 'Bootcamp beginner · 4:30pm T/Th',
    price_zar: 475,
    description: `Outdoor beginner bootcamp. 4:30pm Tuesday and Thursday. ${BOOTCAMP_LOCATION}. Incl. VAT.`,
    class_type_ids: [CLS.bootBeg],
    series_ids: [SER.bootBeg],
    schedule_label: '4:30pm Tue / Thu',
    location: BOOTCAMP_LOCATION,
    sort_order: 60,
  }),
  plan({
    id: 'vuka_pln_boot_1730',
    code: 'VUKA_BOOT_1730',
    name: 'Bootcamp · 5:30pm M/T/Th',
    price_zar: 475,
    description: `Outdoor bootcamp. 5:30pm Monday, Tuesday and Thursday. ${BOOTCAMP_LOCATION}. Incl. VAT.`,
    class_type_ids: [CLS.boot],
    series_ids: [SER.boot1730],
    schedule_label: '5:30pm Mon / Tue / Thu',
    location: BOOTCAMP_LOCATION,
    sort_order: 70,
  }),
  plan({
    id: 'vuka_pln_addon_tech',
    code: 'VUKA_ADDON_TECH',
    name: 'Add-on · Friday Tech Class',
    price_zar: 150,
    description: 'Add-on +R150/pm. Friday 4:30pm Tech Class. Incl. VAT.',
    class_type_ids: [CLS.tech],
    series_ids: [SER.tech],
    schedule_label: '4:30pm Friday',
    addon: true,
    sort_order: 80,
  }),
  plan({
    id: 'vuka_pln_addon_multi',
    code: 'VUKA_ADDON_MULTI',
    name: 'Add-on · Saturday Multi Fitness',
    price_zar: 150,
    description: 'Add-on +R150/pm. Saturday 8:00am Multi Fitness. Incl. VAT.',
    class_type_ids: [CLS.multi],
    series_ids: [SER.multi],
    schedule_label: '8:00am Saturday',
    addon: true,
    sort_order: 90,
  }),
  plan({
    id: 'vuka_pln_kids',
    code: 'VUKA_KIDS',
    name: 'Kids Gym · 3:45pm Monday',
    price_zar: 530,
    description:
      'Kids Gym 3:45pm Monday. Sibling 50% off (use the sibling plan). Incl. VAT.',
    class_type_ids: [CLS.kids],
    series_ids: [SER.kids],
    schedule_label: '3:45pm Monday',
    audience: 'kids',
    sibling_discount_pct: 50,
    sort_order: 100,
  }),
  plan({
    id: 'vuka_pln_kids_sib',
    code: 'VUKA_KIDS_SIB',
    name: 'Kids Gym sibling · 50% off',
    price_zar: 265,
    description:
      'Sibling rate for Kids Gym (50% of R530). 3:45pm Monday. Incl. VAT.',
    class_type_ids: [CLS.kids],
    series_ids: [SER.kids],
    schedule_label: '3:45pm Monday',
    audience: 'kids',
    sibling_discount_pct: 50,
    sort_order: 110,
  }),
  plan({
    id: 'vuka_pln_pilates_1',
    code: 'VUKA_PILATES_1',
    name: 'Pilates · 1 class / week',
    price_zar: 475,
    description:
      'Group pilates — one class per week. Mon 5:30pm, Tue 8am, Wed 5:30pm, Thu 8am. Incl. VAT.',
    class_type_ids: [CLS.pilates],
    series_ids: [...PILATES_SERIES],
    schedule_label: '1× / week · Mon 5:30pm · Tue 8am · Wed 5:30pm · Thu 8am',
    weekly_class_limit: 1,
    sort_order: 120,
  }),
  plan({
    id: 'vuka_pln_pilates_2',
    code: 'VUKA_PILATES_2',
    name: 'Pilates · 2 classes / week',
    price_zar: 855,
    description:
      'Group pilates — two classes per week. Mon 5:30pm, Tue 8am, Wed 5:30pm, Thu 8am. Incl. VAT.',
    class_type_ids: [CLS.pilates],
    series_ids: [...PILATES_SERIES],
    schedule_label: '2× / week · Mon 5:30pm · Tue 8am · Wed 5:30pm · Thu 8am',
    weekly_class_limit: 2,
    sort_order: 130,
  }),
  plan({
    id: 'vuka_pln_pilates_3',
    code: 'VUKA_PILATES_3',
    name: 'Pilates · 3 classes / week',
    price_zar: 1265,
    description:
      'Group pilates — three classes per week. Mon 5:30pm, Tue 8am, Wed 5:30pm, Thu 8am. Incl. VAT.',
    class_type_ids: [CLS.pilates],
    series_ids: [...PILATES_SERIES],
    schedule_label: '3× / week · Mon 5:30pm · Tue 8am · Wed 5:30pm · Thu 8am',
    weekly_class_limit: 3,
    sort_order: 140,
  }),
  plan({
    id: 'vuka_pln_unlimited',
    code: 'VUKA_UNLIM',
    name: 'Unlimited class package',
    price_zar: 1140,
    description:
      'Join classes on the daily. All adult group classes (not Kids Gym). Incl. VAT.',
    class_type_ids: [],
    series_ids: [],
    schedule_label: 'Daily · all adult classes',
    unlocks_all_classes: true,
    excluded_class_type_ids: [CLS.kids],
    sort_order: 5,
  }),
];

export const VUKA_TIMETABLE: VukaSlot[] = [
  {
    series_id: SER.fsf5,
    class_type_id: CLS.fsf,
    weekdays: [1, 3, 5],
    start_time: '05:00',
    duration_min: 60,
    capacity: 16,
    public: true,
    public_notes: 'Functional Strength & Fitness',
  },
  {
    series_id: SER.gents5,
    class_type_id: CLS.gents,
    weekdays: [2, 4],
    start_time: '05:00',
    duration_min: 60,
    capacity: 12,
    public: true,
    public_notes: 'Gents only',
  },
  {
    series_id: SER.kb6,
    class_type_id: CLS.kb,
    weekdays: [2, 4],
    start_time: '06:00',
    duration_min: 60,
    capacity: 14,
    public: true,
    public_notes: 'Kettlebell Conditioning and Fitness',
  },
  {
    series_id: SER.bums8,
    class_type_id: CLS.bums,
    weekdays: [2, 4],
    start_time: '08:00',
    duration_min: 60,
    capacity: 8,
    public: true,
    public_notes: 'Private · women only',
  },
  {
    series_id: SER.kb1630,
    class_type_id: CLS.kb,
    weekdays: [1, 3],
    start_time: '16:30',
    duration_min: 60,
    capacity: 14,
    public: true,
    public_notes: 'Kettlebell Conditioning and Fitness',
  },
  {
    series_id: SER.bootBeg,
    class_type_id: CLS.bootBeg,
    weekdays: [2, 4],
    start_time: '16:30',
    duration_min: 60,
    location: BOOTCAMP_LOCATION,
    capacity: 20,
    public: true,
    public_notes: 'Beginner outdoor bootcamp',
  },
  {
    series_id: SER.boot1730,
    class_type_id: CLS.boot,
    weekdays: [1, 2, 4],
    start_time: '17:30',
    duration_min: 60,
    location: BOOTCAMP_LOCATION,
    capacity: 20,
    public: true,
    public_notes: 'Outdoor bootcamp',
  },
  {
    series_id: SER.tech,
    class_type_id: CLS.tech,
    weekdays: [5],
    start_time: '16:30',
    duration_min: 45,
    capacity: 16,
    public: true,
    public_notes: 'Add-on Tech Class',
  },
  {
    series_id: SER.multi,
    class_type_id: CLS.multi,
    weekdays: [6],
    start_time: '08:00',
    duration_min: 60,
    capacity: 16,
    public: true,
    public_notes: 'Add-on Saturday Multi Fitness',
  },
  {
    series_id: SER.kids,
    class_type_id: CLS.kids,
    weekdays: [1],
    start_time: '15:45',
    duration_min: 45,
    capacity: 12,
    public: true,
    public_notes: 'Kids Gym · sibling 50% off',
  },
  {
    series_id: SER.pilMon,
    class_type_id: CLS.pilates,
    weekdays: [1],
    start_time: '17:30',
    duration_min: 45,
    capacity: 12,
    public: true,
    public_notes: 'Group pilates',
  },
  {
    series_id: SER.pilTue,
    class_type_id: CLS.pilates,
    weekdays: [2],
    start_time: '08:00',
    duration_min: 45,
    capacity: 12,
    public: true,
    public_notes: 'Group pilates',
  },
  {
    series_id: SER.pilWed,
    class_type_id: CLS.pilates,
    weekdays: [3],
    start_time: '17:30',
    duration_min: 45,
    capacity: 12,
    public: true,
    public_notes: 'Group pilates',
  },
  {
    series_id: SER.pilThu,
    class_type_id: CLS.pilates,
    weekdays: [4],
    start_time: '08:00',
    duration_min: 45,
    capacity: 12,
    public: true,
    public_notes: 'Group pilates',
  },
];

export const VUKA_JOINING = {
  fee_zar: 600,
  waived: true,
  note: 'Once-off joining is listed at R600 incl. VAT — currently waived (free).',
};

export function storeUsesClassSubscribe(store: FitgraphStore): boolean {
  if (store.settings?.class_subscribe === true) return true;
  return (store.membership_plans || []).some(
    (p) => p.catalog === 'vuka' && p.active !== false
  );
}

export type SubscribeClass = {
  plan_id: string;
  code: string;
  name: string;
  class_name: string;
  schedule_label: string;
  price_zar: number;
  billing: string;
  audience?: string;
  addon?: boolean;
  location?: string;
  weekly_class_limit?: number | null;
  unlocks_all?: boolean;
  subscribers: number;
};

function classNameFromPlan(p: FitMembershipPlan): string {
  const n = String(p.name || '');
  const cut = n.split(' · ')[0]?.trim();
  return cut || n;
}

export function timetableSlotsForPlan(
  plan: Pick<FitMembershipPlan, 'series_ids'>
): VukaSlot[] {
  const ids = new Set(plan.series_ids || []);
  if (!ids.size) return [];
  return VUKA_TIMETABLE.filter((s) => ids.has(s.series_id));
}

export function timetableSlotForPlan(
  plan: Pick<FitMembershipPlan, 'series_ids'>
): VukaSlot | null {
  const slots = timetableSlotsForPlan(plan);
  return slots.length === 1 ? slots[0] : null;
}

export function listSubscribeClasses(store: FitgraphStore): SubscribeClass[] {
  if (!storeUsesClassSubscribe(store)) return [];
  const active = (store.subscriptions || []).filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );
  return (store.membership_plans || [])
    .filter(
      (p) =>
        p.active !== false &&
        p.public !== false &&
        (p.catalog === 'vuka' ||
          p.unlocks_all_classes === true ||
          (p.series_ids && p.series_ids.length > 0))
    )
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .map((p) => ({
      plan_id: p.id,
      code: p.code,
      name: p.name,
      class_name: classNameFromPlan(p),
      schedule_label: p.schedule_label || '',
      price_zar: Number(p.price_zar) || 0,
      billing: p.billing || 'monthly',
      audience: p.audience,
      addon: p.addon === true,
      location: p.location,
      weekly_class_limit: p.weekly_class_limit ?? null,
      unlocks_all: p.unlocks_all_classes === true,
      subscribers: active.filter((s) => s.plan_id === p.id).length,
    }));
}

function endTimeFrom(start: string, durationMin: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = (h || 0) * 60 + (m || 0) + durationMin;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function mondayOf(dateIso: string): string {
  const dow = weekdayOf(dateIso);
  const back = dow === 0 ? 6 : dow - 1;
  return addDaysIso(dateIso, -back);
}

function upcomingDatesForWeekdays(
  weekdays: number[],
  weeks: number,
  fromIso: string
): string[] {
  const out: string[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = addDaysIso(fromIso, i);
    if (weekdays.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}

function sameishPlan(
  current: FitMembershipPlan,
  next: VukaPlanDraft
): boolean {
  return (
    current.name === next.name &&
    Number(current.price_zar) === Number(next.price_zar) &&
    current.billing === next.billing &&
    current.description === next.description &&
    current.public !== false &&
    current.active !== false &&
    Boolean(current.unlocks_all_classes) === Boolean(next.unlocks_all_classes) &&
    (current.weekly_class_limit ?? null) === (next.weekly_class_limit ?? null) &&
    (current.schedule_label || '') === (next.schedule_label || '') &&
    JSON.stringify(current.series_ids || []) ===
      JSON.stringify(next.series_ids || []) &&
    JSON.stringify(current.class_type_ids || []) ===
      JSON.stringify(next.class_type_ids || []) &&
    JSON.stringify(current.excluded_class_type_ids || []) ===
      JSON.stringify(next.excluded_class_type_ids || [])
  );
}

export function gymHasClassSpecificPlans(store: FitgraphStore): boolean {
  return (store.membership_plans || []).some(
    (p) =>
      p.active !== false &&
      (p.unlocks_all_classes === true ||
        (Array.isArray(p.series_ids) && p.series_ids.length > 0) ||
        (Array.isArray(p.class_type_ids) && p.class_type_ids.length > 0))
  );
}

export function activeClassSubscriptions(
  store: FitgraphStore,
  clientId: string
): Array<{ sub: FitSubscription; plan: FitMembershipPlan }> {
  return (store.subscriptions || [])
    .filter(
      (s) =>
        s.client_id === clientId &&
        (s.status === 'active' || s.status === 'trialing')
    )
    .map((sub) => {
      const plan = store.membership_plans.find((p) => p.id === sub.plan_id);
      return plan ? { sub, plan } : null;
    })
    .filter((x): x is { sub: FitSubscription; plan: FitMembershipPlan } =>
      Boolean(x)
    );
}

export type SessionCoverageInput = Pick<FitSession, 'class_type_id'> & {
  series_id?: string | null;
  start_time?: string;
  date?: string;
  session_kind?: FitSession['session_kind'];
};

/** Map an owner/coach diary row onto the VUKA timetable slot it belongs to. */
export function catalogSlotForSession(
  session: SessionCoverageInput
): VukaSlot | null {
  const ser = String(session.series_id || '');
  if (ser) {
    const byId = VUKA_TIMETABLE.find((s) => s.series_id === ser);
    if (byId) return byId;
  }
  const start = String(session.start_time || '').slice(0, 5);
  const typeHits = VUKA_TIMETABLE.filter(
    (s) => s.class_type_id === session.class_type_id
  );
  if (!typeHits.length) return null;
  const timed = start
    ? typeHits.filter((s) => s.start_time.slice(0, 5) === start)
    : [];
  if (timed.length === 1) return timed[0];
  if (timed.length > 1 && session.date) {
    const dow = weekdayOf(session.date);
    const dayHits = timed.filter((s) => s.weekdays.includes(dow));
    if (dayHits.length) return dayHits[0];
  }
  if (timed.length > 1) return timed[0];
  if (typeHits.length === 1) return typeHits[0];
  return null;
}

function sessionMatchesPlanSlots(
  plan: Pick<FitMembershipPlan, 'series_ids'>,
  session: SessionCoverageInput
): boolean {
  const slots = timetableSlotsForPlan(plan);
  if (!slots.length) return false;
  const start = String(session.start_time || '').slice(0, 5);
  const series = String(session.series_id || '');
  const dow = session.date ? weekdayOf(session.date) : null;
  return slots.some((s) => {
    if (series && s.series_id === series) return true;
    if (s.class_type_id !== session.class_type_id) return false;
    if (start && s.start_time.slice(0, 5) !== start) return false;
    if (dow != null && s.weekdays.length && !s.weekdays.includes(dow)) {
      return false;
    }
    return true;
  });
}

function classTypeSharedWithOtherSlots(
  planSlots: VukaSlot[],
  classTypeId: string
): boolean {
  return VUKA_TIMETABLE.some(
    (t) =>
      t.class_type_id === classTypeId &&
      !planSlots.some((s) => s.series_id === t.series_id)
  );
}

function isSystemSession(session: SessionCoverageInput, store?: FitgraphStore) {
  const kind = session.session_kind;
  if (kind && kind !== 'class') return true;
  const ct = store?.class_types.find((c) => c.id === session.class_type_id);
  const code = String(ct?.code || '');
  return (
    code === SYS_PT_CODE ||
    code === SYS_COACH_TIME_CODE ||
    code === SYS_COACH_AWAY_CODE
  );
}

export function planCoversSession(
  plan: FitMembershipPlan,
  session: SessionCoverageInput,
  store?: FitgraphStore
): boolean {
  if (plan.active === false) return false;
  if (isSystemSession(session, store)) return false;
  if (plan.unlocks_all_classes) {
    const excluded = plan.excluded_class_type_ids || [];
    return !excluded.includes(session.class_type_id);
  }
  if (plan.series_ids && plan.series_ids.length) {
    if (session.series_id && plan.series_ids.includes(session.series_id)) {
      return true;
    }
    const slot = catalogSlotForSession(session);
    if (slot && plan.series_ids.includes(slot.series_id)) return true;
    const slots = timetableSlotsForPlan(plan);
    const start = String(session.start_time || '').slice(0, 5);
    if (
      start &&
      slots.some(
        (s) =>
          s.class_type_id === session.class_type_id &&
          s.start_time.slice(0, 5) === start
      )
    ) {
      return true;
    }
  }
  if (plan.class_type_ids && plan.class_type_ids.length) {
    if (!plan.class_type_ids.includes(session.class_type_id)) return false;
    const slots = timetableSlotsForPlan(plan);
    if (
      slots.length &&
      classTypeSharedWithOtherSlots(slots, session.class_type_id)
    ) {
      return sessionMatchesPlanSlots(plan, session);
    }
    return true;
  }
  if (store && gymHasClassSpecificPlans(store)) return false;
  return true;
}

function weekBookingsOnClass(
  store: FitgraphStore,
  clientId: string,
  classTypeId: string,
  aroundDate: string,
  ignoreSessionId?: string
): number {
  const weekStart = mondayOf(aroundDate);
  const weekEnd = addDaysIso(weekStart, 6);
  return (store.bookings || []).filter((b) => {
    if (b.client_id !== clientId) return false;
    if (
      b.status !== 'booked' &&
      b.status !== 'attended' &&
      b.status !== 'waitlist'
    ) {
      return false;
    }
    if (ignoreSessionId && b.session_id === ignoreSessionId) return false;
    const s = store.sessions.find((x) => x.id === b.session_id);
    if (!s || s.class_type_id !== classTypeId) return false;
    return s.date >= weekStart && s.date <= weekEnd;
  }).length;
}

export type ClassBookDecision = {
  ok: boolean;
  error?: string;
  need_plan?: boolean;
  need_debit_bank?: boolean;
  plan_name?: string | null;
  weekly_used?: number;
  weekly_limit?: number | null;
};

function debitBankGate(
  store: FitgraphStore,
  client: FitClient
): ClassBookDecision | null {
  if (!gymRequiresDebitBank(store) || memberDebitBankComplete(client)) {
    return null;
  }
  return {
    ok: false,
    need_debit_bank: true,
    error:
      'Add your bank details on your profile so the gym can set up your debit order',
  };
}

export function memberMayBookSession(
  store: FitgraphStore,
  client: FitClient | null | undefined,
  session: FitSession,
  opts?: { ignoreDebitBank?: boolean; ignoreWeeklyLimit?: boolean }
): ClassBookDecision {
  if (!client || client.active === false) {
    return {
      ok: false,
      need_plan: true,
      error: 'Subscribe to this class first — then a coach can book you in',
    };
  }
  const covering = activeClassSubscriptions(store, client.id).filter((x) =>
    planCoversSession(x.plan, session, store)
  );
  if (!covering.length) {
    if (!gymHasClassSpecificPlans(store)) {
      return (
        (opts?.ignoreDebitBank ? null : debitBankGate(store, client)) || {
          ok: true,
        }
      );
    }
    return {
      ok: false,
      need_plan: true,
      error:
        'Subscribe to this class first — then you or a coach can book the session',
    };
  }
  const limited = covering
    .map((x) => x.plan)
    .filter((p) => p.weekly_class_limit != null && p.weekly_class_limit > 0)
    .sort((a, b) => (b.weekly_class_limit || 0) - (a.weekly_class_limit || 0))[0];
  if (!opts?.ignoreWeeklyLimit && limited?.weekly_class_limit) {
    const used = weekBookingsOnClass(
      store,
      client.id,
      session.class_type_id,
      session.date
    );
    if (used >= limited.weekly_class_limit) {
      return {
        ok: false,
        error: `${limited.name} allows ${limited.weekly_class_limit} class${
          limited.weekly_class_limit === 1 ? '' : 'es'
        } this week`,
        plan_name: limited.name,
        weekly_used: used,
        weekly_limit: limited.weekly_class_limit,
      };
    }
    const bank = opts?.ignoreDebitBank
      ? null
      : debitBankGate(store, client);
    if (bank) return bank;
    return {
      ok: true,
      plan_name: limited.name,
      weekly_used: used,
      weekly_limit: limited.weekly_class_limit,
    };
  }
  const bank = opts?.ignoreDebitBank
    ? null
    : debitBankGate(store, client);
  if (bank) return bank;
  return { ok: true, plan_name: covering[0].plan.name };
}

/** Booked + subscribed people a coach can group-message for this session. */
export function membersOnClassSession(
  store: FitgraphStore,
  session: FitSession
): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>();
  for (const b of store.bookings || []) {
    if (b.session_id !== session.id) continue;
    if (b.status === 'cancelled' && b.rsvp !== 'coming') continue;
    const client = (store.clients || []).find((c) => c.id === b.client_id);
    if (client?.active === false) continue;
    const name = client?.name || b.guest_name;
    if (b.client_id && name) byId.set(b.client_id, name);
  }
  for (const row of subscribersForSession(store, session)) {
    if (row.client.active === false) continue;
    byId.set(row.client.id, row.client.name);
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
}

export function subscribersForSession(
  store: FitgraphStore,
  session: FitSession
): Array<{
  client: FitClient;
  plan_name: string;
  booked: boolean;
  booking?: FitBooking;
}> {
  if (isSystemSession(session, store)) return [];
  const bookedBy = new Map(
    (store.bookings || [])
      .filter((b) => b.session_id === session.id && b.status !== 'cancelled')
      .map((b) => [b.client_id, b])
  );
  const rows: Array<{
    client: FitClient;
    plan_name: string;
    booked: boolean;
    booking?: FitBooking;
  }> = [];
  for (const client of store.clients || []) {
    if (client.active === false) continue;
    const covering = activeClassSubscriptions(store, client.id).find((x) =>
      planCoversSession(x.plan, session, store)
    );
    if (!covering) continue;
    const booking = bookedBy.get(client.id);
    rows.push({
      client,
      plan_name: covering.plan.name,
      booked: Boolean(booking),
      booking,
    });
  }
  return rows.sort((a, b) => a.client.name.localeCompare(b.client.name));
}

export type ClassSubscriptionReport = {
  joining: typeof VUKA_JOINING | null;
  active_subs: number;
  mrr_zar: number;
  plans: Array<{
    plan_id: string;
    code: string;
    name: string;
    price_zar: number;
    schedule_label?: string;
    addon?: boolean;
    subscribers: number;
    mrr_zar: number;
  }>;
  members: Array<{
    client_id: string;
    name: string;
    email?: string;
    plans: string[];
    monthly_zar: number;
    attended: number;
    booked: number;
    no_show: number;
  }>;
};

export function buildClassSubscriptionReport(
  store: FitgraphStore,
  opts?: { from?: string; to?: string; coachId?: string | null; clientId?: string | null }
): ClassSubscriptionReport {
  const from = opts?.from || '2000-01-01';
  const to = opts?.to || '9999-12-31';
  const joining = store.settings?.joining_fee_zar != null ? VUKA_JOINING : null;
  const active = (store.subscriptions || []).filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );
  const scopedActive = opts?.clientId
    ? active.filter((s) => s.client_id === opts.clientId)
    : active;
  const planRows = (store.membership_plans || [])
    .filter((p) => p.active !== false)
    .map((p) => {
      const subs = scopedActive.filter((s) => s.plan_id === p.id);
      return {
        plan_id: p.id,
        code: p.code,
        name: p.name,
        price_zar: Number(p.price_zar) || 0,
        schedule_label: p.schedule_label,
        addon: p.addon === true,
        subscribers: subs.length,
        mrr_zar: subs.reduce(
          (n, s) => n + subscriptionChargeZar(s, p),
          0
        ),
      };
    })
    .filter((p) =>
      opts?.clientId
        ? p.subscribers > 0
        : p.subscribers > 0 || p.plan_id.startsWith('vuka_pln_')
    )
    .sort((a, b) => b.mrr_zar - a.mrr_zar);

  const sessionInRange = (s: FitSession) => {
    if (s.date < from || s.date > to) return false;
    if (opts?.coachId && s.coach_id !== opts.coachId) return false;
    return true;
  };

  const members = (store.clients || [])
    .filter((c) => c.active !== false)
    .filter((c) => !opts?.clientId || c.id === opts.clientId)
    .map((c) => {
      const subs = activeClassSubscriptions(store, c.id);
      const books = (store.bookings || []).filter((b) => {
        if (b.client_id !== c.id || b.status === 'cancelled') return false;
        const s = store.sessions.find((x) => x.id === b.session_id);
        return s ? sessionInRange(s) : false;
      });
      return {
        client_id: c.id,
        name: c.name,
        email: c.email,
        plans: subs.map((x) => x.plan.name),
        monthly_zar: subs.reduce(
          (n, x) => n + subscriptionChargeZar(x.sub, x.plan),
          0
        ),
        attended: books.filter((b) => b.status === 'attended').length,
        booked: books.filter(
          (b) => b.status === 'booked' || b.status === 'attended'
        ).length,
        no_show: books.filter((b) => b.status === 'no_show').length,
      };
    })
    .filter((m) => m.plans.length || m.booked || m.attended);

  return {
    joining,
    active_subs: scopedActive.length,
    mrr_zar: planRows.reduce((n, p) => n + p.mrr_zar, 0),
    plans: planRows,
    members: members.sort((a, b) => b.monthly_zar - a.monthly_zar),
  };
}

export function ensureVukaClassCatalog(
  store: FitgraphStore,
  opts: {
    companyId?: number | null;
    tradingName?: string | null;
    legalName?: string | null;
    now?: string;
    weeks?: number;
  }
): { store: FitgraphStore; changed: boolean; applied: boolean } {
  if (!isVukaFitnessCompany(opts)) {
    return { store, changed: false, applied: false };
  }
  const now = opts.now || new Date().toISOString();
  let changed = false;

  if (!store.settings) {
    store.settings = {
      enabled: true,
      public_token: `fg_${opts.companyId || VUKA_COMPANY_ID}_${Date.now().toString(36)}`,
      allow_public_booking: true,
      show_coaches: true,
      show_pricing: true,
    };
    changed = true;
  }
  if (store.settings.require_paid_membership !== true) {
    store.settings.require_paid_membership = true;
    changed = true;
  }
  if (store.settings.show_pricing !== true) {
    store.settings.show_pricing = true;
    changed = true;
  }
  if (store.settings.joining_fee_zar !== VUKA_JOINING.fee_zar) {
    store.settings.joining_fee_zar = VUKA_JOINING.fee_zar;
    changed = true;
  }
  if (store.settings.joining_fee_waived !== VUKA_JOINING.waived) {
    store.settings.joining_fee_waived = VUKA_JOINING.waived;
    changed = true;
  }
  if (store.settings.joining_fee_note !== VUKA_JOINING.note) {
    store.settings.joining_fee_note = VUKA_JOINING.note;
    changed = true;
  }
  if (!store.settings.brand_name) {
    store.settings.brand_name = 'VUKA Fitness';
    changed = true;
  }
  if (store.settings.class_subscribe !== true) {
    store.settings.class_subscribe = true;
    changed = true;
  }
  if (store.settings.collect_debit_bank !== true) {
    store.settings.collect_debit_bank = true;
    changed = true;
  }
  if (store.settings.require_debit_bank !== true) {
    store.settings.require_debit_bank = true;
    changed = true;
  }

  const catalogClassIds = new Set(VUKA_CLASS_TYPES.map((c) => c.id));
  const catalogClassCodes = new Set(VUKA_CLASS_TYPES.map((c) => c.code));

  for (const ct of VUKA_CLASS_TYPES) {
    const i = store.class_types.findIndex(
      (c) => c.id === ct.id || c.code === ct.code
    );
    if (i < 0) {
      store.class_types.push({
        ...ct,
        created_at: now,
      });
      changed = true;
      continue;
    }
    const cur = store.class_types[i];
    if (
      cur.name !== ct.name ||
      cur.description !== ct.description ||
      cur.category !== ct.category ||
      cur.capacity !== ct.capacity ||
      cur.default_duration_min !== ct.default_duration_min ||
      cur.active === false ||
      cur.id !== ct.id
    ) {
      store.class_types[i] = {
        ...cur,
        id: ct.id,
        code: ct.code,
        name: ct.name,
        category: ct.category,
        default_duration_min: ct.default_duration_min,
        capacity: ct.capacity,
        description: ct.description,
        active: true,
      };
      changed = true;
    }
  }

  for (const draft of VUKA_MEMBERSHIP_PLANS) {
    const i = store.membership_plans.findIndex(
      (p) => p.id === draft.id || p.code === draft.code
    );
    const row: FitMembershipPlan = {
      ...(i >= 0 ? store.membership_plans[i] : {}),
      ...draft,
      id: draft.id,
      created_at: i >= 0 ? store.membership_plans[i].created_at : now,
    };
    if (i < 0) {
      store.membership_plans.push(row);
      changed = true;
    } else if (!sameishPlan(store.membership_plans[i], draft)) {
      store.membership_plans[i] = row;
      changed = true;
    }
  }

  for (const p of store.membership_plans) {
    if (p.id.startsWith('vuka_pln_') || String(p.catalog) === 'vuka') continue;
    if (p.public !== false && p.active !== false) {
      p.public = false;
      changed = true;
    }
  }

  const protectedClass = (c: { id: string; code?: string }) =>
    catalogClassIds.has(c.id) ||
    catalogClassCodes.has(String(c.code || '')) ||
    c.code === SYS_PT_CODE ||
    c.code === SYS_COACH_TIME_CODE;

  const dropClassIds = new Set(
    store.class_types.filter((c) => !protectedClass(c)).map((c) => c.id)
  );
  if (dropClassIds.size) {
    for (const s of store.sessions) {
      if (dropClassIds.has(s.class_type_id) && s.status !== 'cancelled') {
        s.status = 'cancelled';
        changed = true;
      }
    }
    store.class_types = store.class_types.filter((c) => !dropClassIds.has(c.id));
    changed = true;
  }

  // Owner builds the diary. Clear auto-seeded series once, then leave calendar alone.
  if (store.settings.vuka_calendar_manual !== true) {
    const autoSessionIds = new Set(
      store.sessions
        .filter(
          (s) =>
            String(s.id).startsWith('vuka_ses_') ||
            (s.origin === 'series' &&
              String(s.series_id || '').startsWith('vuka_ser_'))
        )
        .map((s) => s.id)
    );
    if (autoSessionIds.size) {
      store.bookings = (store.bookings || []).filter(
        (b) => !autoSessionIds.has(b.session_id)
      );
      store.sessions = store.sessions.filter((s) => !autoSessionIds.has(s.id));
      changed = true;
    }
    store.settings.vuka_calendar_manual = true;
    changed = true;
  }

  if (ensureDemoShopProgramme(store, now)) changed = true;
  if (ensureVukaShopOffers(store, now)) changed = true;
  if (ensureVukaCoaches(store, now)) changed = true;

  return { store, changed, applied: true };
}

/**
 * Keep VUKA class rates on the public shop. Does not rewrite bios/photos.
 * If the catalog was never applied, missing plans are inserted. If every
 * VUKA plan was taken off the shop, they are put back.
 */
export function ensureVukaShopOffers(
  store: FitgraphStore,
  now = new Date().toISOString()
): boolean {
  if (!Array.isArray(store.membership_plans)) store.membership_plans = [];
  let changed = false;
  const byId = new Set(store.membership_plans.map((p) => p.id));
  const byCode = new Set(
    store.membership_plans.map((p) => String(p.code || ''))
  );
  for (const draft of VUKA_MEMBERSHIP_PLANS) {
    if (byId.has(draft.id) || byCode.has(draft.code)) continue;
    store.membership_plans.push({ ...draft, created_at: now });
    byId.add(draft.id);
    byCode.add(draft.code);
    changed = true;
  }
  const vukaPlans = store.membership_plans.filter(
    (p) => p.id.startsWith('vuka_pln_') || String(p.catalog) === 'vuka'
  );
  const publicCount = vukaPlans.filter(
    (p) =>
      p.public !== false &&
      p.active !== false &&
      Number(p.price_zar) > 0
  ).length;
  if (vukaPlans.length && publicCount === 0) {
    for (const p of vukaPlans) {
      const draft = VUKA_MEMBERSHIP_PLANS.find(
        (d) => d.id === p.id || d.code === p.code
      );
      p.public = true;
      p.active = true;
      if (!(Number(p.price_zar) > 0) && draft) p.price_zar = draft.price_zar;
      changed = true;
    }
  }
  return changed;
}

/**
 * Contracted VUKA coaches. Email on this list is the GymAdvisor coach
 * sign-in key. Jared is Jared-Wade Cawood (trainer), not member Jared Martin.
 */
export const VUKA_COACH_ROSTER: Array<{
  name: string;
  email: string;
  code: string;
}> = [
  {
    name: 'Bianca Westhorpe-Pottow',
    email: 'b.west.pot@gmail.com',
    code: 'BIA',
  },
  { name: 'Miri', email: 'mirjam@roosgroup.co.za', code: 'MRI' },
  {
    name: 'Jared-Wade Cawood',
    email: 'jaredcawood77@gmail.com',
    code: 'JAR',
  },
  { name: 'Jaryyd', email: '', code: 'JYD' },
  {
    name: 'Sophie Pearce',
    email: 'pearcesophie56@gmail.com',
    code: 'SOP',
  },
];

function findExistingVukaCoach(
  store: FitgraphStore,
  row: { name: string; email: string }
): FitCoach | undefined {
  const email = String(row.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = (store.coaches || []).find((c) =>
      coachPortalEmails(c).includes(email)
    );
    if (byEmail) return byEmail;
  }
  const byName = (store.coaches || []).find((c) =>
    namesMatchForPortalSignIn(c.name, row.name)
  );
  if (byName) return byName;
  const first = shopCoachFirstName(row.name);
  if (!first) return undefined;
  const sameFirst = (store.coaches || []).filter(
    (c) => shopCoachFirstName(c.name) === first
  );
  if (first === 'jared') {
    const trainer = sameFirst.find((c) => /cawood/i.test(c.name));
    if (trainer) return trainer;
    const notMember = sameFirst.filter((c) => !/martin/i.test(c.name));
    if (notMember.length === 1) return notMember[0];
    const unnamed = sameFirst.filter(
      (c) => shopCoachFirstName(c.name) === first && !String(c.name).includes(' ')
    );
    if (unnamed.length === 1) return unnamed[0];
    return undefined;
  }
  if (sameFirst.length === 1) return sameFirst[0];
  return undefined;
}

/** Keep contracted VUKA coaches on the gym file with their emails. */
export function ensureVukaCoaches(
  store: FitgraphStore,
  now = new Date().toISOString()
): boolean {
  if (!Array.isArray(store.coaches)) store.coaches = [];
  let changed = false;
  for (const row of VUKA_COACH_ROSTER) {
    const email = String(row.email || '').trim().toLowerCase();
    let coach = findExistingVukaCoach(store, row);
    if (!coach) {
      coach = {
        id: newId('coh'),
        code: row.code,
        name: row.name,
        email: email || undefined,
        engagement: 'contractor',
        can_manage_classes: true,
        active: true,
        created_at: now,
      };
      store.coaches.push(coach);
      changed = true;
      continue;
    }
    if (email && !coachPortalEmails(coach).includes(email)) {
      coach.email = email;
      changed = true;
    }
    if (coach.can_manage_classes !== true) {
      coach.can_manage_classes = true;
      changed = true;
    }
    if (coach.active === false) {
      coach.active = true;
      changed = true;
    }
    if (!coach.engagement) {
      coach.engagement = 'contractor';
      changed = true;
    }
    if (
      row.name.toLowerCase() !== String(coach.name || '').toLowerCase() &&
      shopCoachFirstName(coach.name) === shopCoachFirstName(row.name) &&
      !String(coach.name || '').includes(' ')
    ) {
      coach.name = row.name;
      changed = true;
    }
  }
  return changed;
}

/** Bianca, Miri, Jared, Jaryyd, Sophie — then everyone else. */
export function ensureVukaCoachOrder(store: FitgraphStore): boolean {
  const list = store.coaches || [];
  if (!list.length) return false;
  const sorted = list.slice().sort((a, b) => {
    const r = vukaShopCoachRank(a.name) - vukaShopCoachRank(b.name);
    if (r !== 0) return r;
    return String(a.name).localeCompare(String(b.name));
  });
  let changed = false;
  sorted.forEach((c, i) => {
    const order = 10 * (i + 1);
    if (c.sort_order !== order) {
      c.sort_order = order;
      changed = true;
    }
  });
  const same = sorted.every((c, i) => c.id === list[i]?.id);
  if (!same) {
    store.coaches = sorted;
    changed = true;
  }
  return changed;
}

export async function persistVukaCatalogIfNeeded(
  companyId: number,
  store: FitgraphStore,
  save: (next: FitgraphStore) => Promise<void>,
  identity?: { tradingName?: string | null; legalName?: string | null }
): Promise<FitgraphStore> {
  if (
    !isVukaFitnessCompany({
      companyId,
      tradingName: identity?.tradingName,
      legalName: identity?.legalName,
    })
  ) {
    return store;
  }
  const { absorbKnownClientAliases, ensureVukaRoster, vukaDeskSettled } =
    await import('@/lib/fitness/vuka-roster');
  let next = store;
  let dirty = false;
  if (!vukaDeskSettled(store)) {
    const result = ensureVukaClassCatalog(store, {
      companyId,
      tradingName: identity?.tradingName,
      legalName: identity?.legalName,
    });
    next = result.store;
    dirty = result.changed;
    const roster = ensureVukaRoster(next);
    next = roster.store;
    dirty = dirty || roster.changed;
  }
  const absorbed = absorbKnownClientAliases(next);
  next = absorbed.store;
  dirty = dirty || absorbed.changed;
  if (ensureDemoShopProgramme(next)) dirty = true;
  if (ensureVukaShopOffers(next)) dirty = true;
  if (ensureVukaCoaches(next)) dirty = true;
  if (ensureVukaCoachOrder(next)) dirty = true;
  if (dirty) {
    await save(next);
  }
  return next;
}
