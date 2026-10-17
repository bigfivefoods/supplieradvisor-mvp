/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-data.test.ts
 * Pins core flow copy, statuses, caps and write-role chips.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  projects: {
    lead: 'From a portfolio to a report. The module cards on this page stay where they are.',
    outcome: 'A project can be created, grouped, planned and reported, when the tables behind each screen are present.',
    guardrails: [
      {
        title: 'Migration notice',
        body: 'The portfolio, the programmes, the method screens and the risk log ask you to apply the migration when a query fails. The board, the chart, the milestones and the time log do not. A failed read can show a zero, because the report does not show the notice.',
      },
      {
        title: 'Gate checklist',
        body: 'Moving a project between gates does not check the gate checklist. The checklist is reference text.',
      },
      {
        title: 'Board and chart',
        body: 'The board moves a task with a column choice. The chart is read only. A milestone can be added and marked done.',
      },
      {
        title: 'Programmes',
        body: 'You can create a programme on this screen. This screen does not edit a programme after you save it.',
      },
    ],
  },
  accounting: {
    lead: 'From the chart of accounts to unaudited statements. The page guard opens this page for the owner and for finance.',
    outcome: 'The books are set up, amounts are recorded, and the statements stay unaudited.',
    guardrails: [
      {
        title: 'Unaudited',
        body: 'Management accounts, the balance sheet, the cash flow, the VAT worksheet and the annual statements say they are compiled and unaudited. They are not a filing.',
      },
      {
        title: 'Recorded, not sent',
        body: 'A receipt and a supplier payment are recorded in the books. Neither screen sends money from a bank.',
      },
      {
        title: 'Balanced post',
        body: 'A posted journal is refused when debits and credits differ. A draft may stay out of balance. A locked month rejects a posted journal. If the lock check cannot run, it does not block.',
      },
      {
        title: 'Owner and finance',
        body: 'The page guard opens these screens for the owner and for finance. The server restricts posting and editing a journal, recording a payment, allocating a bank line, and saving settings to the owner and to finance. Creating an account, an invoice, a bill, a bank line, a bank import and a VAT row checks company membership only. The screen is what hides those actions. The lock button is for the owner and for finance. The lock route also accepts an admin.',
      },
    ],
  },
  people: {
    lead: 'From hiring a person to a review. The cards on this page stay where they are.',
    outcome: 'A person is on the directory, leave and a payroll run can be recorded, and a rating can be stored.',
    guardrails: [
      {
        title: 'Payroll',
        body: 'The payroll screen calculates a run and stores it. The screen says the tax amounts are illustrative proxies. Marking the run paid can post a journal when a labour account and a bank account both exist in the chart. It does not pay staff from a bank.',
      },
      {
        title: 'Page guard',
        body: 'The page guard limits who sees these links. The people routes check company membership.',
      },
      {
        title: 'Disciplinary record',
        body: 'The disciplinary screen opens a case and sets a status and an outcome. It does not keep a hearing log.',
      },
      {
        title: 'Directory',
        body: 'An employee record needs a business unit before it saves. The other employee address only opens this directory.',
      },
    ],
  },
  sustainability: {
    lead: 'From a measurement to an evidence pack. The figures are estimates. The module cards on this page stay where they are.',
    outcome: 'Measurements, targets and actions can be recorded as estimates, and the pack can be exported.',
    guardrails: [
      {
        title: 'Estimate',
        body: 'The carbon screen says default factors are order-of-magnitude, and it labels shipment logistics as an estimate. The evidence pack says the figures are estimates and that it is not an audit.',
      },
      {
        title: 'Missing tables',
        body: 'The carbon, water, materiality, target, initiative and certificate screens ask you to apply the migration when a query fails. The evidence pack does not. It still builds, and those sections are then empty.',
      },
      {
        title: 'Certificate record',
        body: 'The certificate screen stores a name, an issuer and an expiry. It does not issue a certificate and it does not verify it with the issuer. It flags the expiry date.',
      },
      {
        title: 'Page guard',
        body: 'These links follow the operations page guard. The impact routes check company membership.',
      },
    ],
  },
  network: {
    lead: 'From discovery to a first trade. This is a short chain. The summary on this page stays where it is.',
    outcome: 'A business can be found, a request can be accepted, and a price, an order and the money screen follow.',
    guardrails: [
      {
        title: 'Invite screens',
        body: 'The supplier invite screen and the customer invite screen send a claim link. They are not the in-app request. The discover screen sends the in-app request.',
      },
      {
        title: 'Price agreement',
        body: 'A price agreement is for a connected buyer. It is refused until the connection is accepted and not suspended. It is not a public price list.',
      },
      {
        title: 'First trade',
        body: 'A purchase order can be raised for a supplier on the book. A quote can be sent from the customer desk without an accepted connection. When an accepted connection is suspended, a new purchase order for that business is refused.',
      },
      {
        title: 'Page guard',
        body: 'The connection routes check company membership. The page guard is what limits the link.',
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
  projects: {
    portfolio: 'partial', programmes: 'partial', method: 'partial', board: 'live',
    time: 'live', riad: 'partial', reporting: 'partial',
  },
  accounting: {
    chart: 'live', settings: 'partial', journals: 'live', ar: 'live', ap: 'live',
    payments: 'live', bank: 'live', tax: 'live', management: 'live', afs: 'partial',
  },
  people: {
    directory: 'live', org: 'live', onboarding: 'live', leave: 'live', payroll: 'partial',
    performance: 'live', training: 'live', discipline: 'partial',
  },
  sustainability: {
    carbon: 'partial', resources: 'partial', materiality: 'partial', targets: 'partial',
    initiatives: 'partial', certificates: 'partial', pack: 'partial',
  },
  network: {
    discover: 'live', invite: 'live', accept: 'live', prices: 'live', trade: 'live', money: 'live',
  },
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
  projects: {
    portfolio: 'canViewProjects', programmes: 'canViewProjects', method: 'canViewProjects',
    board: 'canViewProjects', time: 'canViewProjects', riad: 'canViewProjects', reporting: 'canViewProjects',
  },
  accounting: {
    chart: 'canViewAccounting', settings: 'canViewAccounting', journals: 'canViewAccounting',
    ar: 'canViewAccounting', ap: 'canViewAccounting', payments: 'canViewAccounting',
    bank: 'canViewAccounting', tax: 'canViewAccounting', management: 'canViewAccounting', afs: 'canViewAccounting',
  },
  people: {
    directory: 'canViewPeople', org: 'canViewPeople', onboarding: 'canViewPeople', leave: 'canViewPeople',
    payroll: 'canViewPeople', performance: 'canViewPeople', training: 'canViewPeople', discipline: 'canViewPeople',
  },
  sustainability: {
    carbon: 'canViewOperations', resources: 'canViewOperations', materiality: 'canViewOperations',
    targets: 'canViewOperations', initiatives: 'canViewOperations', certificates: 'canViewOperations',
    pack: 'canViewOperations',
  },
  network: {
    discover: 'canViewNetwork', invite: 'canViewSuppliers', accept: 'canViewNetwork',
    prices: 'canViewNetwork', trade: 'canViewSuppliers', money: 'canViewCustomers',
  },
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
  canViewProjects: {
    roles: ['owner', 'admin', 'member', 'operations'],
    who: 'owner, admin, member, operations',
  },
  canViewPeople: {
    roles: ['owner', 'admin', 'member', 'finance', 'operations'],
    who: 'owner, admin, member, finance, operations',
  },
  canViewNetwork: {
    roles: ['owner', 'admin', 'member'],
    who: 'owner, admin, member',
  },
  canViewOperations: {
    roles: ['owner', 'admin', 'member', 'operations'],
    who: 'owner, admin, member, operations',
  },
};

const STEP_COPY: Partial<Record<CoreFlowModuleId, Record<string, { desc: string; note?: string }>>> = {
  projects: {
    portfolio: {
      desc: 'Create a project and filter the list by programme and method. When a query fails, the screen asks you to apply the migration.',
      note: 'When a query fails, the screen asks you to apply the migration.',
    },
    programmes: {
      desc: 'Create a programme and open the projects in it. This screen does not edit a programme after you save it. When a query fails, the screen asks you to apply the migration.',
      note: 'This screen does not edit a programme after you save it.',
    },
    method: {
      desc: 'Charter a project on the method board and move it between gates. The checklist on a gate is reference text and does not block the move. The goal screen creates a project against a goal. It does not edit an existing project. Both screens ask you to apply the migration when a query fails.',
      note: 'The gate checklist does not block a move. Both screens ask you to apply the migration when a query fails.',
    },
    board: {
      desc: 'Add a task and move it with the column choice. The chart is read only. A milestone can be added and marked done.',
    },
    time: {
      desc: 'Log hours on a date, with a project when you choose one. This screen does not change or remove an entry.',
    },
    riad: {
      desc: 'Log a risk, an issue, an action or a decision, and close or reopen it. When a query fails, the screen asks you to apply the migration.',
      note: 'When a query fails, the screen asks you to apply the migration.',
    },
    reporting: {
      desc: 'Read counts of projects, logged hours and open items on this screen. It does not export a file. A failed read can show a zero, because this screen does not show the migration notice.',
      note: 'It does not export a file. A failed read can show a zero.',
    },
  },
  accounting: {
    chart: {
      desc: 'Add accounts and read period totals from posted journals.',
    },
    settings: {
      desc: 'Set a lock date and open or close a month. A locked month rejects a posted journal. The screen always prints a note that tells you to apply the migration if the lock list is empty. If the lock check cannot run, it does not block a post.',
      note: 'The screen always prints a note that tells you to apply the migration if the lock list is empty. If the lock check cannot run, it does not block a post.',
    },
    journals: {
      desc: 'Save a draft, then post it when debits match credits. A draft may stay out of balance. A locked month rejects the post.',
    },
    ar: {
      desc: 'Record a customer invoice and a receipt against it. Recording a receipt updates the books. It does not send money.',
    },
    ap: {
      desc: 'Record a supplier bill and a payment against it. Recording a payment updates the books. It does not send money.',
    },
    payments: {
      desc: 'Record a receipt or a supplier payment in the books. This screen does not send money from a bank.',
    },
    bank: {
      desc: 'Match a bank line to an invoice or allocate it to an account. You can import a statement on this screen.',
    },
    tax: {
      desc: 'Build a VAT worksheet for the period from invoices and classified bank lines. The screen says the worksheet is unaudited. This screen does not submit the return.',
    },
    management: {
      desc: 'Read the profit and loss for the period from posted journals. The balance sheet and the cash flow sit beside it. Each of these screens says the statement is unaudited.',
    },
    afs: {
      desc: 'Compile the annual statements from posted journals and print them. The screen says they are compiled and unaudited. It does not file them.',
      note: 'The screen says they are compiled and unaudited. It does not file them.',
    },
  },
  people: {
    directory: {
      desc: 'Add an employee on the directory. A business unit is required before the record saves. The other employee address only opens this directory.',
    },
    org: {
      desc: 'The chart shows who reports to whom. You change a manager on the directory. The organisation screen keeps the business units, work cells, stations and assets.',
    },
    onboarding: {
      desc: 'Tick onboarding items on the employee record. The ticks do not store the documents.',
    },
    leave: {
      desc: 'Request leave and approve or reject a pending request. Approval reduces the stored balance.',
    },
    payroll: {
      desc: 'Calculate a payroll run and store it. The screen says the tax amounts are illustrative proxies. Marking the run paid can post a journal when a labour account and a bank account both exist in the chart. It does not pay staff from a bank.',
      note: 'The screen says the tax amounts are illustrative proxies. It does not pay staff from a bank.',
    },
    performance: {
      desc: 'Record a rating. Formal reviews appear in the list. This screen does not edit a review.',
    },
    training: {
      desc: 'Assign a course and mark it complete. This screen does not attach a certificate.',
    },
    discipline: {
      desc: 'Open a case and set its status and outcome. The status list includes a hearing. The screen does not keep a hearing log.',
      note: 'The screen does not keep a hearing log.',
    },
  },
  sustainability: {
    carbon: {
      desc: 'Record an emission line from an activity and a factor, or type a direct amount. The screen says default factors are order-of-magnitude. Shipment logistics sit beside the ledger as an estimate. When a query fails, the screen asks you to apply the migration.',
      note: 'The screen says default factors are order-of-magnitude. Shipment logistics are an estimate.',
    },
    resources: {
      desc: 'Record water, waste and energy amounts. Diversion and renewable share are calculated from those amounts. A saved row is stored as an estimate. When a query fails, the screen asks you to apply the migration.',
      note: 'A saved row is stored as an estimate. When a query fails, the screen asks you to apply the migration.',
    },
    materiality: {
      desc: 'Score topics for impact and for money. The scores are your estimate of what matters. When a query fails, the screen asks you to apply the migration.',
      note: 'The scores are your estimate. When a query fails, the screen asks you to apply the migration.',
    },
    targets: {
      desc: 'Set a target and read progress from the emission ledger and the resource totals. Those totals are estimates. This screen does not check the target against an outside standard. When a query fails, the screen asks you to apply the migration.',
      note: 'The totals are estimates. When a query fails, the screen asks you to apply the migration.',
    },
    initiatives: {
      desc: 'Record an initiative and set its progress yourself. The impact note is text you type, and it is an estimate. When a query fails, the screen asks you to apply the migration.',
      note: 'The impact note is an estimate you type. When a query fails, the screen asks you to apply the migration.',
    },
    certificates: {
      desc: 'Store a certificate name, an issuer and an expiry. This screen does not issue a certificate and does not verify it with the issuer. It flags the expiry date. When a query fails, the screen asks you to apply the migration.',
      note: 'This screen does not issue a certificate and does not verify it with the issuer. It flags the expiry date.',
    },
    pack: {
      desc: 'Export operating data as JSON and open a print view. The pack says the figures are estimates and that it is not an audit. It still builds when a query fails, and those sections are then empty.',
      note: 'The pack says the figures are estimates and that it is not an audit.',
    },
  },
  network: {
    discover: {
      desc: 'Find a business that is open to trade and send a request with a note. The marketplace lists products and can send an inquiry.',
    },
    invite: {
      desc: 'Invite a supplier who is not on the book yet, or invite a customer from the other link. Those screens send a claim link. An in-app request is the discover step.',
    },
    accept: {
      desc: 'Accept or decline an incoming request on this page. The address can open the incoming list.',
    },
    prices: {
      desc: 'Agree prices with a connected buyer. The agreement is refused until the connection is accepted and not suspended. It is not a public price list.',
    },
    trade: {
      desc: 'Raise a purchase order for a supplier on the book, or send a quote from the customer desk. A quote does not need an accepted connection. When an accepted connection is suspended, a new purchase order for that business is refused.',
    },
    money: {
      desc: 'Follow invoices and collections on the customer money screen. This step does not send money.',
    },
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
  'projects',
  'accounting',
  'people',
  'sustainability',
  'network',
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
  const stepCopy = STEP_COPY[id];
  if (stepCopy) {
    assert.deepEqual(
      flow.steps.map((step) => step.id),
      Object.keys(stepCopy),
      `${id} step ids`
    );
    for (const step of flow.steps) {
      assert.equal(step.desc, stepCopy[step.id].desc, `${id} ${step.id} desc`);
      assert.equal(step.note ?? null, stepCopy[step.id].note ?? null, `${id} ${step.id} note`);
    }
  }
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
for (const id of ['manufacturing', 'distribution', 'inventory', 'quality', 'sheq', 'projects', 'accounting', 'people', 'sustainability', 'network'] as const) {
  for (const line of visibleLines(CORE_FLOWS[id])) {
    const lower = line.toLowerCase();
    for (const word of copyBan) assert.equal(lower.includes(word), false, `${id} ${word} ${line}`);
  }
}

assert.equal(
  CORE_FLOWS.projects.steps.find((step) => step.id === 'method')?.desc,
  'Charter a project on the method board and move it between gates. The checklist on a gate is reference text and does not block the move. The goal screen creates a project against a goal. It does not edit an existing project. Both screens ask you to apply the migration when a query fails.'
);
assert.equal(
  CORE_FLOWS.projects.steps.find((step) => step.id === 'board')?.desc,
  'Add a task and move it with the column choice. The chart is read only. A milestone can be added and marked done.'
);
assert.equal(
  CORE_FLOWS.projects.steps.find((step) => step.id === 'reporting')?.note,
  'It does not export a file. A failed read can show a zero.'
);
{
  const projectsSrc = readFileSync('lib/advisors/process-flows/core/projects.ts', 'utf8');
  const at = projectsSrc.indexOf("id: 'reporting'");
  assert.ok(at >= 0);
  const block = projectsSrc.slice(at, at + 700);
  assert.match(block, /status: 'partial'/);
  assert.doesNotMatch(block, /status: 'live'/);
}
assert.equal(
  CORE_FLOWS.accounting.steps.find((step) => step.id === 'journals')?.desc,
  'Save a draft, then post it when debits match credits. A draft may stay out of balance. A locked month rejects the post.'
);
assert.equal(
  CORE_FLOWS.accounting.steps.find((step) => step.id === 'afs')?.desc,
  'Compile the annual statements from posted journals and print them. The screen says they are compiled and unaudited. It does not file them.'
);
assert.equal(
  CORE_FLOWS.accounting.steps.find((step) => step.id === 'payments')?.desc,
  'Record a receipt or a supplier payment in the books. This screen does not send money from a bank.'
);
assert.equal(CORE_FLOWS.accounting.steps.filter((step) => step.roles.includes('admin')).length, 0);
assert.equal(CORE_FLOWS.accounting.steps.filter((step) => step.who !== 'owner, finance').length, 0);
assert.equal(
  CORE_FLOWS.people.steps.find((step) => step.id === 'payroll')?.desc,
  'Calculate a payroll run and store it. The screen says the tax amounts are illustrative proxies. Marking the run paid can post a journal when a labour account and a bank account both exist in the chart. It does not pay staff from a bank.'
);
assert.equal(
  CORE_FLOWS.people.steps.find((step) => step.id === 'discipline')?.note,
  'The screen does not keep a hearing log.'
);
assert.equal(CORE_FLOWS.people.steps.filter((step) => step.roles.includes('sales')).length, 0);
assert.equal(CORE_FLOWS.people.steps.filter((step) => step.who.includes('viewer')).length, 0);
assert.equal(
  CORE_FLOWS.sustainability.steps.find((step) => step.id === 'carbon')?.desc,
  'Record an emission line from an activity and a factor, or type a direct amount. The screen says default factors are order-of-magnitude. Shipment logistics sit beside the ledger as an estimate. When a query fails, the screen asks you to apply the migration.'
);
assert.equal(
  CORE_FLOWS.sustainability.steps.find((step) => step.id === 'pack')?.note,
  'The pack says the figures are estimates and that it is not an audit.'
);
assert.equal(
  CORE_FLOWS.sustainability.steps.find((step) => step.id === 'resources')?.note,
  'A saved row is stored as an estimate. When a query fails, the screen asks you to apply the migration.'
);
assert.equal(
  CORE_FLOWS.sustainability.steps.filter((step) => step.status === 'partial').length,
  CORE_FLOWS.sustainability.steps.length
);
assert.equal(
  CORE_FLOWS.network.steps.find((step) => step.id === 'prices')?.desc,
  'Agree prices with a connected buyer. The agreement is refused until the connection is accepted and not suspended. It is not a public price list.'
);
assert.equal(
  CORE_FLOWS.network.steps.find((step) => step.id === 'trade')?.desc,
  'Raise a purchase order for a supplier on the book, or send a quote from the customer desk. A quote does not need an accepted connection. When an accepted connection is suspended, a new purchase order for that business is refused.'
);
assert.deepEqual(CORE_FLOWS.network.steps.find((step) => step.id === 'money')?.roles, [
  'owner', 'admin', 'member', 'finance', 'sales', 'sales_contractor',
]);
assert.deepEqual(CORE_FLOWS.network.steps.find((step) => step.id === 'invite')?.roles, ['owner', 'admin', 'member']);
assert.deepEqual(CORE_FLOWS.network.steps.find((step) => step.id === 'discover')?.roles, ['owner', 'admin', 'member']);

const journalSrc = readFileSync('app/api/accounting/journals/route.ts', 'utf8');
assert.match(journalSrc, /requireCompanyPermission\(\s*request,\s*companyId,\s*'accounting',\s*'write'/);
assert.match(journalSrc, /Journal must balance/);
assert.match(journalSrc, /if \(status === 'posted' && !balanced\.ok\)/);
const lockSrc = readFileSync('lib/accounting/period-lock.ts', 'utf8');
assert.match(lockSrc, /table missing/);
assert.equal((lockSrc.match(/return \{ locked: false, period_key \}/g) || []).length, 2);
assert.equal(
  CORE_FLOWS.accounting.steps.find((step) => step.id === 'settings')?.note,
  'The screen always prints a note that tells you to apply the migration if the lock list is empty. If the lock check cannot run, it does not block a post.'
);
assert.match(
  readFileSync('app/api/sustainability/resources/route.ts', 'utf8'),
  /is_estimate: body\.is_estimate !== false/
);
assert.match(readFileSync('app/dashboard/sustainability/carbon-tracking/page.tsx', 'utf8'), /order-of-magnitude/);
assert.match(readFileSync('app/dashboard/sustainability/carbon-tracking/page.tsx', 'utf8'), /Logistics estimates/);
const lockRoute = readFileSync('app/api/accounting/period-locks/route.ts', 'utf8');
assert.match(lockRoute, /ROLES_FINANCE_CRITICAL/);
const financeCritical = readFileSync('lib/auth/api-auth.ts', 'utf8');
assert.match(financeCritical, /ROLES_FINANCE_CRITICAL: TeamRole\[\] = \['owner', 'admin', 'finance'\]/);
const settingsButton = readFileSync('lib/business/useCompanyRole.ts', 'utf8');
assert.match(settingsButton, /const FINANCE_CRITICAL: TeamRole\[\] = \['owner', 'finance'\]/);
const payrollSrc = readFileSync('app/api/hr/payroll/route.ts', 'utf8');
assert.match(payrollSrc, /requireCompanyAccess/);
assert.equal(payrollSrc.includes('requireCompanyPermission'), false);
assert.match(payrollSrc, /postBalancedJournal/);
assert.match(readFileSync('app/dashboard/people/payroll/page.tsx', 'utf8'), /illustrative proxies/);
const pricingSrc = readFileSync('lib/pricing/access.ts', 'utf8');
assert.match(pricingSrc, /status\) !== 'accepted'/);
assert.match(readFileSync('app/api/sustainability/esg-pack/route.ts', 'utf8'), /Estimates and operational inventory/);
assert.match(readFileSync('app/dashboard/projects/kanban-boards/page.tsx', 'utf8'), /column choice|column_key/);
assert.match(readFileSync('app/dashboard/projects/gantt/page.tsx', 'utf8'), /<WaterfallGantt groups=\{groups\}/);
assert.equal(readFileSync('app/dashboard/projects/gantt/page.tsx', 'utf8').includes('onSelect'), false);

const membershipWriteRoutes = [
  'app/api/accounting/chart-of-accounts/route.ts',
  'app/api/accounting/invoices/route.ts',
  'app/api/accounting/bank/route.ts',
  'app/api/accounting/bank/import/route.ts',
  'app/api/accounting/tax/route.ts',
];
for (const file of membershipWriteRoutes) {
  const src = readFileSync(file, 'utf8');
  assert.match(src, /import \{ assertAccountingAccess \} from '@\/lib\/accounting\/access'/);
  assert.equal(src.includes('assertAccountingAccess('), false, file);
  assert.match(src, /requireCompanyAccess/);
  assert.equal(src.includes('requireCompanyPermission'), false, file);
}
assert.match(readFileSync('app/api/accounting/payments/route.ts', 'utf8'), /requireCompanyPermission\(\s*request,\s*companyId,\s*'accounting',\s*'write'/);
assert.match(readFileSync('app/api/accounting/bank/allocate/route.ts', 'utf8'), /requireCompanyPermission\(\s*request,\s*companyId,\s*'accounting',\s*'write'/);
assert.match(
  readFileSync('app/api/accounting/settings/route.ts', 'utf8'),
  /assertAccountingAccess\(_gate\.userId, companyId, 'write'\)/
);
const ownerFinance = CORE_FLOWS.accounting.guardrails.find((item) => item.title === 'Owner and finance')?.body || '';
assert.match(ownerFinance, /Creating an account, an invoice, a bill, a bank line, a bank import and a VAT row checks company membership only/);
assert.match(ownerFinance, /posting and editing a journal, recording a payment, allocating a bank line, and saving settings/);
assert.match(
  readFileSync('app/dashboard/accounting/settings/page.tsx', 'utf8'),
  /<p className="text-xs text-neutral-500">[\s\S]*if this is/
);
assert.match(readFileSync('app/api/projects/route.ts', 'utf8'), /if \(error\) \{[\s\S]*warning: error\.message/);
assert.match(readFileSync('app/api/sustainability/inventory/route.ts', 'utf8'), /if \(error\) \{\s*warning = error\.message/);
assert.match(readFileSync('app/dashboard/sustainability/carbon-tracking/page.tsx', 'utf8'), /setWarning\(json\.warning \|\| json\.hint/);
assert.match(readFileSync('app/dashboard/sustainability/green-certificates/page.tsx', 'utf8'), /expiry_status === 'expired'/);
assert.match(readFileSync('app/dashboard/sustainability/green-certificates/page.tsx', 'utf8'), /Expires in/);

console.log('brief121-core-data.test.ts ok');
