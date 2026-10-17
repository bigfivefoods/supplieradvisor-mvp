/**
 * RecoverAdvisor® collection process. One source for the Command diagram.
 * Pure: no React, no network, no clock. RecoverAdvisor® gives no legal advice.
 */
import { recoverRoleLabel, recoverSectionVisible } from './roles';
import type {
  RecoverBookStats,
  RecoverCapabilities,
  RecoverDeskPayload,
  RecoverMandate,
  RecoverRole,
} from './types';

export type FlowStatus = 'live' | 'partial' | 'soon';
export type FlowPhaseId = 'set_up' | 'reach' | 'collect' | 'close';
export type FlowStepId =
  | 'creditor'
  | 'mandate'
  | 'placement'
  | 'trace'
  | 'contact'
  | 'arrangement'
  | 'payment'
  | 'escalate'
  | 'remit'
  | 'report';

export type FlowIcon =
  | 'Building2'
  | 'ShieldCheck'
  | 'FileSpreadsheet'
  | 'UserSearch'
  | 'Mail'
  | 'HandCoins'
  | 'Landmark'
  | 'Archive'
  | 'Receipt'
  | 'ClipboardList'
  | 'Users'
  | 'Smartphone';

export type FlowNavSection = 'Overview' | 'Work' | 'Place' | 'Setup';

export type FlowStepDef = {
  id: FlowStepId;
  n: number;
  phase: FlowPhaseId;
  title: string;
  desc: string;
  who: string;
  roles: readonly RecoverRole[];
  href: string | null;
  status: FlowStatus;
  soonNote?: string;
  icon: FlowIcon;
  navSection?: FlowNavSection;
  secondary?: { label: string; href: string; navSection: FlowNavSection }[];
};

export type FlowChip = {
  text: string;
  tone: 'count' | 'soon' | 'note' | 'sample';
  /** Set when the visible text is a dash. */
  ariaLabel?: string;
};

export type FlowNodeView = {
  id: FlowStepId | 'foundation' | 'runs';
  n: number;
  title: string;
  desc: string;
  who: string;
  icon: FlowIcon;
  state: 'ready' | 'empty' | 'soon' | 'not_yours';
  linkHref: string | null;
  chips: FlowChip[];
  mine: boolean;
  ariaLabel: string;
  secondary: { label: string; href: string }[];
};

export type FlowPhaseView = {
  id: FlowPhaseId;
  title: string;
  subtitle: string;
  nodes: FlowNodeView[];
};

const COUNT = new Intl.NumberFormat('en-ZA');

export function formatFlowCount(value: number): string {
  return COUNT.format(value);
}

export const FLOW_PHASES: readonly { id: FlowPhaseId; title: string; subtitle: string }[] = [
  { id: 'set_up', title: 'Phase A · Set up the work', subtitle: 'Who we collect for and what we may do' },
  { id: 'reach', title: 'Phase B · Reach the debtor', subtitle: 'Find them, verify the contact, make first contact' },
  { id: 'collect', title: 'Phase C · Agree and collect', subtitle: 'Arrangements, payments and reconciliation' },
  { id: 'close', title: 'Phase D · Close and account', subtitle: 'Escalate or close, pay the creditor, report and audit' },
];

export const FLOW_STEPS: readonly FlowStepDef[] = [
  {
    id: 'creditor',
    n: 1,
    phase: 'set_up',
    title: 'Creditor onboarding',
    desc: 'Record the creditor who places accounts.',
    who: 'Owner / Manager',
    roles: ['owner', 'manager'],
    href: '/dashboard/recovergraph/creditors',
    status: 'live',
    icon: 'Building2',
    navSection: 'Place',
  },
  {
    id: 'mandate',
    n: 2,
    phase: 'set_up',
    title: 'Mandate',
    desc: 'Record the mandate: the product, the commission, and whether the National Credit Act applies.',
    who: 'Owner / Manager',
    roles: ['owner', 'manager'],
    href: '/dashboard/recovergraph/mandates',
    status: 'live',
    icon: 'ShieldCheck',
    navSection: 'Place',
  },
  {
    id: 'placement',
    n: 3,
    phase: 'set_up',
    title: 'Import and placement of accounts',
    desc: 'Bring the creditor book in and place the accounts. Assign them when the team is ready.',
    who: 'Owner / Manager',
    roles: ['owner', 'manager'],
    href: '/dashboard/recovergraph/imports',
    status: 'live',
    icon: 'FileSpreadsheet',
    navSection: 'Place',
    secondary: [
      { label: 'Accounts', href: '/dashboard/recovergraph/accounts', navSection: 'Work' },
      { label: 'Queue', href: '/dashboard/recovergraph/queue', navSection: 'Work' },
    ],
  },
  {
    id: 'trace',
    n: 4,
    phase: 'reach',
    title: 'Debtor tracing and contact verification',
    desc: 'Contact points can be recorded on the account now.',
    who: 'Agent / Manager',
    roles: ['agent', 'manager'],
    href: '/dashboard/recovergraph/accounts',
    status: 'partial',
    soonNote: 'Tracing and verification tools launching soon',
    icon: 'UserSearch',
    navSection: 'Work',
  },
  {
    id: 'contact',
    n: 5,
    phase: 'reach',
    title: 'First contact and letter of demand (section 129 notice where the NCA applies)',
    desc: 'Letters and notices are not open yet. Nothing in RecoverAdvisor® contacts a debtor yet.',
    who: 'Agent / Manager',
    roles: ['agent', 'manager'],
    href: null,
    status: 'soon',
    soonNote: 'Letters and notices are not open yet. Nothing in RecoverAdvisor® contacts a debtor yet.',
    icon: 'Mail',
  },
  {
    id: 'arrangement',
    n: 6,
    phase: 'collect',
    title: 'Promise to pay and payment arrangement',
    desc: 'Promises and schedules are not open yet.',
    who: 'Agent / Manager',
    roles: ['agent', 'manager'],
    href: '/dashboard/recovergraph/accounts?state=arrangement',
    status: 'partial',
    soonNote: 'Promises and schedules launching soon',
    icon: 'HandCoins',
    navSection: 'Work',
  },
  {
    id: 'payment',
    n: 7,
    phase: 'collect',
    title: 'Payments and reconciliation',
    desc: 'Payments are not recorded yet.',
    who: 'Finance / Manager',
    roles: ['finance', 'manager'],
    href: '/dashboard/recovergraph/accounts?state=paid',
    status: 'partial',
    soonNote: 'Receipting and reconciliation launching soon',
    icon: 'Landmark',
    navSection: 'Work',
  },
  {
    id: 'escalate',
    n: 8,
    phase: 'close',
    title: 'Escalation or closure',
    desc: 'Recall and close work today. A legal hand-over is not open yet.',
    who: 'Manager',
    roles: ['manager'],
    href: '/dashboard/recovergraph/accounts?state=recalled',
    status: 'partial',
    soonNote: 'Legal hand-over launching soon',
    icon: 'Archive',
    navSection: 'Work',
  },
  {
    id: 'remit',
    n: 9,
    phase: 'close',
    title: 'Remittance and statement to the creditor',
    desc: 'Trust ledger and settlement statements are not open yet.',
    who: 'Finance / Manager',
    roles: ['finance', 'manager'],
    href: null,
    status: 'soon',
    soonNote: 'Trust ledger and settlement statements are not open yet.',
    icon: 'Receipt',
  },
  {
    id: 'report',
    n: 10,
    phase: 'close',
    title: 'Reporting and audit',
    desc: 'Every desk change is already written to an append-only audit log. Reports and the compliance centre arrive later.',
    who: 'Owner / Manager / Compliance',
    roles: ['owner', 'manager', 'compliance'],
    href: null,
    status: 'soon',
    soonNote: 'Every desk change is already written to an append-only audit log. Reports and the compliance centre arrive later.',
    icon: 'ClipboardList',
  },
];

export const FLOW_FOUNDATION = {
  title: 'Before step 1: operator, Council for Debt Collectors registration and team',
  desc: 'Council registration is recorded here. RecoverAdvisor® gives no legal advice.',
  href: '/dashboard/recovergraph/settings/team',
  navSection: 'Setup' as const,
  icon: 'Users' as const,
};

export const FLOW_RUNS = {
  title: 'Work from a phone',
  desc: 'Portals and install lists the owner app, the workers app, and the client app. Those three apps are launching soon.',
  href: '/dashboard/recovergraph/settings/portals',
  navSection: 'Setup' as const,
  icon: 'Smartphone' as const,
};

export const FLOW_GUARDRAILS: readonly { title: string; body: string }[] = [
  {
    title: 'Demo-data mode',
    body: 'Figures stay in demo-data mode until real data is enabled on the workspace.',
  },
  {
    title: 'An agent sees their own accounts',
    body: 'An agent sees only the accounts assigned to them.',
  },
  {
    title: 'Identity numbers stay masked',
    body: 'Identity numbers are masked, and every reveal is logged.',
  },
  {
    title: 'Desk changes are audited',
    body: 'Every desk change is written to an append-only audit log.',
  },
  {
    title: 'Council registration and assignment',
    body: 'New assignments can be blocked when a Council registration is not recorded.',
  },
  {
    title: 'Nothing contacts a debtor yet',
    body: 'RecoverAdvisor® gives no legal advice. Nothing in RecoverAdvisor® contacts a debtor yet.',
  },
];

export const FLOW_OUTCOME =
  'Set up the creditor and the mandate, place the book, trace and make contact, agree and collect, then close, pay the creditor and keep the audit trail.';

export function flowStatusCounts(): { live: number; partial: number; soon: number } {
  return {
    live: FLOW_STEPS.filter((step) => step.status === 'live').length,
    partial: FLOW_STEPS.filter((step) => step.status === 'partial').length,
    soon: FLOW_STEPS.filter((step) => step.status === 'soon').length,
  };
}

export function flowStatusLine(): string {
  const counts = flowStatusCounts();
  return `${counts.live} of ${FLOW_STEPS.length} steps are live · ${counts.partial} are partly live · ${counts.soon} are launching soon`;
}

export function flowSrSummary(): string {
  const counts = flowStatusCounts();
  return `This process has ten steps in four phases. ${counts.live} are live, ${counts.partial} are partly live and ${counts.soon} are launching soon.`;
}

export function flowRolePill(role: RecoverRole): string {
  if (role === 'none') return 'No role on this desk';
  return `You are the ${recoverRoleLabel(role).toLowerCase()}`;
}

export function stepAriaLabel(n: number, title: string, counts: string[], opens: string | null): string {
  const count = counts.length ? `, ${counts.join(', ')}` : '';
  const open = opens ? ` Opens ${opens}.` : '';
  return `Step ${n}, ${title}${count}.${open}`;
}

function bookOrEmpty(
  counts: RecoverDeskPayload['counts'],
  book: RecoverBookStats | null | undefined
): RecoverBookStats | null | undefined {
  if (book) return book;
  if (counts.creditors === 0 && counts.mandates === 0) {
    return {
      placedCount: 0,
      placedBalanceCents: 0,
      assignedCount: 0,
      unassignedCount: 0,
      imported: false,
      arrangementCount: 0,
      paidCount: 0,
      recalledCount: 0,
      closedCount: 0,
    };
  }
  return book;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function noun(n: number, one: string, many: string): string {
  return `${formatFlowCount(n)} ${n === 1 ? one : many}`;
}

function ncaActive(mandates: readonly RecoverMandate[]): number {
  return mandates.filter((row) => row.nca_regulated && row.status === 'active').length;
}

function seesWorkspaceCounts(role: RecoverRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'finance' || role === 'compliance' || role === 'viewer';
}

function seesSplit(role: RecoverRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'finance' || role === 'compliance';
}

function seesStateCounts(role: RecoverRole): boolean {
  return seesSplit(role);
}

type Screen = 'creditors' | 'mandates' | 'imports' | 'accounts' | 'queue' | 'team' | 'portals';

function screenOf(href: string): Screen | null {
  if (href.includes('/settings/team')) return 'team';
  if (href.includes('/settings/portals')) return 'portals';
  if (href.includes('/creditors')) return 'creditors';
  if (href.includes('/mandates')) return 'mandates';
  if (href.includes('/imports')) return 'imports';
  if (href.includes('/queue')) return 'queue';
  if (href.includes('/accounts')) return 'accounts';
  return null;
}

export function canOpenRecoverScreen(
  role: RecoverRole,
  capabilities: RecoverCapabilities,
  href: string,
  navSection?: string
): boolean {
  if (role === 'none') return false;
  const screen = screenOf(href);
  if (!screen) return false;
  if (navSection && !recoverSectionVisible(role, navSection)) return false;
  if (screen === 'creditors' || screen === 'mandates') {
    return recoverSectionVisible(role, 'Place') && capabilities.canSeeCreditorDetail !== false;
  }
  if (screen === 'imports') {
    return recoverSectionVisible(role, 'Place') && capabilities.canImport !== false;
  }
  if (screen === 'accounts') return recoverSectionVisible(role, 'Work');
  if (screen === 'queue') return recoverSectionVisible(role, 'Work') && role !== 'viewer';
  if (screen === 'team') return capabilities.canManageStaff === true;
  if (screen === 'portals') return recoverSectionVisible(role, 'Setup');
  return false;
}

function opensPhrase(href: string): string {
  const screen = screenOf(href);
  if (screen === 'accounts') {
    const state = new URL(href, 'https://recover.invalid').searchParams.get('state');
    return state ? `accounts filtered to ${state}` : 'accounts';
  }
  if (screen === 'imports') return 'imports';
  if (screen === 'creditors') return 'creditors';
  if (screen === 'mandates') return 'mandates';
  if (screen === 'queue') return 'the queue';
  if (screen === 'team') return 'team and registrations';
  if (screen === 'portals') return 'portals and install';
  return 'the screen';
}

function holdNote(role: RecoverRole): string {
  return role === 'agent' ? 'Set up by your manager' : 'Not available to your role';
}

const DASH: FlowChip = { text: '—', tone: 'note', ariaLabel: 'not available' };
const UNAVAILABLE: FlowChip = { text: 'Counts unavailable', tone: 'note' };

function unavailableBook(): { chips: FlowChip[]; empty: boolean } {
  return { chips: [UNAVAILABLE], empty: false };
}

export type FlowPreviewKind = 'live' | 'illustration' | 'harbour';

export function resolveProcessFlow(input: {
  role: RecoverRole;
  capabilities: RecoverCapabilities;
  counts: RecoverDeskPayload['counts'];
  mandates: RecoverMandate[];
  book: RecoverBookStats | null | undefined;
  ready: boolean;
  sample: boolean;
  preview?: FlowPreviewKind;
}): {
  phases: FlowPhaseView[];
  nodes: FlowNodeView[];
  summary: string;
  srSummary: string;
  lead: string;
  roleLabel: string;
  foundation: FlowNodeView;
  runs: FlowNodeView;
  outcome: string;
  guardrails: readonly { title: string; body: string }[];
  defaultCollapsed: boolean;
} {
  const preview = input.preview || (input.sample ? 'illustration' : 'live');
  const book = bookOrEmpty(input.counts, input.book);
  const nodes = FLOW_STEPS.map((step) => nodeFor(step, input, preview, book));
  const phases = FLOW_PHASES.map((phase) => ({
    ...phase,
    nodes: nodes.filter((node) => FLOW_STEPS.find((step) => step.id === node.id)?.phase === phase.id),
  }));
  return {
    phases,
    nodes,
    summary: flowStatusLine(),
    srSummary: flowSrSummary(),
    lead: leadFor(input.role),
    roleLabel: flowRolePill(input.role),
    foundation: foundationFor(input, preview),
    runs: runsFor(input),
    outcome: FLOW_OUTCOME,
    guardrails: FLOW_GUARDRAILS,
    defaultCollapsed: true,
  };
}

function leadFor(role: RecoverRole): string {
  if (role === 'agent') {
    return 'This is the whole collection desk. Your steps are tracing, first contact, and arrangements. You only see accounts assigned to you.';
  }
  if (role === 'finance') {
    return 'You can read the book. Payments and remittance are your steps. Payments are not recorded yet.';
  }
  if (role === 'compliance') {
    return 'You can read the book. Reporting and the audit trail are your steps. Reports are not open yet.';
  }
  if (role === 'viewer') {
    return 'This is a read-only picture of the collection desk.';
  }
  if (role === 'none') return 'This desk has no role yet.';
  return 'Ten steps, from the creditor and the mandate through to the audit trail. Open a step to go to that screen.';
}

function nodeFor(
  step: FlowStepDef,
  input: {
    role: RecoverRole;
    capabilities: RecoverCapabilities;
    counts: RecoverDeskPayload['counts'];
    mandates: RecoverMandate[];
    ready: boolean;
    sample: boolean;
  },
  preview: FlowPreviewKind,
  book: RecoverBookStats | null | undefined
): FlowNodeView {
  const allowed = step.href ? canOpenRecoverScreen(input.role, input.capabilities, step.href, step.navSection) : false;
  const linkHref = input.ready && allowed && step.href ? step.href : null;
  const chips: FlowChip[] = [];
  let empty = false;
  if (input.ready && step.status !== 'soon') {
    const built = countsFor(step, input, book);
    chips.push(...built.chips);
    empty = built.empty;
  }
  if (step.status === 'soon') chips.push({ text: 'Launching soon', tone: 'soon' });
  else if (step.soonNote) chips.push({ text: step.soonNote, tone: 'soon' });
  if (input.ready && !linkHref && step.status !== 'soon') chips.push({ text: holdNote(input.role), tone: 'note' });
  if (preview === 'illustration') {
    const visible = chips.filter(
      (chip) => chip.text !== '—' && chip.text !== 'Counts unavailable' && !chip.text.includes('NCA-regulated')
    );
    chips.length = 0;
    chips.push(...visible);
    if (!chips.some((chip) => chip.tone === 'sample')) {
      chips.push({ text: 'Illustration · sample data', tone: 'sample' });
    }
  }
  const state: FlowNodeView['state'] =
    step.status === 'soon' ? 'soon' : !input.ready ? 'empty' : !allowed ? 'not_yours' : empty ? 'empty' : 'ready';
  const ariaCounts = chips
    .filter((chip) => chip.tone === 'count' || chip.ariaLabel === 'not available')
    .map((chip) => chip.ariaLabel || chip.text);
  const secondary =
    input.ready && step.secondary
      ? step.secondary
          .filter((item) => canOpenRecoverScreen(input.role, input.capabilities, item.href, item.navSection))
          .map((item) => ({ label: item.label, href: item.href }))
      : [];
  return {
    id: step.id,
    n: step.n,
    title: step.title,
    desc: step.desc,
    who: step.who,
    icon: step.icon,
    state,
    linkHref,
    chips,
    mine: step.roles.includes(input.role),
    ariaLabel: stepAriaLabel(step.n, step.title, ariaCounts, linkHref ? opensPhrase(linkHref) : null),
    secondary,
  };
}

function countsFor(
  step: FlowStepDef,
  input: {
    role: RecoverRole;
    counts: RecoverDeskPayload['counts'];
    mandates: RecoverMandate[];
  },
  book: RecoverBookStats | null | undefined
): { chips: FlowChip[]; empty: boolean } {
  const chips: FlowChip[] = [];
  const role = input.role;
  if (step.id === 'creditor') {
    if (!seesWorkspaceCounts(role)) return { chips, empty: false };
    if (!finite(input.counts.creditors)) return { chips: [DASH], empty: false };
    if (input.counts.creditors === 0) return { chips: [{ text: 'No creditors yet', tone: 'note' }], empty: true };
    return { chips: [{ text: noun(input.counts.creditors, 'creditor', 'creditors'), tone: 'count' }], empty: false };
  }
  if (step.id === 'mandate') {
    if (!seesWorkspaceCounts(role)) return { chips, empty: false };
    if (!finite(input.counts.mandates)) return { chips: [DASH], empty: false };
    const rows: FlowChip[] =
      input.counts.mandates === 0
        ? [{ text: 'No mandates yet', tone: 'note' }]
        : [{ text: noun(input.counts.mandates, 'mandate', 'mandates'), tone: 'count' }];
    if (role !== 'agent' && input.counts.mandates > 0) {
      rows.push({ text: noun(ncaActive(input.mandates), 'NCA-regulated', 'NCA-regulated'), tone: 'count' });
    }
    return { chips: rows, empty: input.counts.mandates === 0 };
  }
  if (step.id === 'placement') {
    if (role === 'agent') {
      if (!book || !finite(book.assignedCount)) return unavailableBook();
      return {
        chips: [{ text: `${noun(book.assignedCount, 'assigned to you', 'assigned to you')}`, tone: 'count' }],
        empty: book.assignedCount === 0,
      };
    }
    if (!seesWorkspaceCounts(role)) return { chips, empty: false };
    if (!book || !finite(book.placedCount)) return unavailableBook();
    if (book.placedCount === 0) return { chips: [{ text: 'Nothing placed yet', tone: 'note' }], empty: true };
    chips.push({ text: noun(book.placedCount, 'placed', 'placed'), tone: 'count' });
    if (seesSplit(role) && finite(book.assignedCount) && finite(book.unassignedCount)) {
      chips.push({
        text: `${formatFlowCount(book.assignedCount)} assigned · ${formatFlowCount(book.unassignedCount)} unassigned`,
        tone: 'count',
      });
    }
    return { chips, empty: false };
  }
  if (step.id === 'arrangement') {
    return stateCount(role, book, book?.arrangementCount, 'in arrangement');
  }
  if (step.id === 'payment') {
    return stateCount(role, book, book?.paidCount, 'paid');
  }
  if (step.id === 'escalate') {
    if (!seesStateCounts(role)) return { chips, empty: false };
    if (!book) return unavailableBook();
    if (!finite(book.recalledCount) || !finite(book.closedCount)) return { chips: [DASH], empty: false };
    return {
      chips: [
        { text: noun(book.recalledCount, 'recalled', 'recalled'), tone: 'count' },
        { text: noun(book.closedCount, 'closed', 'closed'), tone: 'count' },
      ],
      empty: book.recalledCount === 0 && book.closedCount === 0,
    };
  }
  return { chips, empty: false };
}

function stateCount(
  role: RecoverRole,
  book: RecoverBookStats | null | undefined,
  value: number | undefined,
  label: string
): { chips: FlowChip[]; empty: boolean } {
  if (!seesStateCounts(role)) return { chips: [], empty: false };
  if (!book) return unavailableBook();
  if (!finite(value)) return { chips: [DASH], empty: false };
  return { chips: [{ text: `${formatFlowCount(value)} ${label}`, tone: 'count' }], empty: value === 0 };
}

function foundationFor(
  input: {
    role: RecoverRole;
    capabilities: RecoverCapabilities;
    counts: RecoverDeskPayload['counts'];
    ready: boolean;
  },
  preview: FlowPreviewKind
): FlowNodeView {
  const href = FLOW_FOUNDATION.href;
  const allowed = canOpenRecoverScreen(input.role, input.capabilities, href, FLOW_FOUNDATION.navSection);
  const linkHref = input.ready && allowed ? href : null;
  const chips: FlowChip[] = [];
  if (input.ready && input.capabilities.canManageStaff && finite(input.counts.staff)) {
    chips.push({ text: noun(input.counts.staff, 'staff', 'staff'), tone: 'count' });
  } else if (input.ready && input.capabilities.canManageStaff) {
    chips.push(DASH);
  }
  if (input.ready && !linkHref) chips.push({ text: holdNote(input.role), tone: 'note' });
  if (input.ready && preview === 'illustration' && chips.some((chip) => chip.tone === 'count')) {
    chips.push({ text: 'Illustration · sample data', tone: 'sample' });
  }
  return {
    id: 'foundation',
    n: 0,
    title: FLOW_FOUNDATION.title,
    desc: FLOW_FOUNDATION.desc,
    who: 'Owner / Manager',
    icon: FLOW_FOUNDATION.icon,
    state: !input.ready ? 'empty' : allowed ? 'ready' : 'not_yours',
    linkHref,
    chips,
    mine: input.role === 'owner' || input.role === 'manager',
    ariaLabel: `Before step 1, operator and team.${linkHref ? ' Opens team and registrations.' : ''}`,
    secondary: [],
  };
}

function runsFor(input: { role: RecoverRole; capabilities: RecoverCapabilities; ready: boolean }): FlowNodeView {
  const href = FLOW_RUNS.href;
  const allowed = canOpenRecoverScreen(input.role, input.capabilities, href, FLOW_RUNS.navSection);
  const linkHref = input.ready && allowed ? href : null;
  return {
    id: 'runs',
    n: 0,
    title: FLOW_RUNS.title,
    desc: FLOW_RUNS.desc,
    who: 'Everyone',
    icon: FLOW_RUNS.icon,
    state: linkHref ? 'ready' : 'not_yours',
    linkHref,
    chips: [{ text: 'Launching soon', tone: 'soon' }],
    mine: false,
    ariaLabel: `Work from a phone.${linkHref ? ' Opens portals and install.' : ''}`,
    secondary: [],
  };
}
