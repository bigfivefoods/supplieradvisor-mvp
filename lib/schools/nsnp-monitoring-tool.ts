/**
 * KZN NSNP Monitoring Tool (2026-27) — types + official scoring rules.
 * Used by DBE/PEU field workers for on-site school monitoring.
 */

export const NSNP_MONITORING_VERSION = 'KZN-2026-27';

export const FOOD_QUALITY_PRODUCTS = [
  {
    key: 'soya_mince',
    label: 'Soya Mince',
    spec:
      'Protein ≥24g/100g; TVP/soya first on ingredients list',
  },
  {
    key: 'maize_meal',
    label: 'Maize Meal',
    spec: '“Super” maize meal; fortified; logo printed/embedded',
  },
  {
    key: 'sugar_beans',
    label: 'Sugar Beans',
    spec: 'Dry beans Grade 1/2; transparent packaging that does not tear',
  },
  {
    key: 'uht_milk',
    label: 'UHT Milk',
    spec: 'Long-life full cream cow’s milk; UHT; carton container',
  },
  {
    key: 'amasi',
    label: 'Amasi',
    spec: 'From high/full cream pasteurised cow’s milk; 2L/4L opaque yellow HDPE bottles',
  },
  {
    key: 'pilchards',
    label: 'Pilchards in Tomato Sauce',
    spec: '70% pilchards / 30% sauce; SABS/NRCS approved',
  },
] as const;

export type FoodQualityKey = (typeof FOOD_QUALITY_PRODUCTS)[number]['key'];

export type YesNo = 'yes' | 'no' | '';

export type FeedingTimePrimary =
  | 'by_1130'
  | '1131_1200'
  | '1201_1230'
  | 'after_1230'
  | '';

export type FeedingTimeSecondary =
  | 'by_1000'
  | '1001_1030'
  | '1031_1100'
  | 'after_1100'
  | '';

export type GardenCondition = 'good' | 'average' | 'neglected' | '';
export type GardenProduceUse = 'supplement_feeding' | 'other' | '';

export type SchoolPhaseBand =
  | 'primary_combined_intermediate_sec_q1'
  | 'secondary_q2_5'
  | '';

export type MonitoringFormData = {
  // A1 Interview & school
  a1_school_name: string;
  a2_emis: string;
  a3_school_phone: string;
  a4_district: string;
  a5_quintile: string;
  a6_monitor_name: string;
  a7_visit_date: string;
  a8_time_in: string;
  a9_r1_name: string;
  a9_r1_position: string;
  a9_r1_contact: string;
  a9_r2_name: string;
  a9_r2_position: string;
  a9_r2_contact: string;
  a10_sp_name: string;
  a10_sp_number: string;
  a11_sp_adequate: YesNo;
  a12_nsnp_learners: string;
  a13_learners_eating: string;
  a14_food_handlers: string;
  school_profile_id: number | null;
  school_phase_band: SchoolPhaseBand;

  // A2 Main meal
  a15_feeding_today: YesNo;
  a16_feed_time_primary: FeedingTimePrimary;
  a17_feed_time_secondary: FeedingTimeSecondary;

  // B Record keeping (yes = score points)
  b1: YesNo;
  b2: YesNo;
  b3: YesNo;
  b4: YesNo;
  b5: YesNo;
  b6: YesNo;
  b7: YesNo;
  b8: YesNo;
  b9: YesNo;
  b10: YesNo;
  b11: YesNo;
  b12: YesNo;
  b9_samples: Array<{
    product: string;
    qty_counted: string;
    qty_register: string;
    match: YesNo;
  }>;

  // C Food groups
  c_starch: FoodGroupRow;
  c_protein: FoodGroupRow;
  c_fruit_veg: FoodGroupRow;
  c_exam_learners: string;

  // D Health & safety
  d1: YesNo;
  d2: YesNo;
  d3: YesNo;
  d4: YesNo;
  d5: YesNo;
  d6: YesNo;
  d7: YesNo;
  d8: YesNo;
  d9: YesNo;
  d10: YesNo;
  d11: YesNo;
  d12: YesNo;
  d13: YesNo;
  d14: YesNo;
  d15: YesNo;
  d16: YesNo;
  d17: YesNo;
  quality: Record<
    FoodQualityKey,
    {
      within_spec: YesNo;
      original_packaging: YesNo;
      within_expiry: YesNo;
      expiry_date: string;
      correctly_labelled: YesNo;
    }
  >;
  s1_sample_containers: YesNo;
  s2_coa_valid: YesNo;

  // E Gardens
  e1_has_garden: YesNo;
  e1_why_not: string;
  e2_condition: GardenCondition;
  e3_learners_educators: boolean;
  e3_ground_staff: boolean;
  e3_community: boolean;
  e3_explain: string;
  e4_produce_use: GardenProduceUse;

  // Breakfast
  bf1_served: YesNo;
  bf2_time: 'before_8' | 'after_8' | '';
  bf3_reason: string;
  bf_challenges: string;
  bf_actions: string;
  bf_comments: string;

  // Feedback
  observations: string;
  recommendations: string;
  principal_ack: boolean;
  coordinator_ack: boolean;
};

export type FoodGroupRow = {
  served: boolean;
  product_description: string;
  qty_prepared: string;
  qty_should: string;
  /** auto % = prepared/should * 100 when both numeric */
  pct_prepared: string;
};

export type MonitoringScores = {
  feeding_time_points: number;
  food_groups_served: number;
  food_groups_kpi: number;
  starch_kpi: number;
  protein_kpi: number;
  veg_kpi: number;
  overall_kpi: number;
  rkmp: number;
  nehs: number;
  gardens: number;
  traffic_light: 'green' | 'yellow' | 'red';
  b_detail: Record<string, number>;
  d_detail: Record<string, number>;
  e_detail: Record<string, number>;
};

export function emptyQualityRow() {
  return {
    within_spec: '' as YesNo,
    original_packaging: '' as YesNo,
    within_expiry: '' as YesNo,
    expiry_date: '',
    correctly_labelled: '' as YesNo,
  };
}

export function emptyMonitoringForm(
  defaults?: Partial<MonitoringFormData>
): MonitoringFormData {
  const quality = {} as MonitoringFormData['quality'];
  for (const p of FOOD_QUALITY_PRODUCTS) {
    quality[p.key] = emptyQualityRow();
  }
  return {
    a1_school_name: '',
    a2_emis: '',
    a3_school_phone: '',
    a4_district: '',
    a5_quintile: '',
    a6_monitor_name: '',
    a7_visit_date: new Date().toISOString().slice(0, 10),
    a8_time_in: '',
    a9_r1_name: '',
    a9_r1_position: '',
    a9_r1_contact: '',
    a9_r2_name: '',
    a9_r2_position: '',
    a9_r2_contact: '',
    a10_sp_name: '',
    a10_sp_number: '',
    a11_sp_adequate: '',
    a12_nsnp_learners: '',
    a13_learners_eating: '',
    a14_food_handlers: '',
    school_profile_id: null,
    school_phase_band: '',
    a15_feeding_today: '',
    a16_feed_time_primary: '',
    a17_feed_time_secondary: '',
    b1: '',
    b2: '',
    b3: '',
    b4: '',
    b5: '',
    b6: '',
    b7: '',
    b8: '',
    b9: '',
    b10: '',
    b11: '',
    b12: '',
    b9_samples: [
      { product: '', qty_counted: '', qty_register: '', match: '' },
      { product: '', qty_counted: '', qty_register: '', match: '' },
    ],
    c_starch: emptyFoodGroup(),
    c_protein: emptyFoodGroup(),
    c_fruit_veg: emptyFoodGroup(),
    c_exam_learners: '',
    d1: '',
    d2: '',
    d3: '',
    d4: '',
    d5: '',
    d6: '',
    d7: '',
    d8: '',
    d9: '',
    d10: '',
    d11: '',
    d12: '',
    d13: '',
    d14: '',
    d15: '',
    d16: '',
    d17: '',
    quality,
    s1_sample_containers: '',
    s2_coa_valid: '',
    e1_has_garden: '',
    e1_why_not: '',
    e2_condition: '',
    e3_learners_educators: false,
    e3_ground_staff: false,
    e3_community: false,
    e3_explain: '',
    e4_produce_use: '',
    bf1_served: '',
    bf2_time: '',
    bf3_reason: '',
    bf_challenges: '',
    bf_actions: '',
    bf_comments: '',
    observations: '',
    recommendations: '',
    principal_ack: false,
    coordinator_ack: false,
    ...defaults,
  };
}

function emptyFoodGroup(): FoodGroupRow {
  return {
    served: false,
    product_description: '',
    qty_prepared: '',
    qty_should: '',
    pct_prepared: '',
  };
}

function ynPoints(v: YesNo, pts: number): number {
  return v === 'yes' ? pts : 0;
}

function parseNum(s: string): number | null {
  const n = Number(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** Column E % prepared — use explicit pct or compute from C/D */
export function foodGroupPct(row: FoodGroupRow): number | null {
  if (row.pct_prepared.trim()) {
    const n = parseNum(row.pct_prepared);
    return n;
  }
  const prep = parseNum(row.qty_prepared);
  const should = parseNum(row.qty_should);
  if (prep == null || should == null || should === 0) return null;
  return Math.round((prep / should) * 1000) / 10;
}

export function quantityKpiBand(pct: number | null): number {
  if (pct == null || pct < 0) return 0;
  if (pct >= 81) return 20;
  if (pct >= 61) return 15;
  if (pct >= 41) return 10;
  if (pct >= 25) return 5;
  return 0;
}

export function feedingTimePrimaryPoints(t: FeedingTimePrimary): number {
  switch (t) {
    case 'by_1130':
      return 20;
    case '1131_1200':
      return 15;
    case '1201_1230':
      return 10;
    case 'after_1230':
      return 0;
    default:
      return 0;
  }
}

export function feedingTimeSecondaryPoints(t: FeedingTimeSecondary): number {
  switch (t) {
    case 'by_1000':
      return 20;
    case '1001_1030':
      return 15;
    case '1031_1100':
      return 10;
    case 'after_1100':
      return 0;
    default:
      return 0;
  }
}

export function scoreMonitoringForm(form: MonitoringFormData): MonitoringScores {
  const b_detail: Record<string, number> = {
    b1: ynPoints(form.b1, 2),
    b2: ynPoints(form.b2, 3),
    b3: ynPoints(form.b3, 1),
    b4: ynPoints(form.b4, 1),
    b5: ynPoints(form.b5, 2),
    b6: ynPoints(form.b6, 2),
    b7: ynPoints(form.b7, 2),
    b8: ynPoints(form.b8, 1),
    b9: ynPoints(form.b9, 2),
    b10: ynPoints(form.b10, 1),
    b11: ynPoints(form.b11, 2),
    b12: ynPoints(form.b12, 1),
  };
  const rkmp = Object.values(b_detail).reduce((a, b) => a + b, 0);

  const d_detail: Record<string, number> = {
    d1: ynPoints(form.d1, 1),
    d2: ynPoints(form.d2, 2),
    d3: ynPoints(form.d3, 2),
    d4: ynPoints(form.d4, 1),
    d5: ynPoints(form.d5, 1),
    d6: ynPoints(form.d6, 1),
    d7: ynPoints(form.d7, 1),
    d8: ynPoints(form.d8, 1),
    d9: ynPoints(form.d9, 1),
    d10: ynPoints(form.d10, 1),
    d11: ynPoints(form.d11, 1),
    d12: ynPoints(form.d12, 2),
    d13: ynPoints(form.d13, 2),
    d14: ynPoints(form.d14, 1),
    d15: ynPoints(form.d15, 1),
    d16: ynPoints(form.d16, 1),
  };
  const nehs = Object.values(d_detail).reduce((a, b) => a + b, 0);

  // Gardens /10
  let e1 = 0;
  let e2 = 0;
  let e3 = 0;
  let e4 = 0;
  if (form.e1_has_garden === 'yes') {
    e1 = 2;
    if (form.e2_condition === 'good') e2 = 4;
    else if (form.e2_condition === 'average') e2 = 2;
    else e2 = 0;
    if (form.e3_learners_educators) e3 += 2;
    if (form.e3_ground_staff) e3 += 1;
    if (form.e3_community) e3 += 1;
    e3 = Math.min(2, e3);
    e4 = form.e4_produce_use === 'supplement_feeding' ? 2 : 0;
  }
  const e_detail = { e1, e2, e3, e4 };
  const gardens = e1 + e2 + e3 + e4;

  // Food groups served
  const groups = [
    form.c_starch.served,
    form.c_protein.served,
    form.c_fruit_veg.served,
  ].filter(Boolean).length;
  const food_groups_kpi = groups >= 3 ? 20 : groups === 2 ? 10 : 0;

  const starch_kpi = quantityKpiBand(foodGroupPct(form.c_starch));
  const protein_kpi = quantityKpiBand(foodGroupPct(form.c_protein));
  const veg_kpi = quantityKpiBand(foodGroupPct(form.c_fruit_veg));

  let feeding_time_points = 0;
  if (form.a15_feeding_today === 'yes') {
    if (form.school_phase_band === 'secondary_q2_5') {
      feeding_time_points = feedingTimeSecondaryPoints(
        form.a17_feed_time_secondary
      );
    } else {
      // default primary/combined/intermediate + secondary Q1
      feeding_time_points = feedingTimePrimaryPoints(
        form.a16_feed_time_primary
      );
    }
  }

  // Official: if not feeding today, whole KPI is 0
  let overall_kpi = 0;
  if (form.a15_feeding_today === 'yes') {
    overall_kpi =
      feeding_time_points +
      food_groups_kpi +
      starch_kpi +
      protein_kpi +
      veg_kpi;
  } else if (form.a15_feeding_today === 'no') {
    overall_kpi = 0;
  }

  const traffic_light: MonitoringScores['traffic_light'] =
    overall_kpi >= 81 ? 'green' : overall_kpi >= 50 ? 'yellow' : 'red';

  return {
    feeding_time_points,
    food_groups_served: groups,
    food_groups_kpi,
    starch_kpi,
    protein_kpi,
    veg_kpi,
    overall_kpi,
    rkmp,
    nehs,
    gardens,
    traffic_light,
    b_detail,
    d_detail,
    e_detail,
  };
}

export const B_QUESTIONS: Array<{
  key: keyof MonitoringFormData;
  code: string;
  label: string;
  points: number;
  guidance: string;
}> = [
  {
    key: 'b1',
    code: 'B1',
    label:
      'Is the NSNP file filed according to NSNP current financial year and standard school file index?',
    points: 2,
    guidance:
      '2 points if using standard file index AND ordered by index and current financial year.',
  },
  {
    key: 'b2',
    code: 'B2',
    label: 'Is there evidence that the school has a functional NSNP committee?',
    points: 3,
    guidance:
      'Properly constituted (Annexure A); roles & responsibilities acknowledged form signed/stamped; met last quarter (minutes).',
  },
  {
    key: 'b3',
    code: 'B3',
    label:
      'Is the NSNP Approval letter for the current financial year on file?',
    points: 1,
    guidance:
      'Letter sets budget allocation, feeding days and monthly budget for this financial year.',
  },
  {
    key: 'b4',
    code: 'B4',
    label:
      'Is the NSNP School Feeding Summary Register correct and up to date for the previous month?',
    points: 1,
    guidance:
      'Tracks learners fed per day; system to confirm totals by class/grade/phase.',
  },
  {
    key: 'b5',
    code: 'B5',
    label:
      'Are copies of the signed Food Handler contracts and IDs on file?',
    points: 2,
    guidance:
      'Signed contracts for all Food Handlers with ID copy attached (Annexure C).',
  },
  {
    key: 'b6',
    code: 'B6',
    label:
      'Are copies of NSNP claim documents on file for all previous months of the current financial year?',
    points: 2,
    guidance: 'Monthly claim forms filed for all prior months of this FY.',
  },
  {
    key: 'b7',
    code: 'B7',
    label:
      'Is there evidence that for the current month the school checked quantities per delivery/standardised DN against the official school-specific delivery schedule?',
    points: 2,
    guidance:
      'Comparison on the delivery schedule (not a separate paper) + quality tracking sheet.',
  },
  {
    key: 'b8',
    code: 'B8',
    label:
      'Is the food handler attendance register up to date for the current month?',
    points: 1,
    guidance: 'Complete up to and including the day of the visit.',
  },
  {
    key: 'b9',
    code: 'B9',
    label:
      'Is the Stock Register up to date and accurate for the current month?',
    points: 2,
    guidance:
      'Count min. 2 products (include high-risk). 2 points only if all counted products match the register.',
  },
  {
    key: 'b10',
    code: 'B10',
    label: 'Is the equipment and utensils register up to date and accurate?',
    points: 1,
    guidance: '1 point if register is up to date and filed.',
  },
  {
    key: 'b11',
    code: 'B11',
    label:
      'Is there evidence the school is using the School Specific Menu to determine the correct amount of food to prepare?',
    points: 2,
    guidance:
      'School Specific Menu for current FY must be on the wall in the kitchen.',
  },
  {
    key: 'b12',
    code: 'B12',
    label:
      'Is the standard food handler duty list on the wall in the kitchen? (Job description on file)',
    points: 1,
    guidance: 'English & Zulu duty list on the kitchen wall.',
  },
];

export const D_QUESTIONS: Array<{
  key: keyof MonitoringFormData;
  code: string;
  area: string;
  label: string;
  points: number;
  guidance: string;
}> = [
  {
    key: 'd1',
    code: 'D1',
    area: 'Food Handlers',
    label: 'Is there evidence that Food Handlers have been trained?',
    points: 1,
    guidance: 'Signed register for training or video attendance.',
  },
  {
    key: 'd2',
    code: 'D2',
    area: 'Food Handlers',
    label: 'Are the Food Handlers clean and appropriately dressed?',
    points: 2,
    guidance: 'Clean · aprons · head covering · closed shoes (all required).',
  },
  {
    key: 'd3',
    code: 'D3',
    area: 'Food Handlers',
    label:
      'Is there evidence that Food Handlers are conducting kitchen hygiene checklist activities hourly?',
    points: 2,
    guidance: 'Daily Kitchen Hygiene Checklist completed for visit day.',
  },
  {
    key: 'd4',
    code: 'D4',
    area: 'Meal Prep',
    label: 'Is the preparation area ventilated?',
    points: 1,
    guidance: 'Windows/doors open for ventilation.',
  },
  {
    key: 'd5',
    code: 'D5',
    area: 'Meal Prep',
    label: 'Does the school have a basic First Aid Kit in the preparation area?',
    points: 1,
    guidance:
      'Plasters, gloves, CPR mask, splints, disinfectant, gauze, scissors, etc.',
  },
  {
    key: 'd6',
    code: 'D6',
    area: 'Meal Prep',
    label:
      'Is there a fire extinguisher in the meal prep area serviced in the last 12 months?',
    points: 1,
    guidance: 'Service sticker with date / next due date.',
  },
  {
    key: 'd7',
    code: 'D7',
    area: 'Meal Prep',
    label:
      'Are flammable liquids positioned/stored away from flames / the gas stove?',
    points: 1,
    guidance: 'Alcohol-based cleaners not near open flame.',
  },
  {
    key: 'd8',
    code: 'D8',
    area: 'Meal Prep',
    label:
      'If the school uses gas, is the gas canister outside, protected and locked?',
    points: 1,
    guidance: 'Wood/electricity schools score 1 automatically if applicable.',
  },
  {
    key: 'd9',
    code: 'D9',
    area: 'Meal Prep',
    label: 'Is waste being managed correctly?',
    points: 1,
    guidance: 'Bins outside with lids; emptied and disinfected regularly.',
  },
  {
    key: 'd10',
    code: 'D10',
    area: 'Serve / Eat',
    label: 'Are all learners washing their hands before and after eating?',
    points: 1,
    guidance: 'Soap and running water; observe or verify with educators/learners.',
  },
  {
    key: 'd11',
    code: 'D11',
    area: 'Serve / Eat',
    label:
      'Are learners eating in classrooms/dining hall under educator supervision?',
    points: 1,
    guidance: 'Supervised; no sharing of utensils.',
  },
  {
    key: 'd12',
    code: 'D12',
    area: 'Serve / Eat',
    label: 'Is prepared food appropriately covered?',
    points: 2,
    guidance: 'Original lids including when taken to class.',
  },
  {
    key: 'd13',
    code: 'D13',
    area: 'Storeroom',
    label: 'Is the storage area clean, safe and hygienic?',
    points: 2,
    guidance: 'Clean · off floor · away from chemicals · FIFO packing.',
  },
  {
    key: 'd14',
    code: 'D14',
    area: 'Storeroom',
    label: 'Are the key NSNP products within their specifications?',
    points: 1,
    guidance: 'Use quality tracking sheet column A.',
  },
  {
    key: 'd15',
    code: 'D15',
    area: 'Storeroom',
    label:
      'Are the key NSNP products packaged in their original manufacturer packaging?',
    points: 1,
    guidance: 'Quality tracking sheet column B.',
  },
  {
    key: 'd16',
    code: 'D16',
    area: 'Storeroom',
    label: 'Are the key NSNP products within their expiry date?',
    points: 1,
    guidance: 'Quality tracking sheet column C.',
  },
];
