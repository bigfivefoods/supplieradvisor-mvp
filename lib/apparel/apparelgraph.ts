/**
 * ApparelAdvisor® (apparelgraph) — apparel manufacturing workspace.
 * Stored under profiles.metadata.apparelgraph (no new SQL tables).
 */

export const APPARELGRAPH_MODULE_ID = 'apparelgraph' as const;
export const APPARELGRAPH_META_KEY = 'apparelgraph' as const;
export const APPARELGRAPH_PACK_ID = 'apparel' as const;
export const APPAREL_QA_HOLD_CODE = 'QA_HOLD' as const;

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

export type ApparelStyleMatrixRow = {
  id: string;
  style_code: string;
  colour: string;
  size: string;
  planned_qty: number;
  cut_qty?: number;
  sew_qty?: number;
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

export type ApparelgraphStore = {
  capability: ApparelCapability;
  styles: {
    matrix: ApparelStyleMatrixRow[];
    techPack: ApparelTechPack[];
    bom: ApparelBomItem[];
  };
  samples: ApparelSample[];
  rolls: ApparelRoll[];
  tickets: ApparelTicket[];
  ta: ApparelTa[];
  updated_at?: string;
};

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

export function emptyApparelgraphStore(): ApparelgraphStore {
  return {
    capability: {
      lines: 0,
      operators: 0,
      units_per_day: 0,
      lead_days: 0,
    },
    styles: {
      matrix: [],
      techPack: [],
      bom: [],
    },
    samples: [],
    rolls: [],
    tickets: [],
    ta: [],
  };
}

export function readApparelgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): ApparelgraphStore {
  const src = asObject(meta);
  const raw = asObject(src[APPARELGRAPH_META_KEY]);
  const d = emptyApparelgraphStore();
  const styles = asObject(raw.styles);
  return {
    capability: {
      ...d.capability,
      ...asObject(raw.capability),
    },
    styles: {
      matrix: Array.isArray(styles.matrix)
        ? (styles.matrix as ApparelStyleMatrixRow[])
        : [],
      techPack: Array.isArray(styles.techPack)
        ? (styles.techPack as ApparelTechPack[])
        : [],
      bom: Array.isArray(styles.bom) ? (styles.bom as ApparelBomItem[]) : [],
    },
    samples: Array.isArray(raw.samples)
      ? (raw.samples as ApparelSample[])
      : [],
    rolls: Array.isArray(raw.rolls) ? (raw.rolls as ApparelRoll[]) : [],
    tickets: Array.isArray(raw.tickets)
      ? (raw.tickets as ApparelTicket[])
      : [],
    ta: Array.isArray(raw.ta) ? (raw.ta as ApparelTa[]) : [],
    updated_at:
      typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
}

function mergeIdArray(existing: unknown, incoming: unknown): unknown[] {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  const out: unknown[] = [];
  const seen = new Set<string>();

  for (const row of next) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const id = String((row as { id?: unknown }).id || '').trim();
      if (id) {
        out.push(row);
        seen.add(id);
        continue;
      }
    }
    out.push(row);
  }

  for (const row of prev) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const id = String((row as { id?: unknown }).id || '').trim();
      if (id && seen.has(id)) continue;
    }
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
  return deepMergeValue(existing, incoming) as ApparelgraphStore;
}

export function writeApparelgraphToMetadata(
  meta: Record<string, unknown>,
  store: ApparelgraphStore
): Record<string, unknown> {
  return {
    ...meta,
    [APPARELGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
  };
}

export function summariseApparelgraph(store: ApparelgraphStore) {
  const gates = {
    fourPoint: store.tickets.some((t) => t.four_point === 'fail') ? 'fail' : 'pass',
    shade: store.tickets.some((t) => t.shade_band === 'fail') ? 'fail' : 'pass',
    goldSeal: store.tickets.some((t) => t.gold_seal === 'fail') ? 'fail' : 'pass',
    aql: store.tickets.some((t) => t.aql === 'fail') ? 'fail' : 'pass',
    expiredNbc: store.tickets.some((t) => {
      if (!t.nbc_expiry) return false;
      return t.nbc_expiry < new Date().toISOString().slice(0, 10);
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

  return {
    lines: Number(store.capability.lines) || 0,
    operators: Number(store.capability.operators) || 0,
    unitsPerDay: Number(store.capability.units_per_day) || 0,
    styleRows: store.styles.matrix.length,
    techPacks: store.styles.techPack.length,
    bomLines: store.styles.bom.length,
    samples: store.samples.length,
    rolls: store.rolls.length,
    tickets: store.tickets.length,
    ta: store.ta.length,
    linkedLots: linkedLots.size,
    linkedPos: linkedPo.size,
    qaHolds: qaHoldTickets.length,
    holdGateCode: APPAREL_QA_HOLD_CODE,
    holdBlocked: blocked,
    gates,
  };
}

export function apparelgraphSeedStore(nowIso = new Date().toISOString()): ApparelgraphStore {
  const today = nowIso.slice(0, 10);
  return {
    capability: {
      lines: 4,
      operators: 62,
      units_per_day: 1850,
      lead_days: 21,
      cmt_only: true,
      notes: 'CMT + finishing with in-line QA checkpoints.',
    },
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
      ],
      bom: [
        {
          id: 'bom_1',
          style_code: 'BFF-T01',
          item: 'Rib knit 180gsm',
          uom: 'm',
          consumption: 1.35,
          wastage_pct: 3.5,
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
        expires_on: `${new Date(Date.now() + 30 * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10)}`,
      },
    ],
    updated_at: nowIso,
  };
}
