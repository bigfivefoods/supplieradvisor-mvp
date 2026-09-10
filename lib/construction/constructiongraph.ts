/**
 * ConstructionAdvisor® (constructiongraph) — building / construction OS.
 * Stored under profiles.metadata.constructiongraph (no new SQL tables).
 * Distinct from Core Projects — this hub is the industry site OS.
 */

export const CONSTRUCTIONGRAPH_MODULE_ID = 'constructiongraph' as const;
export const CONSTRUCTIONGRAPH_META_KEY = 'constructiongraph' as const;
export const CONSTRUCTIONGRAPH_PACK_ID = 'construction_building' as const;

export const SITE_STATUSES = [
  'tender',
  'awarded',
  'on_site',
  'practical_completion',
  'final_account',
  'closed',
] as const;

export const CONTRACT_TYPES = ['JBCC', 'GCC', 'NEC', 'FIDIC', 'other'] as const;

export const DRAWING_DISCIPLINES = [
  'architectural',
  'structural',
  'civil',
  'electrical',
  'mechanical',
  'other',
] as const;

export type ConstructionSiteStatus = (typeof SITE_STATUSES)[number];
export type ConstructionContractType = (typeof CONTRACT_TYPES)[number];

export type ConstructionSite = {
  id: string;
  code: string;
  name: string;
  client?: string;
  contract_value?: number | null;
  address?: string;
  city?: string;
  province?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: ConstructionSiteStatus | string;
  contract_type?: ConstructionContractType | string;
  notes?: string;
};

export type ConstructionDrawing = {
  id: string;
  site_id?: string | null;
  drawing_no: string;
  title: string;
  revision?: string;
  discipline?: (typeof DRAWING_DISCIPLINES)[number] | string;
  status?: 'issued' | 'superseded' | 'for_construction' | 'as_built' | string;
};

export type ConstructionBoqItem = {
  id: string;
  site_id?: string | null;
  item_no: string;
  description: string;
  uom: string;
  qty: number;
  rate: number;
  amount?: number;
};

export type ConstructionSubcontractor = {
  id: string;
  name: string;
  trade: string;
  site_id?: string | null;
  contact?: string;
  status?: 'appointed' | 'tendering' | 'complete' | string;
  contract_value?: number | null;
};

export type ConstructionMaterial = {
  id: string;
  site_id?: string | null;
  item: string;
  uom: string;
  ordered_qty: number;
  delivered_qty?: number;
  po_number?: string | null;
};

export type ConstructionPlant = {
  id: string;
  site_id?: string | null;
  plant_no: string;
  description: string;
  status?: 'on_site' | 'off_hire' | 'breakdown' | string;
  hired?: boolean;
};

export type ConstructionProgrammeRow = {
  id: string;
  site_id?: string | null;
  activity: string;
  start_date?: string | null;
  end_date?: string | null;
  pct_complete?: number;
  status?: 'planned' | 'in_progress' | 'complete' | 'delayed' | string;
};

export type ConstructionSafetyRow = {
  id: string;
  site_id?: string | null;
  kind: 'toolbox' | 'incident' | 'inspection' | 'permit' | string;
  title: string;
  date?: string | null;
  status?: 'open' | 'closed' | string;
  notes?: string;
};

export type ConstructionVariation = {
  id: string;
  site_id?: string | null;
  number: string;
  description: string;
  amount?: number | null;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'claimed' | string;
};

export type ConstructionCertificate = {
  id: string;
  site_id?: string | null;
  number: string;
  period?: string | null;
  certified_amount?: number | null;
  retention?: number | null;
  status?: 'draft' | 'issued' | 'paid' | string;
};

export type ConstructionSnag = {
  id: string;
  site_id?: string | null;
  item: string;
  location?: string;
  status?: 'open' | 'in_progress' | 'closed' | string;
  due_date?: string | null;
};

export type ConstructiongraphStore = {
  sites: ConstructionSite[];
  drawings: ConstructionDrawing[];
  boq: ConstructionBoqItem[];
  subcontractors: ConstructionSubcontractor[];
  materials: ConstructionMaterial[];
  plant: ConstructionPlant[];
  programme: ConstructionProgrammeRow[];
  safety: ConstructionSafetyRow[];
  variations: ConstructionVariation[];
  certificates: ConstructionCertificate[];
  snags: ConstructionSnag[];
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

export function emptyConstructiongraphStore(): ConstructiongraphStore {
  return {
    sites: [],
    drawings: [],
    boq: [],
    subcontractors: [],
    materials: [],
    plant: [],
    programme: [],
    safety: [],
    variations: [],
    certificates: [],
    snags: [],
  };
}

export function readConstructiongraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): ConstructiongraphStore {
  const src = asObject(meta);
  const raw = asObject(src[CONSTRUCTIONGRAPH_META_KEY]);
  return {
    sites: asArray<ConstructionSite>(raw.sites),
    drawings: asArray<ConstructionDrawing>(raw.drawings),
    boq: asArray<ConstructionBoqItem>(raw.boq),
    subcontractors: asArray<ConstructionSubcontractor>(raw.subcontractors),
    materials: asArray<ConstructionMaterial>(raw.materials),
    plant: asArray<ConstructionPlant>(raw.plant),
    programme: asArray<ConstructionProgrammeRow>(raw.programme),
    safety: asArray<ConstructionSafetyRow>(raw.safety),
    variations: asArray<ConstructionVariation>(raw.variations),
    certificates: asArray<ConstructionCertificate>(raw.certificates),
    snags: asArray<ConstructionSnag>(raw.snags),
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
      if (!id) continue;
      if (seen.has(id)) continue;
      out.push(row);
      seen.add(id);
      continue;
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

export function mergeConstructiongraphStore(
  existing: ConstructiongraphStore,
  incoming: Partial<ConstructiongraphStore>
): ConstructiongraphStore {
  return deepMergeValue(existing, incoming) as ConstructiongraphStore;
}

export function writeConstructiongraphToMetadata(
  meta: Record<string, unknown>,
  store: ConstructiongraphStore
): Record<string, unknown> {
  return {
    ...meta,
    [CONSTRUCTIONGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
  };
}

function money(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function summariseConstructiongraph(store: ConstructiongraphStore) {
  const contractValue = store.sites.reduce(
    (sum, s) => sum + money(s.contract_value),
    0
  );
  const certified = store.certificates.reduce(
    (sum, c) => sum + money(c.certified_amount),
    0
  );
  const variations = store.variations.reduce(
    (sum, v) => sum + money(v.amount),
    0
  );
  const openSnags = store.snags.filter((s) => s.status !== 'closed').length;
  const openSafety = store.safety.filter((s) => s.status !== 'closed').length;
  const onSite = store.sites.filter((s) => s.status === 'on_site').length;
  const boqAmount = store.boq.reduce((sum, row) => {
    const amount =
      row.amount != null ? money(row.amount) : money(row.qty) * money(row.rate);
    return sum + amount;
  }, 0);

  return {
    sites: store.sites.length,
    onSite,
    drawings: store.drawings.length,
    boqLines: store.boq.length,
    boqAmount,
    subcontractors: store.subcontractors.length,
    materials: store.materials.length,
    plant: store.plant.length,
    programmeRows: store.programme.length,
    safetyOpen: openSafety,
    variations,
    variationCount: store.variations.length,
    certified,
    certificateCount: store.certificates.length,
    contractValue,
    openSnags,
    snags: store.snags.length,
  };
}

export function constructiongraphSeedStore(
  nowIso = new Date().toISOString()
): ConstructiongraphStore {
  const today = nowIso.slice(0, 10);
  return {
    sites: [
      {
        id: 'site_1',
        code: 'SITE-01',
        name: 'Sandton mixed-use podium',
        client: 'Apex Developments',
        contract_value: 48_500_000,
        address: '5th Street, Sandhurst',
        city: 'Sandton',
        province: 'Gauteng',
        start_date: today,
        end_date: null,
        status: 'on_site',
        contract_type: 'JBCC',
        notes: 'Podium + 4 levels. Principal building contractor.',
      },
    ],
    drawings: [
      {
        id: 'drw_1',
        site_id: 'site_1',
        drawing_no: 'A-101',
        title: 'Ground floor GA',
        revision: 'C',
        discipline: 'architectural',
        status: 'for_construction',
      },
    ],
    boq: [
      {
        id: 'boq_1',
        site_id: 'site_1',
        item_no: '3.2.1',
        description: 'Reinforced concrete columns 25 MPa',
        uom: 'm³',
        qty: 420,
        rate: 2850,
        amount: 1_197_000,
      },
    ],
    subcontractors: [
      {
        id: 'sub_1',
        name: 'Highveld Steel Fixers',
        trade: 'Reinforcing',
        site_id: 'site_1',
        contact: 'Thabo M.',
        status: 'appointed',
        contract_value: 2_400_000,
      },
    ],
    materials: [
      {
        id: 'mat_1',
        site_id: 'site_1',
        item: '25 MPa ready-mix',
        uom: 'm³',
        ordered_qty: 420,
        delivered_qty: 180,
        po_number: 'PO-8812',
      },
    ],
    plant: [
      {
        id: 'plt_1',
        site_id: 'site_1',
        plant_no: 'TC-12',
        description: 'Tower crane 8t',
        status: 'on_site',
        hired: true,
      },
    ],
    programme: [
      {
        id: 'prg_1',
        site_id: 'site_1',
        activity: 'Podium structure',
        start_date: today,
        end_date: null,
        pct_complete: 32,
        status: 'in_progress',
      },
    ],
    safety: [
      {
        id: 'saf_1',
        site_id: 'site_1',
        kind: 'toolbox',
        title: 'Working at height',
        date: today,
        status: 'closed',
      },
    ],
    variations: [
      {
        id: 'var_1',
        site_id: 'site_1',
        number: 'VO-003',
        description: 'Additional lift-core walls',
        amount: 640_000,
        status: 'submitted',
      },
    ],
    certificates: [
      {
        id: 'cert_1',
        site_id: 'site_1',
        number: 'IPC-02',
        period: today.slice(0, 7),
        certified_amount: 6_200_000,
        retention: 620_000,
        status: 'issued',
      },
    ],
    snags: [
      {
        id: 'snag_1',
        site_id: 'site_1',
        item: 'Basement waterproofing at grid C/4',
        location: 'B1',
        status: 'open',
        due_date: today,
      },
    ],
    updated_at: nowIso,
  };
}
