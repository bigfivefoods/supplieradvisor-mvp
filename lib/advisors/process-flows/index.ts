import { APPARELGRAPH_FLOW } from './apparelgraph';
import { CONSTRUCTIONGRAPH_FLOW } from './constructiongraph';
import { FLEETGRAPH_FLOW } from './fleetgraph';
import { TRADEGRAPH_FLOW } from './tradegraph';
import type { AdvisorFlowDef, AdvisorFlowModuleId } from './types';

/**
 * One entry per module that uses the shared flow.
 * Adding a module is a data file plus one line here, then one mount.
 * recovergraph stays off this map. It has its own diagram.
 */
export const ADVISOR_FLOWS: Partial<Record<AdvisorFlowModuleId, AdvisorFlowDef>> = {
  tradegraph: TRADEGRAPH_FLOW,
  constructiongraph: CONSTRUCTIONGRAPH_FLOW,
  fleetgraph: FLEETGRAPH_FLOW,
  apparelgraph: APPARELGRAPH_FLOW,
};

export function getAdvisorFlow(id: AdvisorFlowModuleId): AdvisorFlowDef | null {
  return ADVISOR_FLOWS[id] ?? null;
}

export { FLOW_BRAND } from './brand';
export {
  flowDefaultOpen,
  flowSrSummary,
  flowStatusCounts,
  flowStatusLine,
  resolveAdvisorFlow,
  stepAriaLabel,
} from './resolve';
export type {
  AdvisorFlowDef,
  AdvisorFlowModuleId,
  AdvisorFlowView,
  FlowCaps,
  FlowChip,
  FlowIconName,
  FlowNodeView,
  FlowStatus,
  FlowTarget,
  ResolveAdvisorFlowInput,
} from './types';
