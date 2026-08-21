/**
 * Company-branded member PWA for Advisor modules (GymAdvisor, clinics, hire, retail).
 * Config lives on the module store settings. Members install one app per business.
 * Keep this file free of server-only imports so the member app can use it.
 */
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import { growPreviewCopy } from '@/lib/advisors/grow-preview';
import type { AdvisorPortalModule } from '@/lib/advisors/portal-sections';

export const ADVISOR_PWA_MODULES = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'medicalgraph',
  'psychiatrygraph',
  'hiregraph',
  'retailgraph',
] as const;

export type AdvisorPwaModule = (typeof ADVISOR_PWA_MODULES)[number];

export type AdvisorPwaSettings = {
  pwa_enabled?: boolean;
  pwa_name?: string;
  pwa_short_name?: string;
  pwa_description?: string;
  pwa_theme_color?: string;
  pwa_background_color?: string;
  pwa_icon_url?: string | null;
};

const ADVISOR_LABEL: Record<AdvisorPwaModule, string> = {
  fitgraph: 'GymAdvisor®',
  physiograph: 'PhysioAdvisor®',
  dentalgraph: 'DentalAdvisor®',
  medicalgraph: 'MedicalAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
  hiregraph: 'HireAdvisor®',
  retailgraph: 'RetailAdvisor®',
};

export const ADVISOR_PWA_INDEX_KEYS: Record<AdvisorPwaModule, string[]> = {
  fitgraph: ['fitgraph_public_token'],
  physiograph: ['physiograph_public_token'],
  dentalgraph: ['dentalgraph_public_token'],
  medicalgraph: ['medicalgraph_public_token'],
  psychiatrygraph: ['psychiatrygraph_public_token'],
  hiregraph: ['hiregraph_public_token'],
  retailgraph: ['retailgraph_public_token'],
};

const JOIN_KIND: Record<AdvisorPwaModule, string> = {
  fitgraph: 'gym',
  physiograph: 'physio',
  dentalgraph: 'dental',
  medicalgraph: 'medical',
  psychiatrygraph: 'psychiatry',
  hiregraph: 'hire',
  retailgraph: 'retail',
};

export function isAdvisorPwaModule(raw: string | null | undefined): raw is AdvisorPwaModule {
  return (ADVISOR_PWA_MODULES as readonly string[]).includes(String(raw || ''));
}

export function advisorPwaStartPath(module: AdvisorPwaModule, token: string): string {
  return `/pwa/${module}/${encodeURIComponent(token)}`;
}

export function advisorPwaManifestPath(module: AdvisorPwaModule, token: string): string {
  return `/api/public/advisor-pwa/manifest?module=${encodeURIComponent(module)}&token=${encodeURIComponent(token)}`;
}

export function advisorPwaAbsoluteUrl(
  origin: string,
  module: AdvisorPwaModule,
  token: string
): string {
  const base = String(origin || '').replace(/\/$/, '') || 'https://www.supplieradvisor.com';
  return `${base}${advisorPwaStartPath(module, token)}`;
}

export function memberTokenStorageKey(module: AdvisorPwaModule): string {
  if (module === 'hiregraph') return 'sa_hiregraph_customer_token';
  return `sa_${module}_member_token`;
}

export function pwaMemberMapKey(module: AdvisorPwaModule, publicToken: string): string {
  return `sa_pwa_member:${module}:${publicToken}`;
}

export function advisorPwaMemberOpenPath(
  module: AdvisorPwaModule,
  memberToken: string
): string {
  const t = encodeURIComponent(memberToken);
  if (module === 'hiregraph') return `/hire/${t}`;
  if (module === 'retailgraph') return `/embed/retail/${t}`;
  return `/member/${module}/${t}`;
}

export function normalizeHexColor(raw: string | null | undefined, fallback: string): string {
  const s = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return fallback;
}

export function pwaShortName(name: string, max = 12): string {
  const t = name.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim();
}

export type AdvisorPwaBrand = {
  module: AdvisorPwaModule;
  publicToken: string;
  companyId: number;
  advisorLabel: string;
  audience: string;
  audienceSingular: string;
  brandName: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  iconUrl: string;
  startPath: string;
  memberBasePath: string;
  joinPath: string;
  joinKind: string;
  enabled: boolean;
};

function defaultTheme(module: AdvisorPwaModule): string {
  return growPreviewCopy(module as AdvisorPortalModule).color;
}

function memberBasePath(module: AdvisorPwaModule): string {
  if (module === 'hiregraph') return '/hire';
  if (module === 'retailgraph') return '/embed/retail';
  return `/member/${module}`;
}

function joinPath(module: AdvisorPwaModule, token: string): string {
  const t = encodeURIComponent(token);
  if (module === 'fitgraph') return `/join/fitgraph/${t}`;
  if (module === 'hiregraph') return `/hire/${t}`;
  if (module === 'retailgraph') return `/embed/retail/${t}`;
  return `/embed/advisor/${module}/${t}`;
}

export function settingsFromAdvisorMeta(
  moduleKey: string,
  meta: Record<string, unknown>
): Record<string, unknown> {
  const nested = meta[moduleKey];
  const store =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : meta;
  const settings = store.settings;
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    return settings as Record<string, unknown>;
  }
  return store;
}

export function buildAdvisorPwaBrand(opts: {
  module: AdvisorPwaModule;
  publicToken: string;
  companyId: number;
  settings: Record<string, unknown>;
}): AdvisorPwaBrand {
  const copy = growPreviewCopy(opts.module as AdvisorPortalModule);
  const theme = normalizeHexColor(
    String(opts.settings.pwa_theme_color || opts.settings.embed_primary_color || opts.settings.primary_color || ''),
    defaultTheme(opts.module)
  );
  const brandName =
    String(opts.settings.pwa_name || opts.settings.brand_name || '').trim() ||
    ADVISOR_LABEL[opts.module];
  const short =
    String(opts.settings.pwa_short_name || '').trim() || pwaShortName(brandName);
  const desc =
    String(opts.settings.pwa_description || opts.settings.public_bio || '').trim() ||
    `${brandName} — ${copy.audienceSingular} app on your phone.`;
  const icon =
    String(opts.settings.pwa_icon_url || '').trim() ||
    logoUrlFromSettings(opts.settings) ||
    '/sa-icon-512.png';
  const enabled = opts.settings.pwa_enabled !== false;
  return {
    module: opts.module,
    publicToken: opts.publicToken,
    companyId: opts.companyId,
    advisorLabel: ADVISOR_LABEL[opts.module],
    audience: copy.audience,
    audienceSingular: copy.audienceSingular,
    brandName,
    shortName: pwaShortName(short),
    description: desc.slice(0, 180),
    themeColor: theme,
    backgroundColor: normalizeHexColor(
      String(opts.settings.pwa_background_color || ''),
      '#0c4a6e'
    ),
    iconUrl: icon,
    startPath: advisorPwaStartPath(opts.module, opts.publicToken),
    memberBasePath: memberBasePath(opts.module),
    joinPath: joinPath(opts.module, opts.publicToken),
    joinKind: JOIN_KIND[opts.module],
    enabled,
  };
}

/** Chrome install needs PNG/JPEG; company logos are often AVIF/SVG. */
export function pwaManifestIconUrl(url: string): string {
  const u = String(url || '').toLowerCase();
  if (!u) return '/sa-icon-512.png';
  if (u.startsWith('/sa-icon')) return url;
  if (/\.(png|jpe?g|webp)(\?|#|$)/.test(u)) return url;
  return '/sa-icon-512.png';
}

export function advisorPwaWebManifest(brand: AdvisorPwaBrand): Record<string, unknown> {
  const start = `${brand.startPath}?source=pwa`;
  const icon = pwaManifestIconUrl(brand.iconUrl);
  const icons = [
    {
      src: icon,
      sizes: '192x192',
      type: iconMime(icon),
      purpose: 'any',
    },
    {
      src: icon,
      sizes: '512x512',
      type: iconMime(icon),
      purpose: 'any',
    },
    {
      src: '/sa-icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ];
  return {
    name: brand.brandName,
    short_name: brand.shortName,
    description: brand.description,
    start_url: start,
    scope: '/',
    id: brand.startPath,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    background_color: brand.backgroundColor,
    theme_color: brand.themeColor,
    lang: 'en',
    prefer_related_applications: false,
    icons,
    shortcuts: [
      {
        name: `Open ${brand.shortName}`,
        short_name: 'Open',
        url: start,
        icons: [{ src: icon, sizes: '192x192' }],
      },
    ],
  };
}

function iconMime(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith('.svg') || u.includes('image/svg')) return 'image/svg+xml';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  if (u.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

export function readPwaSettings(settings?: Record<string, unknown> | null): AdvisorPwaSettings {
  const s = settings || {};
  return {
    pwa_enabled: s.pwa_enabled !== false,
    pwa_name: String(s.pwa_name || ''),
    pwa_short_name: String(s.pwa_short_name || ''),
    pwa_description: String(s.pwa_description || ''),
    pwa_theme_color: String(s.pwa_theme_color || ''),
    pwa_background_color: String(s.pwa_background_color || ''),
    pwa_icon_url: s.pwa_icon_url != null ? String(s.pwa_icon_url) : '',
  };
}

export function pwaSettingsPatch(draft: AdvisorPwaSettings): AdvisorPwaSettings {
  const name = String(draft.pwa_name || '').trim().slice(0, 60);
  const shortRaw = String(draft.pwa_short_name || '').trim();
  return {
    pwa_enabled: draft.pwa_enabled !== false,
    pwa_name: name,
    pwa_short_name: pwaShortName(shortRaw || name, 12),
    pwa_description: String(draft.pwa_description || '').trim().slice(0, 180),
    pwa_theme_color: draft.pwa_theme_color
      ? normalizeHexColor(draft.pwa_theme_color, '')
      : '',
    pwa_background_color: draft.pwa_background_color
      ? normalizeHexColor(draft.pwa_background_color, '')
      : '',
    pwa_icon_url: draft.pwa_icon_url != null ? String(draft.pwa_icon_url).trim() : '',
  };
}

export function rememberAdvisorPwaMember(opts: {
  module: AdvisorPwaModule;
  memberToken: string;
  publicToken?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  const member = String(opts.memberToken || '').trim();
  if (member.length < 8) return;
  try {
    localStorage.setItem(memberTokenStorageKey(opts.module), member);
    const pub = String(opts.publicToken || '').trim();
    if (pub.length >= 8) {
      localStorage.setItem(pwaMemberMapKey(opts.module, pub), member);
    }
  } catch {
    /* private mode */
  }
}

export function recallAdvisorPwaMember(
  module: AdvisorPwaModule,
  publicToken: string,
  mappedOnly = false
): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const mapped = localStorage.getItem(pwaMemberMapKey(module, publicToken));
    if (mapped && mapped.trim().length >= 8) return mapped.trim();
    if (mappedOnly) return null;
    const last = localStorage.getItem(memberTokenStorageKey(module));
    if (last && last.trim().length >= 8) return last.trim();
  } catch {
    /* private mode */
  }
  return null;
}
