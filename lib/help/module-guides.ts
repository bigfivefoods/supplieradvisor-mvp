/**
 * How-to guides for every sidebar module.
 * Priority modules are written from the screens and the server checks.
 * The remaining modules use the process-flow and sidebar labels, and never
 * repeat the one-line summary as a step.
 */
import { ALL_FLOWS } from '@/lib/advisors/process-flows';
import type { AdvisorFlowDef, FlowStepDef, FlowTarget } from '@/lib/advisors/process-flows/types';
import { resourceLabel, type PermissionResource } from '@/lib/business/permissions';
import { MODULE_NAV, type ModuleNav, type ModuleNavItem } from '@/lib/chrome/module-nav';
import { ACCOUNTING_GUIDE } from '@/lib/help/guides/accounting';
import { CUSTOMERS_GUIDE } from '@/lib/help/guides/customers';
import { GYM_GUIDE } from '@/lib/help/guides/gym';
import { INVENTORY_GUIDE } from '@/lib/help/guides/inventory';
import { PEOPLE_GUIDE } from '@/lib/help/guides/people';
import { SALES_GUIDE } from '@/lib/help/guides/sales';
import { SUPPLIERS_GUIDE } from '@/lib/help/guides/suppliers';
import { TRADE_GUIDE } from '@/lib/help/guides/trade';
import { gateMessage, viewRoleLabels } from '@/lib/help/roles';
import type { GuideError, GuideFaq, GuideFeature, GuideNode, ModuleGuide } from '@/lib/help/types';
import {
  FLOW_GUARDRAILS,
  FLOW_OUTCOME,
  FLOW_PHASES,
  FLOW_STEPS,
} from '@/lib/recovery/process-flow';

export type { GuideError, GuideFaq, GuideFeature, GuideNode, ModuleGuide };

const HAND: Record<string, ModuleGuide> = {
  accounting: ACCOUNTING_GUIDE,
  tradegraph: TRADE_GUIDE,
  fitgraph: GYM_GUIDE,
  suppliers: SUPPLIERS_GUIDE,
  customers: CUSTOMERS_GUIDE,
  inventory: INVENTORY_GUIDE,
  people: PEOPLE_GUIDE,
  'sales-portal': SALES_GUIDE,
};

const PROSE_NAME: Record<string, string> = {
  apparelgraph: 'ApparelAdvisor®',
  containers: 'ContainerAdvisor®',
  constructiongraph: 'ConstructionAdvisor®',
  dentalgraph: 'DentalAdvisor®',
  fieldgraph: 'CropAdvisor®',
  fitgraph: 'GymAdvisor®',
  fleetgraph: 'FleetAdvisor®',
  health: 'HealthAdvisor®',
  hiregraph: 'HireAdvisor®',
  medicalgraph: 'MedicalAdvisor®',
  physiograph: 'PhysioAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
  quarrygraph: 'QuarryAdvisor®',
  recovergraph: 'RecoverAdvisor®',
  retailgraph: 'RetailAdvisor®',
  schools: 'SchoolAdvisor®',
  tradegraph: 'TradeAdvisor®',
  vetgraph: 'VetAdvisor®',
};

const PURPOSE: Record<string, string> = {
  platform:
    'The SupplierAdvisor® admin console. It covers system health, companies, members, government activation, and referral operations.',
  'my-business':
    'The company command tower in SupplierAdvisor®. It holds the legal profile, the team, trust, documents, and which modules are switched on.',
  operations:
    'The operations chain in SupplierAdvisor®, from inbound goods through the warehouse and production to outbound fulfilment, plus exceptions.',
  intelligence:
    'Insights in SupplierAdvisor®: the pulse, forecasts, scorecards, and Super-Cube® leadership training.',
  fieldgraph:
    'CropAdvisor® for fields, estimates, harvest planning, inputs, labour, regen, and mill trade.',
  quarrygraph:
    'QuarryAdvisor® for quarries, faces, reserves, production, plant, dispatch, and compliance.',
  fitgraph:
    'GymAdvisor® for the member book, classes, the floor, debit orders, and the member app.',
  physiograph:
    'PhysioAdvisor® for practitioners, patients, the diary, claims, and the patient app.',
  dentalgraph:
    'DentalAdvisor® for the practice diary, patients, claims, and the patient app.',
  psychiatrygraph:
    'PsychiatryAdvisor® for practitioners, patients, the diary, claims, and the patient app.',
  medicalgraph:
    'MedicalAdvisor® for practitioners, patients, tasks, claims, and the patient app.',
  vetgraph:
    'VetAdvisor® for vets, clients and their animals, the diary, claims, and the client app.',
  hiregraph:
    'HireAdvisor® for the hire catalogue, bookings, handover, and settlements.',
  retailgraph:
    'RetailAdvisor® for the till, the catalogue, paid baskets, and the shopper app.',
  schools:
    'SchoolAdvisor® for a department, a school, and a service provider working the same feeding programme.',
  guide:
    'The training curriculum already inside SupplierAdvisor®. This how-to follows the sidebar, one module at a time.',
};

function proseName(mod: { id: string; name: string }): string {
  return PROSE_NAME[mod.id] || mod.name;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function norm(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '');
}

function distinct(summary: string, steps: string[]): string[] {
  const target = norm(summary);
  const out = steps.map((step) => step.trim()).filter((step) => step && norm(step) !== target);
  if (!out.length) {
    out.push('Use the labelled controls on this screen. Save only when the required fields are filled.');
  }
  return out;
}

function titleCaseRole(label: string): string {
  return label
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function rolesForResource(resource: PermissionResource | undefined): string[] {
  if (!resource) return ['Anyone who can open the SupplierAdvisor® dashboard'];
  const labels = viewRoleLabels(resource);
  return labels.length ? labels : ['Owner'];
}

function whoLine(resource: PermissionResource | undefined, fallback: string): string {
  if (!resource) return fallback;
  const labels = rolesForResource(resource);
  return `${labels.join(', ')} can open this module. Anyone else sees “${gateMessage(resource)}”.`;
}

function joinModule(root: string, path: string): string {
  const hashless = path.split('#')[0] || '';
  const queryAt = hashless.indexOf('?');
  const pathname = queryAt === -1 ? hashless : hashless.slice(0, queryAt);
  const search = queryAt === -1 ? '' : hashless.slice(queryAt);
  const leaf = pathname.replace(/^\//, '');
  const base = root.replace(/\/$/, '');
  return `${leaf ? `${base}/${leaf}` : base}${search}`;
}

function targetHref(def: AdvisorFlowDef, target: FlowTarget | null): string | null {
  if (!target) return null;
  if (target.path.startsWith('/')) return target.path;
  if (target.scope === 'app') return `/${target.path.replace(/^\//, '')}`;
  return joinModule(def.hrefRoot, target.path);
}

function skippedCopy(text: string): boolean {
  return /kwaden|sample company|fixture book|demo-data|acme|harbour grocers/i.test(text);
}

function gateError(resource: PermissionResource | undefined): GuideError {
  if (!resource) {
    return {
      message: 'You do not have access to this area.',
      fix: 'Sign in on a company role that can open the dashboard.',
    };
  }
  return {
    message: gateMessage(resource),
    fix: 'Ask an owner to change your team role, or open a module that role can view.',
  };
}

function stepsForFlow(step: FlowStepDef, hrefLabel: string): string[] {
  const steps = [`Open ${hrefLabel} from the sidebar.`];
  if (step.secondary?.length) {
    steps.push(`This step also opens ${step.secondary.map((item) => item.label).join(', ')}.`);
  }
  if (step.note && !skippedCopy(step.note)) steps.push(sentence(step.note));
  if (step.status === 'soon') steps.push('This step is not open yet.');
  else if (step.status === 'partial') steps.push('Part of this step is live. The note says what is still closed.');
  else {
    steps.push(
      `Stay on ${hrefLabel}. An empty screen means nothing has been saved for this company yet.`
    );
  }
  if (step.who) steps.push(`The process names ${step.who} for this step. The role check above is what actually opens the screen.`);
  return steps;
}

function stepsForNav(step: ModuleNavItem): string[] {
  if (step.href === '/dashboard/intelligence/leadership-development') {
    return [
      'Open Lead from the Insights sidebar.',
      'The screen is Super-Cube® training for the people who run the company.',
      'It does not post a journal and it does not file a return.',
    ];
  }
  const where = step.section ? ` in ${step.section}` : '';
  const steps = [`Open ${step.name} from the sidebar${where}.`];
  if (step.group) steps.push(`This item is listed for the ${step.group} tools.`);
  steps.push('Work stays on the company you have open. An empty list means nothing has been saved on this screen yet.');
  return steps;
}

function featureShell(
  partial: Omit<GuideFeature, 'steps' | 'prerequisites' | 'behind' | 'errors' | 'faqs'> & {
    steps: string[];
    resource?: PermissionResource;
    prerequisites?: string[];
    behind?: string[];
    errors?: GuideError[];
    faqs?: GuideFaq[];
    note?: string;
  }
): GuideFeature {
  const prerequisites = partial.prerequisites?.length
    ? partial.prerequisites
    : ['Open the company this work belongs to.', partial.resource ? `Your role must be allowed to view ${resourceLabel(partial.resource)}.` : 'You need access to the dashboard.'];
  const behind = partial.behind?.length
    ? partial.behind
    : [partial.note || 'The screen reads and saves this company’s own records. It does not fill the list when nothing has been saved.'];
  return {
    id: partial.id,
    name: partial.name,
    href: partial.href,
    summary: partial.summary,
    who: partial.who,
    prerequisites,
    steps: distinct(partial.summary, partial.steps),
    behind: (() => {
    const lines = behind.filter((line) => line.trim() && norm(line) !== norm(partial.summary));
    return lines.length ? lines : ['This screen uses the company you have open.'];
  })(),
    errors: partial.errors?.length ? partial.errors : [gateError(partial.resource)],
    faqs: partial.faqs?.length
      ? partial.faqs
      : [
          {
            q: `${partial.name} looks empty. What now?`,
            a: 'Nothing has been saved for this company on that screen. Enter the first record, or open a period that already has work. The screen is not filled with sample rows.',
          },
        ],
  };
}

function featuresFromFlow(def: AdvisorFlowDef, resource: PermissionResource | undefined): GuideFeature[] {
  return def.steps
    .filter((step) => !skippedCopy(`${step.title} ${step.desc} ${step.note || ''}`))
    .map((step) => {
      const href = targetHref(def, step.to);
      const label = step.to?.label || step.title;
      const summary = sentence(step.desc);
      return featureShell({
        id: step.id,
        name: step.title,
        href,
        summary,
        who: `${step.who}. ${whoLine(resource, 'Anyone who can open this module.')}`,
        resource,
        steps: stepsForFlow(step, label),
        note: step.note ? sentence(step.note) : undefined,
        behind: [
          step.status === 'soon'
            ? 'This step is marked not open yet.'
            : step.status === 'partial'
              ? 'Part of this step is live.'
              : `This step is live on ${label}.`,
          step.note ? sentence(step.note) : `Saving writes this company’s record for ${step.title}.`,
        ],
      });
    });
}

function featuresFromNav(
  steps: readonly ModuleNavItem[],
  covered: Set<string>,
  who: string,
  resource: PermissionResource | undefined
): GuideFeature[] {
  const seen = new Set<string>();
  const features: GuideFeature[] = [];
  for (const step of steps) {
    const key = `${step.group || ''}|${step.href}|${step.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!step.group && covered.has(step.href.split('?')[0])) continue;
    const summary = step.desc ? sentence(step.desc) : `${step.name} is a screen in this module.`;
    features.push(
      featureShell({
        id: key,
        name: step.group ? `${step.name} · ${step.group}` : step.name,
        href: step.href,
        summary,
        who: step.group ? `${step.group} tools. ${who}` : who,
        resource,
        steps: stepsForNav(step),
      })
    );
  }
  return features;
}

function flowNodes(def: AdvisorFlowDef, features: GuideFeature[]): GuideNode[] {
  if (def.phases.length) {
    return def.phases.map((phase) => ({
      id: phase.id,
      label: phase.title,
      hint: phase.subtitle,
    }));
  }
  return features.slice(0, 8).map((feature) => ({
    id: feature.id,
    label: feature.name,
  }));
}

function navNodes(steps: readonly ModuleNavItem[]): GuideNode[] {
  const sections: GuideNode[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    const id = step.section || step.name;
    if (seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, label: id, hint: step.name });
  }
  if (sections.length) return sections.slice(0, 10);
  return steps.slice(0, 8).map((step) => ({ id: step.href, label: step.name, hint: step.desc }));
}

function faqsFromGuardrails(rows: readonly { title: string; body: string }[]): GuideFaq[] {
  return rows
    .filter((row) => !skippedCopy(`${row.title} ${row.body}`))
    .map((row) => ({ q: `What if ${row.title.replace(/\?$/, '')}?`, a: sentence(row.body) }));
}

function emptyFaq(name: string): GuideFaq {
  return {
    q: `${name} looks empty. What now?`,
    a: `Nothing has been saved for this company on that screen. SupplierAdvisor® does not fill ${name} with sample rows. Enter the first record, or open a period that already has posted work.`,
  };
}

function buildRecoverGuide(mod: ModuleNav): ModuleGuide {
  const name = proseName(mod);
  const who = 'Owner, Manager, Agent, Finance, and Compliance, as named on each step. RecoverAdvisor® gives no legal advice.';
  const features: GuideFeature[] = FLOW_STEPS.map((step) => {
    const summary = sentence(step.desc);
    return featureShell({
      id: step.id,
      name: step.title,
      href: step.href,
      summary,
      who: `${step.who}. ${who}`,
      steps: [
        step.href ? `Open ${step.title}.` : `${step.title} has no screen yet.`,
        step.soonNote ? sentence(step.soonNote) : '',
        step.status === 'soon' ? 'This step is not open yet.' : 'Save against the placement you have open.',
      ].filter(Boolean),
      behind: [
        step.status === 'soon' ? 'This step is marked not open yet.' : `${step.title} is ${step.status} on the collection desk.`,
        'RecoverAdvisor® gives no legal advice.',
      ],
      errors: [
        {
          message: gateMessage('recovery'),
          fix: 'Ask an owner for a role that can open RecoverAdvisor®.',
        },
      ],
      faqs: [
        {
          q: `Who is named for ${step.title}?`,
          a: step.who,
        },
      ],
    });
  });
  return {
    id: mod.id,
    name,
    href: mod.href,
    purpose: `${name} is the collection desk in SupplierAdvisor®. ${FLOW_OUTCOME} ${name} gives no legal advice.`,
    roles: ['Owner', 'Manager', 'Agent', 'Finance', 'Compliance'],
    features,
    faqs: [emptyFaq(name), ...faqsFromGuardrails(FLOW_GUARDRAILS)],
    flow: FLOW_PHASES.map((phase) => ({ id: phase.id, label: phase.title, hint: phase.subtitle })),
    outcome: FLOW_OUTCOME,
  };
}

function buildGenerated(mod: ModuleNav): ModuleGuide {
  const name = proseName(mod);
  const flow = ALL_FLOWS[mod.id as keyof typeof ALL_FLOWS] ?? null;
  const resource = mod.resource;
  const fromFlow = flow ? featuresFromFlow(flow, resource) : [];
  const covered = new Set(
    fromFlow.map((feature) => feature.href?.split('?')[0]).filter((href): href is string => Boolean(href))
  );
  const roles = flow ? flow.roles.map((role) => titleCaseRole(role.label)) : rolesForResource(resource);
  const who = whoLine(resource, roles.join(', '));
  const features = [...fromFlow, ...featuresFromNav(mod.steps, covered, who, resource)];
  const purpose = flow?.lead
    ? `${name} in SupplierAdvisor®. ${sentence(flow.lead)}`
    : PURPOSE[mod.id] || `${name} is a workspace in SupplierAdvisor®. The steps below are the screens in the sidebar.`;
  const faqs = [emptyFaq(name), ...(flow ? faqsFromGuardrails(flow.guardrails) : [])];
  return {
    id: mod.id,
    name,
    href: mod.href,
    purpose,
    roles,
    features,
    faqs,
    flow: flow ? flowNodes(flow, features) : navNodes(mod.steps),
    outcome: flow?.outcome || `You can move through ${name} from the sidebar without leaving SupplierAdvisor®.`,
  };
}

function buildOne(mod: ModuleNav): ModuleGuide {
  if (mod.id === 'recovergraph') return buildRecoverGuide(mod);
  return HAND[mod.id] ?? buildGenerated(mod);
}

export const MODULE_GUIDES: readonly ModuleGuide[] = MODULE_NAV.map(buildOne);

export function getModuleGuide(id: string): ModuleGuide | null {
  return MODULE_GUIDES.find((guide) => guide.id === id) ?? null;
}
