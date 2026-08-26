/**
 * Module → platform inbox context (deep links from every product module).
 */
import type { CompanyMsgChannel } from '@/lib/messaging/company-inbox';

export type ComposeMode = 'colleague' | 'supplier' | 'customer' | 'connection';

export type ModuleMessageContext = {
  from: string;
  label: string;
  backHref: string;
  backLabel: string;
  titleAccent: string;
  description: string;
  defaultCompose: ComposeMode;
  /** Filter inbox list when set */
  filterChannel?: CompanyMsgChannel | 'trade' | 'all';
};

const CTX: Record<string, ModuleMessageContext> = {
  home: {
    from: 'home',
    label: 'Control Tower',
    backHref: '/dashboard',
    backLabel: 'Control Tower',
    titleAccent: 'company inbox',
    description:
      'One inbox for colleagues, connected suppliers and customers, and care messages from gyms or clinics where you are a member or patient.',
    defaultCompose: 'colleague',
    filterChannel: 'all',
  },
  company: {
    from: 'company',
    label: 'Company',
    backHref: '/dashboard/my-business',
    backLabel: 'Company',
    titleAccent: 'team & partners',
    description:
      'Message your team and trade partners without leaving company ops.',
    defaultCompose: 'colleague',
  },
  sales: {
    from: 'sales',
    label: 'Sales',
    backHref: '/sales',
    backLabel: 'Sales',
    titleAccent: 'customers & team',
    description: 'Message connected customers and your internal sales team.',
    defaultCompose: 'customer',
    filterChannel: 'customer',
  },
  suppliers: {
    from: 'suppliers',
    label: 'Suppliers',
    backHref: '/dashboard/suppliers',
    backLabel: 'Suppliers',
    titleAccent: 'supplier threads',
    description:
      'Message connected suppliers about POs, OTIFEF, and performance.',
    defaultCompose: 'supplier',
    filterChannel: 'supplier',
  },
  customers: {
    from: 'customers',
    label: 'Customers',
    backHref: '/dashboard/customers',
    backLabel: 'Customers',
    titleAccent: 'customer threads',
    description:
      'Message connected customers about quotes, orders, and collections.',
    defaultCompose: 'customer',
    filterChannel: 'customer',
  },
  containers: {
    from: 'containers',
    label: 'ContainerAdvisor',
    backHref: '/dashboard/containers',
    backLabel: 'ContainerAdvisor',
    titleAccent: 'network partners',
    description: 'Coordinate with contractors, resellers, and your team.',
    defaultCompose: 'connection',
  },
  inventory: {
    from: 'inventory',
    label: 'Inventory',
    backHref: '/dashboard/inventory',
    backLabel: 'Inventory',
    titleAccent: 'warehouse team',
    description: 'Internal notes for stock, receives, and warehouse moves.',
    defaultCompose: 'colleague',
    filterChannel: 'colleague',
  },
  operations: {
    from: 'operations',
    label: 'Operations',
    backHref: '/dashboard/operations',
    backLabel: 'Operations',
    titleAccent: 'ops team',
    description: 'Coordinate inbound, warehouse, production, and outbound.',
    defaultCompose: 'colleague',
    filterChannel: 'colleague',
  },
  manufacturing: {
    from: 'manufacturing',
    label: 'Manufacturing',
    backHref: '/dashboard/manufacturing',
    backLabel: 'Make',
    titleAccent: 'floor team',
    description: 'Message planners and work-centre owners on the floor.',
    defaultCompose: 'colleague',
    filterChannel: 'colleague',
  },
  distribution: {
    from: 'distribution',
    label: 'Distribution',
    backHref: '/dashboard/distribution',
    backLabel: 'Ship',
    titleAccent: 'carriers & fleet',
    description: 'Message carriers, fleet, and trade partners on shipments.',
    defaultCompose: 'connection',
  },
  accounting: {
    from: 'accounting',
    label: 'Finance',
    backHref: '/dashboard/accounting',
    backLabel: 'Finance',
    titleAccent: 'finance team',
    description: 'Internal threads for AR, AP, close, and cash.',
    defaultCompose: 'colleague',
    filterChannel: 'colleague',
  },
  people: {
    from: 'people',
    label: 'People',
    backHref: '/dashboard/people',
    backLabel: 'People',
    titleAccent: 'HR team',
    description: 'Message colleagues from the People directory context.',
    defaultCompose: 'colleague',
    filterChannel: 'colleague',
  },
  sheq: {
    from: 'sheq',
    label: 'SHEQ',
    backHref: '/dashboard/sheq',
    backLabel: 'SHEQ',
    titleAccent: 'safety team',
    description: 'Coordinate incidents, hazards, NCR and CAPA owners.',
    defaultCompose: 'colleague',
  },
  quality: {
    from: 'quality',
    label: 'Quality',
    backHref: '/dashboard/quality',
    backLabel: 'Quality',
    titleAccent: 'quality team',
    description: 'Internal quality threads and supplier follow-ups.',
    defaultCompose: 'colleague',
  },
  projects: {
    from: 'projects',
    label: 'Projects',
    backHref: '/dashboard/projects',
    backLabel: 'Projects',
    titleAccent: 'project team',
    description: 'Project and programme team coordination.',
    defaultCompose: 'colleague',
  },
  sustainability: {
    from: 'sustainability',
    label: 'Impact',
    backHref: '/dashboard/sustainability',
    backLabel: 'Impact',
    titleAccent: 'impact team',
    description: 'Coordinate GHG, resources, and regenerative actions.',
    defaultCompose: 'colleague',
  },
  intelligence: {
    from: 'intelligence',
    label: 'Intelligence',
    backHref: '/dashboard/intelligence',
    backLabel: 'Intelligence',
    titleAccent: 'insights team',
    description: 'Share insight actions and leadership follow-ups.',
    defaultCompose: 'colleague',
  },
  fieldgraph: {
    from: 'fieldgraph',
    label: 'CropAdvisor',
    backHref: '/dashboard/fieldgraph',
    backLabel: 'CropAdvisor',
    titleAccent: 'farm · mill · buyer',
    description:
      'Message mills, buyers, and your farm team from CropAdvisor.',
    defaultCompose: 'connection',
    filterChannel: 'trade',
  },
  quarrygraph: {
    from: 'quarrygraph',
    label: 'QuarryAdvisor',
    backHref: '/dashboard/quarrygraph',
    backLabel: 'QuarryAdvisor',
    titleAccent: 'office · pit · trade',
    description:
      'Message customers, carriers, and quarry teams from QuarryAdvisor.',
    defaultCompose: 'connection',
    filterChannel: 'trade',
  },
  schools: {
    from: 'schools',
    label: 'Schools / NSNP',
    backHref: '/dashboard/schools',
    backLabel: 'Schools',
    titleAccent: 'DBE · school · SP',
    description:
      'Programme messaging for department, school kitchen, and service providers.',
    defaultCompose: 'colleague',
  },
  health: {
    from: 'health',
    label: 'HealthAdvisor',
    backHref: '/dashboard/health',
    backLabel: 'HealthAdvisor',
    titleAccent: 'DoH · facility · SP',
    description:
      'Programme messaging for health facilities and service providers.',
    defaultCompose: 'colleague',
  },
  network: {
    from: 'network',
    label: 'Network',
    backHref: '/dashboard/connections',
    backLabel: 'Network',
    titleAccent: 'team & trade',
    description:
      'Message colleagues, connected suppliers and customers — and care messages from gyms or clinics.',
    defaultCompose: 'connection',
  },
};

export function resolveModuleMessageContext(
  from: string | null | undefined,
  channelParam?: string | null
): ModuleMessageContext {
  const key = String(from || 'network').toLowerCase().trim();
  const base = CTX[key] || CTX.network;

  let defaultCompose = base.defaultCompose;
  let filterChannel = base.filterChannel;
  const ch = String(channelParam || '').toLowerCase().trim();
  if (
    ch === 'colleague' ||
    ch === 'supplier' ||
    ch === 'customer' ||
    ch === 'connection'
  ) {
    defaultCompose = ch as ComposeMode;
    if (ch === 'colleague' || ch === 'supplier' || ch === 'customer') {
      filterChannel = ch;
    } else if (ch === 'connection') {
      filterChannel = 'trade';
    }
  }

  return { ...base, defaultCompose, filterChannel };
}

export function threadMatchesFilter(
  channel: CompanyMsgChannel | string,
  filter?: ModuleMessageContext['filterChannel']
): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'trade') {
    return (
      channel === 'supplier' ||
      channel === 'customer' ||
      channel === 'connection' ||
      channel === 'service'
    );
  }
  return channel === filter;
}
