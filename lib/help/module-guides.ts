/**
 * How-to guides for every sidebar module.
 * Steps come from the process-flow definitions and from MODULE_NAV routes.
 * No sample company, no invented screen.
 */
import { ALL_FLOWS } from '@/lib/advisors/process-flows';
import type { AdvisorFlowDef, FlowStepDef, FlowTarget } from '@/lib/advisors/process-flows/types';
import {
  TEAM_ROLE_OPTIONS,
  canView,
  type PermissionResource,
} from '@/lib/business/permissions';
import { MODULE_NAV, type ModuleNav, type ModuleNavItem } from '@/lib/chrome/module-nav';
import {
  FLOW_GUARDRAILS,
  FLOW_OUTCOME,
  FLOW_PHASES,
  FLOW_STEPS,
} from '@/lib/recovery/process-flow';

export type GuideFeature = {
  id: string;
  name: string;
  href: string | null;
  summary: string;
  who: string;
  steps: string[];
};

export type GuideFaq = {
  q: string;
  a: string;
};

export type GuideNode = {
  id: string;
  label: string;
  hint?: string;
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
  outcome: string;
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

function titleCaseRole(label: string): string {
  return label
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function rolesForResource(resource: PermissionResource | undefined): string[] {
  if (!resource) return ['Anyone who can open the SupplierAdvisor® dashboard'];
  const labels = TEAM_ROLE_OPTIONS.filter((option) => canView(option.value, resource)).map(
    (option) => option.label
  );
  return labels.length ? labels : ['Owner'];
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

function stepsForFlow(step: FlowStepDef, hrefLabel: string): string[] {
  const steps = [`Open ${hrefLabel}.`];
  if (step.desc && !skippedCopy(step.desc)) steps.push(sentence(step.desc));
  if (step.note && step.note !== step.desc && !skippedCopy(step.note)) steps.push(sentence(step.note));
  if (step.status === 'soon') steps.push('This step is not open yet.');
  if (step.status === 'partial') steps.push('Part of this step is live. The note says what is still closed.');
  return steps;
}

function stepsForNav(step: ModuleNavItem): string[] {
  if (step.href === '/dashboard/intelligence/leadership-development') {
    return [
      'Open Lead from the sidebar.',
      'The screen is Super-Cube® training for the people who run the company.',
    ];
  }
  if (step.href === '/dashboard/suppliers/po' || step.href === '/dashboard/procurement/po') {
    return [
      'Open Order from the Suppliers sidebar.',
      'Raise a purchase order, receive it, and settle it on this screen.',
      '/dashboard/procurement and /dashboard/procurement/po both redirect here.',
      'The screen uses this company’s own orders. An empty list means no purchase order has been saved yet.',
    ];
  }
  const steps = [`Open ${step.name} from the sidebar.`];
  if (step.desc) steps.push(sentence(step.desc));
  if (step.group) steps.push(`This item is listed for the ${step.group} tools.`);
  steps.push('The screen uses this company’s own records. An empty list means nothing has been saved yet.');
  return steps;
}

const VAT201_FEATURE: GuideFeature = {
  id: 'vat201',
  name: 'Build and file the VAT201',
  href: '/dashboard/accounting/vat201',
  summary:
    'SupplierAdvisor® builds the SARS VAT201 from the posted ledger. It does not submit the return to SARS.',
  who: 'Owner, admin, or finance can edit the VAT settings. Filing and the settlement journal need accounting write access. The screen says only an owner or a finance user can file or post the settlement.',
  steps: [
    'Open VAT201 from Finance.',
    'Set the VAT number, the basis, the category, the effective date, and the first period end, then save. If those dates are blank, the return cannot be built until you enter them. SupplierAdvisor® does not invent a VAT number.',
    'Choose the tax period. The return is assembled from posted journals, invoices, and payments for that period.',
    'On the payment basis, VAT is due or claimable when cash is received or paid. The ledger still posts output VAT on the invoice date and input VAT on the bill date, so the return will not match accounts 1150 and 2120 until those invoices are paid.',
    'On the invoice basis, output VAT follows the invoice date and input VAT follows the bill date, including amounts that are still unpaid.',
    'On the hybrid basis, output VAT follows the invoice date and input VAT follows the cash date. Unpaid supplier bills stay out of input tax.',
    'Read the field list, the supporting pack, and the reconciliation. Copy a field with its Copy button. The clipboard value has no currency symbol.',
    'One push marks the return Reviewed, locks the months in the period, and opens SARS eFiling in a new tab. Copy each field into eFiling in order. SupplierAdvisor® cannot log in to SARS.',
    'SupplierAdvisor® does not submit the return. There is no public VAT201 API, and SupplierAdvisor® is not accredited as an Independent Software Vendor. The submit action stays off.',
    'After you have submitted on eFiling, record the eFiling reference and the submission date on this screen.',
    'When the payment has been made to SARS, confirm it and record the payment date. SupplierAdvisor® posts a settlement journal that clears 1150 and 2120 through 2125 and the bank account. It does not send the money.',
    'Leave diesel refund fields blank on eFiling unless a diesel refund is registered.',
    'If the period is not set, the screen says to set the VAT period. It does not fill the return with sample rows.',
  ],
};

function vatFaqs(): GuideFaq[] {
  return [
    {
      q: 'Does SupplierAdvisor® send the VAT201 to SARS?',
      a: 'No. SupplierAdvisor® opens eFiling and lets you copy the fields. It does not submit the return, and it never asks for a SARS username or password.',
    },
    {
      q: 'What happens when I mark the return Reviewed?',
      a: 'The return is locked, the months in the period are locked, and eFiling opens so you can copy the fields. Reopen is only available while the return is still Reviewed.',
    },
    {
      q: 'The VAT201 does not match account 1150 or 2120. What now?',
      a: 'On the payment basis the return follows cash, while those accounts follow the invoice or bill date. The reconciliation flags that difference. It is not a sample figure.',
    },
    {
      q: 'The VAT201 screen is empty. What now?',
      a: 'Enter the VAT effective date and a first period end that matches the category. Until then there is no return. The books are not filled with sample invoices.',
    },
    {
      q: 'A report shows no posted journals. What now?',
      a: 'The profit and loss, balance sheet, cash flow, and the other accounting reports stay empty for that period. Widen the dates, or post journals. They do not fall back to sample rows.',
    },
  ];
}

function featuresFromFlow(def: AdvisorFlowDef): GuideFeature[] {
  return def.steps
    .filter((step) => !skippedCopy(`${step.title} ${step.desc} ${step.note || ''}`))
    .map((step) => {
      const href = targetHref(def, step.to);
      const label = step.to?.label || step.title;
      return {
        id: step.id,
        name: step.title,
        href,
        summary: sentence(step.desc),
        who: step.who,
        steps: stepsForFlow(step, label),
      };
    });
}

function featuresFromNav(
  steps: readonly ModuleNavItem[],
  covered: Set<string>,
  who: string
): GuideFeature[] {
  const seen = new Set<string>();
  const features: GuideFeature[] = [];
  for (const step of steps) {
    const key = `${step.group || ''}|${step.href}|${step.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!step.group && covered.has(step.href.split('?')[0])) continue;
    features.push({
      id: key,
      name: step.group ? `${step.name} · ${step.group}` : step.name,
      href: step.href,
      summary: step.desc ? sentence(step.desc) : `Open ${step.name}.`,
      who: step.group ? `${step.group} tools` : who,
      steps: stepsForNav(step),
    });
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
  const features: GuideFeature[] = FLOW_STEPS.map((step) => ({
    id: step.id,
    name: step.title,
    href: step.href,
    summary: sentence(step.desc),
    who: step.who,
    steps: [
      step.href ? `Open ${step.title}.` : `${step.title} has no screen yet.`,
      sentence(step.desc),
      step.soonNote ? sentence(step.soonNote) : '',
      step.status === 'soon' ? 'This step is not open yet.' : '',
    ].filter(Boolean),
  }));
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

function buildOne(mod: ModuleNav): ModuleGuide {
  if (mod.id === 'recovergraph') return buildRecoverGuide(mod);
  const name = proseName(mod);
  const flow = ALL_FLOWS[mod.id as keyof typeof ALL_FLOWS] ?? null;
  const fromFlow = flow ? featuresFromFlow(flow) : [];
  const covered = new Set(
    fromFlow.map((feature) => feature.href?.split('?')[0]).filter((href): href is string => Boolean(href))
  );
  const roles = flow
    ? flow.roles.map((role) => titleCaseRole(role.label))
    : rolesForResource(mod.resource);
  let features = [...fromFlow, ...featuresFromNav(mod.steps, covered, roles.join(', '))];
  if (mod.id === 'accounting') {
    features = features.filter((feature) => feature.href?.split('?')[0] !== '/dashboard/accounting/vat201');
    const taxAt = features.findIndex((feature) => feature.id === 'tax');
    features.splice(taxAt >= 0 ? taxAt + 1 : features.length, 0, VAT201_FEATURE);
  }
  const purpose = flow?.lead
    ? `${name} in SupplierAdvisor®. ${sentence(flow.lead)}`
    : PURPOSE[mod.id] || `${name} is a workspace in SupplierAdvisor®. The steps below are the screens in the sidebar.`;
  const faqs = [
    emptyFaq(name),
    ...(flow ? faqsFromGuardrails(flow.guardrails) : []),
    ...(mod.id === 'accounting' ? vatFaqs() : []),
  ];
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

export const MODULE_GUIDES: readonly ModuleGuide[] = MODULE_NAV.map(buildOne);

export function getModuleGuide(id: string): ModuleGuide | null {
  return MODULE_GUIDES.find((guide) => guide.id === id) ?? null;
}
