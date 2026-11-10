import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'CropAdvisor® opens for anyone who can view Operations. The gate says “Your role (…) cannot access Operations.” Saves check company membership. A field, an estimate, a harvest line, and a trade link do not depend on each other. Nothing here posts a ledger journal or creates an inventory lot.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const CROP_GUIDE: ModuleGuide = {
  id: 'fieldgraph',
  name: 'CropAdvisor®',
  href: '/dashboard/fieldgraph',
  purpose:
    'CropAdvisor® in SupplierAdvisor® is the field book: fields, estimates, the harvest sequence, vehicles, inputs, labour, regen, and links out to trade. Trade does not create a lot. Inputs do not decrement Inventory.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'A field can be saved, an estimate revised, and a cutting sequence projected. The trade screen only links out.',
  flow: [
    { id: 'field', label: 'Field', hint: 'Code and name' },
    { id: 'estimate', label: 'Estimate', hint: 'Then actual' },
    { id: 'harvest', label: 'Harvest', hint: 'Projection' },
    { id: 'trade', label: 'Trade', hint: 'Links only' },
  ],
  faqs: [
    {
      q: 'The trade screen mentions origin lots and OTIFEF. Did harvest create a lot?',
      a: 'No. Saving a harvest line does not create a lot. Trade links to Inventory lots, Customers, Suppliers, and Ship. Inputs do not decrement stock.',
    },
  ],
  features: [
    feat({
      id: 'command',
      name: 'Command',
      href: '/dashboard/fieldgraph',
      summary: 'Command counts fields, estimate tonnes, open harvest, and fleet, and opens the other screens.',
      who: WHO,
      prerequisites: ['A company is selected. Load demo estate is refused in production.'],
      steps: ['Open Command.', 'Open Field & agronomic data, Estimates, Harvest Planner, Vehicle Management, Inputs, Labour, Regen, Trade, or Reports.', 'Origin lots opens Inventory lots. It is not a lot this desk created.'],
      behind: ['The tiles read this company’s book. No stock movement and no journal are posted.'],
      errors: [
        { message: 'SupplierAdvisor® does not load a sample book on production.', fix: 'Add a field. Load demo estate does not run in production.' },
        { message: 'Load failed', fix: 'Keep the company selected and open Command again.' },
      ],
      faqs: [{ q: 'The tiles are zero. Is an estate missing?', a: 'Nothing has been saved. Add a field. The desk does not fill one in.' }],
    }),
    feat({
      id: 'fields',
      name: 'Field & agronomic',
      href: '/dashboard/fieldgraph/fields',
      summary: 'Field & agronomic is the shared field master. Code and name are required.',
      who: WHO,
      prerequisites: ['Code and name are required. Irrigation is Dryland, Irrigated, or Partial.'],
      steps: ['Open Field & agronomic. The form is Add / update field (agronomic master).', 'Enter Code and Field name, the crop, and Irrigation. Press Save field master.', 'Select a row to read Yield & quality · seasons.'],
      behind: ['The field is stored on this company. Delete toasts Removed. No stock and no journal are posted.'],
      errors: [
        { message: 'Code and name required', fix: 'Fill both. The success line says the agronomic record was saved.' },
        { message: 'No estimate/actual yield rows yet for this field. Add estimates and actuals under Estimates.', fix: 'The field exists. Estimates are a different screen.' },
      ],
      faqs: [{ q: 'Click a field row does nothing useful. Why?', a: 'That is the unselected panel. Select a row to see the yield bars. If there are no estimates, the panel says so.' }],
    }),
    feat({
      id: 'estimates',
      name: 'Estimates',
      href: '/dashboard/fieldgraph/estimates',
      summary: 'Estimates saves a revision and a separate actual yield. Board marks the row for the mill group board. It does not submit the board.',
      who: WHO,
      prerequisites: ['Select a field. The status options are Draft, Submitted, Revised, Mill board, and Final.'],
      steps: [
        'Open Estimates. Under Create / revise estimate choose the field, the season, the tonnes, and the status. Press Save estimate.',
        'Press Board on a row to store the board status. Press Export Mill Board CSV if you need the file.',
        'Under Record actual yield press Save actual. Actual yield is not an estimate status.',
      ],
      behind: ['Revisions stay on the estimate. The CSV is built in the browser. No lot and no journal are posted.'],
      errors: [
        { message: 'Select a field', fix: 'The field list is empty until a field exists. Save one first.' },
        { message: 'No season data yet', fix: 'Save an estimate. The desk does not invent a season.' },
      ],
      faqs: [{ q: 'Does Board send the estimate to the mill?', a: 'No. It stores the status and a board reference. The toast says marked for Mill Group Board submission. Nothing is transmitted.' }],
    }),
    feat({
      id: 'harvest',
      name: 'Harvest Planner',
      href: '/dashboard/fieldgraph/harvest',
      summary: 'Harvest Planner builds a cutting sequence and projects dates. The trade screen calls this Harvest plan. The title is Harvest Planner.',
      who: WHO,
      prerequisites: ['A field is required. Tonnes copy from a non-draft estimate when one exists. The sequence must have a row before projection.'],
      steps: [
        'Open Harvest Planner. Set Season.',
        'Under Add to cutting sequence choose the field and press Add field to sequence. Status options are Planned, Cutting, Delivered, and Done. The table shows those words in lowercase.',
        'Set Season start (first cut) and Daily allocation (tonnes / day). Press Run projection.',
        'Use Move up and Move down to reorder.',
      ],
      behind: ['Projection writes the planned start, the planned end, and the days. It does not create a lot, a delivery, or a journal. If the daily tonnes are missing, the server uses 120.'],
      errors: [
        { message: 'Select a field', fix: 'Choose a field before Add field to sequence.' },
        { message: 'Add fields to the sequence first', fix: 'Projection needs at least one row. The empty line names the season.' },
      ],
      faqs: [{ q: 'Did the projection create a mill delivery?', a: 'No. Destination is text on the row. Trade is where the links to lots and customers are, and those links do not create the documents.' }],
    }),
    feat({
      id: 'vehicles',
      name: 'Vehicles',
      href: '/dashboard/fieldgraph/fleet',
      summary: 'Vehicles registers a machine and a daily activity. Fuel and rand per kilometre are calculated here. They are not a stock issue.',
      who: WHO,
      prerequisites: ['Code and name are required to register. An activity needs a vehicle from the list or a free-text name.'],
      steps: [
        'Open Vehicles. The title is Vehicle Management.',
        'On Vehicle registry enter Code and Name. Press Register.',
        'On Daily activity choose the vehicle or type one, the activity, the hours, and the fuel. Press Log daily activity.',
      ],
      behind: ['Utilisation is calculated from the logs. No fuel stock is issued and no journal is posted.'],
      errors: [
        { message: 'Code and name required', fix: 'Both are required. The success line says the vehicle was registered with fuel and rand-per-kilometre rates.' },
        { message: 'Select or name a vehicle', fix: 'Pick a vehicle or type a name before you log the day.' },
      ],
      faqs: [{ q: 'No vehicles registered yet. Is this FleetAdvisor®?', a: 'No. This is the crop vehicle book. FleetAdvisor® is a separate module.' }],
    }),
    feat({
      id: 'inputs',
      name: 'Inputs',
      href: '/dashboard/fieldgraph/inputs',
      summary: 'Inputs logs a fertiliser, chemical, seed, or other application. It does not decrement Inventory.',
      who: WHO,
      prerequisites: ['A field and a product are required.'],
      steps: [
        'Open Inputs. Choose Field. Enter the date, Product, and Qty. Category is Fertiliser, Chemical, Seed, or Other. Unit starts as kg.',
        'Enter N kg/ha, P kg/ha, and K kg/ha when you have them, and Cost ZAR. Press Log application.',
      ],
      behind: ['The row is an application on this book. Cost is a number on the row. Inventory on-hand does not change and no journal is posted.'],
      errors: [{ message: 'Field and product required', fix: 'Choose the field and enter the product. The success line is Application logged.' }],
      faqs: [{ q: 'Will a fertiliser line reduce warehouse stock?', a: 'No. Inputs do not decrement Inventory.' }],
    }),
    feat({
      id: 'labour',
      name: 'Labour & rates',
      href: '/dashboard/fieldgraph/labour',
      summary: 'Labour registers a gang and logs a day. The toast says the gang was synced to People. Gang / crew is the type that is not written to People.',
      who: WHO,
      prerequisites: ['Code and name are required. A rate in rand is required. Statutory payroll stays in People. The page says so.'],
      steps: [
        'Open Labour & rates. On Gangs & rates enter Code and Gang / crew name. Choose Permanent, Temporary / seasonal, Contractor, or Gang / crew. Enter Rate (ZAR) and the rate unit. Press Register gang with rate.',
        'On Daily labour choose the gang, the field, the activity, the headcount, and the hours. Press Log labour with rate.',
      ],
      behind: [
        'The page toast says Gang registered — synced to People directory for every save. Permanent, temporary, and contractor are written across. Gang / crew stays on this book. The API text that says only permanent is dual-written is narrower than the mapper.',
        'No payroll journal is posted here.',
      ],
      errors: [
        { message: 'Code and name required', fix: 'Fill both before Register gang with rate.' },
        { message: 'Enter a labour rate (ZAR)', fix: 'The rate cannot be blank.' },
        { message: 'Crop / quarry gangs stay in the operational book unless marked as staff or contractor', fix: 'Gang / crew is not written to People. Choose Permanent, Temporary / seasonal, or Contractor when you want that link.' },
      ],
      faqs: [{ q: 'Does this run payroll?', a: 'No. Rates stay on the crop book. People payroll is a different module.' }],
    }),
    feat({
      id: 'regen',
      name: 'Regen',
      href: '/dashboard/fieldgraph/regen',
      summary: 'Regen saves a field sample: soil carbon, moisture, cover, and water. It does not write the Impact inventory.',
      who: WHO,
      prerequisites: ['A field is required. Impact is a link, not a save.'],
      steps: ['Open Regen. Choose Field. Enter SOC %, Moisture %, Cover %, Water mm, and the notes. Press Save sample.'],
      behind: ['The sample stays on the crop book. The Impact link opens the sustainability module. This save does not write it and does not post a journal.'],
      errors: [{ message: 'Select a field', fix: 'Choose a field. The success line is Regen sample saved.' }],
      faqs: [{ q: 'Does Regen update the Impact inventory?', a: 'No. Impact is a separate module. This screen does not write those emission lines.' }],
    }),
    feat({
      id: 'trade',
      name: 'Trade',
      href: '/dashboard/fieldgraph/trade',
      summary: 'Trade lists harvest destinations and links to lots, customers, suppliers, and Ship. It does not create those documents.',
      who: WHO,
      prerequisites: ['Harvest lines exist if you expect destinations. The empty line names Harvest plan. The screen title of that page is Harvest Planner.'],
      steps: ['Open Trade. Read the destinations.', 'Open Inventory lots, Customers, Suppliers, or Ship from the links. Create the lot or the order there.'],
      behind: ['Nothing is saved that becomes a lot, an order, an invoice, or a journal. The OTIFEF words on the page are not a score this screen calculates from a new lot.'],
      errors: [{ message: 'No harvest lines yet — build them under Harvest plan.', fix: 'Add the sequence on Harvest Planner. The link name and the screen title differ.' }],
      faqs: [{ q: 'Where is the mill invoice?', a: 'Not here. Customers and Finance hold invoices. This page only links out.' }],
    }),
    feat({
      id: 'management',
      name: 'Management report',
      href: '/dashboard/fieldgraph/management',
      summary: 'The management report is the key-metrics pack for this company’s fields. It does not invent a benchmark.',
      who: WHO,
      prerequisites: ['Fields and estimates exist if you expect tonnes. The management address opens the report.'],
      steps: ['Open Management report. The address opens the report. Use the period slicer, then CSV or Refresh.'],
      behind: ['Figures come from this company’s book. No journal is posted.'],
      errors: [{ message: 'Load failed', fix: 'Reopen the report. Zeros mean the book is empty.' }],
      faqs: [{ q: 'Is the PDF a mill submission?', a: 'No. It is a pack of the figures on the book. Board submission of an estimate is the Board button on Estimates, and that only stores a status.' }],
    }),
  ],
};
