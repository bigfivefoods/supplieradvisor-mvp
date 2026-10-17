import type {
  AdvisorFlowDef,
  AdvisorFlowView,
  FlowCaps,
  FlowChip,
  FlowNodeView,
  FlowSecondaryView,
  FlowStatusCounts,
  FlowStepDef,
  FlowTarget,
  ResolveAdvisorFlowInput,
} from './types';

const ROLE_NOTE = 'Not available to your role';
const PREVIEW_NOTE = 'Open in the signed-in app';
const HERE_NOTE = 'Not available here';
const SOON_LABEL = 'Launching soon';

export function flowStatusCounts(def: AdvisorFlowDef): FlowStatusCounts {
  let live = 0;
  let partial = 0;
  let soon = 0;
  for (const step of def.steps) {
    if (step.status === 'live') live += 1;
    else if (step.status === 'partial') partial += 1;
    else soon += 1;
  }
  return { live, partial, soon, total: def.steps.length };
}

export function flowStatusLine(counts: FlowStatusCounts): string {
  const live = counts.live === 1 ? '1 step is live' : `${counts.live} steps are live`;
  const partial = counts.partial === 1 ? '1 partly live' : `${counts.partial} partly live`;
  const soon = counts.soon === 1 ? '1 launching soon' : `${counts.soon} launching soon`;
  return `${live}, ${partial}, ${soon}`;
}

export function flowSrSummary(def: AdvisorFlowDef): string {
  const counts = flowStatusCounts(def);
  const phases = def.phases.length;
  const phaseWord = phases === 1 ? 'phase' : 'phases';
  return `This process has ${counts.total} steps in ${phases} ${phaseWord}. ${counts.live} are live, ${counts.partial} are partly live and ${counts.soon} are launching soon.`;
}

export function stepAriaLabel(step: Pick<FlowStepDef, 'n' | 'title' | 'status'>, href: string | null, reason: string | null): string {
  const head = `Step ${step.n}, ${step.title}.`;
  if (step.status === 'soon' || reason === 'soon') return `${head} ${SOON_LABEL}.`;
  if (reason === 'role') return `${head} ${ROLE_NOTE}.`;
  if (reason === 'preview') return `${head} ${PREVIEW_NOTE}.`;
  if (reason === 'here') return `${head} ${HERE_NOTE}.`;
  if (!href) return `${head} ${SOON_LABEL}.`;
  const opened = step.title.charAt(0).toLowerCase() + step.title.slice(1);
  return `${head} Opens the ${opened}.`;
}

function splitHref(href: string): { path: string; search: string } {
  const hashless = href.split('#')[0] || '';
  const queryAt = hashless.indexOf('?');
  if (queryAt === -1) return { path: hashless, search: '' };
  return { path: hashless.slice(0, queryAt), search: hashless.slice(queryAt + 1) };
}

function pathKey(path: string): string {
  const bare = splitHref(path).path.replace(/^\//, '').replace(/\/$/, '');
  return bare;
}

function isPreviewBase(hrefBase: string): boolean {
  return hrefBase.startsWith('/preview/');
}

function joinModule(root: string, path: string): string {
  const { path: pathname, search } = splitHref(path);
  const leaf = pathname.replace(/^\//, '');
  const base = root.replace(/\/$/, '');
  const href = leaf ? `${base}/${leaf}` : base;
  return search ? `${href}?${search}` : href;
}

function withRole(href: string, role: string | undefined, preview: boolean): string {
  if (!preview || !role) return href;
  if (/[?&]role=/.test(href)) return href;
  const joiner = href.includes('?') ? '&' : '?';
  return `${href}${joiner}role=${encodeURIComponent(role)}`;
}

function capBlocks(caps: FlowCaps | undefined, needs: string | undefined): boolean {
  if (!needs || !caps) return false;
  return caps[needs] === false;
}

type ResolvedTarget = { href: string | null; reason: 'soon' | 'role' | 'preview' | 'here' | null };

function applyReachable(resolved: ResolvedTarget, input: ResolveAdvisorFlowInput): ResolvedTarget {
  if (!resolved.href) return resolved;
  if (input.reachable && !input.reachable(resolved.href)) return { href: null, reason: 'here' };
  if (!input.mapHref) return resolved;
  const next = input.mapHref(resolved.href);
  if (!next) return { href: null, reason: 'here' };
  return { href: next, reason: resolved.reason };
}

function resolveTarget(
  target: FlowTarget | null,
  def: AdvisorFlowDef,
  input: ResolveAdvisorFlowInput,
  hrefBase: string,
  preview: boolean,
  blocked: 'soon' | null
): ResolvedTarget {
  if (blocked === 'soon' || !target) return { href: null, reason: 'soon' };
  if (capBlocks(input.caps, target.needs)) return { href: null, reason: 'role' };
  if (preview) {
    if (target.scope === 'app') {
      if (!target.previewHref) return applyReachable({ href: null, reason: 'preview' }, input);
      return applyReachable({ href: withRole(target.previewHref, input.role, true), reason: null }, input);
    }
    const key = pathKey(target.path);
    if (!def.previewPaths.includes(key)) return applyReachable({ href: null, reason: 'preview' }, input);
    return applyReachable({ href: withRole(joinModule(hrefBase, target.path), input.role, true), reason: null }, input);
  }
  if (target.scope === 'app') return applyReachable({ href: target.path, reason: null }, input);
  return applyReachable({ href: joinModule(hrefBase, target.path), reason: null }, input);
}

function chipsFor(step: FlowStepDef, reason: ResolvedTarget['reason'], extra: readonly FlowChip[] | undefined): FlowChip[] {
  const chips: FlowChip[] = [];
  if (step.status === 'soon') chips.push({ id: 'soon', label: SOON_LABEL, tone: 'slate' });
  if (step.note && (step.status === 'partial' || step.status === 'soon' || step.status === 'live')) {
    const label = step.note;
    if (!(step.status === 'soon' && label === SOON_LABEL)) {
      chips.push({ id: 'note', label, tone: 'slate' });
    }
  }
  if (reason === 'role') chips.push({ id: 'role', label: ROLE_NOTE, tone: 'slate' });
  if (reason === 'preview') chips.push({ id: 'preview', label: PREVIEW_NOTE, tone: 'slate' });
  if (reason === 'here') chips.push({ id: 'here', label: HERE_NOTE, tone: 'slate' });
  if (extra) {
    for (const chip of extra) chips.push(chip);
  }
  return chips;
}

function toNode(step: FlowStepDef, def: AdvisorFlowDef, input: ResolveAdvisorFlowInput, hrefBase: string, preview: boolean): FlowNodeView {
  const blocked = step.status === 'soon' || step.to == null ? 'soon' : null;
  const primary = resolveTarget(step.to, def, input, hrefBase, preview, blocked === 'soon' ? 'soon' : null);
  const reason = step.status === 'soon' ? 'soon' : primary.reason;
  const href = step.status === 'soon' ? null : primary.href;
  const secondary: FlowSecondaryView[] = (step.secondary || []).map((target) => {
    const resolved = resolveTarget(target, def, input, hrefBase, preview, null);
    return {
      label: target.label,
      href: resolved.href,
      note: resolved.reason === 'role' ? ROLE_NOTE : resolved.reason === 'preview' ? PREVIEW_NOTE : resolved.reason === 'here' ? HERE_NOTE : null,
    };
  });
  const mine =
    (input.role != null && step.roles.includes(input.role)) ||
    (input.audience != null && (step.audiences || []).includes(input.audience));
  return {
    id: step.id,
    n: step.n,
    title: step.title,
    desc: step.desc,
    who: step.who,
    icon: step.icon,
    state: step.status,
    linkHref: href,
    chips: chipsFor(step, reason === 'soon' ? null : reason, input.chips?.[step.id]),
    mine,
    ariaLabel: stepAriaLabel(step, href, reason),
    secondary,
    note: step.note || null,
  };
}

export function resolveAdvisorFlow(def: AdvisorFlowDef, input: ResolveAdvisorFlowInput = {}): AdvisorFlowView {
  const hrefBase = (input.hrefBase || def.hrefRoot).replace(/\/$/, '');
  const preview = isPreviewBase(hrefBase);
  const known = input.role == null ? undefined : def.roles.find((item) => item.id === input.role);
  const counts = flowStatusCounts(def);
  const phases = def.phases.map((phase) => ({
    id: phase.id,
    title: phase.title,
    subtitle: phase.subtitle,
    steps: def.steps.filter((step) => step.phase === phase.id).map((step) => toNode(step, def, input, hrefBase, preview)),
  }));
  const around = def.around
    ? {
        title: def.around.title,
        links: def.around.links.map((target) => {
          const resolved = resolveTarget(target, def, input, hrefBase, preview, null);
          return {
            label: target.label,
            href: resolved.href,
            note: resolved.reason === 'role' ? ROLE_NOTE : resolved.reason === 'preview' ? PREVIEW_NOTE : resolved.reason === 'here' ? HERE_NOTE : null,
          };
        }),
      }
    : null;
  return {
    module: def.module,
    product: def.product,
    anchorId: def.anchorId,
    title: def.title,
    lead: def.lead,
    roleLabel: known ? `You are the ${known.label}` : null,
    phases,
    around,
    guardrails: def.guardrails.map((item) => ({ title: item.title, body: item.body })),
    outcome: def.outcome,
    counts,
    phaseCount: def.phases.length,
    srSummary: flowSrSummary(def),
    statusLine: flowStatusLine(counts),
  };
}
