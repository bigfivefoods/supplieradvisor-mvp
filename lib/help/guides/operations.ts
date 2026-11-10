import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Operations opens for anyone who can view Operations. On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. A sales contractor cannot. The gate says “Your role (…) cannot access Operations.” These screens read other modules. They do not post a journal. Chain setup is the write on this module, and that save checks company membership.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'overview',
    name: 'Overview',
    href: '/dashboard/operations',
    summary: 'Overview is the operations tower. It counts purchase orders, shipments, stock, work orders, and exceptions. It does not create them.',
    who: WHO,
    prerequisites: ['A company is selected. If the operations module is off, enable it under Company → Profile → Modules.'],
    steps: [
      'Open Overview. The title is Operations Command.',
      'Press Refresh.',
      'Read Throughput, In motion, and Exceptions, then the telemetry: Open buy POs, Inbound motion, Units on hand, WOs in flight, Outbound motion, Customer open, Containers, and Exceptions.',
      'Open a card: Company calendar, Supplier orders, Inbound, Warehouse & inventory, Production, Outbound, or Customer fulfillment. Each card says Open workbench.',
    ],
    behind: [
      'Open buy POs are the purchase orders in sent, accepted, funded, in transit, partial, open, or confirmed.',
      'Work orders in flight are released, in progress, or hold. Shipment motion is booked through out for delivery.',
      'Exceptions add a shipment exception, a work order on hold, and quality rows that are open, pending, or in progress.',
      'No journal is posted from this page.',
    ],
    errors: [
      { message: 'Your role (…) cannot access Operations.', fix: 'Ask an owner for a role that can view Operations.' },
      { message: 'companyId required', fix: 'Select a company. The empty tower is not a failed load.' },
    ],
    faqs: [
      { q: 'Activity is empty. What now?', a: 'The line is “Activity appears as you create POs, work orders, and shipments.” Create those in Suppliers, Make, or Ship. This page does not seed them.' },
    ],
  }),
  feat({
    id: 'calendar',
    name: 'Calendar',
    href: '/dashboard/calendar',
    summary: 'Calendar is the company week. It shows advisor bookings, People leave, and supplier deliveries. It is the same calendar Home opens.',
    who: 'Anyone who can open the dashboard can open the calendar. A sales contractor cannot. Leave shown here is the People leave that also blocks a coach diary.',
    prerequisites: ['A company is selected. The page says Select a company first when none is open.'],
    steps: [
      'Open Calendar from Operations or from Home. The title is Company calendar.',
      'Set From and To.',
      'Filter with all, gym, clinic, hire, leave, or delivery. The buttons use those words.',
    ],
    behind: [
      'The week reads events already saved by the other modules. It does not post a journal.',
      'Leave on a coach blocks that coach’s diary. The page says so.',
    ],
    errors: [
      { message: 'Select a company first.', fix: 'Choose the company, then reopen the calendar.' },
    ],
    faqs: [
      { q: 'Can I approve leave here?', a: 'No. This screen filters and shows the week. Leave is recorded in People.' },
    ],
  }),
  feat({
    id: 'chains',
    name: 'Chains',
    href: '/dashboard/operations/chains',
    summary: 'Chains links a customer, your finished goods, and a supplier, then lists the live orders on that path.',
    who: `${WHO} Save chain checks that you are a member of the company. It does not re-check an operations write role.`,
    prerequisites: ['Sellable finished goods exist in Inventory if you want them on the chain. The page says to add them when the list is empty.'],
    steps: [
      'Open Chains. The title is Order chains.',
      'Press Add chain. Under 1 · Customer choose Select customer…. Under 2 · Your products choose the finished goods. Under 3 · Supplier choose Select supplier…. Press Save chain. An existing chain uses Update chain.',
      'Press Remove to drop a chain.',
      'Filter Live orders with linked, all, or independent. Open a linked sales order or the preferred manufacturer when you need the source document.',
    ],
    behind: [
      'A chain is the routing record. The customer-facing statuses named on the page are Scheduled, In production, and Produced.',
      'Saving a chain does not post a journal and does not create the sales order. The order appears when the customer purchase order has become a sales order.',
    ],
    errors: [
      { message: 'Failed to load chains', fix: 'Press Refresh and stay on the company.' },
      { message: 'No sellable finished goods yet — add them under Inventory.', fix: 'Add the product in Inventory and mark it sellable, then reopen the chain.' },
    ],
    faqs: [
      { q: 'No linked chains yet. Did a save fail?', a: 'Not always. The empty copy says a chain appears when a customer purchase order becomes a sales order. Add chain stores the route. The live card waits for that order.' },
    ],
  }),
  feat({
    id: 'inbound',
    name: 'Inbound',
    href: '/dashboard/operations/inbound',
    summary: 'Inbound lists supplier shipments. Creating and advancing them is done in Ship.',
    who: WHO,
    prerequisites: ['Shipments exist in Ship with direction inbound. This page does not create one.'],
    steps: [
      'Open Inbound. The title is Inbound Command.',
      'Read Ships, Motion, and Exceptions.',
      'Press Manage inbound or, when the list is empty, Create inbound shipment. Both open Ship.',
      'Press Track on a row. A row without a carrier shows No carrier.',
    ],
    behind: [
      'Statuses shown are planned, booked, picked up, in transit, at hub, customs, out for delivery, delivered, exception, and cancelled.',
      'This page does not write the shipment and does not post a journal.',
    ],
    errors: [
      { message: 'No inbound shipments', fix: 'Create the shipment in Ship, or start from a supplier purchase order and plan the receive. This screen stays empty until then.' },
    ],
    faqs: [
      { q: 'Can I mark a shipment delivered here?', a: 'No. Use Advance or Log event on the Ship inbound board.' },
    ],
  }),
  feat({
    id: 'store',
    name: 'Store',
    href: '/dashboard/operations/warehouse',
    summary: 'Store shows locations, products, and units on hand, then opens Inventory. It does not receive stock.',
    who: WHO,
    prerequisites: ['Inventory has been opened for this company at least as far as the summary. Counts are zero when nothing is saved.'],
    steps: [
      'Open Store. The title is Warehouse & inventory. The in-page name is Warehouse.',
      'Read Locations, Products, Units on hand, Low stock, Raw materials, and Finished goods.',
      'Open Live stock, Receive / scan, Transfers, Cycle counts, Lots & serials, or Locations. Press Open inventory OS for the inventory home.',
    ],
    behind: ['The counts come from the inventory summary. Nothing is posted from this page.'],
    errors: [
      { message: 'Your role (…) cannot access Operations.', fix: 'The warehouse cards use the Operations gate. Inventory has its own gate when you open a stock screen.' },
    ],
    faqs: [
      { q: 'Units on hand is zero. Is stock hidden?', a: 'Nothing has been received for this company, or the summary could not load and the cards fell back to zero. Open Inventory to receive.' },
    ],
  }),
  feat({
    id: 'make',
    name: 'Make',
    href: '/dashboard/operations/production',
    summary: 'Make on the operations tower lists work orders. Releasing and completing them is done in the Make module.',
    who: WHO,
    prerequisites: ['Work orders exist in Make. This page does not create one.'],
    steps: [
      'Open Make. The title is Production operations.',
      'Read Work orders, In flight, OEE proxy, and Active BOMs.',
      'Open the priority queue. Status pills are PLANNED, RELEASED, IN FLIGHT, HOLD, COMPLETE, and CANCELLED.',
      'Press Work orders or, when empty, Open work orders.',
    ],
    behind: [
      'In flight means released, in progress, or hold.',
      'This page does not change a work order and does not post a journal.',
    ],
    errors: [
      { message: 'No production orders', fix: 'Create a work order in Make. The empty copy says you can firm them from the master schedule or launch one directly.' },
    ],
    faqs: [
      { q: 'Why does a hold still count as in flight?', a: 'The tower treats hold as still open. Fix lists it as a warning. Complete or cancel it in Make to take it out.' },
    ],
  }),
  feat({
    id: 'outbound',
    name: 'Outbound',
    href: '/dashboard/operations/outbound',
    summary: 'Outbound lists shipments leaving you. Creating them is done in Ship.',
    who: WHO,
    prerequisites: ['Outbound shipments exist in Ship.'],
    steps: [
      'Open Outbound. The title is Outbound operations.',
      'Read Outbound ships, In motion, Delivered, and Exceptions.',
      'Press Manage outbound, or Create outbound shipment when the list is empty.',
    ],
    behind: ['The list is shipments with direction outbound. This page does not advance them and does not post a journal.'],
    errors: [
      { message: 'No outbound shipments', fix: 'Create the shipment on the Ship outbound board.' },
    ],
    faqs: [
      { q: 'Does Allocate stock happen here?', a: 'No. The link opens the stock screen. This page only lists the shipments.' },
    ],
  }),
  feat({
    id: 'fulfill',
    name: 'Fulfill',
    href: '/dashboard/operations/customer-orders',
    summary: 'Fulfill lists customer purchase orders. It does not accept or ship them.',
    who: WHO,
    prerequisites: ['Customer orders exist. The list shows up to 40 rows.'],
    steps: [
      'Open Fulfill. The title is Customer fulfillment.',
      'Read Customer POs, Open, Complete, and Need ship.',
      'Press Orders workspace or Customer hub to open the customer orders. The row link goes to that workspace, not to a single order id.',
    ],
    behind: [
      'Open counts sent, accepted, funded, in transit, partial, open, confirmed, and shipped.',
      'Complete counts completed and paid. Need ship counts accepted, funded, and confirmed.',
      'No journal is posted here.',
    ],
    errors: [
      { message: 'Could not load customer orders', fix: 'Press the reload path from the page. The title on the failure is Customer orders unavailable.' },
      { message: 'Network error', fix: 'Check the connection and open the page again. The orders were not changed.' },
    ],
    faqs: [
      { q: 'No customer orders yet. Where do I create one?', a: 'Press Open customers. Orders are created in Customers, not on this tower.' },
    ],
  }),
  feat({
    id: 'fix',
    name: 'Fix',
    href: '/dashboard/operations/exceptions',
    summary: 'Fix lists shipment exceptions, work orders on hold, and open quality inspections. It does not clear them.',
    who: WHO,
    prerequisites: ['The source modules have rows. A clear chain is an empty list, not a hidden error.'],
    steps: [
      'Open Fix. The title is Exceptions & holds.',
      'Read Open issues, Critical, Warnings, and Focus. Focus says Clear or Act.',
      'A shipment exception is critical. A work order on hold is a warning. Open inspections show as “{n} open inspections”.',
      'Press Resolve to open Logistics tower, Production floor, or Quality. Press Back to command to return.',
    ],
    behind: [
      'The list reads shipments, production orders, and the operations summary. It writes nothing.',
      'A shipment status of hold is not a real status. Rows are not listed for that word. Exception is the shipment status that counts.',
    ],
    errors: [
      { message: 'No active exceptions', fix: 'That is the clear state. The copy says there is no logistics exception, production hold, or flagged quality gate in this snapshot.' },
    ],
    faqs: [
      { q: 'I put a shipment on hold and it is not listed. Why?', a: 'Ship has no hold status. Advance does not stop on hold. Use Exception on the shipment, or Hold on the work order. Those are the rows Fix reads.' },
    ],
  }),
];

export const OPERATIONS_GUIDE: ModuleGuide = {
  id: 'operations',
  name: 'Operations',
  href: '/dashboard/operations',
  purpose:
    'Operations in SupplierAdvisor® is the tower over purchasing, inbound, the warehouse, production, outbound, and customer orders. It reads those modules. The chain screen is the one that saves a route. Nothing here posts the ledger.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'You can see what is in motion, open the module that owns the document, and save a customer-to-supplier chain when the goods exist.',
  flow: [
    { id: 'buy', label: 'Buy', hint: 'Open POs' },
    { id: 'in', label: 'Inbound', hint: 'Ship creates it' },
    { id: 'stock', label: 'Warehouse', hint: 'Inventory' },
    { id: 'make', label: 'Make', hint: 'Work orders' },
    { id: 'out', label: 'Outbound', hint: 'Then fulfill' },
    { id: 'fix', label: 'Exceptions', hint: 'Read only' },
  ],
  faqs: [
    {
      q: 'Can I receive stock or complete a work order on this tower?',
      a: 'No. Inbound, Store, Make, Outbound, and Fulfill open the module that writes. Chains is the operations screen that saves.',
    },
  ],
  features,
};
