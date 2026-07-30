/**
 * Golden paths by NSNP role.
 *
 * School:
 *   Check kitchen stock vs DBE menu → when short, PO to SP → receive stock → serve meals
 *
 * Service provider (SP):
 *   Receive school PO → procure items → deliver to school
 *
 * DBE / PEU (agency) — programme governance only.
 *   They do **not** order food or receive deliveries.
 *   Catalogue · menus · recipes · calendar · approve joins · PEU compliance · claim review
 */

/** School operational path */
export type SchoolStepId = 'stock' | 'po' | 'receive' | 'serve';

/** SP operational path */
export type IspStepId = 'receive_po' | 'procure' | 'deliver';

/** DBE / PEU programme path */
export type AgencyStepId =
  | 'associations'
  | 'catalogue'
  | 'menu'
  | 'recipes'
  | 'calendar'
  | 'compliance'
  | 'claims';

/** @deprecated use SchoolStepId | IspStepId — kept for soft compatibility */
export type SupplyStepId =
  | SchoolStepId
  | IspStepId
  | 'dn'
  | 'dispatch'
  | 'pod'
  | 'claim';

export type GoldenStepId = SchoolStepId | IspStepId | AgencyStepId;

export type GoldenStepState = 'done' | 'active' | 'blocked' | 'todo';

export type GoldenStep = {
  id: GoldenStepId;
  label: string;
  short: string;
  state: GoldenStepState;
  href: string;
  detail?: string | null;
};

export type GoldenPathSnapshot = {
  role: 'school' | 'isp' | 'agency';
  steps: GoldenStep[];
  activeId: GoldenStepId | null;
  nextLabel: string;
  nextHref: string;
  health: 'green' | 'amber' | 'red';
  metrics: Record<string, number | string | null>;
};

const SCHOOL_STEPS: Array<{
  id: SchoolStepId;
  label: string;
  short: string;
  href: string;
}> = [
  {
    id: 'stock',
    label: 'Kitchen vs menu',
    short: 'Stock',
    href: '/dashboard/schools/kitchen',
  },
  {
    id: 'po',
    label: 'PO to SP (if short)',
    short: 'PO',
    href: '/dashboard/schools/orders',
  },
  {
    id: 'receive',
    label: 'Receive into kitchen',
    short: 'GRN',
    href: '/dashboard/schools/deliveries',
  },
  {
    id: 'serve',
    label: 'Serve meals',
    short: 'Feed',
    href: '/dashboard/schools/serve-day',
  },
];

const ISP_STEPS: Array<{
  id: IspStepId;
  label: string;
  short: string;
  href: string;
}> = [
  {
    id: 'receive_po',
    label: 'School POs',
    short: 'PO in',
    href: '/dashboard/schools/sp-orders-report',
  },
  {
    id: 'procure',
    label: 'Procure items',
    short: 'Buy',
    href: '/dashboard/schools/ops',
  },
  {
    id: 'deliver',
    label: 'Deliver to school',
    short: 'Deliver',
    href: '/dashboard/schools/deliveries',
  },
];

const AGENCY_STEPS: Array<{
  id: AgencyStepId;
  label: string;
  short: string;
  href: string;
}> = [
  {
    id: 'associations',
    label: 'Approve schools & SPs',
    short: 'Join',
    href: '/dashboard/schools/join',
  },
  {
    id: 'catalogue',
    label: 'Approved catalogue',
    short: 'List',
    href: '/dashboard/schools/approved-list',
  },
  {
    id: 'menu',
    label: 'Menu cycle',
    short: 'Menu',
    href: '/dashboard/schools/menu',
  },
  {
    id: 'recipes',
    label: 'Recipes · BOMs',
    short: 'BOM',
    href: '/dashboard/schools/recipes',
  },
  {
    id: 'calendar',
    label: 'Feeding calendar',
    short: 'Days',
    href: '/dashboard/schools/feeding-calendar',
  },
  {
    id: 'compliance',
    label: 'Compliance · PEU',
    short: 'Check',
    href: '/dashboard/schools/monitoring',
  },
  {
    id: 'claims',
    label: 'Review claims',
    short: 'Review',
    href: '/dashboard/schools/agency-report?report=claims',
  },
];

export type PathCounts = {
  /** School: lines below reorder / cover vs DBE menu */
  stockShort: number;
  stockOk: boolean;
  /** Open POs (school raised or SP inbox) */
  openPos: number;
  /** SP: DNs not yet created / procurement in progress */
  openDns: number;
  /** SP: out for delivery / delivered awaiting school GRN */
  dispatched: number;
  withPod: number;
  /** School: deliveries ready to GRN */
  awaitingReceive: number;
  receivedThisWeek: number;
  serveToday: boolean;
  claimsReady: boolean;
  claimsBlocked: boolean;
  lateDeliveries: number;
  openRiads: number;
  probationSps: number;
  /** DBE programme */
  pendingAssociations: number;
  activeSchools: number;
  catalogueProducts: number;
  menuConfigured: boolean;
  recipesConfigured: boolean;
  calendarConfigured: boolean;
  submittedClaims: number;
};

export function emptyPathCounts(): PathCounts {
  return {
    stockShort: 0,
    stockOk: true,
    openPos: 0,
    openDns: 0,
    dispatched: 0,
    withPod: 0,
    awaitingReceive: 0,
    receivedThisWeek: 0,
    serveToday: false,
    claimsReady: false,
    claimsBlocked: false,
    lateDeliveries: 0,
    openRiads: 0,
    probationSps: 0,
    pendingAssociations: 0,
    activeSchools: 0,
    catalogueProducts: 0,
    menuConfigured: false,
    recipesConfigured: false,
    calendarConfigured: false,
    submittedClaims: 0,
  };
}

function buildSchoolPath(c: PathCounts): GoldenPathSnapshot {
  // Bottleneck: short stock → raise PO; else open PO/awaiting → receive; else serve
  let activeId: SchoolStepId | null = null;
  if (c.awaitingReceive > 0) activeId = 'receive';
  else if (c.openPos > 0) activeId = 'po';
  else if (c.stockShort > 0 || !c.stockOk) activeId = 'stock';
  else if (!c.serveToday) activeId = 'serve';
  else activeId = 'serve';

  const steps: GoldenStep[] = SCHOOL_STEPS.map((m) => {
    let state: GoldenStepState = 'todo';
    let detail: string | null = null;

    if (m.id === 'stock') {
      if (c.stockShort > 0) {
        state = 'active';
        detail = `${c.stockShort} short`;
      } else if (c.stockOk) {
        state = 'done';
        detail = 'Cover OK';
      } else {
        state = 'todo';
        detail = 'Check kitchen';
      }
    } else if (m.id === 'po') {
      if (c.openPos > 0) {
        state = 'active';
        detail = `${c.openPos} open`;
      } else if (c.receivedThisWeek > 0 || c.awaitingReceive > 0) {
        state = 'done';
        detail = 'Ordered';
      } else if (c.stockShort > 0) {
        state = 'todo';
        detail = 'Restock needed';
      } else {
        state = 'done';
        detail = 'No shortfall';
      }
    } else if (m.id === 'receive') {
      if (c.awaitingReceive > 0) {
        state = 'active';
        detail = `${c.awaitingReceive} to GRN`;
      } else if (c.receivedThisWeek > 0) {
        state = 'done';
        detail = `${c.receivedThisWeek} this week`;
      } else {
        state = 'todo';
        detail = 'Await delivery';
      }
    } else if (m.id === 'serve') {
      if (c.serveToday) {
        state = 'done';
        detail = 'Logged today';
      } else {
        state = activeId === 'serve' ? 'active' : 'todo';
        detail = 'Due today';
      }
    }

    if (m.id === activeId && state !== 'done') state = 'active';

    return {
      id: m.id,
      label: m.label,
      short: m.short,
      state,
      href: m.href,
      detail,
    };
  });

  const active =
    steps.find((s) => s.state === 'active') ||
    steps.find((s) => s.state === 'todo');

  let health: GoldenPathSnapshot['health'] = 'green';
  if (c.lateDeliveries > 0 || c.claimsBlocked) health = 'red';
  else if (c.stockShort > 0 || c.awaitingReceive > 0 || c.openPos > 0)
    health = 'amber';

  return {
    role: 'school',
    steps,
    activeId: active?.id || null,
    nextLabel: active?.label || 'All clear — feed learners',
    nextHref: active?.href || '/dashboard/schools',
    health,
    metrics: {
      stockShort: c.stockShort,
      openPos: c.openPos,
      awaitingReceive: c.awaitingReceive,
      receivedThisWeek: c.receivedThisWeek,
      serveToday: c.serveToday ? 1 : 0,
    },
  };
}

function buildIspPath(c: PathCounts): GoldenPathSnapshot {
  // Receive PO → procure → deliver
  let activeId: IspStepId | null = null;
  if (c.openPos > 0 && c.openDns === 0 && c.dispatched === 0)
    activeId = 'receive_po';
  else if (c.openDns > 0 || (c.openPos > 0 && c.dispatched === 0))
    activeId = 'procure';
  else if (c.dispatched > 0) activeId = 'deliver';
  else if (c.openPos > 0) activeId = 'receive_po';

  const steps: GoldenStep[] = ISP_STEPS.map((m) => {
    let state: GoldenStepState = 'todo';
    let detail: string | null = null;

    if (m.id === 'receive_po') {
      if (c.openPos > 0) {
        state = activeId === 'receive_po' ? 'active' : 'done';
        detail = `${c.openPos} school PO(s)`;
      } else {
        state = 'done';
        detail = 'Inbox clear';
      }
    } else if (m.id === 'procure') {
      // Procurement = DN not yet dispatched (draft/confirmed)
      if (c.openDns > 0) {
        state = 'active';
        detail = `${c.openDns} to buy/pack`;
      } else if (c.dispatched > 0 || c.openPos === 0) {
        state = 'done';
        detail = c.dispatched > 0 ? 'Ready to deliver' : '—';
      } else {
        state = 'todo';
        detail = 'Buy on-catalogue';
      }
    } else if (m.id === 'deliver') {
      if (c.dispatched > 0) {
        state = 'active';
        detail = `${c.dispatched} in transit`;
      } else if (c.lateDeliveries > 0) {
        state = 'blocked';
        detail = `${c.lateDeliveries} late`;
      } else {
        state = c.openPos === 0 && c.openDns === 0 ? 'done' : 'todo';
        detail = c.withPod > 0 ? `${c.withPod} with POD` : 'Deliver + POD';
      }
    }

    if (m.id === activeId && state !== 'blocked') state = 'active';

    return {
      id: m.id,
      label: m.label,
      short: m.short,
      state,
      href: m.href,
      detail,
    };
  });

  const active =
    steps.find((s) => s.state === 'active') ||
    steps.find((s) => s.state === 'todo');

  let health: GoldenPathSnapshot['health'] = 'green';
  if (c.lateDeliveries > 0) health = 'red';
  else if (c.openPos > 0 || c.openDns > 0 || c.dispatched > 0) health = 'amber';

  return {
    role: 'isp',
    steps,
    activeId: active?.id || null,
    nextLabel: active?.label || 'All clear',
    nextHref: active?.href || '/dashboard/schools',
    health,
    metrics: {
      openPos: c.openPos,
      openDns: c.openDns,
      dispatched: c.dispatched,
      lateDeliveries: c.lateDeliveries,
      withPod: c.withPod,
    },
  };
}

function buildAgencyPath(c: PathCounts): GoldenPathSnapshot {
  const setupDone = {
    associations: c.pendingAssociations === 0 && c.activeSchools > 0,
    catalogue: c.catalogueProducts > 0,
    menu: c.menuConfigured,
    recipes: c.recipesConfigured,
    calendar: c.calendarConfigured,
  };

  const complianceClear =
    c.lateDeliveries === 0 && c.openRiads === 0 && c.probationSps === 0;
  const claimsInboxClear = c.submittedClaims === 0;

  let activeId: AgencyStepId | null = null;
  if (c.pendingAssociations > 0) activeId = 'associations';
  else if (!setupDone.catalogue) activeId = 'catalogue';
  else if (!setupDone.menu) activeId = 'menu';
  else if (!setupDone.recipes) activeId = 'recipes';
  else if (!setupDone.calendar) activeId = 'calendar';
  else if (!complianceClear) activeId = 'compliance';
  else if (c.submittedClaims > 0) activeId = 'claims';
  else if (!setupDone.associations) activeId = 'associations';

  const steps: GoldenStep[] = AGENCY_STEPS.map((m) => {
    let state: GoldenStepState = 'todo';
    let detail: string | null = null;

    if (m.id === 'associations') {
      state = setupDone.associations
        ? 'done'
        : c.pendingAssociations > 0
          ? 'active'
          : 'todo';
      if (c.pendingAssociations > 0)
        detail = `${c.pendingAssociations} pending`;
      else if (c.activeSchools > 0) detail = `${c.activeSchools} schools`;
    } else if (m.id === 'catalogue') {
      state = setupDone.catalogue ? 'done' : 'todo';
      if (c.catalogueProducts > 0) detail = `${c.catalogueProducts} items`;
    } else if (m.id === 'menu') {
      state = setupDone.menu ? 'done' : 'todo';
      detail = setupDone.menu ? 'Set' : 'Not set';
    } else if (m.id === 'recipes') {
      state = setupDone.recipes ? 'done' : 'todo';
      detail = setupDone.recipes ? 'Set' : 'Not set';
    } else if (m.id === 'calendar') {
      state = setupDone.calendar ? 'done' : 'todo';
      detail = setupDone.calendar ? 'Set' : 'Not set';
    } else if (m.id === 'compliance') {
      state = complianceClear ? 'done' : 'active';
      if (c.lateDeliveries > 0) detail = `${c.lateDeliveries} late`;
      else if (c.openRiads > 0) detail = `${c.openRiads} RIAD`;
      else if (c.probationSps > 0) detail = `${c.probationSps} SP risk`;
      else detail = 'Clear';
    } else if (m.id === 'claims') {
      state = claimsInboxClear ? 'done' : 'active';
      if (c.submittedClaims > 0) detail = `${c.submittedClaims} to review`;
      else detail = 'Inbox clear';
    }

    if (m.id === activeId) state = 'active';

    return {
      id: m.id,
      label: m.label,
      short: m.short,
      state,
      href: m.href,
      detail,
    };
  });

  const active =
    steps.find((s) => s.state === 'active') ||
    steps.find((s) => s.state === 'todo');

  let health: GoldenPathSnapshot['health'] = 'green';
  if (c.openRiads > 3 || c.lateDeliveries > 10) health = 'red';
  else if (
    c.pendingAssociations > 0 ||
    c.submittedClaims > 0 ||
    c.lateDeliveries > 0 ||
    c.openRiads > 0 ||
    c.probationSps > 0 ||
    !setupDone.catalogue ||
    !setupDone.menu
  )
    health = 'amber';

  return {
    role: 'agency',
    steps,
    activeId: active?.id || null,
    nextLabel: active?.label || 'Programme on track',
    nextHref: active?.href || '/dashboard/schools',
    health,
    metrics: {
      pendingAssociations: c.pendingAssociations,
      activeSchools: c.activeSchools,
      catalogueProducts: c.catalogueProducts,
      submittedClaims: c.submittedClaims,
      lateDeliveries: c.lateDeliveries,
      openRiads: c.openRiads,
      probationSps: c.probationSps,
      openPos: null,
      awaitingReceive: null,
    },
  };
}

export function buildGoldenPath(
  role: 'school' | 'isp' | 'agency',
  c: PathCounts
): GoldenPathSnapshot {
  if (role === 'agency') return buildAgencyPath(c);
  if (role === 'isp') return buildIspPath(c);
  return buildSchoolPath(c);
}

/** Soft then hard POD gate for school receive */
export function podGate(opts: {
  hasPod: boolean;
  requireHard?: boolean;
}): { ok: boolean; mode: 'ok' | 'soft' | 'hard'; message?: string } {
  if (opts.hasPod) return { ok: true, mode: 'ok' };
  if (opts.requireHard) {
    return {
      ok: false,
      mode: 'hard',
      message:
        'Photo POD required before receive. Attach a POD photo (school or SP), then receive into kitchen.',
    };
  }
  return {
    ok: true,
    mode: 'soft',
    message:
      'No POD photo yet — receive allowed, but attach a POD photo for SP prize points and audit strength.',
  };
}
