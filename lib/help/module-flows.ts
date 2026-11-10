/**
 * Process diagrams for every how-to.
 * Steps, lanes, and branches are the statuses and journals already described
 * on each guide. A module with one actor has no swimlanes.
 */
import type { GuideEdge, GuideNode } from '@/lib/help/types';
import { ACCOUNTING_EDGES, ACCOUNTING_FLOW } from '@/lib/help/guides/accounting';

export type ModuleFlow = { flow: GuideNode[]; edges?: GuideEdge[] };

function withStages(nodes: GuideNode[], groups: Record<string, string[]>): GuideNode[] {
  const stageOf = new Map<string, string>();
  for (const [title, ids] of Object.entries(groups)) {
    for (const id of ids) stageOf.set(id, title);
  }
  return nodes.map((node) => ({ ...node, stage: stageOf.get(node.id) ?? node.stage }));
}

const OFFICE = 'Office';
const CUSTOMER = 'Customer';
const DESK = 'Desk';
const SITE = 'Site';
const OWNER = 'Owner';
const MEMBER = 'Member';

export const MODULE_FLOWS: Record<string, ModuleFlow> = {
  accounting: {
    flow: withStages(
      ACCOUNTING_FLOW.map((node) =>
        node.id === 'post'
          ? {
              ...node,
              does: 'Press Post entry when debits equal credits.',
              who: 'Owner and Finance',
              posts: 'Source manual.',
              status: 'Status becomes posted. A locked period refuses the post.',
            }
          : node
      ),
      {
        'Setup and journals': ['chart', 'draft', 'balanced', 'post'],
        'Invoicing and settlement': ['invoice', 'receipt', 'settle', 'void-invoice'],
        'Bills and costs': ['bill', 'po-allocated', 'skip-bill', 'recognise'],
        'Bank and reconciliation': ['bank', 'auto-match', 'line', 'allocate', 'match', 'exclude'],
        VAT201: ['vat', 'vat201', 'review', 'lock', 'submitted', 'settle-vat', 'settlement', 'nil'],
        'Close and reporting': ['management', 'afs'],
      }
    ),
    edges: ACCOUNTING_EDGES,
  },

  home: {
    flow: [
      { id: 'company', label: 'Company', hint: 'Select it', icon: 'building-2', anchor: 'command', books: 'Home reads the selected company. It does not post a journal.' },
      { id: 'setup', label: 'First run', hint: 'Five records', icon: 'list-checks', anchor: 'command', books: 'Done is computed from the records. There is no Mark done button.' },
      { id: 'boards', label: 'Boards', hint: 'Read only', icon: 'chart-column', anchor: 'command', books: 'The domain boards are a read. Nothing is written to a progress table.' },
      { id: 'inbox', label: 'Messages', hint: 'Your threads', icon: 'send', anchor: 'messages', books: 'A message does not post a journal, a stock movement, or an invoice.' },
      { id: 'week', label: 'Calendar', hint: 'No new leave', icon: 'calendar-days', anchor: 'calendar', books: 'The company week is a read. Leave is requested on People.' },
    ],
  },

  platform: {
    flow: [
      { id: 'console', label: 'Console', hint: 'Operator lock', icon: 'shield', anchor: 'console', books: 'The console then checks for a platform owner. A company owner is not enough.' },
      { id: 'system', label: 'System', hint: 'Read only', icon: 'chart-column', anchor: 'system', books: 'System health is a read. It does not change a company book.' },
      { id: 'gov', label: 'Gov control', hint: 'Activate', icon: 'landmark', anchor: 'gov', books: 'Activate turns on a government department for that programme.' },
      { id: 'refer', label: 'Referrals', hint: 'Settle', icon: 'wallet', anchor: 'referrals', books: 'Settlement readiness is recorded for ops. It does not pay the partner.' },
    ],
  },

  'sales-portal': {
    flow: [
      { id: 'agreement', label: 'Agreement', hint: 'Sales signs', icon: 'notebook-pen', anchor: 'agreement', books: 'The contractor signs the agreement before the portal sells.' },
      { id: 'pipeline', label: 'Pipeline', hint: 'Leads', icon: 'git-branch', anchor: 'sell', books: 'Leads stay on the sales portal. They are not the company Finance book.' },
      { id: 'quote', label: 'Quote', hint: 'Document desk', icon: 'file-pen', anchor: 'sell' },
      { id: 'order', label: 'Order', hint: 'Document desk', icon: 'clipboard-list', anchor: 'sell' },
      { id: 'invoice', label: 'Invoice', hint: 'Document desk', icon: 'receipt', anchor: 'sell' },
      { id: 'earn', label: 'Earn', hint: 'Then subscribe', icon: 'wallet', anchor: 'earn', books: 'Earnings are the contractor’s record. Subscribe is a separate step.' },
    ],
  },

  'my-business': {
    flow: [
      { id: 'profile', label: 'Profile', hint: 'Identity', icon: 'building-2', anchor: 'profile', books: 'Profile stores this company’s identity. It does not post a journal.' },
      { id: 'modules', label: 'Modules', hint: 'Packs and hubs', icon: 'package', anchor: 'modules', books: 'Turning a module on shows it in the sidebar for this company.' },
      { id: 'team', label: 'Team', hint: 'Owner or admin', icon: 'users', anchor: 'team', books: 'An invite adds a person. Checkout is a narrower role than opening Company.' },
      { id: 'trust', label: 'Trust', hint: 'Then verify', icon: 'badge-check', anchor: 'trust' },
      { id: 'bill', label: 'Billing', hint: 'Checkout', icon: 'wallet', anchor: 'billing', books: 'Checkout is limited to owners, admins, or finance.' },
    ],
  },

  network: {
    flow: [
      { id: 'find', label: 'Discover', hint: 'In-app request', icon: 'users', lane: 'You', anchor: 'discover', books: 'The request is pending. A quote does not need it to be accepted.' },
      { id: 'accepted', kind: 'decision', label: 'Accepted?', lane: 'Recipient', anchor: 'graph' },
      { id: 'accept', label: 'Accept', hint: 'The recipient', icon: 'handshake', lane: 'Recipient', anchor: 'graph', books: 'Accept opens trade on that connection.' },
      { id: 'pending', label: 'Stays pending', hint: 'Quote still allowed', icon: 'circle-minus', lane: 'You', anchor: 'graph', books: 'A new purchase order is refused when an accepted connection is suspended.' },
      { id: 'price', label: 'Price', hint: 'Accepted only', icon: 'receipt', lane: 'You', anchor: 'price', books: 'A price agreement saves only after the connection is accepted and not suspended.' },
      { id: 'trade', label: 'First trade', hint: 'Other modules', icon: 'package', lane: 'You', anchor: 'market' },
    ],
    edges: [
      { from: 'find', to: 'accepted' },
      { from: 'accepted', to: 'accept', label: 'Accept' },
      { from: 'accepted', to: 'pending', label: 'Not yet' },
      { from: 'accept', to: 'price' },
      { from: 'price', to: 'trade' },
    ],
  },

  suppliers: {
    flow: withStages([
      { id: 'draft', label: 'Draft', hint: 'Save draft', icon: 'file-pen', anchor: 'po', books: 'Status draft. A draft is not an open order.' },
      { id: 'send-or-cancel', kind: 'decision', label: 'Send?', anchor: 'po' },
      { id: 'sent', label: 'Sent', hint: 'Save & email', icon: 'send', anchor: 'po', books: 'Status sent. Sent is an open order.' },
      { id: 'cancelled', label: 'Cancelled', hint: 'Stops here', icon: 'ban', anchor: 'po', books: 'Status cancelled. It does not move again.' },
      { id: 'accept-or-cancel', kind: 'decision', label: 'Accept?', anchor: 'po' },
      { id: 'accepted', label: 'Mark accepted', hint: 'Posts 1140 / AP', icon: 'badge-check', anchor: 'po', books: 'Debit Inventory 1140, credit AP 2180-* or 2110. A hub order does not post. A zero amount is skipped.' },
      { id: 'receive', label: 'Receive', hint: 'Warehouse qty', icon: 'warehouse', anchor: 'po', books: 'Warehouse quantity only. No second 1140 journal. Receive + OTIFEF records the delivery.' },
      { id: 'invoiced', label: 'Invoiced', hint: 'Supplier bill', icon: 'receipt', anchor: 'po', books: 'Status invoiced. The bill is on Finance. Accept already posted 1140.' },
      { id: 'paid', label: 'Paid', hint: 'Record payment', icon: 'wallet', anchor: 'po', books: 'The payment is recorded on the bill. It does not send the money.' },
      { id: 'complete', kind: 'decision', label: 'OTIFEF in?', anchor: 'after' },
      { id: 'completed', label: 'Completed', hint: 'Does not move', icon: 'circle-check', anchor: 'after', books: 'Completed needs a delivered quantity. A completed order cannot be cancelled.' },
    ], {
      'Draft and send': ['draft', 'send-or-cancel', 'sent', 'cancelled'],
      Accept: ['accept-or-cancel', 'accepted', 'receive'],
      'Bill and complete': ['invoiced', 'paid', 'complete', 'completed'],
    }),
    edges: [
      { from: 'draft', to: 'send-or-cancel' },
      { from: 'send-or-cancel', to: 'sent', label: 'Save & email' },
      { from: 'send-or-cancel', to: 'cancelled', label: 'Cancel' },
      { from: 'sent', to: 'accept-or-cancel' },
      { from: 'accept-or-cancel', to: 'accepted', label: 'Mark accepted' },
      { from: 'accept-or-cancel', to: 'cancelled', label: 'Cancel' },
      { from: 'accepted', to: 'receive' },
      { from: 'receive', to: 'invoiced' },
      { from: 'invoiced', to: 'paid' },
      { from: 'paid', to: 'complete' },
      { from: 'complete', to: 'completed', label: 'Delivered qty' },
      { from: 'complete', to: 'receive', label: 'Record OTIFEF' },
    ],
  },

  customers: {
    flow: [
      { id: 'lead', label: 'Lead', hint: 'On the book', icon: 'user-round', anchor: 'book' },
      { id: 'quote', label: 'Quote', hint: 'Document', icon: 'file-pen', anchor: 'quote' },
      { id: 'order', label: 'Order', hint: 'Document', icon: 'clipboard-list', anchor: 'orders' },
      { id: 'invoice', label: 'Invoice', hint: 'Issue', icon: 'receipt', anchor: 'invoices' },
      { id: 'collect', label: 'Collect', hint: 'Money', icon: 'wallet', anchor: 'money' },
    ],
  },

  containers: {
    flow: [
      { id: 'add', label: 'Add outlet', hint: 'This company', icon: 'map-pin', anchor: 'add' },
      { id: 'pin', label: 'Map', hint: 'The pin', icon: 'map-pin', anchor: 'map' },
      { id: 'staff', label: 'Contractor', hint: 'Assign', icon: 'hard-hat', anchor: 'contractors' },
      { id: 'draw', label: 'Reseller draw', hint: 'Recorded', icon: 'package', anchor: 'resellers' },
      { id: 'read', label: 'Impact', hint: 'Read', icon: 'leaf', anchor: 'impact' },
      { id: 'share', label: 'Share', hint: 'The pack', icon: 'send', anchor: 'share' },
    ],
  },

  inventory: {
    flow: [
      { id: 'catalogue', label: 'Catalogue', hint: 'The product', icon: 'package', anchor: 'products' },
      { id: 'location', label: 'Location', hint: 'A bin', icon: 'warehouse', anchor: 'locations' },
      { id: 'receive', label: 'Receive', hint: 'Quantity in', icon: 'clipboard-check', anchor: 'receive' },
      { id: 'hold', label: 'On hand', hint: 'The balance', icon: 'box', anchor: 'stock' },
      { id: 'move', label: 'Move', hint: 'Transfer', icon: 'arrow-left-right', anchor: 'stock' },
      { id: 'count', label: 'Count', hint: 'The count', icon: 'list-checks', anchor: 'stock' },
    ],
  },

  operations: {
    flow: [
      { id: 'buy', label: 'Buy', hint: 'The order', icon: 'clipboard-list', anchor: 'overview' },
      { id: 'in', label: 'Inbound', hint: 'Arrives', icon: 'truck', anchor: 'inbound' },
      { id: 'stock', label: 'Warehouse', hint: 'On hand', icon: 'warehouse', anchor: 'store' },
      { id: 'make', label: 'Make', hint: 'The run', icon: 'factory', anchor: 'make' },
      { id: 'out', label: 'Outbound', hint: 'Ships', icon: 'ship', anchor: 'outbound' },
      { id: 'fix', label: 'Exceptions', hint: 'The hold', icon: 'flag', anchor: 'fix' },
    ],
  },

  manufacturing: {
    flow: [
      { id: 'bom', label: 'BOM', hint: 'The recipe', icon: 'list-checks', anchor: 'bom' },
      { id: 'mps', label: 'Plan', hint: 'The schedule', icon: 'calendar-days', anchor: 'plan' },
      { id: 'mrp', label: 'Explode', hint: 'The need', icon: 'git-branch', anchor: 'explode' },
      { id: 'wo', label: 'Work order', hint: 'The run', icon: 'factory', anchor: 'run' },
      { id: 'cost', label: 'Cost', hint: 'The rollup', icon: 'receipt', anchor: 'costs' },
    ],
  },

  distribution: {
    flow: [
      { id: 'term', label: 'Incoterm', hint: 'The term', icon: 'clipboard-list', anchor: 'incoterms' },
      { id: 'partner', label: 'Carrier', hint: 'Who moves it', icon: 'truck', anchor: 'carrier' },
      { id: 'plan', label: 'Shipment', hint: 'Planned', icon: 'ship', anchor: 'outbound' },
      { id: 'move', label: 'Advance', hint: 'The leg', icon: 'arrow-left-right', anchor: 'track' },
      { id: 'event', label: 'Log event', hint: 'A note', icon: 'notebook-pen', anchor: 'track' },
      { id: 'done', label: 'Delivered', hint: 'Closed', icon: 'circle-check', anchor: 'track' },
    ],
  },

  people: {
    flow: [
      { id: 'directory', label: 'Directory', hint: 'Add the employee', icon: 'users', anchor: 'directory', books: 'Saving the employee does not post a salary journal.' },
      { id: 'leave', label: 'Leave', hint: 'Approve', icon: 'calendar-days', anchor: 'leave', books: 'A request is pending, approved, rejected, or cancelled.' },
      { id: 'calculate', label: 'Calculate', hint: 'Draft run', icon: 'scale', anchor: 'payroll', books: 'Statuses include draft and calculated. PAYE here is a proxy, not a SARS return.' },
      { id: 'approved', label: 'Approve', hint: 'Calculated run', icon: 'badge-check', anchor: 'payroll', books: 'Approve sets the run to approved. It does not post and it does not pay anyone.' },
      { id: 'paid', label: 'Pay + GL', hint: 'Journal, not the bank', icon: 'wallet', anchor: 'payroll', books: 'Mark paid + GL posts hr_payroll: Dr 6100 or 5200, Cr 1110, and Cr the PAYE liability when that account exists.' },
    ],
  },

  sheq: {
    flow: [
      { id: 'incident', label: 'Incident', hint: 'Open', icon: 'flag', anchor: 'incidents' },
      { id: 'hazard', label: 'Hazard', hint: 'Score 1–5', icon: 'shield', anchor: 'hazards', books: 'Likelihood and severity are each 1 to 5. The score is the product.' },
      { id: 'ncr', label: 'NCR', hint: 'Or from a failed check', icon: 'clipboard-list', anchor: 'ncr' },
      { id: 'capa', label: 'CAPA', hint: 'Then close', icon: 'circle-check', anchor: 'capa' },
    ],
  },

  quality: {
    flow: [
      { id: 'receive', label: 'Receive', hint: 'Scan does not block', icon: 'package', anchor: 'overview', books: 'Scan receive can warn and still take the stock.' },
      { id: 'inspect', label: 'Inspect', hint: 'Pass or fail', icon: 'clipboard-check', anchor: 'inspect' },
      { id: 'result', kind: 'decision', label: 'Clear?', anchor: 'inspect' },
      { id: 'hold', label: 'Hold', hint: 'Ship blocks', icon: 'ban', anchor: 'inspect', books: 'Ship refuses a lot with an open or failed inspection until it is cleared.' },
      { id: 'release', label: 'Release', hint: 'Ship can move', icon: 'circle-check', anchor: 'inspect', books: 'A cleared inspection no longer blocks the transfer.' },
      { id: 'trace', label: 'Trace', hint: 'The graph', icon: 'git-branch', anchor: 'trace' },
      { id: 'pack', label: 'Pack', hint: 'Not a submission', icon: 'files', anchor: 'export', books: 'The recall drill only searches. The pack is not a submission.' },
    ],
    edges: [
      { from: 'receive', to: 'inspect' },
      { from: 'inspect', to: 'result' },
      { from: 'result', to: 'hold', label: 'Fail or open' },
      { from: 'result', to: 'release', label: 'Pass' },
      { from: 'hold', to: 'trace' },
      { from: 'release', to: 'trace' },
      { from: 'trace', to: 'pack' },
    ],
  },

  projects: {
    flow: [
      { id: 'programme', label: 'Programme', hint: 'Create only', icon: 'list-checks', anchor: 'programmes' },
      { id: 'project', label: 'Project', hint: 'Starts planning', icon: 'clipboard-list', anchor: 'portfolio' },
      { id: 'gate', label: 'DMAIC', hint: 'Does not block', icon: 'git-branch', anchor: 'dmaic', books: 'The checklist is reference text. Moving the card is not blocked by it.' },
      { id: 'task', label: 'Task', hint: 'One click', icon: 'circle-check', anchor: 'kanban' },
      { id: 'time', label: 'Hours', hint: 'Append only', icon: 'calendar-days', anchor: 'time' },
    ],
  },

  sustainability: {
    flow: [
      { id: 'ghg', label: 'Emissions', hint: 'The figure', icon: 'leaf', anchor: 'ghg' },
      { id: 'resources', label: 'Resources', hint: 'Use', icon: 'package', anchor: 'resources' },
      { id: 'target', label: 'Target', hint: 'The goal', icon: 'flag', anchor: 'targets' },
      { id: 'prove', label: 'Certificate', hint: 'The file', icon: 'badge-check', anchor: 'certs' },
      { id: 'pack', label: 'Pack', hint: 'The export', icon: 'files', anchor: 'pack' },
    ],
  },

  intelligence: {
    flow: [
      { id: 'pulse', label: 'Pulse', hint: 'The read', icon: 'chart-column', anchor: 'pulse' },
      { id: 'signal', label: 'Signal', hint: 'The note', icon: 'flag', anchor: 'insights' },
      { id: 'forecast', label: 'Forecast', hint: 'The projection', icon: 'chart-column', anchor: 'forecast' },
      { id: 'lab', label: 'Lab', hint: 'The trial', icon: 'git-branch', anchor: 'lab' },
      { id: 'lead', label: 'Super-Cube®', hint: 'The lead', icon: 'box', anchor: 'lead' },
    ],
  },

  apparelgraph: {
    flow: [
      { id: 'season', label: 'Season', hint: 'Stays planning', icon: 'calendar-days', anchor: 'range', books: 'The season stays planning. This save does not issue a shipment.' },
      { id: 'style', label: 'Style', hint: 'Stays concept', icon: 'notebook-pen', anchor: 'styles' },
      { id: 'cost', label: 'BOM line', hint: 'Not an invoice', icon: 'receipt', anchor: 'costing', books: 'A BOM line is a cost. It is not a customer invoice.' },
      { id: 'path', label: 'Milestone', hint: 'Planned, then done', icon: 'flag', anchor: 'path' },
      { id: 'sheet', label: 'Line sheet', hint: 'Then prebook', icon: 'files', anchor: 'wholesale', books: 'Prebook adds booked quantity. It does not check available-to-sell.' },
    ],
  },

  constructiongraph: {
    flow: withStages([
      { id: 'client', label: 'Client', hint: 'Then a project', icon: 'user-round', lane: DESK, anchor: 'clients' },
      { id: 'quote', label: 'Draft quote', hint: 'No issue button', icon: 'file-pen', lane: DESK, anchor: 'quotes', books: 'Save quote stores status draft. There is no Issue control on this screen.' },
      { id: 'project', label: 'Project', hint: 'Starts tender', icon: 'hard-hat', lane: DESK, anchor: 'projects', books: 'Save project stores status tender. Update status moves it to on site, then practical completion.' },
      { id: 'build', label: 'Programme', hint: 'Task starts planned', icon: 'list-checks', lane: SITE, anchor: 'programme', books: 'Save task stores status planned. It does not post a journal.' },
      { id: 'diary', label: 'Diary', hint: 'The day', icon: 'notebook-pen', lane: SITE, anchor: 'diary', books: 'Progress stays editable until the day is signed off. The diary does not post a journal.' },
      { id: 'signed', kind: 'decision', label: 'Signed?', lane: SITE, anchor: 'diary' },
      { id: 'addendum', label: 'Addendum only', hint: 'Progress locked', icon: 'lock', lane: SITE, anchor: 'diary', books: 'A signed day refuses a progress edit and a delete. Add addendum appends a dated, attributed note. Owner, Admin, Member, and Operations can add one.' },
      { id: 'change', label: 'Variation', hint: 'Days, then price', icon: 'git-branch', lane: DESK, anchor: 'variations' },
      { id: 'claim', label: 'Claim', hint: 'Status planned', icon: 'receipt', lane: DESK, anchor: 'payments', books: 'Save claim stores status planned. It does not post Finance.' },
      { id: 'certify', label: 'Certify', hint: 'Certificate issued', icon: 'stamp', lane: OFFICE, anchor: 'payments', books: 'Status certified. Retention is 10%. An interim payment certificate is created. No journal.' },
      { id: 'pay', kind: 'decision', label: 'Record pay?', lane: OFFICE, anchor: 'payments' },
      { id: 'paid', label: 'Paid', hint: 'Certificate paid', icon: 'wallet', lane: OFFICE, anchor: 'certificates', books: 'The claim and the certificate become paid. Money is not sent and no journal is posted.' },
      { id: 'hand', label: 'Handover', hint: 'Close snags', icon: 'circle-check', lane: SITE, anchor: 'handover', books: 'Close sets the snag closed. It does not change the project status.' },
    ], {
      'Client and programme': ['client', 'quote', 'project', 'build'],
      Diary: ['diary', 'signed', 'addendum'],
      'Claims and handover': ['change', 'claim', 'certify', 'pay', 'paid', 'hand'],
    }),
    edges: [
      { from: 'client', to: 'quote' },
      { from: 'quote', to: 'project' },
      { from: 'project', to: 'build' },
      { from: 'build', to: 'diary' },
      { from: 'diary', to: 'signed' },
      { from: 'signed', to: 'addendum', label: 'Signed off' },
      { from: 'signed', to: 'diary', label: 'Not signed' },
      { from: 'addendum', to: 'change' },
      { from: 'change', to: 'claim' },
      { from: 'claim', to: 'certify' },
      { from: 'certify', to: 'pay' },
      { from: 'pay', to: 'paid', label: 'Record pay' },
      { from: 'pay', to: 'certify', label: 'Not yet' },
      { from: 'paid', to: 'hand' },
    ],
  },

  fleetgraph: {
    flow: [
      { id: 'vehicle', label: 'Vehicle', hint: 'Starts active', icon: 'truck', anchor: 'vehicles', books: 'A new vehicle starts active unless you change status. Statuses are Active, Workshop, Off road, or Sold.' },
      { id: 'driver', label: 'Driver', hint: 'No ID number', icon: 'user-round', anchor: 'drivers', books: 'A 13-digit identity number is stripped. This desk does not store it.' },
      { id: 'dates', label: 'Compliance', hint: 'Dates you enter', icon: 'calendar-days', anchor: 'compliance', books: 'Dates are whatever this company enters. The product does not supply a legal calendar.' },
      { id: 'job', label: 'Job', hint: 'Not an invoice', icon: 'clipboard-list', anchor: 'jobs', books: 'Save job does not create a sales order, a delivery note, or a finance invoice.' },
      { id: 'read', label: 'Odometer', hint: 'A reading', icon: 'clipboard-check', anchor: 'vehicles' },
      { id: 'cpk', label: 'Per kilometre', hint: 'From readings', icon: 'receipt', anchor: 'cpk', books: 'Distance uses completed trip readings when they exist, otherwise odometer pairs. FleetAdvisor® does not receive a position. A cost entry does not post a finance journal. Owner, Admin, and Finance can open it.' },
    ],
  },

  tradegraph: {
    flow: withStages([
      { id: 'enquiry', label: 'Enquiry', hint: 'New job', icon: 'user-round', lane: OFFICE, anchor: 'jobs', books: 'Status enquiry. Cancelled jobs stay off the board.' },
      { id: 'quoted', label: 'Quote', hint: 'Save draft', icon: 'file-pen', lane: OFFICE, anchor: 'quote', books: 'Status draft. VAT is 15% on top. The deposit is not collected yet.' },
      { id: 'sent', label: 'Sent', hint: 'Send to customer', icon: 'send', lane: OFFICE, anchor: 'quote', books: 'Send to customer moves draft to sent.' },
      { id: 'sign', kind: 'decision', label: 'Sign?', lane: CUSTOMER, anchor: 'quote' },
      { id: 'scheduled', label: 'Scheduled', hint: 'Accept and sign', icon: 'calendar-days', lane: CUSTOMER, anchor: 'quote', books: 'Accept and sign accepts the quote and opens the job as scheduled.' },
      { id: 'declined', label: 'Declined', hint: 'Stops', icon: 'ban', lane: CUSTOMER, anchor: 'quote', books: 'A declined, accepted, or expired quote cannot be accepted again.' },
      { id: 'site', label: 'On site', hint: 'I have arrived', icon: 'map-pin', lane: OFFICE, anchor: 'onsite', books: 'Arrival can move the job to in progress. It does not post payroll.' },
      { id: 'invoiced', label: 'Invoiced', hint: 'Not the 1130 journal', icon: 'receipt', lane: OFFICE, anchor: 'invoices', books: 'A non-deposit invoice sets the job to invoiced unless it is already paid. It does not by itself post 1130.' },
      { id: 'covered', kind: 'decision', label: 'Covered?', lane: OFFICE, anchor: 'invoices' },
      { id: 'paid', label: 'Paid', hint: 'Balance cleared', icon: 'wallet', lane: OFFICE, anchor: 'invoices', books: 'When recorded payments cover every invoice that is not void, the job becomes paid.' },
    ], {
      Quote: ['enquiry', 'quoted', 'sent', 'sign', 'scheduled', 'declined'],
      'Site and payment': ['site', 'invoiced', 'covered', 'paid'],
    }),
    edges: [
      { from: 'enquiry', to: 'quoted' },
      { from: 'quoted', to: 'sent' },
      { from: 'sent', to: 'sign' },
      { from: 'sign', to: 'scheduled', label: 'Accept and sign' },
      { from: 'sign', to: 'declined', label: 'Decline' },
      { from: 'scheduled', to: 'site' },
      { from: 'site', to: 'invoiced' },
      { from: 'invoiced', to: 'covered' },
      { from: 'covered', to: 'paid', label: 'Covered' },
      { from: 'covered', to: 'invoiced', label: 'Still open' },
    ],
  },

  fieldgraph: {
    flow: [
      { id: 'field', label: 'Field', hint: 'The block', icon: 'leaf', anchor: 'fields' },
      { id: 'estimate', label: 'Estimate', hint: 'The figure', icon: 'scale', anchor: 'estimates' },
      { id: 'harvest', label: 'Harvest', hint: 'The load', icon: 'tractor', anchor: 'harvest' },
      { id: 'trade', label: 'Trade', hint: 'The sale', icon: 'handshake', anchor: 'trade' },
    ],
  },

  quarrygraph: {
    flow: [
      { id: 'quarry', label: 'Quarry', hint: 'Code and name', icon: 'mountain', anchor: 'quarries' },
      { id: 'face', label: 'Face', hint: 'Under the quarry', icon: 'map-pin', anchor: 'sites' },
      { id: 'plan', label: 'Plan', hint: 'Starts planned', icon: 'calendar-days', anchor: 'production' },
      { id: 'pad', label: 'Stockpile', hint: 'Balance you type', icon: 'package', anchor: 'dispatch' },
      { id: 'ticket', label: 'Ticket', hint: 'Deducts if linked', icon: 'truck', anchor: 'dispatch', books: 'A linked stockpile is reduced by the net tonnes, and the balance does not go below zero. Leave it empty to skip that.' },
    ],
  },

  fitgraph: {
    flow: withStages([
      { id: 'member', label: 'Member', hint: 'On the book', icon: 'user-round', lane: OWNER, anchor: 'members', books: 'Membership status is active, paused, expired, cancelled, trial, frozen, or merged.' },
      { id: 'mandate', label: 'Mandate', hint: 'Sign mandate', icon: 'notebook-pen', lane: OWNER, anchor: 'mandates', books: 'Status is pending, active, suspended, or cancelled. Validation is unchecked, valid, invalid, or error.' },
      { id: 'bank-ok', kind: 'decision', label: 'Bank valid?', lane: OWNER, anchor: 'mandates' },
      { id: 'active', label: 'Activate', hint: 'Validation valid', icon: 'badge-check', lane: OWNER, anchor: 'mandates', books: 'Activate is refused until validation is valid.' },
      { id: 'invoice', label: 'Invoice', hint: 'Member fee', icon: 'receipt', lane: OWNER, anchor: 'billing' },
      { id: 'preview', label: 'Preview run', hint: 'Approve run', icon: 'list-checks', lane: OWNER, anchor: 'billing', books: 'Run status can be preview. No money moves in preview.' },
      { id: 'submit', label: 'Submit', hint: 'No live call', icon: 'send', lane: OWNER, anchor: 'billing', books: 'Test mode simulates Netcash. This build refuses live Netcash calls, so no money moves.' },
      { id: 'reconcile', label: 'Reconcile', hint: 'Fetch results', icon: 'scale', lane: OWNER, anchor: 'collections', books: 'A line is scheduled, submitted, paid, unpaid, reversed, skipped, or review.' },
      { id: 'debit', kind: 'decision', label: 'Debit paid?', lane: MEMBER, anchor: 'checkins' },
      { id: 'checkin', label: 'Check-in', hint: 'Visit logged', icon: 'dumbbell', lane: MEMBER, anchor: 'checkins', books: 'An unpaid debit warns: access stays open. The visit is still logged.' },
    ], {
      'Member and mandate': ['member', 'mandate', 'bank-ok', 'active'],
      'Billing run': ['invoice', 'preview', 'submit', 'reconcile'],
      'Check-in': ['debit', 'checkin'],
    }),
    edges: [
      { from: 'member', to: 'mandate' },
      { from: 'mandate', to: 'bank-ok' },
      { from: 'bank-ok', to: 'active', label: 'Valid' },
      { from: 'bank-ok', to: 'mandate', label: 'Not valid' },
      { from: 'active', to: 'invoice' },
      { from: 'invoice', to: 'preview' },
      { from: 'preview', to: 'submit' },
      { from: 'submit', to: 'reconcile' },
      { from: 'reconcile', to: 'debit' },
      { from: 'debit', to: 'checkin', label: 'Paid' },
      { from: 'debit', to: 'checkin', label: 'Unpaid · warn' },
    ],
  },

  hiregraph: {
    flow: [
      { id: 'list', label: 'Listing', hint: 'The item', icon: 'package', anchor: 'catalogue' },
      { id: 'book', label: 'Booking', hint: 'Reserved', icon: 'calendar-days', anchor: 'bookings' },
      { id: 'out', label: 'Out', hint: 'Handover', icon: 'truck', anchor: 'handover' },
      { id: 'back', label: 'Return', hint: 'Back in', icon: 'undo-2', anchor: 'handover' },
      { id: 'read', label: 'Settlement', hint: 'The balance', icon: 'receipt', anchor: 'settlements' },
    ],
  },

  retailgraph: {
    flow: [
      { id: 'sku', label: 'SKU', hint: 'Name and price', icon: 'package', anchor: 'catalogue' },
      { id: 'basket', label: 'Basket', hint: 'Tap to add', icon: 'box', anchor: 'till' },
      { id: 'pay', kind: 'decision', label: 'How paid?', anchor: 'till' },
      { id: 'cash', label: 'Cash', hint: 'Then paid', icon: 'wallet', anchor: 'till', books: 'Cash, or Paid in cash, stores the method cash.' },
      { id: 'phone', label: 'Phone', hint: 'Then paid', icon: 'send', anchor: 'till', books: 'A successful phone payment stores the method paystack. The sale does not store the words QR or NFC.' },
      { id: 'list', label: 'Sales', hint: 'No stock move', icon: 'receipt', anchor: 'sales', books: 'The sale is listed. This till does not move warehouse stock.' },
    ],
    edges: [
      { from: 'sku', to: 'basket' },
      { from: 'basket', to: 'pay' },
      { from: 'pay', to: 'cash', label: 'Cash' },
      { from: 'pay', to: 'phone', label: 'Phone' },
      { from: 'cash', to: 'list' },
      { from: 'phone', to: 'list' },
    ],
  },

  schools: {
    flow: [
      { id: 'join', label: 'Join', hint: 'Department approves', icon: 'graduation-cap', lane: 'Department', anchor: 'join' },
      { id: 'menu', label: 'Menu', hint: 'Department sets it', icon: 'list-checks', lane: 'Department', anchor: 'foods' },
      { id: 'order', label: 'Order', hint: 'Active SP only', icon: 'clipboard-list', lane: 'School', anchor: 'orders' },
      { id: 'serve', label: 'Serve', hint: 'Meals in the period', icon: 'users', lane: 'School', anchor: 'serve' },
      { id: 'claim', label: 'Claim', hint: 'Email, no journal', icon: 'receipt', lane: 'School', anchor: 'claims', books: 'Submit emails the claim. It does not post the ledger.' },
      { id: 'decide', label: 'Decision', hint: 'Then paid', icon: 'badge-check', lane: 'Department', anchor: 'claims', books: 'The department’s decision is by email. The score screens do not change the claim status.' },
    ],
  },

  health: {
    flow: [
      { id: 'dept', label: 'Department', hint: 'Platform activates', icon: 'landmark', anchor: 'agency' },
      { id: 'join', label: 'Facility join', hint: 'Department approves', icon: 'heart-pulse', anchor: 'join' },
      { id: 'list', label: 'Catalogue', hint: 'Schools list', icon: 'list-checks', anchor: 'shared', books: 'The foods list is the schools catalogue. A health facility reads it.' },
      { id: 'supply', label: 'Order', hint: 'Schools order', icon: 'truck', anchor: 'shared', books: 'Orders open the schools screens. No separate clinic purchase order is created.' },
      { id: 'kitchen', label: 'Kitchen', hint: 'Schools kitchen', icon: 'clipboard-list', anchor: 'shared' },
    ],
  },

  recovergraph: {
    flow: withStages([
      { id: 'creditor', label: 'Creditor', hint: 'Starts active', icon: 'building-2', lane: 'Desk', anchor: 'creditors', books: 'A new creditor is active. Archive sets inactive. This desk gives no legal advice.' },
      { id: 'mandate', label: 'Draft mandate', hint: 'Not active yet', icon: 'file-pen', lane: 'Desk', anchor: 'mandates', books: 'The form stores a draft. It does not collect a signed date or an agreement reference, so it does not become active.' },
      { id: 'active', kind: 'decision', label: 'Mandate active?', lane: 'Desk', anchor: 'mandates' },
      { id: 'place', label: 'Place', hint: 'Active only', icon: 'package', lane: 'Desk', anchor: 'imports', books: 'Place writes the accounts and an audit row. It does not post a journal and it does not contact a debtor.' },
      { id: 'refused', label: 'Not placed', hint: 'Draft refused', icon: 'ban', lane: 'Desk', anchor: 'imports', books: 'A draft mandate is refused. The page says the book could not be placed.' },
      { id: 'queue', label: 'Queue', hint: 'Assign', icon: 'users', lane: 'Desk', anchor: 'queue' },
      { id: 'work', label: 'Note or flag', hint: 'No letter', icon: 'flag', lane: 'Agent', anchor: 'accounts', books: 'A flag does not send or block a message. Adjustment is not a receipt.' },
      { id: 'recall-from', kind: 'decision', label: 'Active account?', lane: 'Agent', anchor: 'accounts' },
      { id: 'recall', label: 'Recall', hint: 'From active only', icon: 'undo-2', lane: 'Agent', anchor: 'accounts', books: 'Recall sets the state to recalled, and only from active. Paid, arrangement, and closed are not buttons.' },
    ], {
      'Creditor and mandate': ['creditor', 'mandate', 'active', 'place', 'refused'],
      'Queue and recall': ['queue', 'work', 'recall-from', 'recall'],
    }),
    edges: [
      { from: 'creditor', to: 'mandate' },
      { from: 'mandate', to: 'active' },
      { from: 'active', to: 'place', label: 'Active' },
      { from: 'active', to: 'refused', label: 'Draft' },
      { from: 'place', to: 'queue' },
      { from: 'queue', to: 'work' },
      { from: 'work', to: 'recall-from' },
      { from: 'recall-from', to: 'recall', label: 'Recall' },
      { from: 'recall-from', to: 'work', label: 'Not active' },
    ],
  },

  guide: {
    flow: [
      { id: 'start', label: 'Start', hint: 'This page', icon: 'book-open', anchor: 'start' },
      { id: 'chapter', label: 'Chapter', hint: 'Open it', icon: 'files', anchor: 'start' },
      { id: 'modules', label: 'Modules', hint: 'The how-to', icon: 'list-checks', anchor: 'start' },
    ],
  },
};

function clinicFlow(peopleLabel: string): ModuleFlow {
  return {
    flow: [
      { id: 'people', label: peopleLabel, hint: 'Then the book', icon: 'users', anchor: 'people' },
      { id: 'diary', label: 'Diary', hint: 'Public slot is optional', icon: 'calendar-days', anchor: 'calendar' },
      { id: 'attend', label: 'Attended', hint: 'Front desk', icon: 'clipboard-check', anchor: 'bookings', books: 'Attended is recorded on the booking. Packages, bookings, and claims do not post the finance journal.' },
      { id: 'claim', label: 'Claim', hint: 'Sandbox or paper', icon: 'receipt', anchor: 'claims', books: 'Sandbox simulates an accept. Live MediKredit is refused until accreditation. Manual records a paper pack.' },
      { id: 'account', label: 'Account', hint: 'Invoice posts here', icon: 'wallet', anchor: 'accounts', books: 'A charge or a payment posts only if the finance invoice can be posted.' },
    ],
  };
}

MODULE_FLOWS.physiograph = clinicFlow('Practitioners');
MODULE_FLOWS.dentalgraph = clinicFlow('Staff');
MODULE_FLOWS.psychiatrygraph = clinicFlow('Practitioners');
MODULE_FLOWS.medicalgraph = clinicFlow('Practitioners');
MODULE_FLOWS.vetgraph = clinicFlow('Vets');

export function flowFor(id: string): ModuleFlow | null {
  return MODULE_FLOWS[id] ?? null;
}
