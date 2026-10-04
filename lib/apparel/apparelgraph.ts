/**
 * ApparelAdvisor® (apparelgraph) — apparel manufacturing + brand OS.
 * Stored under profiles.metadata.apparelgraph (no new SQL tables).
 *
 * Range → style/color/size matrix → tech pack + landed BOM → sample gates
 * → critical path → floor tickets → QA holds → wholesale ATS / line sheets
 * → ship. Invoices stay on Customers Trade. POs stay on Suppliers.
 */

export const APPARELGRAPH_MODULE_ID = 'apparelgraph' as const;
export const APPARELGRAPH_META_KEY = 'apparelgraph' as const;
export const APPARELGRAPH_PACK_ID = 'apparel' as const;
export const APPAREL_QA_HOLD_CODE = 'QA_HOLD' as const;
export const APPARELGRAPH_TOKEN_KEY = 'apparelgraph_public_token' as const;
export const APPARELGRAPH_TOKENS_KEY = 'apparelgraph_tokens' as const;

export type ApparelRollOwnership = 'cmt_customer' | 'factory';
export type ApparelGateStatus = 'pass' | 'fail' | 'pending';

export type ApparelCapability = {
  lines: number;
  operators: number;
  units_per_day: number;
  lead_days: number;
  cmt_only?: boolean;
  notes?: string;
};

export type ApparelSeason = {
  id: string;
  code: string;
  name: string;
  drop_date?: string | null;
  status?: 'planning' | 'open' | 'closed' | string;
};

export type ApparelStyle = {
  id: string;
  code: string;
  name: string;
  season_id?: string | null;
  category?: string;
  status?: 'concept' | 'sampling' | 'approved' | 'production' | 'shipped' | string;
  size_curve?: string;
  colorways?: string[];
};

export type ApparelStyleMatrixRow = {
  id: string;
  style_code: string;
  colour: string;
  size: string;
  planned_qty: number;
  cut_qty?: number;
  sew_qty?: number;
  booked_qty?: number;
  shipped_qty?: number;
};

export type ApparelTechPack = {
  id: string;
  style_code: string;
  version: string;
  approved_at?: string | null;
  owner?: string;
};

export type ApparelBomItem = {
  id: string;
  style_code: string;
  item: string;
  uom: string;
  consumption: number;
  wastage_pct?: number;
  unit_cost?: number;
  duty_pct?: number;
};

export type ApparelSample = {
  id: string;
  style_code: string;
  stage: 'proto' | 'fit' | 'pp' | 'shipment';
  status: 'open' | 'approved' | 'rework';
  due_date?: string | null;
  notes?: string;
};

export type ApparelRoll = {
  id: string;
  roll_no: string;
  lot_number?: string | null;
  po_number?: string | null;
  ownership: ApparelRollOwnership;
  material: string;
  shade?: string | null;
  length_m: number;
  balance_m?: number | null;
};

export type ApparelTicket = {
  id: string;
  ticket_no: string;
  style_code: string;
  lot_number?: string | null;
  po_number?: string | null;
  shade?: string | null;
  units: number;
  four_point: ApparelGateStatus;
  shade_band: ApparelGateStatus;
  gold_seal: ApparelGateStatus;
  aql: ApparelGateStatus;
  nbc_expiry?: string | null;
  quality_hold_code?: string | null;
  quality_hold_open?: boolean;
};

export type ApparelTa = {
  id: string;
  style_code: string;
  supplier: string;
  status: 'open' | 'approved' | 'expired';
  expires_on?: string | null;
};

export type ApparelPathItem = {
  id: string;
  style_code: string;
  milestone: string;
  planned_date?: string | null;
  actual_date?: string | null;
  status?: 'planned' | 'done' | 'late' | string;
};

export type ApparelLineSheet = {
  id: string;
  number: string;
  season_id?: string | null;
  title: string;
  status?: 'draft' | 'issued' | 'closed' | string;
  style_codes?: string[];
};

export type ApparelPrebook = {
  id: string;
  line_sheet_id?: string | null;
  customer: string;
  style_code: string;
  colour: string;
  size: string;
  qty: number;
  status?: 'open' | 'allocated' | 'shipped' | string;
};

export type ApparelPortal = {
  id?: string;
  token: string;
  kind: 'public' | 'buyer' | 'mill';
  label?: string;
};

export type ApparelSettings = {
  public_token?: string;
};

export type ApparelgraphStore = {
  capability: ApparelCapability;
  seasons: ApparelSeason[];
  styleBook: ApparelStyle[];
  styles: {
    matrix: ApparelStyleMatrixRow[];
    techPack: ApparelTechPack[];
    bom: ApparelBomItem[];
  };
  samples: ApparelSample[];
  rolls: ApparelRoll[];
  tickets: ApparelTicket[];
  ta: ApparelTa[];
  path: ApparelPathItem[];
  lineSheets: ApparelLineSheet[];
  prebooks: ApparelPrebook[];
  portals: ApparelPortal[];
  settings: ApparelSettings;
  updated_at?: string;
};

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function money(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function newApparelId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function mintApparelToken(): string {
  return `ap_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function bomLanded(row: ApparelBomItem): number {
  const waste = 1 + money(row.wastage_pct) / 100;
  const duty = 1 + money(row.duty_pct) / 100;
  return money(row.consumption) * money(row.unit_cost) * waste * duty;
}

export function styleBomCost(store: ApparelgraphStore, styleCode: string): number {
  return store.styles.bom
    .filter((row) => row.style_code === styleCode)
    .reduce((sum, row) => sum + bomLanded(row), 0);
}

export function availableToSell(row: ApparelStyleMatrixRow): number {
  const made = money(row.sew_qty ?? row.cut_qty ?? row.planned_qty);
  return Math.max(0, made - money(row.booked_qty) - money(row.shipped_qty));
}

export function emptyApparelgraphStore(): ApparelgraphStore {
  return {
    capability: {
      lines: 0,
      operators: 0,
      units_per_day: 0,
      lead_days: 0,
    },
    seasons: [],
    styleBook: [],
    styles: {
      matrix: [],
      techPack: [],
      bom: [],
    },
    samples: [],
    rolls: [],
    tickets: [],
    ta: [],
    path: [],
    lineSheets: [],
    prebooks: [],
    portals: [],
    settings: {},
  };
}

export function hydrateApparelgraphStore(
  store: ApparelgraphStore
): ApparelgraphStore {
  const next: ApparelgraphStore = {
    ...emptyApparelgraphStore(),
    ...store,
    seasons: [...(store.seasons || [])],
    styleBook: [...(store.styleBook || [])],
    styles: {
      matrix: [...(store.styles?.matrix || [])],
      techPack: [...(store.styles?.techPack || [])],
      bom: [...(store.styles?.bom || [])],
    },
    samples: [...(store.samples || [])],
    rolls: [...(store.rolls || [])],
    tickets: [...(store.tickets || [])],
    ta: [...(store.ta || [])],
    path: [...(store.path || [])],
    lineSheets: [...(store.lineSheets || [])],
    prebooks: [...(store.prebooks || [])],
    portals: (store.portals || []).map((p) => ({
      ...p,
      id: p.id || p.token,
    })),
    settings: { ...(store.settings || {}) },
  };

  if (next.styleBook.length === 0) {
    const codes = new Set(next.styles.matrix.map((r) => r.style_code).filter(Boolean));
    for (const code of codes) {
      const colours = [
        ...new Set(
          next.styles.matrix
            .filter((r) => r.style_code === code)
            .map((r) => r.colour)
        ),
      ];
      const sizes = [
        ...new Set(
          next.styles.matrix
            .filter((r) => r.style_code === code)
            .map((r) => r.size)
        ),
      ];
      next.styleBook.push({
        id: `sty_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        code,
        name: code,
        colorways: colours,
        size_curve: sizes.join('-'),
        status: 'production',
      });
    }
  }

  if (
    next.settings.public_token &&
    !next.portals.some((p) => p.kind === 'public')
  ) {
    next.portals.push({
      token: next.settings.public_token,
      kind: 'public',
      label: 'Wholesale line-sheet PWA',
    });
  }

  return next;
}

export function readApparelgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): ApparelgraphStore {
  const src = asObject(meta);
  const raw = asObject(src[APPARELGRAPH_META_KEY]);
  const d = emptyApparelgraphStore();
  const styles = asObject(raw.styles);
  const settings = asObject(raw.settings);
  const store: ApparelgraphStore = {
    capability: {
      ...d.capability,
      ...asObject(raw.capability),
    },
    seasons: asArray<ApparelSeason>(raw.seasons),
    styleBook: asArray<ApparelStyle>(raw.styleBook),
    styles: {
      matrix: Array.isArray(styles.matrix)
        ? (styles.matrix as ApparelStyleMatrixRow[])
        : [],
      techPack: Array.isArray(styles.techPack)
        ? (styles.techPack as ApparelTechPack[])
        : [],
      bom: Array.isArray(styles.bom) ? (styles.bom as ApparelBomItem[]) : [],
    },
    samples: asArray<ApparelSample>(raw.samples),
    rolls: asArray<ApparelRoll>(raw.rolls),
    tickets: asArray<ApparelTicket>(raw.tickets),
    ta: asArray<ApparelTa>(raw.ta),
    path: asArray<ApparelPathItem>(raw.path),
    lineSheets: asArray<ApparelLineSheet>(raw.lineSheets),
    prebooks: asArray<ApparelPrebook>(raw.prebooks),
    portals: asArray<ApparelPortal>(raw.portals),
    settings: {
      public_token:
        typeof settings.public_token === 'string'
          ? settings.public_token
          : typeof src[APPARELGRAPH_TOKEN_KEY] === 'string'
            ? String(src[APPARELGRAPH_TOKEN_KEY])
            : undefined,
    },
    updated_at:
      typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
  return hydrateApparelgraphStore(store);
}

function rowIdentity(row: unknown): string {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  const rec = row as { id?: unknown; token?: unknown };
  return String(rec.id || rec.token || '').trim();
}

function mergeIdArray(existing: unknown, incoming: unknown): unknown[] {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  const out: unknown[] = [];
  const seen = new Set<string>();

  for (const row of next) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const id = rowIdentity(row);
      if (!id) continue;
      if (seen.has(id)) continue;
      out.push(row);
      seen.add(id);
      continue;
    }
    out.push(row);
  }

  for (const row of prev) {
    const id = rowIdentity(row);
    if (id && seen.has(id)) continue;
    out.push(row);
  }

  return out;
}

function deepMergeValue(existing: unknown, incoming: unknown): unknown {
  if (incoming === undefined) return existing;
  if (Array.isArray(incoming)) {
    return mergeIdArray(existing, incoming);
  }
  if (
    incoming &&
    typeof incoming === 'object' &&
    !Array.isArray(incoming) &&
    existing &&
    typeof existing === 'object' &&
    !Array.isArray(existing)
  ) {
    const left = existing as Record<string, unknown>;
    const right = incoming as Record<string, unknown>;
    const out: Record<string, unknown> = { ...left };
    for (const [k, v] of Object.entries(right)) {
      out[k] = deepMergeValue(left[k], v);
    }
    return out;
  }
  return incoming;
}

export function mergeApparelgraphStore(
  existing: ApparelgraphStore,
  incoming: Partial<ApparelgraphStore>
): ApparelgraphStore {
  return hydrateApparelgraphStore(
    deepMergeValue(existing, incoming) as ApparelgraphStore
  );
}

export function writeApparelgraphToMetadata(
  meta: Record<string, unknown>,
  store: ApparelgraphStore
): Record<string, unknown> {
  const tokens: Record<string, string> = {};
  for (const p of store.portals) {
    if (p.token) tokens[p.token] = p.kind;
  }
  if (store.settings.public_token) {
    tokens[store.settings.public_token] = tokens[store.settings.public_token] || 'public';
  }
  return {
    ...meta,
    [APPARELGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
    [APPARELGRAPH_TOKEN_KEY]: store.settings.public_token || undefined,
    [APPARELGRAPH_TOKENS_KEY]: tokens,
  };
}

export function upsertPortal(
  store: ApparelgraphStore,
  portal: ApparelPortal
): ApparelgraphStore {
  const row: ApparelPortal = { ...portal, id: portal.id || portal.token };
  const match = (p: ApparelPortal) => {
    if (row.kind === 'public') return p.kind === 'public';
    return p.token === row.token;
  };
  const portals = store.portals.some(match)
    ? store.portals.map((p) => (match(p) ? row : p))
    : [...store.portals, row];
  const settings =
    row.kind === 'public'
      ? { ...store.settings, public_token: row.token }
      : { ...store.settings };
  return hydrateApparelgraphStore({ ...store, portals, settings });
}

export function wholesaleReport(store: ApparelgraphStore) {
  const rows = store.styles.matrix.map((row) => ({
    ...row,
    ats: availableToSell(row),
    booked: money(row.booked_qty),
    shipped: money(row.shipped_qty),
  }));
  const ats = rows.reduce((s, r) => s + r.ats, 0);
  const booked = rows.reduce((s, r) => s + r.booked, 0);
  const planned = rows.reduce((s, r) => s + money(r.planned_qty), 0);
  return { rows, ats, booked, planned, prebooks: store.prebooks.length };
}

export function rangeReport(store: ApparelgraphStore) {
  return store.seasons.map((season) => {
    const styles = store.styleBook.filter((s) => s.season_id === season.id);
    const codes = new Set(styles.map((s) => s.code));
    const matrix = store.styles.matrix.filter((r) => codes.has(r.style_code));
    const planned = matrix.reduce((s, r) => s + money(r.planned_qty), 0);
    const sew = matrix.reduce((s, r) => s + money(r.sew_qty), 0);
    const cost = styles.reduce((s, st) => s + styleBomCost(store, st.code), 0);
    return {
      season,
      styleCount: styles.length,
      planned,
      sew,
      cost,
      sellThrough: planned > 0 ? (sew / planned) * 100 : 0,
    };
  });
}

export type ApparelPortalView = {
  companyName: string;
  kind: ApparelPortal['kind'];
  season?: string;
  lines: Array<{
    style: string;
    name: string;
    colour: string;
    size: string;
    ats: number;
    planned: number;
    cost: number;
  }>;
  sheets: Array<{ number: string; title: string; status: string }>;
  blocked: boolean;
};

export function portalViewForToken(
  store: ApparelgraphStore,
  token: string,
  companyName: string
): ApparelPortalView | null {
  const portal =
    store.portals.find((p) => p.token === token) ||
    (store.settings.public_token === token
      ? { token, kind: 'public' as const }
      : null);
  if (!portal) return null;
  const wholesale = wholesaleReport(store);
  const lines = wholesale.rows.map((row) => {
    const book = store.styleBook.find((s) => s.code === row.style_code);
    return {
      style: row.style_code,
      name: book?.name || row.style_code,
      colour: row.colour,
      size: row.size,
      ats: row.ats,
      planned: money(row.planned_qty),
      cost: styleBomCost(store, row.style_code),
    };
  });
  return {
    companyName,
    kind: portal.kind,
    season: store.seasons[0]?.code,
    lines,
    sheets: store.lineSheets.map((s) => ({
      number: s.number,
      title: s.title,
      status: String(s.status || 'draft'),
    })),
    blocked: summariseApparelgraph(store).holdBlocked,
  };
}

export function summariseApparelgraph(
  store: ApparelgraphStore,
  nowIso = new Date().toISOString()
) {
  const today = nowIso.slice(0, 10);
  const gates = {
    fourPoint: store.tickets.some((t) => t.four_point === 'fail') ? 'fail' : 'pass',
    shade: store.tickets.some((t) => t.shade_band === 'fail') ? 'fail' : 'pass',
    goldSeal: store.tickets.some((t) => t.gold_seal === 'fail') ? 'fail' : 'pass',
    aql: store.tickets.some((t) => t.aql === 'fail') ? 'fail' : 'pass',
    expiredNbc: store.tickets.some((t) => {
      if (!t.nbc_expiry) return false;
      return t.nbc_expiry < today;
    }),
  } as const;

  const qaHoldTickets = store.tickets.filter(
    (t) =>
      t.quality_hold_open === true ||
      String(t.quality_hold_code || '').trim().toUpperCase() === APPAREL_QA_HOLD_CODE
  );

  const linkedLots = new Set(
    [...store.rolls.map((r) => r.lot_number), ...store.tickets.map((t) => t.lot_number)]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
  );
  const linkedPo = new Set(
    [...store.rolls.map((r) => r.po_number), ...store.tickets.map((t) => t.po_number)]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
  );

  const blocked =
    gates.fourPoint === 'fail' ||
    gates.shade === 'fail' ||
    gates.goldSeal === 'fail' ||
    gates.aql === 'fail' ||
    gates.expiredNbc ||
    qaHoldTickets.length > 0;

  const wholesale = wholesaleReport(store);
  const latePath = store.path.filter((p) => {
    if (p.status === 'done' || p.actual_date) return false;
    return Boolean(p.planned_date && p.planned_date < today);
  }).length;

  return {
    lines: Number(store.capability.lines) || 0,
    operators: Number(store.capability.operators) || 0,
    unitsPerDay: Number(store.capability.units_per_day) || 0,
    styleRows: store.styles.matrix.length,
    styleCount: store.styleBook.length,
    seasons: store.seasons.length,
    techPacks: store.styles.techPack.length,
    bomLines: store.styles.bom.length,
    samples: store.samples.length,
    rolls: store.rolls.length,
    tickets: store.tickets.length,
    ta: store.ta.length,
    path: store.path.length,
    latePath,
    lineSheets: store.lineSheets.length,
    prebooks: store.prebooks.length,
    ats: wholesale.ats,
    booked: wholesale.booked,
    linkedLots: linkedLots.size,
    linkedPos: linkedPo.size,
    qaHolds: qaHoldTickets.length,
    holdGateCode: APPAREL_QA_HOLD_CODE,
    holdBlocked: blocked,
    publicToken: store.settings.public_token || '',
    gates,
  };
}

export function apparelgraphSeedStore(nowIso = new Date().toISOString()): ApparelgraphStore {
  const today = nowIso.slice(0, 10);
  const publicToken = mintApparelToken();
  const buyerToken = mintApparelToken();
  return hydrateApparelgraphStore({
    capability: {
      lines: 4,
      operators: 62,
      units_per_day: 1850,
      lead_days: 21,
      cmt_only: true,
      notes: 'CMT + finishing with in-line QA checkpoints.',
    },
    seasons: [
      {
        id: 'ssn_ss26',
        code: 'SS26',
        name: 'Spring / Summer 26',
        drop_date: today,
        status: 'open',
      },
    ],
    styleBook: [
      {
        id: 'sty_tee',
        code: 'BFF-T01',
        name: 'Coastal Crew Tee',
        season_id: 'ssn_ss26',
        category: 'tops',
        status: 'production',
        size_curve: 'S-M-L-XL',
        colorways: ['Navy', 'Ecru'],
      },
      {
        id: 'sty_short',
        code: 'BFF-S08',
        name: 'Harbor Short',
        season_id: 'ssn_ss26',
        category: 'bottoms',
        status: 'sampling',
        size_curve: 'S-M-L-XL',
        colorways: ['Cobalt'],
      },
    ],
    styles: {
      matrix: [
        {
          id: 'smx_1',
          style_code: 'BFF-T01',
          colour: 'Navy',
          size: 'M',
          planned_qty: 1200,
          cut_qty: 1180,
          sew_qty: 1090,
          booked_qty: 144,
          shipped_qty: 0,
        },
        {
          id: 'smx_2',
          style_code: 'BFF-T01',
          colour: 'Ecru',
          size: 'M',
          planned_qty: 800,
          cut_qty: 760,
          sew_qty: 700,
          booked_qty: 96,
          shipped_qty: 0,
        },
        {
          id: 'smx_3',
          style_code: 'BFF-S08',
          colour: 'Cobalt',
          size: 'M',
          planned_qty: 400,
          cut_qty: 0,
          sew_qty: 0,
          booked_qty: 72,
          shipped_qty: 0,
        },
      ],
      techPack: [
        {
          id: 'tp_1',
          style_code: 'BFF-T01',
          version: 'v3',
          approved_at: `${today}T08:00:00.000Z`,
          owner: 'Product team',
        },
        {
          id: 'tp_2',
          style_code: 'BFF-S08',
          version: 'v1',
          owner: 'Product team',
        },
      ],
      bom: [
        {
          id: 'bom_1',
          style_code: 'BFF-T01',
          item: 'Rib knit 180gsm',
          uom: 'm',
          consumption: 1.35,
          wastage_pct: 3.5,
          unit_cost: 42,
          duty_pct: 22,
        },
        {
          id: 'bom_2',
          style_code: 'BFF-T01',
          item: 'Main label',
          uom: 'ea',
          consumption: 1,
          wastage_pct: 1,
          unit_cost: 1.8,
          duty_pct: 0,
        },
        {
          id: 'bom_3',
          style_code: 'BFF-S08',
          item: 'Twill 240gsm',
          uom: 'm',
          consumption: 1.1,
          wastage_pct: 4,
          unit_cost: 58,
          duty_pct: 22,
        },
      ],
    },
    samples: [
      {
        id: 'smp_1',
        style_code: 'BFF-T01',
        stage: 'pp',
        status: 'approved',
        due_date: today,
      },
      {
        id: 'smp_2',
        style_code: 'BFF-S08',
        stage: 'fit',
        status: 'open',
        due_date: today,
      },
    ],
    rolls: [
      {
        id: 'roll_1',
        roll_no: 'RL-1001',
        lot_number: 'LOT-APP-22',
        po_number: 'PO-4477',
        ownership: 'factory',
        material: 'Single jersey cotton',
        shade: 'Navy A',
        length_m: 420,
        balance_m: 302,
      },
    ],
    tickets: [
      {
        id: 'tkt_1',
        ticket_no: 'TK-1001',
        style_code: 'BFF-T01',
        lot_number: 'LOT-APP-22',
        po_number: 'PO-4477',
        shade: 'Navy A',
        units: 480,
        four_point: 'pass',
        shade_band: 'pass',
        gold_seal: 'pass',
        aql: 'pending',
        nbc_expiry: null,
        quality_hold_code: null,
        quality_hold_open: false,
      },
    ],
    ta: [
      {
        id: 'ta_1',
        style_code: 'BFF-T01',
        supplier: 'Mainline Fabrics',
        status: 'approved',
        expires_on: today,
      },
    ],
    path: [
      {
        id: 'pth_1',
        style_code: 'BFF-T01',
        milestone: 'PP sample',
        planned_date: today,
        actual_date: today,
        status: 'done',
      },
      {
        id: 'pth_2',
        style_code: 'BFF-T01',
        milestone: 'Bulk cut',
        planned_date: today,
        actual_date: today,
        status: 'done',
      },
      {
        id: 'pth_3',
        style_code: 'BFF-S08',
        milestone: 'Fit sample',
        planned_date: today,
        status: 'planned',
      },
    ],
    lineSheets: [
      {
        id: 'ls_1',
        number: 'LS-SS26',
        season_id: 'ssn_ss26',
        title: 'SS26 open-to-buy',
        status: 'issued',
        style_codes: ['BFF-T01', 'BFF-S08'],
      },
    ],
    prebooks: [
      {
        id: 'pb_1',
        line_sheet_id: 'ls_1',
        customer: 'Mitchell Buying Group',
        style_code: 'BFF-T01',
        colour: 'Navy',
        size: 'M',
        qty: 144,
        status: 'allocated',
      },
      {
        id: 'pb_2',
        line_sheet_id: 'ls_1',
        customer: 'Mitchell Buying Group',
        style_code: 'BFF-T01',
        colour: 'Ecru',
        size: 'M',
        qty: 96,
        status: 'allocated',
      },
    ],
    portals: [
      {
        id: publicToken,
        token: publicToken,
        kind: 'public',
        label: 'Wholesale line-sheet PWA',
      },
      {
        id: buyerToken,
        token: buyerToken,
        kind: 'buyer',
        label: 'Mitchell Buying Group',
      },
    ],
    settings: { public_token: publicToken },
    updated_at: nowIso,
  });
}
