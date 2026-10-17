import { APPARELGRAPH_FLOW } from './apparelgraph';
import { CONSTRUCTIONGRAPH_FLOW } from './constructiongraph';
import { CONTAINERS_FLOW } from './containers';
import { CORE_FLOWS } from './core';
import { FLEETGRAPH_FLOW } from './fleetgraph';
import { HEALTH_FLOW } from './health';
import { TRADEGRAPH_FLOW } from './tradegraph';
import type { AdvisorFlowDef, AdvisorFlowModuleId, AdvisorModuleId, CoreFlowModuleId } from './types';

/**
 * One entry per module that uses the shared flow.
 * Adding a module is a data file plus one line here, then one mount.
 * recovergraph stays off this map. It has its own diagram.
 */
export const ADVISOR_FLOWS: Partial<Record<AdvisorModuleId, AdvisorFlowDef>> = {
  tradegraph: TRADEGRAPH_FLOW,
  constructiongraph: CONSTRUCTIONGRAPH_FLOW,
  fleetgraph: FLEETGRAPH_FLOW,
  apparelgraph: APPARELGRAPH_FLOW,
  containers: CONTAINERS_FLOW,
  health: HEALTH_FLOW,
};

export { CORE_FLOWS };

export const ALL_FLOWS: Partial<Record<AdvisorFlowModuleId, AdvisorFlowDef>> = {
  ...ADVISOR_FLOWS,
  ...CORE_FLOWS,
};

export function getCoreFlow(id: CoreFlowModuleId): AdvisorFlowDef | null {
  return CORE_FLOWS[id] ?? null;
}

export function getAdvisorFlow(id: AdvisorFlowModuleId): AdvisorFlowDef | null {
  return ALL_FLOWS[id] ?? null;
}

export { FLOW_BRAND } from './brand';
export {
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
