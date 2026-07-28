/**
 * Golden path: PO → DN → Dispatch → POD → Receive/GRN → Serve → Claim
 * Shared status model for school, SP, and DBE surfaces.
 */

export type GoldenStepId =
  | 'po'
  | 'dn'
  | 'dispatch'
  | 'pod'
  | 'receive'
  | 'serve'
  | 'claim';

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

const STEPS_META: Array<{
  id: GoldenStepId;
  label: string;
  short: string;
  hrefSchool: string;
  hrefIsp: string;
  hrefAgency: string;
}> = [
  {
    id: 'po',
    label: 'PO submitted',
    short: 'PO',
    hrefSchool: '/dashboard/schools/orders',
    hrefIsp: '/dashboard/schools/ops',
    hrefAgency: '/dashboard/schools/ops',
  },
  {
    id: 'dn',
    label: 'Delivery note',
    short: 'DN',
    hrefSchool: '/dashboard/schools/deliveries',
    hrefIsp: '/dashboard/schools/ops',
    hrefAgency: '/dashboard/schools/ops',
  },
  {
    id: 'dispatch',
    label: 'Dispatched',
    short: 'Truck',
    hrefSchool: '/dashboard/schools/deliveries',
    hrefIsp: '/dashboard/schools/ops',
    hrefAgency: '/dashboard/schools/ops',
  },
  {
    id: 'pod',
    label: 'Photo POD',
    short: 'POD',
    hrefSchool: '/dashboard/schools/deliveries',
    hrefIsp: '/dashboard/schools/deliveries',
    hrefAgency: '/dashboard/schools/ops',
  },
  {
    id: 'receive',
    label: 'Received · GRN',
    short: 'GRN',
    hrefSchool: '/dashboard/schools/deliveries',
    hrefIsp: '/dashboard/schools/deliveries',
    hrefAgency: '/dashboard/schools/ops',
  },
  {
    id: 'serve',
    label: 'Serve day',
    short: 'Feed',
    hrefSchool: '/dashboard/schools/serve-day',
    hrefIsp: '/dashboard/schools/prizes',
    hrefAgency: '/dashboard/schools/agency-report?report=feeding',
  },
  {
    id: 'claim',
    label: 'Claim pack',
    short: 'Fund',
    hrefSchool: '/dashboard/schools/claims',
    hrefIsp: '/dashboard/schools/prizes',
    hrefAgency: '/dashboard/schools/agency-report?report=claims',
  },
];

export type PathCounts = {
  openPos: number;
  openDns: number;
  dispatched: number;
  withPod: number;
  awaitingReceive: number;
  receivedThisWeek: number;
  serveToday: boolean;
  claimsReady: boolean;
  claimsBlocked: boolean;
  lateDeliveries: number;
  openRiads: number;
  probationSps: number;
};

export function buildGoldenPath(
  role: 'school' | 'isp' | 'agency',
  c: PathCounts
): GoldenPathSnapshot {
  const href = (id: GoldenStepId) => {
    const m = STEPS_META.find((s) => s.id === id)!;
    if (role === 'isp') return m.hrefIsp;
    if (role === 'agency') return m.hrefAgency;
    return m.hrefSchool;
  };

  const flags: Record<GoldenStepId, boolean> = {
    po: c.openPos > 0 || c.openDns > 0 || c.receivedThisWeek > 0,
    dn: c.openDns > 0 || c.dispatched > 0 || c.awaitingReceive > 0,
    dispatch: c.dispatched > 0 || c.awaitingReceive > 0 || c.withPod > 0,
    pod: c.withPod > 0,
    receive: c.receivedThisWeek > 0,
    serve: c.serveToday,
    claim: c.claimsReady,
  };

  // Determine active bottleneck
  let activeId: GoldenStepId | null = null;
  if (role === 'isp') {
    if (c.openPos > 0 && c.openDns === 0) activeId = 'dn';
    else if (c.openDns > 0 && c.dispatched === 0) activeId = 'dispatch';
    else if (c.dispatched > 0 && c.withPod < c.dispatched) activeId = 'pod';
    else if (c.awaitingReceive > 0) activeId = 'receive';
    else if (c.openPos > 0) activeId = 'po';
  } else if (role === 'school') {
    if (c.awaitingReceive > 0) activeId = c.withPod > 0 ? 'receive' : 'pod';
    else if (!c.serveToday) activeId = 'serve';
    else if (c.claimsBlocked) activeId = 'claim';
    else if (c.claimsReady) activeId = 'claim';
    else if (c.openPos === 0 && c.openDns === 0) activeId = 'po';
  } else {
    // agency: exceptions drive colour
    if (c.openRiads > 0 || c.probationSps > 0 || c.lateDeliveries > 0)
      activeId = 'receive';
    else if (c.claimsReady) activeId = 'claim';
  }

  const steps: GoldenStep[] = STEPS_META.map((m) => {
    let state: GoldenStepState = flags[m.id] ? 'done' : 'todo';
    if (m.id === activeId) state = 'active';
    if (
      m.id === 'claim' &&
      c.claimsBlocked &&
      role === 'school'
    ) {
      state = 'blocked';
    }
    if (m.id === 'pod' && c.awaitingReceive > 0 && c.withPod === 0) {
      state = activeId === 'pod' ? 'active' : 'todo';
    }
    let detail: string | null = null;
    if (m.id === 'po' && c.openPos) detail = `${c.openPos} open`;
    if (m.id === 'dn' && c.openDns) detail = `${c.openDns} DNs`;
    if (m.id === 'dispatch' && c.dispatched) detail = `${c.dispatched}`;
    if (m.id === 'pod' && c.withPod) detail = `${c.withPod} with photo`;
    if (m.id === 'receive' && c.awaitingReceive)
      detail = `${c.awaitingReceive} to receive`;
    if (m.id === 'serve') detail = c.serveToday ? 'Logged today' : 'Due today';
    if (m.id === 'claim')
      detail = c.claimsBlocked
        ? 'Blocked'
        : c.claimsReady
          ? 'Ready'
          : null;

    return {
      id: m.id,
      label: m.label,
      short: m.short,
      state,
      href: href(m.id),
      detail,
    };
  });

  const active = steps.find((s) => s.state === 'active') || steps.find((s) => s.state === 'todo');
  let health: GoldenPathSnapshot['health'] = 'green';
  if (c.lateDeliveries > 0 || c.claimsBlocked || c.openRiads > 3) health = 'red';
  else if (
    c.awaitingReceive > 0 ||
    c.probationSps > 0 ||
    c.openRiads > 0 ||
    (c.dispatched > 0 && c.withPod === 0)
  )
    health = 'amber';

  return {
    role,
    steps,
    activeId: active?.id || null,
    nextLabel: active?.label || 'All clear',
    nextHref: active?.href || '/dashboard/schools',
    health,
    metrics: {
      openPos: c.openPos,
      openDns: c.openDns,
      awaitingReceive: c.awaitingReceive,
      lateDeliveries: c.lateDeliveries,
      openRiads: c.openRiads,
      probationSps: c.probationSps,
    },
  };
}

/** Soft then hard POD gate for receive */
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
