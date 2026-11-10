import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

/**
 * Desk roles come from lib/fleet/roles.ts.
 * Owner stays owner. Admin is the manager.
 * Member and Operations are the dispatcher (operations write, no accounting view).
 * Finance is the office. Viewer and Sales are viewers.
 * Cost entries stay on the fleet desk. They do not post a finance journal.
 */
const WHO =
  'FleetAdvisor® opens for anyone who can view Operations. Owner is the desk owner. Admin is the manager. Member and Operations are the dispatcher. Finance is the office. Viewer and Sales are viewers. A sales contractor cannot open the dashboard. The module gate says “Your role (…) cannot access Operations.” A refused action says “You cannot do that.”';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'command',
    name: 'Command',
    href: '/dashboard/fleetgraph',
    summary: 'Command is the fleet home: the register, open jobs, and cost per kilometre when the role can see costs.',
    who: WHO,
    prerequisites: ['Open the company whose fleet you are keeping.', 'You can view Operations.'],
    steps: [
      'Open Command from FleetAdvisor®.',
      'Press Add your first vehicle when the register is empty. Cost per kilometre shows Not enough data until odometer readings and costs exist.',
      'Use Open jobs, Vehicles, and Drivers. Cost per kilometre is shown to roles that can see costs.',
    ],
    behind: [
      'The desk reads this company’s fleet book. An empty register is not filled with another company’s vehicles.',
      'Quotes and customer invoices are not on this desk. There is no invoice button.',
    ],
    errors: [
      {
        message: 'The desk could not load.',
        fix: 'Reload the page. If it persists, the fleet tables may not be applied yet. Settings then says they are pending.',
      },
      {
        message: 'Your role (…) cannot access Operations.',
        fix: 'Ask an owner for a role that can view Operations.',
      },
    ],
    faqs: [
      {
        q: 'Where do I invoice a load?',
        a: 'You do not, on this desk. Quotes and invoicing are not switched on. A job can store a price. It does not become a finance invoice.',
      },
    ],
  }),
  feat({
    id: 'map',
    name: 'Fleet map',
    href: '/dashboard/fleetgraph/map',
    summary: 'Fleet map explains where a position could come from. Nothing is tracked live, and the page does not plot a vehicle.',
    who: WHO,
    prerequisites: ['You can open FleetAdvisor®.'],
    steps: [
      'Open Fleet map. The page says nothing is tracked yet.',
      'Under Position sources, Manual odometer is available now. Press Add an odometer reading. That opens Vehicles. A reading is a distance, not a live dot.',
      'Driver phone says a consented phone fix during a trip is not switched on.',
      'GPS file import and Telematics integrations are listed as not switched on.',
    ],
    behind: [
      'No live position is stored and no tracker feed is assumed.',
      'The process picture that calls this the last odometer distance is the vehicles register, not a map of places.',
    ],
    errors: [
      {
        message: 'Your role (…) cannot access Operations.',
        fix: 'The map uses the same Operations gate as the rest of FleetAdvisor®.',
      },
    ],
    faqs: [
      {
        q: 'Why is there no vehicle dot?',
        a: 'Live positions are not tracked. Record an odometer reading on the vehicle. That is a kilometre reading.',
      },
    ],
  }),
  feat({
    id: 'vehicles',
    name: 'Vehicles',
    href: '/dashboard/fleetgraph/vehicles',
    summary: 'Vehicles is the register: registration, status, odometer readings, and running costs for roles that may see them.',
    who: `${WHO} Add a vehicle, Save vehicle, Add reading, and Save status are the owner, the manager, and the dispatcher. Add cost entry is accepted for the owner and the manager. The office can read costs and is refused on the save.`,
    prerequisites: ['You can edit the register, unless you are only reading.'],
    steps: [
      'Open Vehicles. Filter All, Active, Workshop, Off road, or Sold. Search by Registration.',
      'Press Add a vehicle or Add your first vehicle. Enter Registration. Press Save vehicle. The button stays off until Registration is filled.',
      'Open the vehicle. Under Odometer, enter Reading and press Add reading.',
      'Under Status, choose Active, Workshop, Off road, or Sold. Press Save status.',
      'Where your role sees costs, open Costs and profile. Choose Category: Fuel, Toll, Border, Maintenance, Tyres, Other running, Fine, or Other. Enter Amount (rand) and Date. VAT amount (rand) can stay blank to use the workspace rate. Tick VAT is claimable when it applies. For Fuel, enter Litres, Odometer at fill, and tick Full tank if it was. Press Add cost entry.',
      'On a cost row, press Reverse. A reversed row shows Reversed. Press Open record for the vehicle page.',
    ],
    behind: [
      'Save vehicle stores the registration on this company’s fleet book. A new vehicle starts as a rigid you own, status active, unless you change status afterwards.',
      'Add cost entry writes a fleet cost row. It does not post a finance journal. The word ledger on this screen means that cost list, not Finance.',
      'Standing and capital costs are refused on this list. They belong on the cost profile. Press Save cost profile for those.',
      'Reverse writes an opposite cost row. The original stays. A reversal cannot itself be reversed.',
      'Dispatcher cost-per-kilometre figures are omitted from the list. The office can read costs. Driver pay is left off the office view.',
    ],
    errors: [
      {
        message: 'You cannot do that.',
        fix: 'The office, a viewer, and a dispatcher cannot add a running cost. Owner or Admin can. A dispatcher also cannot archive a vehicle.',
      },
      {
        message: 'You cannot archive a vehicle.',
        fix: 'Archiving is for the owner or the manager. The dispatcher can edit the register and cannot archive.',
      },
      {
        message: 'Check the amount.',
        fix: 'Enter an amount above zero. The placeholder shows 1 500.00 or 1500,50.',
      },
      {
        message: 'Standing and capital costs belong on the cost profile, not the ledger.',
        fix: 'Use Save cost profile for purchase and standing costs. Use Add cost entry for fuel, tolls, and the other running categories.',
      },
      {
        message: 'A reversal cannot be reversed.',
        fix: 'The row is already a reversal. Add a new cost entry if you need another figure.',
      },
      {
        message: 'This record changed. Reload and try again.',
        fix: 'Someone else saved the vehicle. Reload, then save again.',
      },
      {
        message: 'The desk could not save that.',
        fix: 'Reload. If fleet tables are not applied, the save cannot land yet.',
      },
    ],
    faqs: [
      {
        q: 'Why does cost per kilometre say Not enough data?',
        a: 'The vehicle needs odometer readings and costs. Two readings at least 7 days apart are what the desk asks for before a kilometre rate can be built.',
      },
    ],
  }),
  feat({
    id: 'drivers',
    name: 'Drivers',
    href: '/dashboard/fleetgraph/drivers',
    summary: 'Drivers stores a name, a phone, employment, and a licence code. It does not store an identity number.',
    who: `${WHO} Add a driver and Save driver are the owner, the manager, and the dispatcher.`,
    prerequisites: ['Demo-data mode blocks personal details on an import until an owner confirms real data. Typing a driver on this screen still uses the form below.'],
    steps: [
      'Open Drivers. Press Add a driver.',
      'Enter Name. Phone, Employment, Licence code, and Notes are on the same form. Employment is Employee, Contractor, or Owner-operator.',
      'Press Save driver. Name is required. The form has no identity-number field.',
    ],
    behind: [
      'A 13-digit number, or the words for a licence or passport number, are stripped out of free text. The desk does not store them.',
      'The dispatcher cannot archive a driver. The owner and the manager can.',
    ],
    errors: [
      {
        message: 'Remove the 13-digit number. This desk does not store identity numbers.',
        fix: 'Take the number out of Notes or any other free-text field.',
      },
      {
        message: 'Remove the licence or passport number. This desk does not store it.',
        fix: 'Keep the licence code, such as EC. Do not paste the licence number.',
      },
      {
        message: 'You cannot archive a driver.',
        fix: 'Ask an owner or an admin. The dispatcher can edit the driver and cannot archive them.',
      },
    ],
    faqs: [
      {
        q: 'Where is the identity number?',
        a: 'It is not on the form, and the server rejects one if it is pasted into notes.',
      },
    ],
  }),
  feat({
    id: 'compliance',
    name: 'Compliance',
    href: '/dashboard/fleetgraph/compliance',
    summary: 'Compliance is the expiry list: licence discs, permits, and the dates the company enters. It does not decide the law.',
    who: `${WHO} Add date and Save dates are the owner, the manager, and the dispatcher. Reminder rules are the owner and the manager. The office can read and export.`,
    prerequisites: ['A vehicle or a driver exists before a date can be attached to one.'],
    steps: [
      'Open Compliance. Filter Every kind, or narrow the list. The empty hint says to add a vehicle, then record its licence disc date.',
      'Press Add your first licence disc date, or Add date. Press Save dates.',
      'For a PrDP, set the category to G, D, or P. Press Save permit.',
      'Press the export when your role can export. The office can export. A dispatcher records dates and does not manage reminder rules.',
      'An owner or manager opens reminder settings, chooses the rule, the channels, and the recipients, and presses Save reminder. The log is Reminder log.',
    ],
    behind: [
      'Dates are whatever this company enters. The product does not supply a legal calendar.',
      'A PrDP without a category is refused. Country codes on a cross-border permit must be between 1 and 12.',
      'Reminders are for the owner and the manager. Other roles see “Reminder settings are for an owner or manager.”',
    ],
    errors: [
      {
        message: 'PrDP needs a category.',
        fix: 'Choose G, D, or P before you save the permit.',
      },
      {
        message: 'PrDP category must be G, D or P.',
        fix: 'Use one of those three letters.',
      },
      {
        message: 'The new expiry must be after the current one.',
        fix: 'Renewal only moves the date forward. Pick a later expiry.',
      },
      {
        message: 'Add the province.',
        fix: 'A permit that needs a province cannot be saved blank.',
      },
    ],
    faqs: [
      {
        q: 'No dated rows in this filter. What now?',
        a: 'That sentence means this filter has nothing. Change Every kind or All dates, or add the date on the vehicle.',
      },
    ],
  }),
  feat({
    id: 'jobs',
    name: 'Jobs',
    href: '/dashboard/fleetgraph/jobs',
    summary: 'A job holds the customer, the stops, and the cargo. Dispatch and proof of delivery are not switched on.',
    who: `${WHO} Create a job and Save job are the owner, the manager, and the dispatcher. The price field is hidden unless the role can see rates. A dispatcher sees prices only after the owner turns that on.`,
    prerequisites: ['The customer must already belong to this company. You cannot type a stranger and have the job create them.'],
    steps: [
      'Open Jobs. Filter All, Draft, Booked, or Cancelled.',
      'Press Create a job. Search the customer with Search by name and choose one from this company.',
      'Add the stops. A stop needs a place. The empty hint says to create a job with a pickup and a delivery. Assignment comes later.',
      'Enter the price where the field is shown. Press Save job.',
    ],
    behind: [
      'Save job stores the job on the fleet book. It does not create a sales order, a delivery note, or a finance invoice.',
      'There is no dispatch button and no proof-of-delivery button. The page says both are not switched on.',
      'A stop that already belongs to another job is refused.',
    ],
    errors: [
      {
        message: 'Choose a customer from this company.',
        fix: 'Pick a customer already on this company. The job will not invent one.',
      },
      {
        message: 'Check the stops.',
        fix: 'Each stop needs a known kind and valid dates. Fix the row the message points at.',
      },
      {
        message: 'That stop belongs to another job.',
        fix: 'Use a new stop, or open the job that already owns it.',
      },
      {
        message: 'You cannot do that.',
        fix: 'The office and a viewer cannot create a job.',
      },
    ],
    faqs: [
      {
        q: 'Why is the price missing?',
        a: 'Dispatchers do not see job prices until the owner presses Let dispatchers see prices. That switch does not reveal cost per kilometre.',
      },
    ],
  }),
  feat({
    id: 'cpk',
    name: 'Cost per kilometre',
    href: '/dashboard/fleetgraph/cpk',
    summary: 'Cost per kilometre is built from this company’s readings and costs. It says Not enough data until those exist.',
    who: `${WHO} The owner, the manager, and the office can open the costs. A dispatcher sees “Cost per kilometre is hidden for this role.” Driver pay stays with the owner and the manager.`,
    prerequisites: ['Vehicles, odometer readings, and cost entries exist. Otherwise the rate cannot be calculated.'],
    steps: [
      'Open CPK.',
      'Read the layers Running, Standing, Capital, and Overhead.',
      'Set Target scope to Whole fleet or Vehicle class. Enter the target in rand per kilometre. Targets are this company’s own figures.',
      'Record an overhead pool for the month when you have one, and save it from that form.',
    ],
    behind: [
      'The rate uses the fleet book only. It does not read the finance ledger and it does not post one.',
      'How this is calculated says distance can come from GPS. The book does not pass position fixes, and Fleet map says nothing is tracked. Distance comes from completed trip readings or odometer pairs. Planned kilometres are not used.',
      'Office can read costs. Driver pay is removed from that view. The empty hint names an owner or an office role and leaves out the manager. Admin can open this screen.',
      'Not enough data, Partial, and Complete are the completeness states on the vehicle.',
    ],
    errors: [
      {
        message: 'Cost per kilometre is hidden for this role.',
        fix: 'Open it as Owner, Admin, or Finance. A dispatcher is not given this screen’s costs.',
      },
    ],
    faqs: [
      {
        q: 'Can I type a cost per kilometre?',
        a: 'You can set a target in rand per kilometre. The actual rate is calculated from readings and costs. It is not a number you type over the result.',
      },
    ],
  }),
  feat({
    id: 'import',
    name: 'Import',
    href: '/dashboard/fleetgraph/import',
    summary: 'Import brings vehicles, drivers, or compliance dates from a CSV, or vehicles and drivers from Ship. Ship is not changed.',
    who: `${WHO} A CSV import is the owner or the manager. Import from Ship is the owner only. The screen says “Only an owner can import from Ship.”`,
    prerequisites: ['Run Dry run before Commit. A driver import while demo-data mode is on can be counted and cannot be committed.'],
    steps: [
      'Open Import. Choose Ship vehicles, Ship drivers, Vehicles CSV, Drivers CSV, or Compliance CSV.',
      'For a CSV, edit the CSV box. For Ship, read Import from Ship. It is one-way. Licence numbers are never read.',
      'Press Dry run. Read Create, Link, Fill, and Errors.',
      'Press Commit. If this file was already committed, the screen says Already imported.',
    ],
    behind: [
      'Commit writes the fleet book. Ship rows are copied in. Ship itself is not updated.',
      'Demo-data mode blocks a driver commit: “Demo-data mode is on. Personal details stay off until an owner confirms real data in Settings.” Dry-run counts still work.',
      'A second commit of the same import does not duplicate the rows.',
    ],
    errors: [
      {
        message: 'Run a dry run first.',
        fix: 'Press Dry run. Commit stays off until that result is in.',
      },
      {
        message: 'You cannot import that.',
        fix: 'Ship imports are owner-only. A manager can commit a CSV. A dispatcher cannot import.',
      },
      {
        message: 'The desk could not read Ship.',
        fix: 'Ship has no rows the desk could read, or the read failed. Fix Ship, then dry-run again. Ship is not edited from here.',
      },
      {
        message: 'That import is not available.',
        fix: 'Choose one of the five kinds on the screen.',
      },
      {
        message: 'Database setup is still pending.',
        fix: 'The fleet tables are not applied. The import cannot be stored yet.',
      },
    ],
    faqs: [
      {
        q: 'Will Import change my Ship vehicles?',
        a: 'No. The page says Ship is never changed. The copy lands on the fleet book.',
      },
    ],
  }),
  feat({
    id: 'settings',
    name: 'Settings',
    href: '/dashboard/fleetgraph/settings',
    summary: 'Settings holds the workspace name, the required rate margin, who sees prices, and the switch out of demo-data mode.',
    who: `${WHO} Save settings is the owner or the manager. Retention, price visibility, and Confirm real data are the owner. Other roles see “You can look, not change”.`,
    prerequisites: ['Fleet tables are applied. Until then the page says “Settings are pending” and the workspace cannot be saved.'],
    steps: [
      'Open Settings. Enter Display name and Required rate margin (%). 10 means 10%. Press Save settings.',
      'Read What each role can do.',
      'The owner uses Owner switches. Press Let dispatchers see prices, or Hide prices from dispatchers. It starts off.',
      'Set Suggested holding period (days) and press Save holding period.',
      'To leave demo-data mode, type ENABLE REAL DATA in “Type ENABLE REAL DATA to leave demo-data mode” and press Confirm real data.',
    ],
    behind: [
      'Confirm real data is stored for this company. Until then, personal details on a driver import stay off.',
      'Letting dispatchers see prices reveals job prices only. It does not reveal cost per kilometre or driver pay.',
      'The margin is added on top of fleet breakeven when the desk shows the required rate.',
    ],
    errors: [
      {
        message: 'Settings are pending until the fleet tables are applied.',
        fix: 'The workspace cannot be saved yet. This is not a read-only role. Use Back to command and try again after the tables exist.',
      },
      {
        message: 'You can look, not change',
        fix: 'Dispatcher, office, and viewer do not edit settings. Ask an owner or an admin.',
      },
      {
        message: 'Retention, price visibility and the real-data switch are owner-only.',
        fix: 'Admin can save the workspace name and the margin. The three owner switches stay with Owner.',
      },
    ],
    faqs: [
      {
        q: 'Does Confirm real data load example vehicles?',
        a: 'No. It only leaves demo-data mode so personal details can be stored. Vehicles still come from the register or from Import.',
      },
    ],
  }),
];

export const FLEET_GUIDE: ModuleGuide = {
  id: 'fleetgraph',
  name: 'FleetAdvisor®',
  href: '/dashboard/fleetgraph',
  purpose:
    'FleetAdvisor® in SupplierAdvisor® is the vehicle register, the drivers, the compliance dates, the jobs, and the cost of a kilometre. Live tracking, dispatch, proof of delivery, quotes, and invoices are not on this desk.',
  roles: ['Owner', 'Admin', 'Member', 'Operations', 'Finance', 'Viewer', 'Sales'],
  outcome:
    'The register has vehicles and drivers, dates are recorded, a job can be saved against a customer of this company, and cost per kilometre is calculated when readings and costs exist.',
  flow: [
    { id: 'vehicle', label: 'Vehicle', hint: 'Registration' },
    { id: 'driver', label: 'Driver', hint: 'No ID number' },
    { id: 'dates', label: 'Compliance', hint: 'Dates you enter' },
    { id: 'job', label: 'Job', hint: 'No dispatch yet' },
    { id: 'read', label: 'Odometer', hint: 'And running cost' },
    { id: 'cpk', label: 'Per kilometre', hint: 'From your entries' },
  ],
  faqs: [
    {
      q: 'The process picture talks about billing the customer. Where is the invoice?',
      a: 'It is not switched on. A job can store a price. It does not create a quote, an invoice, or a finance journal.',
    },
    {
      q: 'Fleet map looks empty of vehicles. Is tracking on?',
      a: 'No. The page says nothing is tracked yet. Manual odometer is the source that works, and it records distance on the vehicle, not a position.',
    },
  ],
  features,
};
