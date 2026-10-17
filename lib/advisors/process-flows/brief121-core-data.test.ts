/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-data.test.ts
 * Pins core flow copy, statuses, caps and write-role chips.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CORE_CAP_KEYS, flowRoleDefs } from './core-caps';
import { CORE_FLOWS } from './core';
import { FLOW_ICON_NAMES, type AdvisorFlowDef, type CoreFlowModuleId, type FlowStepDef } from './types';

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand',
];
const SPELLED_COUNT_ALLOW = ['one desk', 'one picture', 'one place', 'one diary entry'];
const spelledCount = new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\s+[A-Za-z]`, 'i');
const spelledPercent = new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\s+percent\\b`, 'i');

function hasSpelledCount(line: string): boolean {
  let rest = line;
  for (const phrase of SPELLED_COUNT_ALLOW) rest = rest.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), ' ');
  return spelledCount.test(rest);
}

function visibleLines(flow: AdvisorFlowDef): string[] {
  const lines = [flow.product, flow.title, flow.lead, flow.outcome];
  for (const phase of flow.phases) lines.push(phase.title, phase.subtitle);
  for (const role of flow.roles) lines.push(role.label);
  for (const step of flow.steps) {
    lines.push(step.title, step.desc, step.who);
    if (step.note) lines.push(step.note);
    if (step.to) lines.push(step.to.label);
    for (const extra of step.secondary || []) lines.push(extra.label);
  }
  for (const guard of flow.guardrails) lines.push(guard.title, guard.body);
  return lines;
}

const PINNED: Record<CoreFlowModuleId, { lead: string; outcome: string; guardrails: { title: string; body: string }[] }> = {
  home: {
    lead: 'Follow a supplier from the first connection to a recorded payment and a score. The setup checklist on this page stays where it is.',
    outcome: 'The supplier is on the book, the order is received into stock, the bill and the payment are recorded, and the supplier is scored.',
    guardrails: [
      {
        title: 'Recorded, not sent',
        body: 'A supplier bill and a payment are recorded in the books. Neither screen sends money from a bank.',
      },
      {
        title: 'Finance screens',
        body: 'The bill, the payment and the bank match open for the owner and for finance. Another role can read the step and does not get the link.',
      },
      {
        title: 'Receive into stock',
        body: 'Goods are received on the purchase order desk or by a stock scan. This chain has no separate goods-received document.',
      },
      {
        title: 'Advisor home',
        body: 'Finance and a sales contractor stay on Control Tower. Another role with an Advisor home is sent there. This chain is on the core command page only.',
      },
    ],
  },
  suppliers: {
    lead: 'The life of a supplier, from the first search to a score and a report. The journey checklist on this page stays where it is.',
    outcome: 'The supplier is on the book, documents and orders are in place, and the score and the report are ready to read.',
    guardrails: [
      {
        title: 'Document vault',
        body: 'The supplier document vault stores a record and a pasted file link. It does not store the file. The contracts screen only opens that vault.',
      },
      {
        title: 'Portal link',
        body: 'The supplier portal screen issues a link for a supplier on the book.',
      },
      {
        title: 'Risk log',
        body: 'A risk, issue, action or decision is logged against a supplier from the register.',
      },
      {
        title: 'Supplier book',
        body: 'The supplier book is the network screen. The profiles address only opens that screen.',
      },
    ],
  },
  customers: {
    lead: 'From a lead to cash collected, beside the path strip on this page. The path strip stays where it is.',
    outcome: 'A customer is on the book, the quote becomes an order and an invoice, and the account is there to read.',
    guardrails: [
      {
        title: 'Pipeline tab',
        body: 'The pipeline step opens the leads screen with the pipeline tab. That screen reads the tab from the address.',
      },
      {
        title: 'Diary gate',
        body: 'The diary link follows the sales portal rule. A role that can open Customers may still see that step without the link.',
      },
      {
        title: 'Customer book',
        body: 'The customer book is the profiles screen. The search address only opens that screen.',
      },
      {
        title: 'Account view',
        body: 'The account screen shows identity, memberships, invoices, the last visit and activity. Ratings are a separate screen.',
      },
    ],
  },
  'sales-portal': {
    lead: 'The contractor workspace, from the agreement to earnings. Nothing here states a rate or a price.',
    outcome: 'The agreement is signed when the role needs it, the sale is quoted and invoiced, and earnings are on the screen.',
    guardrails: [
      {
        title: 'Agreement',
        body: 'A sales contractor and sales sign the agreement on this screen. The owner, an admin and finance open the portal without that signature.',
      },
      {
        title: 'Subscription',
        body: 'A sales contractor and sales start the paid subscription on this screen after the free period. The owner, an admin and finance are not sent to checkout.',
      },
      {
        title: 'No rate on this picture',
        body: 'Earnings show projected, earned and paid commission from the portal. This picture does not state a rate.',
      },
      {
        title: 'Same document desk',
        body: 'Quote, order and invoice on this portal open the document desk in the sales portal.',
      },
    ],
  },
  manufacturing: {
    lead: 'From a bill of materials to a costed batch. The module cards on this page stay where they are.',
    outcome: 'The bill is defined, the schedule is firmed, materials are netted, the work order is run, and cost is on the centre.',
    guardrails: [
      {
        title: 'Suggestions only',
        body: 'A material run suggests make and buy. It does not raise a purchase order.',
      },
      {
        title: 'Work order stock',
        body: 'Completing a work order posts finished stock only when the order has a product and a warehouse is available. The warehouse is the location sent with the completion, or else a company warehouse. Bill components are posted out of stock when the order has a bill.',
      },
      {
        title: 'Labour rate',
        body: 'Labour on a completed work order uses the station rate when that rate is set, and otherwise the cell rate. Nothing is recorded when neither rate is set. The cost screen shows those expenses with stations and assets.',
      },
    ],
  },
  distribution: {
    lead: 'From the commercial terms and the carrier roster to a tracked shipment. Proof of delivery is not captured yet. The module cards on this page stay where they are.',
    outcome: 'Commercial terms, carriers and vehicles are set, shipments are booked, and movement is in the event log.',
    guardrails: [
      {
        title: 'Purchase order text',
        body: 'A purchase-order reference on a shipment is free text. It is not a link to the purchase order.',
      },
      {
        title: 'Proof of delivery',
        body: 'Delivered is an event label. The log stores no signature and no photo.',
      },
      {
        title: 'Events',
        body: 'Advancing a shipment writes an event. The tracking screen reads that log.',
      },
    ],
  },
  inventory: {
    lead: 'From the catalogue to a counted stock position. The module cards on this page stay where they are.',
    outcome: 'Products and sites are set, stock is received and moved, and the count and the report are ready to read.',
    guardrails: [
      {
        title: 'Catalogue',
        body: 'The product catalogue is the products screen. The finished-goods and raw-materials addresses open a stock filter, not this catalogue.',
      },
      {
        title: 'Transfer hold',
        body: 'Shipping a transfer is refused when a line carries a lot number and that lot has an open or failed inspection. A line with no lot number is not checked. Only the owner or an admin can override that block, and the override is logged. Any error from the inspection query lets the transfer ship. On the signed-out preview, the transfer link opens the live stock screen. The signed-in link stays on transfers.',
      },
      {
        title: 'Scan still receives',
        body: 'A scan receive still receives the lot. The response carries a warning when that lot already has an open or failed inspection. The screen does not show that warning yet.',
      },
      {
        title: 'Counts',
        body: 'A count posts a changed quantity back to the amount on hand. The cycle-count address opens the count history, and the stock-take address opens this same screen.',
      },
    ],
  },
  quality: {
    lead: 'From an inspection to a traced lot. The path cards on this page stay where they are.',
    outcome: 'A lot is inspected, the plan and the monitoring are logged, and the trace and the drill are there to read.',
    guardrails: [
      {
        title: 'Hold on a transfer',
        body: 'An open or failed inspection blocks shipping a transfer line that carries that lot number. A line with no lot number is not checked. Any error from the inspection query lets the transfer ship. Only the owner or an admin can override the block, and the override is logged. A scan receive is not blocked, and the scan screen does not show the warning.',
      },
      {
        title: 'Failed inspection',
        body: 'A failed inspection raises a non-conformance and opens a corrective action. An open inspection does not.',
      },
      {
        title: 'Operating log',
        body: 'HACCP stores a plan, control points and monitoring logs. It does not issue a certificate.',
      },
      {
        title: 'Recall drill',
        body: 'The recall screen searches a lot and shows stock, inspections and monitoring. It does not run a recall.',
      },
      {
        title: 'Export',
        body: 'The regulatory screen downloads operating records as JSON and opens a print view. It is not a submission.',
      },
    ],
  },
  sheq: {
    lead: 'From an incident to a closed action. The cards on this page stay where they are.',
    outcome: 'The incident and the hazard are recorded, the non-conformance is raised, and the action can be closed.',
    guardrails: [
      {
        title: 'Score',
        body: 'A hazard stores likelihood and severity, and a score from them. This picture states no scale.',
      },
      {
        title: 'Failed inspection',
        body: 'A failed inspection raises a non-conformance and opens a corrective action. You can also raise a non-conformance on this screen.',
      },
      {
        title: 'Close the action',
        body: 'A corrective action stores a root cause, a corrective action and a preventive action. Setting the status to effective records the check time.',
      },
    ],
  },
};

const STATUS: Record<CoreFlowModuleId, Record<string, FlowStepDef['status']>> = {
  home: { supplier: 'live', po: 'live', receive: 'live', bill: 'live', payment: 'live', bank: 'live', score: 'live' },
  suppliers: {
    discover: 'live', add: 'live', network: 'live', documents: 'partial', po: 'live',
    portal: 'live', performance: 'live', risks: 'live', report: 'live',
  },
  customers: {
    book: 'live', leads: 'live', pipeline: 'live', diary: 'live', quote: 'live',
    order: 'live', invoice: 'live', collect: 'live', account: 'live',
  },
  'sales-portal': {
    agreement: 'live', pipeline: 'live', diary: 'live', quote: 'live', order: 'live',
    invoice: 'live', earnings: 'live', subscribe: 'live',
  },
  manufacturing: { bom: 'live', mps: 'live', mrp: 'partial', orders: 'live', cells: 'live', cost: 'live' },
  distribution: {
    incoterms: 'live', carriers: 'live', fleet: 'live', inbound: 'live', outbound: 'live',
    tracking: 'live', pod: 'soon',
  },
  inventory: {
    products: 'live', sites: 'live', scan: 'partial', stock: 'live', transfer: 'live',
    count: 'live', report: 'live', storefront: 'live',
  },
  quality: { inspect: 'live', haccp: 'live', trace: 'live', drill: 'partial', pack: 'partial' },
  sheq: { incident: 'live', hazard: 'live', ncr: 'live', capa: 'live' },
};

const NEEDS: Record<CoreFlowModuleId, Record<string, string>> = {
  home: {
    supplier: 'canViewSuppliers', po: 'canViewSuppliers', receive: 'canViewSuppliers',
    bill: 'canViewAccounting', payment: 'canViewAccounting', bank: 'canViewAccounting', score: 'canViewSuppliers',
  },
  suppliers: {
    discover: 'canViewSuppliers', add: 'canViewSuppliers', network: 'canViewSuppliers',
    documents: 'canViewSuppliers', po: 'canViewSuppliers', portal: 'canViewSuppliers',
    performance: 'canViewSuppliers', risks: 'canViewSuppliers', report: 'canViewSuppliers',
  },
  customers: {
    book: 'canViewCustomers', leads: 'canViewCustomers', pipeline: 'canViewCustomers',
    diary: 'canUseSalesPortal', quote: 'canViewCustomers', order: 'canViewCustomers',
    invoice: 'canViewCustomers', collect: 'canViewCustomers', account: 'canViewCustomers',
  },
  'sales-portal': {
    agreement: 'canUseSalesPortal', pipeline: 'canUseSalesPortal', diary: 'canUseSalesPortal',
    quote: 'canUseSalesPortal', order: 'canUseSalesPortal', invoice: 'canUseSalesPortal',
    earnings: 'canUseSalesPortal', subscribe: 'canUseSalesPortal',
  },
  manufacturing: {
    bom: 'canViewManufacturing', mps: 'canViewManufacturing', mrp: 'canViewManufacturing',
    orders: 'canViewManufacturing', cells: 'canViewManufacturing', cost: 'canViewManufacturing',
  },
  distribution: {
    incoterms: 'canViewDistribution', carriers: 'canViewDistribution', fleet: 'canViewDistribution',
    inbound: 'canViewDistribution', outbound: 'canViewDistribution', tracking: 'canViewDistribution',
    pod: 'canViewDistribution',
  },
  inventory: {
    products: 'canViewInventory', sites: 'canViewInventory', scan: 'canViewInventory',
    stock: 'canViewInventory', transfer: 'canViewInventory', count: 'canViewInventory',
    report: 'canViewInventory', storefront: 'canViewInventory',
  },
  quality: {
    inspect: 'canViewSheq', haccp: 'canViewSheq', trace: 'canViewSheq', drill: 'canViewSheq', pack: 'canViewSheq',
  },
  sheq: { incident: 'canViewSheq', hazard: 'canViewSheq', ncr: 'canViewSheq', capa: 'canViewSheq' },
};

/** Literal chip lists. Not derived from writeRolesForCap. */
const WHO: Record<string, { roles: readonly string[]; who: string }> = {
  canViewSuppliers: {
    roles: ['owner', 'admin', 'member'],
    who: 'owner, admin, member',
  },
  canViewAccounting: {
    roles: ['owner', 'finance'],
    who: 'owner, finance',
  },
  canViewCustomers: {
    roles: ['owner', 'admin', 'member', 'finance', 'sales', 'sales_contractor'],
    who: 'owner, admin, member, finance, sales, sales contractor',
  },
  canUseSalesPortal: {
    roles: ['sales_contractor', 'owner', 'admin', 'finance', 'sales'],
    who: 'sales contractor, owner, admin, finance, sales',
  },
  canViewManufacturing: {
    roles: ['owner', 'admin', 'member', 'operations'],
    who: 'owner, admin, member, operations',
  },
  canViewDistribution: {
    roles: ['owner', 'admin', 'member', 'operations'],
    who: 'owner, admin, member, operations',
  },
  canViewInventory: {
    roles: ['owner', 'admin', 'member', 'operations'],
    who: 'owner, admin, member, operations',
  },
  canViewSheq: {
    roles: ['owner', 'admin', 'member', 'operations'],
    who: 'owner, admin, member, operations',
  },
};

const ids = Object.keys(CORE_FLOWS) as CoreFlowModuleId[];
assert.deepEqual(ids, [
  'home',
  'suppliers',
  'customers',
  'sales-portal',
  'manufacturing',
  'distribution',
  'inventory',
  'quality',
  'sheq',
]);

for (const id of ids) {
  const flow = CORE_FLOWS[id];
  assert.equal(flow.module, id);
  assert.equal(flow.anchorId, `${id}-process-flow`);
  assert.equal(flow.product.includes('®'), true, id);
  assert.equal(flow.title.includes('®'), true, id);
  assert.equal(flow.module.includes('®'), false);
  assert.equal(flow.anchorId.includes('®'), false);
  assert.equal(flow.hrefRoot.includes('®'), false);
  assert.equal(flow.previewRoot, null, id);
  assert.deepEqual(flow.previewPaths, []);
  assert.equal(flow.lead, PINNED[id].lead);
  assert.equal(flow.outcome, PINNED[id].outcome);
  assert.deepEqual(
    flow.guardrails.map((item) => ({ title: item.title, body: item.body })),
    PINNED[id].guardrails
  );
  assert.deepEqual(flow.roles, flowRoleDefs(id));
  const phaseIds = new Set(flow.phases.map((phase) => phase.id));
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  flow.steps.forEach((step, index) => {
    assert.equal(step.n, index + 1, `${id} ${step.id}`);
    assert.equal(seen.has(step.id), false, step.id);
    seen.add(step.id);
    assert.equal(phaseIds.has(step.phase), true, step.id);
    counts.set(step.phase, (counts.get(step.phase) || 0) + 1);
    assert.equal(step.status, STATUS[id][step.id], `${id} ${step.id}`);
    assert.equal((FLOW_ICON_NAMES as readonly string[]).includes(step.icon), true, step.icon);
    const cap = NEEDS[id][step.id];
    assert.equal((CORE_CAP_KEYS as readonly string[]).includes(cap), true, `${id} ${step.id}`);
    if (step.status === 'soon') {
      assert.equal(step.to, null, step.id);
      assert.equal(step.secondary, undefined, step.id);
    } else {
      assert.ok(step.to, step.id);
      assert.equal(step.to?.needs, cap, `${id} ${step.id}`);
    }
    for (const extra of step.secondary || []) {
      assert.equal((CORE_CAP_KEYS as readonly string[]).includes(extra.needs || ''), true, extra.path);
      assert.equal(extra.path.includes('®'), false);
    }
    const pinnedWho = WHO[cap];
    assert.ok(pinnedWho, `${id} ${step.id} ${cap}`);
    assert.deepEqual(step.roles, pinnedWho.roles);
    assert.equal(step.who, pinnedWho.who);
    if (step.status === 'partial' || step.status === 'soon') assert.ok(step.note && step.note.length > 0, step.id);
    for (const source of step.sources) {
      assert.equal(existsSync(source), true, source);
      assert.equal(source.includes('®'), false, source);
    }
  });
  assert.deepEqual([...seen].sort(), Object.keys(STATUS[id]).sort(), id);
  for (const [phase, count] of counts) assert.ok(count <= 4, `${id} ${phase} ${count}`);
  for (const phase of flow.phases) assert.ok(flow.steps.some((step) => step.phase === phase.id), phase.id);
  for (const line of visibleLines(flow)) {
    assert.equal(/\d/.test(line), false, `${id} digit ${line}`);
    assert.equal(hasSpelledCount(line), false, `${id} count ${line}`);
    assert.equal(spelledPercent.test(line), false, `${id} percent ${line}`);
    assert.equal(line.includes('®') === false || line.includes('SupplierAdvisor®'), true, line);
  }
  for (const guard of flow.guardrails) assert.equal(existsSync(guard.source), true, guard.source);
}

const documents = CORE_FLOWS.suppliers.steps.find((step) => step.id === 'documents');
assert.equal(documents?.status, 'partial');
assert.equal(
  documents?.note,
  'The vault stores a record and a pasted file link. It does not store the file. The contracts screen only opens that vault.'
);
assert.equal(
  CORE_FLOWS.customers.steps.find((step) => step.id === 'diary')?.desc,
  'Keep calls, meetings, emails, follow-ups and tasks on the sales diary.'
);
assert.equal(
  CORE_FLOWS['sales-portal'].steps.find((step) => step.id === 'diary')?.desc,
  'Keep the sales diary of calls, meetings, emails, follow-ups and tasks.'
);
assert.equal(
  CORE_FLOWS['sales-portal'].steps.find((step) => step.id === 'agreement')?.desc,
  'A sales contractor and sales sign the agreement here. The owner, an admin and finance open the portal without that signature.'
);
assert.equal(
  CORE_FLOWS['sales-portal'].steps.find((step) => step.id === 'subscribe')?.desc,
  'A sales contractor and sales start the paid subscription here after the free period. The owner, an admin and finance are not sent to checkout.'
);
for (const step of CORE_FLOWS['sales-portal'].steps) {
  assert.equal(step.roles.includes('member'), false, step.id);
  assert.equal(step.who.includes('member'), false, step.id);
}
assert.equal(CORE_FLOWS.customers.steps.find((step) => step.id === 'diary')?.roles.includes('member'), false);
assert.equal(
  CORE_FLOWS.home.steps.filter((step) => step.status !== 'live').length +
    CORE_FLOWS.customers.steps.filter((step) => step.status !== 'live').length +
    CORE_FLOWS['sales-portal'].steps.filter((step) => step.status !== 'live').length,
  0
);

assert.equal(
  CORE_FLOWS.manufacturing.steps.find((step) => step.id === 'mrp')?.desc,
  'Net demand against stock on hand and scheduled receipts. The run suggests make and buy. It does not raise a purchase order.'
);
assert.equal(
  CORE_FLOWS.manufacturing.steps.find((step) => step.id === 'mrp')?.note,
  'The run suggests make and buy. It does not raise a purchase order.'
);
assert.equal(CORE_FLOWS.distribution.steps.find((step) => step.id === 'pod')?.to, null);
assert.equal(
  CORE_FLOWS.distribution.steps.find((step) => step.id === 'pod')?.note,
  'Delivered is an event label only. There is no signature and no photo.'
);
assert.equal(
  CORE_FLOWS.quality.steps.find((step) => step.id === 'drill')?.note,
  'This is a drill. It does not run a recall.'
);
assert.equal(
  CORE_FLOWS.quality.steps.find((step) => step.id === 'pack')?.note,
  'The export is JSON and a print view. It is not a submission.'
);
assert.equal(
  CORE_FLOWS.quality.steps.filter((step) => step.status === 'partial').map((step) => step.id).join(','),
  'drill,pack'
);
assert.equal(
  CORE_FLOWS.sheq.steps.find((step) => step.id === 'capa')?.desc,
  'Record the root cause, the corrective action and the preventive action. Setting the status to effective records the check time.'
);
assert.equal(
  CORE_FLOWS.inventory.steps.find((step) => step.id === 'scan')?.desc,
  'Scan a code to receive stock onto a location, with a lot when you enter one. A lot that already has an open or failed inspection is still received. The response carries a warning that the screen does not show yet.'
);
assert.equal(
  CORE_FLOWS.inventory.steps.find((step) => step.id === 'scan')?.note,
  'The response carries a warning that the screen does not show yet.'
);
assert.equal(CORE_FLOWS.inventory.steps.find((step) => step.id === 'scan')?.status, 'partial');
assert.equal(
  CORE_FLOWS.inventory.steps.filter((step) => step.status !== 'live').map((step) => step.id).join(','),
  'scan'
);
assert.equal(
  CORE_FLOWS.manufacturing.steps.find((step) => step.id === 'orders')?.desc,
  'Release, start and complete a work order. Completing it posts finished stock only when the order has a product and a warehouse is available, and posts bill components out of stock when the order has a bill.'
);
assert.equal(CORE_FLOWS.sheq.steps.filter((step) => step.status !== 'live').length, 0);
for (const step of [...CORE_FLOWS.quality.steps, ...CORE_FLOWS.sheq.steps, ...CORE_FLOWS.manufacturing.steps]) {
  assert.equal(step.roles.includes('sales'), false, step.id);
  assert.equal(step.who.includes('viewer'), false, step.id);
}
const copyBan = ['certified', 'compliant', 'auditor-ready', 'iso ', 'grn'];
for (const id of ['manufacturing', 'distribution', 'inventory', 'quality', 'sheq'] as const) {
  for (const line of visibleLines(CORE_FLOWS[id])) {
    const lower = line.toLowerCase();
    for (const word of copyBan) assert.equal(lower.includes(word), false, `${id} ${word} ${line}`);
  }
}

console.log('brief121-core-data.test.ts ok');
