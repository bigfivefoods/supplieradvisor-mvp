import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Ship opens for anyone who can view Distribution. On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. A sales contractor cannot. The gate says “Your role (…) cannot access Distribution.” Creates and advances check that you are an active member. They do not check a separate write role. No shipment, carrier, or fleet save posts a finance journal.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'overview',
    name: 'Overview',
    href: '/dashboard/distribution',
    summary: 'Overview is the logistics tower. It counts inbound, outbound, carriers, and fleet, and opens the boards.',
    who: WHO,
    prerequisites: ['A company is selected. If the distribution tables are missing, the page names the schema file.'],
    steps: [
      'Open Overview. The title is Distribution Command.',
      'Press Refresh.',
      'Read In motion, OTIF, and Exceptions, then Inbound, Outbound, Carriers, and Fleet ready.',
      'Open Inbound logistics, Outbound logistics, Live tracking, Carriers, Fleet & drivers, or Incoterms® 2020.',
    ],
    behind: [
      'The counts come from the distribution summary. No journal is posted.',
      'Incoterms® 2020 is on this tower and in the in-page nav. It is not a sidebar item.',
    ],
    errors: [
      { message: 'Your role (…) cannot access Distribution.', fix: 'Ask an owner for a role that can view Distribution.' },
    ],
    faqs: [
      { q: 'No shipments yet. Where is the mode mix?', a: 'The page says the mode mix appears when shipments exist. Create one on Inbound or Outbound.' },
    ],
  }),
  feat({
    id: 'incoterms',
    name: 'Incoterms',
    href: '/dashboard/distribution/incoterms',
    summary: 'Incoterms stores the company default term and mode. A new shipment does not copy that default by itself.',
    who: WHO,
    prerequisites: ['A company is selected. The eleven terms are always listed.'],
    steps: [
      'Open Incoterms® 2020 from the Ship overview or the in-page nav. It is not in the sidebar.',
      'Read Any mode of transport and Sea and inland waterway.',
      'Press Use as company default on the term you want. Set the mode to Road, Rail, Ocean, Air, Multimodal, or Last mile.',
      'Press Save defaults.',
    ],
    behind: [
      'Save defaults stores default_incoterm and default_mode. Until settings load, the form starts on DAP and road.',
      'The shipment form keeps its own incoterm. Creating a shipment does not fill it from this default.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Save failed', fix: 'Stay on the company and press Save defaults again. The success line is Distribution defaults saved.' },
    ],
    faqs: [
      { q: 'I saved DAP. Why is a new shipment not DAP?', a: 'The board does not copy the company default into the form. Pick the term on the shipment.' },
    ],
  }),
  feat({
    id: 'inbound',
    name: 'Inbound',
    href: '/dashboard/distribution/inbound',
    summary: 'Inbound creates a shipment into the company and advances it. Advance changes the status and does not write a tracking event.',
    who: WHO,
    prerequisites: ['Origin name or origin city, and destination name or destination city, are required.'],
    steps: [
      'Open Inbound. The title is Inbound logistics.',
      'Filter All, In motion, Planned, Delivered, or Exceptions.',
      'Press New inbound or Create first shipment.',
      'Enter Origin and Destination, including city and country. Optional fields are Tracking #, PO / ref, and Weight kg.',
      'Choose a mode: Road, Rail, Ocean, Air, Multimodal, or Last mile. Choose an incoterm. Carrier, Vehicle, and Driver are optional. Press Create shipment.',
      'Press Advance to move the status. Press Log event, pick a preset, and press Post tracking event.',
    ],
    behind: [
      'Create stores status planned and a number that starts with INB. It also writes an event labelled Shipment created.',
      'Advance walks planned, booked, picked up, in transit, at hub, customs, out for delivery, and delivered. It does not write a tracking event. Exception and cancelled are not steps on Advance.',
      'Log event writes the event. Presets include Booking confirmed, Picked up from origin, Departed origin, Arrived at hub / port, Customs clearance, Out for delivery, Delivered — POD, Exception / delay, and Note / update.',
      'Delivered — POD is an event label. There is no signature and no photo. A delivered shipment whose PO / ref is all digits may raise a rating prompt for that purchase order. It does not post a journal.',
      'Advance and Log event hide once the status is delivered or cancelled.',
    ],
    errors: [
      { message: 'Origin required', fix: 'Enter an origin name or an origin city.' },
      { message: 'Destination required', fix: 'Enter a destination name or a destination city.' },
      { message: 'shipment_id and label required', fix: 'Pick a preset or type a custom label before Post tracking event.' },
      { message: 'Advance failed', fix: 'Reload the row. A delivered or cancelled shipment has no Advance button.' },
    ],
    faqs: [
      { q: 'I pressed Advance and the tracking list did not grow. Why?', a: 'Advance only updates the status. Press Log event and Post tracking event when you want a line on the tracking screen.' },
    ],
  }),
  feat({
    id: 'outbound',
    name: 'Outbound',
    href: '/dashboard/distribution/outbound',
    summary: 'Outbound is the same board for shipments leaving the company. Numbers start with OUT.',
    who: WHO,
    prerequisites: ['Origin and destination are required, the same as inbound.'],
    steps: [
      'Open Outbound. The title is Outbound logistics.',
      'Press New outbound. Fill Origin, Destination, the mode, and the incoterm. Press Create shipment.',
      'Press Advance or Log event. Delivered — POD is a tracking label, not a signed document.',
    ],
    behind: [
      'The status chain, the missing event on Advance, and the rating prompt on a numeric PO / ref are the same as inbound.',
      'No finance journal is posted.',
    ],
    errors: [
      { message: 'Origin required', fix: 'Enter the dock or the city you are shipping from.' },
      { message: 'Destination required', fix: 'Enter the customer site or the city.' },
      { message: 'No outbound shipments', fix: 'Press Create first shipment. The desk does not create one from a sales order by itself.' },
    ],
    faqs: [
      { q: 'Does a delivered outbound invoice the customer?', a: 'No. It updates the shipment. The customer invoice stays in Customers or Finance.' },
    ],
  }),
  feat({
    id: 'track',
    name: 'Track',
    href: '/dashboard/distribution/tracking',
    summary: 'Track reads shipments and their events. It does not log an event.',
    who: WHO,
    prerequisites: ['A shipment exists. Events exist only if create or Log event wrote them.'],
    steps: [
      'Open Track. The title is Live tracking.',
      'Search with “Search number, tracking, carrier, city…”.',
      'Filter the raw direction inbound or outbound.',
      'Select a shipment and read the events. Press Refresh to reload.',
    ],
    behind: [
      'In motion on this screen is picked up, in transit, at hub, customs, and out for delivery. Booked is not counted as in motion here.',
      'An empty event list says to log events from the inbound or outbound boards.',
    ],
    errors: [
      { message: 'Nothing to track yet', fix: 'Create a shipment on Inbound or Outbound.' },
      { message: 'No events yet. Log events from inbound/outbound boards.', fix: 'Advance alone will not fill this list. Post a tracking event on the board.' },
    ],
    faqs: [
      { q: 'Is this a live GPS map?', a: 'No. It is the status and the event list. There is no position feed on this screen.' },
    ],
  }),
  feat({
    id: 'carrier',
    name: 'Carrier',
    href: '/dashboard/distribution/carriers',
    summary: 'Carrier stores a partner you can later pick on a shipment.',
    who: WHO,
    prerequisites: ['A company is selected. Name is required.'],
    steps: [
      'Open Carrier. The title is Carrier network.',
      'Press Add first carrier. The dialog is Onboard carrier.',
      'Enter the legal or trading name and a CODE. Coverage regions and Email are optional.',
      'Set the type to 3PL, Courier, Ocean, Air, Rail, Last mile, or Own fleet. Set the mode and the service: Standard, Express, Economy, or Reefer. Press Save carrier.',
    ],
    behind: [
      'A new carrier is stored as active. Assigning it happens on the shipment form, not here.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Name required', fix: 'Enter the legal or trading name. The API says companyId and name are required.' },
      { message: 'Delete failed', fix: 'Reload. The success line is Removed.' },
    ],
    faqs: [
      { q: 'No carriers yet. Can I still create a shipment?', a: 'Yes. Carrier on the shipment is optional. Add the partner here when you want it on the list.' },
    ],
  }),
  feat({
    id: 'fleet',
    name: 'Fleet',
    href: '/dashboard/distribution/fleet-drivers',
    summary: 'Fleet on Ship is a vehicle and driver list for shipments. It is not FleetAdvisor®.',
    who: WHO,
    prerequisites: ['A vehicle needs a code. A driver needs a code and a full name.'],
    steps: [
      'Open Fleet. The title is Fleet & drivers.',
      'Open the vehicles tab. Press Add vehicle. Enter CODE, Name, Plate, and Capacity kg. Choose Van, Truck, Reefer, Trailer, or Bike. Save it.',
      'Set the vehicle status to available, in use, maintenance, or offline.',
      'Open the drivers tab. Press Add driver. Enter CODE, Full name, Phone, and License class.',
      'Set the driver status to available, on route, off duty, or suspended.',
      'Assign them later on a shipment under Vehicle and Driver.',
    ],
    behind: [
      'New rows start as available. There is no licence-expiry lock on this list.',
      'No journal is posted. FleetAdvisor® is a separate module with its own register.',
    ],
    errors: [
      { message: 'Code required', fix: 'A vehicle needs a code.' },
      { message: 'Code and name required', fix: 'A driver needs a code and a full name. The API says code and full_name are required.' },
    ],
    faqs: [
      { q: 'Will these vehicles appear in FleetAdvisor®?', a: 'Not by themselves. FleetAdvisor® can import from Ship, and only an owner can run that import. This screen does not write the FleetAdvisor® book.' },
    ],
  }),
];

export const DISTRIBUTION_GUIDE: ModuleGuide = {
  id: 'distribution',
  name: 'Ship',
  href: '/dashboard/distribution',
  purpose:
    'Ship in SupplierAdvisor® is the logistics desk: carriers, a simple fleet list, inbound and outbound shipments, and the event log. Advance changes status without writing an event. Delivered — POD is a label, not a signature. Nothing here posts the ledger.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'A shipment can be created, advanced to delivered, and given tracking events. The company can store a default incoterm that the shipment form does not copy on its own.',
  flow: [
    { id: 'term', label: 'Incoterm', hint: 'Optional default' },
    { id: 'partner', label: 'Carrier', hint: 'And fleet list' },
    { id: 'plan', label: 'Shipment', hint: 'Status planned' },
    { id: 'move', label: 'Advance', hint: 'No event row' },
    { id: 'event', label: 'Log event', hint: 'Then track' },
    { id: 'done', label: 'Delivered', hint: 'Not an invoice' },
  ],
  faqs: [
    {
      q: 'The process picture says advancing a shipment writes an event. Does it?',
      a: 'No. Advance only updates the status. Create writes “Shipment created”. Log event writes the later lines, including Delivered — POD.',
    },
  ],
  features,
};
