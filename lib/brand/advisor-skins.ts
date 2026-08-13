/**
 * Advisor product skins — when a company is in HireAdvisor (or another Advisor),
 * the OS chrome (wordmark, accent, titles) matches that product.
 *
 * Resolution:
 *  1) Current dashboard route (using HireAdvisor right now)
 *  2) Single enabled Advisor module on the company
 *  3) Single industry pack that maps to an Advisor
 *  4) SupplierAdvisor (default Core OS)
 */

export type AdvisorSkinId =
  | 'supplier'
  | 'hire'
  | 'gym'
  | 'physio'
  | 'dental'
  | 'medical'
  | 'psychiatry'
  | 'crop'
  | 'quarry'
  | 'school';

export type AdvisorSkin = {
  id: AdvisorSkinId;
  /** Legal / product wordmark without ® */
  name: string;
  registered: string;
  shortName: string;
  tagline: string;
  homeHref: string;
  /** Dashboard path prefixes that activate this skin */
  prefixes: string[];
  /** Company module ids that count as “this Advisor is on” */
  moduleIds: string[];
  /** Industry pack ids that imply this Advisor */
  packIds: string[];
  /** Brand blues/accents (applied as --sa-brand / --sa-brand-deep) */
  brand: string;
  brandDeep: string;
};

export const SUPPLIER_SKIN: AdvisorSkin = {
  id: 'supplier',
  name: 'SupplierAdvisor',
  registered: 'SupplierAdvisor®',
  shortName: 'SA',
  tagline: 'Supply-chain operating system',
  homeHref: '/dashboard',
  prefixes: [],
  moduleIds: [],
  packIds: [],
  brand: '#00b4d8',
  brandDeep: '#0077b6',
};

export const ADVISOR_SKINS: readonly AdvisorSkin[] = [
  {
    id: 'hire',
    name: 'HireAdvisor',
    registered: 'HireAdvisor®',
    shortName: 'Hire',
    tagline: 'Hire & rental marketplace',
    homeHref: '/dashboard/hiregraph',
    prefixes: ['/dashboard/hiregraph'],
    moduleIds: ['hiregraph'],
    packIds: ['staffing_hire'],
    brand: '#0891b2',
    brandDeep: '#0e7490',
  },
  {
    id: 'gym',
    name: 'GymAdvisor',
    registered: 'GymAdvisor®',
    shortName: 'Gym',
    tagline: 'Gym & studio OS',
    homeHref: '/dashboard/fitgraph',
    prefixes: ['/dashboard/fitgraph'],
    moduleIds: ['fitgraph'],
    packIds: ['fitness_gym'],
    brand: '#7c3aed',
    brandDeep: '#5b21b6',
  },
  {
    id: 'physio',
    name: 'PhysioAdvisor',
    registered: 'PhysioAdvisor®',
    shortName: 'Physio',
    tagline: 'Clinic & rehab OS',
    homeHref: '/dashboard/physiograph',
    prefixes: ['/dashboard/physiograph'],
    moduleIds: ['physiograph'],
    packIds: ['allied_health_clinic', 'allied_health'],
    brand: '#0d9488',
    brandDeep: '#0f766e',
  },
  {
    id: 'dental',
    name: 'DentalAdvisor',
    registered: 'DentalAdvisor®',
    shortName: 'Dental',
    tagline: 'Dental practice OS',
    homeHref: '/dashboard/dentalgraph',
    prefixes: ['/dashboard/dentalgraph'],
    moduleIds: ['dentalgraph'],
    packIds: ['dental'],
    brand: '#0284c7',
    brandDeep: '#0369a1',
  },
  {
    id: 'medical',
    name: 'MedicalAdvisor',
    registered: 'MedicalAdvisor®',
    shortName: 'Medical',
    tagline: 'Practice & scripts OS',
    homeHref: '/dashboard/medicalgraph',
    prefixes: ['/dashboard/medicalgraph'],
    moduleIds: ['medicalgraph'],
    packIds: ['medical_practice', 'medical'],
    brand: '#4f46e5',
    brandDeep: '#3730a3',
  },
  {
    id: 'psychiatry',
    name: 'PsychiatryAdvisor',
    registered: 'PsychiatryAdvisor®',
    shortName: 'Psychiatry',
    tagline: 'Psychiatry practice OS',
    homeHref: '/dashboard/psychiatrygraph',
    prefixes: ['/dashboard/psychiatrygraph'],
    moduleIds: ['psychiatrygraph'],
    packIds: ['psychiatry'],
    brand: '#e11d48',
    brandDeep: '#9f1239',
  },
  {
    id: 'crop',
    name: 'CropAdvisor',
    registered: 'CropAdvisor®',
    shortName: 'Crop',
    tagline: 'Primary production OS',
    homeHref: '/dashboard/fieldgraph',
    prefixes: ['/dashboard/fieldgraph'],
    moduleIds: ['fieldgraph'],
    packIds: ['agri_regen'],
    brand: '#16a34a',
    brandDeep: '#15803d',
  },
  {
    id: 'quarry',
    name: 'QuarryAdvisor',
    registered: 'QuarryAdvisor®',
    shortName: 'Quarry',
    tagline: 'Quarry & aggregates OS',
    homeHref: '/dashboard/quarrygraph',
    prefixes: ['/dashboard/quarrygraph'],
    moduleIds: ['quarrygraph'],
    packIds: ['quarry_aggregates'],
    brand: '#b45309',
    brandDeep: '#92400e',
  },
  {
    id: 'school',
    name: 'SchoolAdvisor',
    registered: 'SchoolAdvisor®',
    shortName: 'School',
    tagline: 'NSNP · public sector',
    homeHref: '/dashboard/schools',
    prefixes: ['/dashboard/schools'],
    moduleIds: ['schools'],
    packIds: ['school_nsnp', 'schools'],
    brand: '#2563eb',
    brandDeep: '#1d4ed8',
  },
];

export function skinForModuleId(moduleId: string | null | undefined): AdvisorSkin | null {
  const id = String(moduleId || '');
  return ADVISOR_SKINS.find((s) => s.moduleIds.includes(id)) || null;
}

export function skinForPath(pathname: string | null | undefined): AdvisorSkin | null {
  const p = pathname || '';
  let best: AdvisorSkin | null = null;
  let bestLen = -1;
  for (const skin of ADVISOR_SKINS) {
    for (const prefix of skin.prefixes) {
      if (
        (p === prefix || p.startsWith(prefix + '/')) &&
        prefix.length > bestLen
      ) {
        best = skin;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

export function enabledAdvisorSkins(opts: {
  enabledModules?: Record<string, boolean> | null;
  packIds?: string[] | null;
}): AdvisorSkin[] {
  const mods = opts.enabledModules || {};
  const packs = new Set((opts.packIds || []).map(String));
  return ADVISOR_SKINS.filter((s) => {
    const byModule = s.moduleIds.some((id) => mods[id] === true);
    const byPack = s.packIds.some((id) => packs.has(id));
    return byModule || byPack;
  });
}

/** User chrome branding preference (independent of light/dark). */
export type BrandMode = 'core' | 'module' | AdvisorSkinId;

export const BRAND_MODE_KEY = 'sa-brand-mode';

export function isBrandMode(v: unknown): v is BrandMode {
  if (v === 'core' || v === 'module') return true;
  return ADVISOR_SKINS.some((s) => s.id === v) || v === 'supplier';
}

export function readStoredBrandMode(): BrandMode {
  if (typeof window === 'undefined') return 'module';
  try {
    const raw = localStorage.getItem(BRAND_MODE_KEY);
    if (isBrandMode(raw)) return raw;
  } catch {
    /* soft */
  }
  return 'module';
}

export function persistBrandMode(mode: BrandMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BRAND_MODE_KEY, mode);
    document.cookie = `${BRAND_MODE_KEY}=${mode};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* soft */
  }
}

export function skinById(id: string | null | undefined): AdvisorSkin | null {
  if (!id || id === 'supplier' || id === 'core') return SUPPLIER_SKIN;
  return ADVISOR_SKINS.find((s) => s.id === id) || null;
}

/**
 * Active product skin for chrome.
 * User brand preference:
 *  - core → always SupplierAdvisor
 *  - module → follow current Advisor route (or sole pack)
 *  - hire | gym | … → lock that Advisor brand
 */
export function resolveAdvisorSkin(opts: {
  pathname?: string | null;
  enabledModules?: Record<string, boolean> | null;
  packIds?: string[] | null;
  brandMode?: BrandMode | null;
}): AdvisorSkin {
  const mode = opts.brandMode || 'module';

  if (mode === 'core' || mode === 'supplier') {
    return SUPPLIER_SKIN;
  }

  if (mode !== 'module') {
    return skinById(mode) || SUPPLIER_SKIN;
  }

  const fromPath = skinForPath(opts.pathname);
  if (fromPath) return fromPath;

  const enabled = enabledAdvisorSkins({
    enabledModules: opts.enabledModules,
    packIds: opts.packIds,
  });
  if (enabled.length === 1) return enabled[0];

  return SUPPLIER_SKIN;
}

export function applyAdvisorSkinToDocument(skin: AdvisorSkin) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.advisor = skin.id;
  root.style.setProperty('--sa-brand', skin.brand);
  root.style.setProperty('--sa-brand-deep', skin.brandDeep);
  const r = parseInt(skin.brand.slice(1, 3), 16);
  const g = parseInt(skin.brand.slice(3, 5), 16);
  const b = parseInt(skin.brand.slice(5, 7), 16);
  if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
    root.style.setProperty('--sa-brand-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty('--sa-brand-glow', `rgba(${r}, ${g}, ${b}, 0.22)`);
  }
}
