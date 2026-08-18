/**
 * What an owner can show on their public Advisor portal.
 * Stored as settings.portal_sections; legacy show_* flags stay in sync.
 */

export type AdvisorPortalModule =
  | 'fitgraph'
  | 'physiograph'
  | 'dentalgraph'
  | 'psychiatrygraph'
  | 'medicalgraph'
  | 'hiregraph'
  | 'retailgraph';

export type PortalSectionDef = {
  id: string;
  label: string;
  hint?: string;
};

export const PORTAL_SECTIONS: Record<AdvisorPortalModule, PortalSectionDef[]> = {
  fitgraph: [
    { id: 'timetable', label: 'Class timetable' },
    { id: 'team', label: 'Coaches', hint: 'Team bios' },
    { id: 'join', label: 'Join / memberships', hint: 'Public prices' },
    { id: 'policies', label: 'Policies', hint: 'PDF contracts' },
    { id: 'hours', label: 'Hours & visit' },
  ],
  physiograph: [
    { id: 'diary', label: 'Open diary' },
    { id: 'team', label: 'Team' },
    { id: 'services', label: 'Services' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'hours', label: 'Hours & visit' },
    { id: 'contact', label: 'Contact' },
  ],
  dentalgraph: [
    { id: 'diary', label: 'Open diary' },
    { id: 'team', label: 'Team' },
    { id: 'services', label: 'Services' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'hours', label: 'Hours & visit' },
    { id: 'contact', label: 'Contact' },
  ],
  psychiatrygraph: [
    { id: 'diary', label: 'Open diary' },
    { id: 'team', label: 'Team' },
    { id: 'services', label: 'Services' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'hours', label: 'Hours & visit' },
    { id: 'contact', label: 'Contact' },
  ],
  medicalgraph: [
    { id: 'diary', label: 'Open diary' },
    { id: 'team', label: 'Team' },
    { id: 'services', label: 'Services' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'hours', label: 'Hours & visit' },
    { id: 'contact', label: 'Contact' },
  ],
  hiregraph: [
    { id: 'news', label: 'News' },
    { id: 'catalogue', label: 'Catalogue' },
    { id: 'contact', label: 'Contact' },
  ],
  retailgraph: [
    { id: 'news', label: 'News' },
    { id: 'shop', label: 'Shop' },
    { id: 'contact', label: 'Contact' },
  ],
};

export type PortalSectionSettings = {
  portal_sections?: Record<string, boolean> | null;
  show_coaches?: boolean;
  show_practitioners?: boolean;
  show_staff?: boolean;
  show_pricing?: boolean;
  show_contracts?: boolean;
};

export function isPortalSectionOn(
  settings: PortalSectionSettings | null | undefined,
  id: string,
  fallback = true
): boolean {
  const raw = settings?.portal_sections?.[id];
  if (raw === true || raw === false) return raw;
  if (id === 'team' || id === 'coaches') {
    if (settings?.show_coaches === false) return false;
    if (settings?.show_practitioners === false) return false;
    if (settings?.show_staff === false) return false;
  }
  if (id === 'join' || id === 'pricing' || id === 'shop' || id === 'catalogue') {
    if (settings?.show_pricing === false) return false;
  }
  if (id === 'policies') {
    if (settings?.show_contracts === false) return false;
  }
  return fallback;
}

export function readPortalSectionMap(
  module: AdvisorPortalModule,
  settings?: PortalSectionSettings | null
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of PORTAL_SECTIONS[module] || []) {
    out[s.id] = isPortalSectionOn(settings, s.id);
  }
  return out;
}

export function portalSectionsToLegacyFlags(
  module: AdvisorPortalModule,
  sections: Record<string, boolean>
): {
  show_coaches?: boolean;
  show_practitioners?: boolean;
  show_staff?: boolean;
  show_pricing?: boolean;
  show_contracts?: boolean;
} {
  const flags: {
    show_coaches?: boolean;
    show_practitioners?: boolean;
    show_staff?: boolean;
    show_pricing?: boolean;
    show_contracts?: boolean;
  } = {};
  if (module === 'fitgraph') {
    if (sections.team !== undefined) flags.show_coaches = sections.team !== false;
    if (sections.join !== undefined) flags.show_pricing = sections.join !== false;
    if (sections.policies !== undefined) {
      flags.show_contracts = sections.policies !== false;
    }
  } else if (
    module === 'physiograph' ||
    module === 'dentalgraph' ||
    module === 'psychiatrygraph' ||
    module === 'medicalgraph'
  ) {
    if (sections.team !== undefined) {
      flags.show_practitioners = sections.team !== false;
      flags.show_staff = sections.team !== false;
    }
    if (sections.pricing !== undefined) {
      flags.show_pricing = sections.pricing !== false;
    }
  } else if (module === 'hiregraph') {
    if (sections.catalogue !== undefined) {
      flags.show_pricing = sections.catalogue !== false;
    }
  } else if (module === 'retailgraph') {
    if (sections.shop !== undefined) flags.show_pricing = sections.shop !== false;
  }
  return flags;
}

export function advisorPublicEmbedPath(
  module: AdvisorPortalModule,
  token: string
): string {
  const t = encodeURIComponent(token);
  if (module === 'fitgraph') return `/embed/fitgraph/${t}`;
  if (module === 'hiregraph') return `/embed/hire/${t}`;
  if (module === 'retailgraph') return `/embed/retail/${t}`;
  return `/embed/advisor/${module}/${t}`;
}
