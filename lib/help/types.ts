/** How-to guide shape. Copy is prose for people using the product. */

export type GuideError = {
  /** The message the screen or the API actually returns. */
  message: string;
  fix: string;
};

export type GuideFaq = {
  q: string;
  a: string;
};

/** Lucide icon names already used by the app. */
export type GuideFlowIcon =
  | 'book-open'
  | 'file-pen'
  | 'scale'
  | 'send'
  | 'wallet'
  | 'rotate-ccw'
  | 'receipt'
  | 'ban'
  | 'landmark'
  | 'arrow-left-right'
  | 'link-2'
  | 'eye-off'
  | 'percent'
  | 'clipboard-list'
  | 'lock'
  | 'stamp'
  | 'circle-minus'
  | 'chart-column'
  | 'files'
  | 'git-branch';

export type GuideNode = {
  id: string;
  label: string;
  hint?: string;
  /** Lucide icon drawn in the node. Decisions may omit it. */
  icon?: GuideFlowIcon;
  /**
   * Role that performs the step.
   * Swimlanes render only when a flow uses two or more lanes.
   */
  lane?: string;
  /** What the books or the system do at this step. */
  books?: string;
  /** Feature id. The node scrolls to `#guide-{anchor}`. */
  anchor?: string;
  kind?: 'step' | 'decision';
};

export type GuideEdge = {
  from: string;
  to: string;
  /** Branch label drawn on the connector. */
  label?: string;
};

export type GuideFeature = {
  id: string;
  name: string;
  href: string | null;
  /** What the feature is for. Steps must not repeat this sentence. */
  summary: string;
  /** Who can use it, from the role checks in the code. */
  who: string;
  prerequisites: string[];
  steps: string[];
  behind: string[];
  errors: GuideError[];
  faqs: GuideFaq[];
};

export type ModuleGuide = {
  id: string;
  name: string;
  href: string;
  purpose: string;
  roles: string[];
  features: GuideFeature[];
  faqs: GuideFaq[];
  flow: GuideNode[];
  /**
   * Connectors. When omitted, the nodes run in array order.
   * A decision needs two or more outgoing edges.
   */
  edges?: GuideEdge[];
  outcome: string;
};
