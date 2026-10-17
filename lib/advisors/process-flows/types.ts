/**
 * Shared process-flow types. No React, no Date, no network.
 * recovergraph keeps its own diagram and is not registered here.
 * FLOW_ICON_NAMES is the icon set. AdvisorProcessFlow maps every name;
 * a module that reuses a name needs no component edit.
 */
export type AdvisorModuleId =
  | 'tradegraph'
  | 'constructiongraph'
  | 'fleetgraph'
  | 'apparelgraph'
  | 'containers'
  | 'health'
  | 'recovergraph';

/** Core workspace ids that use the shared flow. Skipped core ids stay off this union. */
export type CoreFlowModuleId = 'home' | 'suppliers' | 'customers' | 'sales-portal';

export type AdvisorFlowModuleId = AdvisorModuleId | CoreFlowModuleId;

export type FlowStatus = 'live' | 'partial' | 'soon';

export const FLOW_ICON_NAMES = [
  'users',
  'clipboard-list',
  'file-text',
  'calendar-days',
  'calendar-range',
  'package',
  'hard-hat',
  'receipt',
  'shield-check',
  'bar-chart-3',
  'building-2',
  'hammer',
  'book-open',
  'git-branch',
  'wallet',
  'clipboard-check',
  'map-pin',
  'message-square',
  'list-checks',
  'globe',
  'clock',
] as const;

export type FlowIconName = (typeof FLOW_ICON_NAMES)[number];

export type FlowChipTone = 'slate' | 'emerald' | 'rose' | 'indigo' | 'violet' | 'cyan' | 'sky';

export type FlowChip = {
  id: string;
  label: string;
  tone: FlowChipTone;
};

export type FlowTarget = {
  label: string;
  scope: 'module' | 'app';
  path: string;
  needs?: string;
  previewHref?: string;
};

export type FlowStepDef = {
  id: string;
  n: number;
  phase: string;
  title: string;
  desc: string;
  who: string;
  roles: readonly string[];
  status: FlowStatus;
  to: FlowTarget | null;
  secondary?: readonly FlowTarget[];
  note?: string;
  icon: FlowIconName;
  sources: readonly string[];
  audiences?: readonly string[];
};

export type FlowPhaseDef = {
  id: string;
  title: string;
  subtitle: string;
};

export type FlowRoleDef = {
  id: string;
  label: string;
};

export type AdvisorFlowDef = {
  module: AdvisorFlowModuleId;
  product: string;
  anchorId: string;
  title: string;
  lead: string;
  hrefRoot: string;
  previewRoot: string | null;
  previewPaths: readonly string[];
  roles: readonly FlowRoleDef[];
  phases: readonly FlowPhaseDef[];
  steps: readonly FlowStepDef[];
  around?: {
    title: string;
    links: readonly FlowTarget[];
  };
  guardrails: readonly { title: string; body: string; source: string }[];
  outcome: string;
};

/** Boolean flags from a module capability object. A string role field is ignored by the resolver. */
export type FlowCaps = { readonly [key: string]: boolean | string | undefined };

export type ResolveAdvisorFlowInput = {
  role?: string;
  caps?: FlowCaps;
  hrefBase?: string;
  audience?: string;
  chips?: Readonly<Record<string, readonly FlowChip[]>>;
  /**
   * When set, a resolved href this returns false for is plain text.
   * Omitted, the resolver does not call it.
   */
  reachable?: (href: string) => boolean;
};

export type FlowSecondaryView = {
  label: string;
  href: string | null;
  note: string | null;
};

export type FlowNodeView = {
  id: string;
  n: number;
  title: string;
  desc: string;
  who: string;
  icon: FlowIconName;
  state: FlowStatus;
  linkHref: string | null;
  chips: FlowChip[];
  mine: boolean;
  ariaLabel: string;
  secondary: FlowSecondaryView[];
  note: string | null;
};

export type FlowPhaseView = {
  id: string;
  title: string;
  subtitle: string;
  steps: FlowNodeView[];
};

export type FlowStatusCounts = {
  live: number;
  partial: number;
  soon: number;
  total: number;
};

export type AdvisorFlowView = {
  module: AdvisorFlowModuleId;
  product: string;
  anchorId: string;
  title: string;
  lead: string;
  roleLabel: string | null;
  phases: FlowPhaseView[];
  around: { title: string; links: FlowSecondaryView[] } | null;
  guardrails: readonly { title: string; body: string }[];
  outcome: string;
  counts: FlowStatusCounts;
  phaseCount: number;
  srSummary: string;
  statusLine: string;
};
