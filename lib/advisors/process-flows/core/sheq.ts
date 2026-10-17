import { CORE_HREF_ROOT, flowRoleDefs } from '../core-caps';
import type { AdvisorFlowDef } from '../types';
import { flowStep, target } from './step';

const sheq = 'canViewSheq' as const;

export const SHEQ_FLOW: AdvisorFlowDef = {
  module: 'sheq',
  product: 'SupplierAdvisor®',
  anchorId: 'sheq-process-flow',
  title: 'SupplierAdvisor® from incident to closed action',
  lead: 'From an incident to a closed action. The cards on this page stay where they are.',
  hrefRoot: CORE_HREF_ROOT.sheq,
  previewRoot: null,
  previewPaths: [],
  roles: flowRoleDefs('sheq'),
  phases: [
    { id: 'report', title: 'Report and assess', subtitle: 'Record the incident and score the hazard' },
    { id: 'close', title: 'Fix and close', subtitle: 'Raise the non-conformance and close the action' },
  ],
  steps: [
    flowStep({
      id: 'incident',
      n: 1,
      phase: 'report',
      title: 'Report an incident',
      desc: 'Record an incident, a near miss or an injury.',
      status: 'live',
      icon: 'shield-check',
      needs: sheq,
      to: target('module', 'incidents', 'Incidents', sheq),
      sources: ['app/dashboard/sheq/incidents/page.tsx', 'app/api/sheq/incidents/route.ts'],
    }),
    flowStep({
      id: 'hazard',
      n: 2,
      phase: 'report',
      title: 'Assess a hazard',
      desc: 'Record a hazard, score it from likelihood and severity, and note the control.',
      status: 'live',
      icon: 'clipboard-check',
      needs: sheq,
      to: target('module', 'hazards', 'Hazards', sheq),
      sources: ['app/dashboard/sheq/hazards/page.tsx', 'app/api/sheq/hazards/route.ts'],
    }),
    flowStep({
      id: 'ncr',
      n: 3,
      phase: 'close',
      title: 'Raise a non-conformance',
      desc: 'Raise a non-conformance on this screen. A failed inspection raises a non-conformance as well, and opens a corrective action.',
      status: 'live',
      icon: 'clipboard-list',
      needs: sheq,
      to: target('module', 'ncrs', 'Non-conformances', sheq),
      secondary: [target('app', '/dashboard/quality/inspections', 'Inspections', sheq)],
      sources: ['app/dashboard/sheq/ncrs/page.tsx', 'lib/sheq/from-inspection.ts'],
    }),
    flowStep({
      id: 'capa',
      n: 4,
      phase: 'close',
      title: 'Close the corrective action',
      desc: 'Record the root cause, the corrective action and the preventive action. Setting the status to effective records the check time.',
      status: 'live',
      icon: 'clipboard-check',
      needs: sheq,
      to: target('module', 'capas', 'Corrective actions', sheq),
      sources: ['app/dashboard/sheq/capas/page.tsx', 'app/api/sheq/capas/route.ts'],
    }),
  ],
  guardrails: [
    {
      title: 'Score',
      body: 'A hazard stores likelihood and severity, and a score from them. This picture states no scale.',
      source: 'app/dashboard/sheq/hazards/page.tsx',
    },
    {
      title: 'Failed inspection',
      body: 'A failed inspection raises a non-conformance and opens a corrective action. You can also raise a non-conformance on this screen.',
      source: 'lib/sheq/from-inspection.ts',
    },
    {
      title: 'Close the action',
      body: 'A corrective action stores a root cause, a corrective action and a preventive action. Setting the status to effective records the check time.',
      source: 'app/api/sheq/capas/route.ts',
    },
  ],
  outcome: 'The incident and the hazard are recorded, the non-conformance is raised, and the action can be closed.',
};
