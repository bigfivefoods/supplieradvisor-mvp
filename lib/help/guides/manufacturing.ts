import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Make opens for anyone who can view Manufacturing. On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. A sales contractor cannot. The gate says “Your role (…) cannot access Manufacturing.” Saves check that you are an active member. They do not check a separate write role. Stock movements on complete are not journals. A cost allocation is the journal.';

const GL =
  'A cost entry posts a journal when the chart can resolve the accounts. Materials debit 5100, then 1140. Labour debits 5200, then 6100. The credit is 2130, then 2110, memo “Manufacturing cost accrual”, source manufacturing_cost. If those accounts are missing the entry can still save and the screen warns. Produce and consume stock movements are not journals.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'overview',
    name: 'Overview',
    href: '/dashboard/manufacturing',
    summary: 'Overview is the factory home. It shows OEE, WIP, and yield, and opens the other Make screens.',
    who: WHO,
    prerequisites: ['A company is selected. If the manufacturing tables are missing, the page shows a Schema line and the migration names.'],
    steps: [
      'Open Overview. The title is Manufacturing Command.',
      'Press Refresh telemetry.',
      'Read OEE, WIP, and Yield, then Work orders, Active BOMs, MPS plans, and Work cells.',
      'Open Work orders, Bills of materials, Master schedule, Material requirements, Work cells, or Cost centres.',
    ],
    behind: ['Refresh reads the manufacturing summary. It does not post a journal. Last MRP run is hidden until a run exists.'],
    errors: [
      { message: 'Your role (…) cannot access Manufacturing.', fix: 'Ask an owner for a role that can view Manufacturing.' },
    ],
    faqs: [
      { q: 'The counts are zero. Is the factory hidden?', a: 'Nothing has been saved yet. Create a BOM, a plan, or a work order. The desk does not seed a factory.' },
    ],
  }),
  feat({
    id: 'plan',
    name: 'Plan',
    href: '/dashboard/manufacturing/master-production-schedules',
    summary: 'Plan is the master schedule. You enter forecast and firm quantities, activate the plan, then turn firm quantities into planned work orders.',
    who: WHO,
    prerequisites: ['Finished goods exist in Inventory. Without them the page says to create finished goods, then create a new MPS plan to seed lines.'],
    steps: [
      'Open Plan. The title is Master schedule. The in-page name is MPS.',
      'Press New MPS plan or Create MPS.',
      'Edit Forecast and Firm on the lines.',
      'Press Activate plan.',
      'Press Firm → work orders. It stays disabled while the firm total is zero. Confirm “Create work orders from all firm quantities in this plan?”',
    ],
    behind: [
      'A new plan is a draft. Activate plan stores it as active. Statuses are draft, active, frozen, and closed.',
      'Firm → work orders inserts production orders with status planned. It does not post a journal and it does not run MRP.',
    ],
    errors: [
      { message: 'plan_id, product_id, week_start required', fix: 'Keep the line on a product and a week. Do not firm a blank row.' },
      { message: 'Create failed', fix: 'Stay on the company and create the plan again. Finished goods must exist to seed lines.' },
      { message: 'Firm failed', fix: 'Put a firm quantity above zero, activate the plan, and press Firm → work orders again.' },
    ],
    faqs: [
      { q: 'No master production schedule. What is the horizon?', a: 'The empty body describes a 12-week plan. Press New MPS plan. Lines seed from finished goods.' },
    ],
  }),
  feat({
    id: 'explode',
    name: 'Explode',
    href: '/dashboard/manufacturing/mrp',
    summary: 'Explode runs material requirements. It suggests make, buy, or expedite. It does not raise a purchase order.',
    who: WHO,
    prerequisites: ['An active MPS and active BOMs give the run something to explode. The button still runs if they are missing, and the result can be empty.'],
    steps: [
      'Open Explode. The title is Material requirements. The in-page name is MRP.',
      'Press Run MRP now, or Run first MRP when there has been no run.',
      'Read Last run SKUs, Shortages, Make, and Buy / expedite.',
      'Filter shortages or all. Columns are Product, Gross, On hand, Receipts, Net, Planned, Action, and Source.',
    ],
    behind: [
      'A run is stored as running, then complete or failed. Actions on a line are none, make, buy, or expedite.',
      'The run writes requirement rows only. It does not create a purchase order and it does not post a journal.',
    ],
    errors: [
      { message: 'Failed to create MRP run', fix: 'Stay on the company and press Run MRP now again. A failed run shows status failed and the error on the run.' },
    ],
    faqs: [
      { q: 'No shortages on this run. Should I raise a PO?', a: 'No. That sentence means materials cover demand. Even a buy line is a suggestion. Raise the purchase order in Suppliers yourself.' },
    ],
  }),
  feat({
    id: 'bom',
    name: 'BOM',
    href: '/dashboard/manufacturing/bills-of-materials',
    summary: 'BOM is the bill of materials. A structure starts as draft. MRP and work orders use it after you activate it.',
    who: WHO,
    prerequisites: ['Products exist if you want component lines. The header can be saved with a name.'],
    steps: [
      'Open BOM. The title is Bills of materials.',
      'Press New BOM or Create first BOM.',
      'Enter the name, the product, the quantity, and each component. Status on the editor is Draft, Active, or Obsolete.',
      'Save, then press Activate on the row you want MRP to use.',
      'Delete asks “Delete this BOM structure?”',
    ],
    behind: [
      'A new BOM is draft. Activate stores status active. MRP uses active BOMs.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Name required', fix: 'Enter the BOM name. The API also requires the company.' },
      { message: 'companyId and name required', fix: 'Select the company and name the structure.' },
      { message: 'Activate failed', fix: 'Reload the row and press Activate again. The success line is “BOM active — ready for MRP & work orders”.' },
    ],
    faqs: [
      { q: 'No BOMs defined. Will MRP invent one?', a: 'No. Press Create first BOM. A run without an active BOM cannot explode that product.' },
    ],
  }),
  feat({
    id: 'run',
    name: 'Run',
    href: '/dashboard/manufacturing/production-orders',
    summary: 'Run is the work order. It moves from planned to released, in flight, hold, and complete. Complete can move stock and capture labour.',
    who: WHO,
    prerequisites: ['A product is required to create the order. A warehouse is required before complete will post stock. A cost per hour on the cell or the station is required before labour cost is captured.'],
    steps: [
      'Open Run. The title is Work orders.',
      'Press New work order. Choose Product. Work cell can stay Unassigned. Enter Qty planned, Priority (1=highest), and Scheduled start. Press Create order.',
      'Filter All, Planned, Released, In flight, Hold, or Complete.',
      'On a planned order press Release. On a released or hold order press Start. On an in-flight order press Progress, Log hours, Hold, or Complete.',
      'Complete asks for labour hours and says a blank uses the clock from start until now.',
      'On a complete order that still has no labour cost, press Capture labor.',
    ],
    behind: [
      'Statuses are planned, released, in_progress, hold, complete, and cancelled. The pills say PLANNED, RELEASED, IN FLIGHT, HOLD, COMPLETE, and CANCELLED.',
      'Start stores the actual start. Complete sets the completed quantity to the planned quantity when the completed quantity is still zero, then posts a produce movement and consume movements for the BOM when a product, a quantity, and a warehouse exist.',
      'Labour capture posts a cost journal only when a rate exists. Zero hours is skipped. Stock movements are not journals.',
      GL,
    ],
    errors: [
      { message: 'Select a product', fix: 'Choose Product before Create order.' },
      { message: 'product_id required', fix: 'The order cannot be saved without a product.' },
      { message: 'no warehouse', fix: 'Add a warehouse in Inventory, then complete the order again if stock did not move. The order can still be marked complete.' },
      { message: 'No cost rate on work cell/station — set cost_per_hour on the cell or station first', fix: 'Set the hourly rate on the cell or the station, then press Capture labor. The hours were not costed.' },
      { message: 'No labor hours to capture — set hours or ensure actual start/end times exist', fix: 'Enter hours on Complete, or make sure the order has a start and an end. Zero hours does not post a cost.' },
      { message: 'Invalid hours', fix: 'Enter a number, or leave the complete prompt blank to use the clock.' },
    ],
    faqs: [
      { q: 'Does Complete post the ledger by itself?', a: 'Stock movements are not journals. The ledger moves only when labour capture, or a later cost allocation, finds the chart accounts and a non-zero amount.' },
    ],
  }),
  feat({
    id: 'cells',
    name: 'Cells',
    href: '/dashboard/manufacturing/work-centers',
    summary: 'Cells are the work centres. You commission one, then set it active, maintenance, or offline.',
    who: WHO,
    prerequisites: ['A company is selected. Code and name are required.'],
    steps: [
      'Open Cells. The title is Work cells.',
      'Press New cell or Commission first cell. Enter CODE, Cell name, and Hours/day. Press Commission.',
      'Set the status button to active, maintenance, or offline. The in-use button reads in the raw status, shown as active, maintenance, or offline.',
      'Read WIP. It is the count of open orders assigned to the cell.',
    ],
    behind: [
      'A new cell is stored as active. Efficiency is the figure you store. It is not calculated on this page.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Code and name required', fix: 'Enter CODE and Cell name. The API says companyId, code, and name are required.' },
      { message: 'Delete failed', fix: 'Reload. A cell with history may refuse the delete. The success line is Cell removed.' },
    ],
    faqs: [
      { q: 'No work cells yet. Can a work order still start?', a: 'Yes. Work cell on the order can stay Unassigned. Commission a cell when you want hours and a labour rate attached to one.' },
    ],
  }),
  feat({
    id: 'costs',
    name: 'Costs',
    href: '/dashboard/manufacturing/cost-centres',
    summary: 'Costs is the structure of business units, stations, assets, and expenses. Allocate posts a journal when the chart can resolve the accounts.',
    who: WHO,
    prerequisites: ['The cost-structure tables exist. Allocate needs an amount and at least one of a business unit, a cell, a station, or an asset.'],
    steps: [
      'Open Costs. The title is Cost centres structure.',
      'Open Cost rollup, Business units, Work stations, Assets, or Expenses.',
      'Press New business unit and Create unit. Add a station or press New asset.',
      'On an expense enter Amount and Description. Choose the category: Materials (inventory · BS), Capital / PPE (BS), Operating, Labour, Energy, Maintenance, Depreciation, Overhead, or Other.',
      'Choose Allocate to BU, Allocate to cell, Allocate to station, or Allocate to asset, then allocate.',
    ],
    behind: [
      GL,
      'Capital / PPE (BS) is not given its own balance-sheet code. That category falls through to the operating codes 6990, then 6200.',
      'There is no period lock on this post. A zero amount is skipped. A second post of an entry that already has a journal does not post again.',
      'Delete asks “Delete this record?”',
    ],
    errors: [
      { message: 'Amount required', fix: 'Enter an amount before you allocate.' },
      { message: 'Allocate to a BU, cell, station, or asset', fix: 'Pick one target. The API refuses an expense with nowhere to sit.' },
      { message: 'COA missing expense or accrual accounts — open Accounting → Chart of Accounts and seed defaults', fix: 'Seed the chart in Finance. The cost row may already be saved. The journal waits on the accounts. Expense and credit accounts must also differ.' },
      { message: 'Code and name required', fix: 'A business unit or station needs both.' },
    ],
    faqs: [
      { q: 'The toast says Expense allocated without a journal number. Did it post?', a: 'The row was saved. The journal is missing when the chart cannot resolve the debit and the credit. Open the chart, seed the defaults, and allocate again if no journal number was shown.' },
    ],
  }),
];

export const MANUFACTURING_GUIDE: ModuleGuide = {
  id: 'manufacturing',
  name: 'Make',
  href: '/dashboard/manufacturing',
  purpose:
    'Make in SupplierAdvisor® is the factory: the bill of materials, the master schedule, the material explosion, the work order, the cells, and the cost centres. MRP does not raise a purchase order. The ledger moves when a cost entry posts, not when stock is produced.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'An active BOM and an active plan can firm planned work orders, a complete order can move stock, and a cost allocation can post the accrual journal.',
  flow: [
    { id: 'bom', label: 'BOM', hint: 'Draft, then active' },
    { id: 'mps', label: 'Plan', hint: 'Firm quantities' },
    { id: 'mrp', label: 'Explode', hint: 'No purchase order' },
    { id: 'wo', label: 'Work order', hint: 'Release, then complete' },
    { id: 'cost', label: 'Cost', hint: 'Journal if the chart exists' },
  ],
  faqs: [
    {
      q: 'The process picture starts at the BOM and the sidebar starts at Plan. Which order is the live one?',
      a: 'Both screens exist. MRP uses an active BOM and an active plan. You can open them in either order. Firm quantities become planned work orders. Explode only suggests make or buy.',
    },
  ],
  features,
};
