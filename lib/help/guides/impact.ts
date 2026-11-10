import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Impact opens for anyone who can view Operations. The gate says “Your role (…) cannot access Operations.” Saves check that you are a member. They do not check an operations write role. Nothing in this module posts a ledger journal. Figures are operational estimates, not a certified inventory and not an audit opinion.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const IMPACT_GUIDE: ModuleGuide = {
  id: 'sustainability',
  name: 'Impact',
  href: '/dashboard/sustainability',
  purpose:
    'Impact in SupplierAdvisor® is the sustainability suite: emissions, water and waste, targets, materiality, certificates, initiatives, and the evidence pack. The page title is Sustainability. The sidebar name is Impact. The pack says it is not a formal audit opinion.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'You can log an emission, a resource metric, a target, and a certificate, then export a pack that labels its estimates.',
  flow: [
    { id: 'ghg', label: 'Emissions', hint: 'Not certified' },
    { id: 'resources', label: 'Resources', hint: 'Marked estimate' },
    { id: 'target', label: 'Target', hint: 'Then initiative' },
    { id: 'prove', label: 'Certificate', hint: 'You type it' },
    { id: 'pack', label: 'Pack', hint: 'JSON or print' },
  ],
  faqs: [
    {
      q: 'The pack failed to build. Did it still show zeros?',
      a: 'No. A failed load toasts Failed to build pack and the page says Could not build pack. It does not pretend the sections are empty numbers.',
    },
  ],
  features: [
    feat({
      id: 'overview',
      name: 'Overview',
      href: '/dashboard/sustainability',
      summary: 'Overview is the sustainability home. Ethical sourcing is a card here and is not in the sidebar.',
      who: WHO,
      prerequisites: ['A company is selected. A missing table shows the migration line.'],
      steps: ['Open Overview. The title is Sustainability suite.', 'Open GHG inventory, Water · waste · energy, Targets & pathway, Certificates, Ethical sourcing, Initiatives, Materiality, or ESG packs.'],
      behind: ['The principle on the page says default factors are order-of-magnitude and this is not a substitute for a formal audit opinion. No journal is posted.'],
      errors: [{ message: 'Apply migration for full ESG tables.', fix: 'The hint names the sustainability migration. Until then the full tables are not there. The tiles can show a dash.' }],
      faqs: [{ q: 'Why does the title say Sustainability?', a: 'That is the page title. The sidebar name is Impact. They are the same module.' }],
    }),
    feat({
      id: 'ghg',
      name: 'GHG',
      href: '/dashboard/sustainability/carbon-tracking',
      summary: 'GHG logs scope 1, 2, and 3 lines. Default factors are labelled as not certified. Logistics estimates sit beside them.',
      who: WHO,
      prerequisites: ['A category is required. You can enter kilograms directly or use a factor.'],
      steps: [
        'Open GHG. The title is Carbon ledger.',
        'Press Add emission. Pick the scope and the category. Enter the activity, the amount, or kilograms directly. Press Apply default factor for category if you want the stored factor. Press Save.',
      ],
      behind: [
        'The line is an operational record. Shipment logistics are an estimate next to it, not the same row.',
        'No ledger journal is posted. The info line says it is not a certified inventory.',
      ],
      errors: [
        { message: 'category required', fix: 'Pick a category. No default factor for this category means you type the factor or the kilograms.' },
        { message: 'No inventory lines yet', fix: 'Press Add first emission. Logistics can still estimate from shipments.' },
      ],
      faqs: [{ q: 'Is the total a certified footprint?', a: 'No. The page says to replace the defaults with local factors before you disclose, and that the factors are not certified.' }],
    }),
    feat({
      id: 'resources',
      name: 'Resources',
      href: '/dashboard/sustainability/water-waste',
      summary: 'Resources logs water, waste, and energy. A new row is stored as an estimate because the form does not say otherwise.',
      who: WHO,
      prerequisites: ['Amount is required. The type must be water, waste, or energy.'],
      steps: ['Open Resources. Choose Water, Waste, or Energy.', 'Press Log metric. Pick the category for that tab and enter Amount. Save.'],
      behind: ['Diversion rate and renewable share are calculated. You do not type them. The saved row defaults to an estimate. No journal is posted.'],
      errors: [
        { message: 'resource_type must be water|waste|energy', fix: 'Use one of the three tabs.' },
        { message: 'category required', fix: 'Pick the category for that tab before you save.' },
      ],
      faqs: [{ q: 'No water metrics yet. Is diversion zero?', a: 'The empty line is that tab. Diversion is calculated from the rows you have logged.' }],
    }),
    feat({
      id: 'targets',
      name: 'Targets',
      href: '/dashboard/sustainability/regenerative-dashboard',
      summary: 'Targets stores a baseline and a horizon. Progress uses the live inventory. Mark achieved is the only status button.',
      who: WHO,
      prerequisites: ['Name is required.'],
      steps: ['Open Targets. Press New target. Enter Name, the years, and the values. Save.', 'On an active target press Mark achieved.'],
      behind: ['There is no status dropdown. Progress is the API percent. It does not check an outside standard. No journal is posted.'],
      errors: [{ message: 'Name required', fix: 'Enter the target name.' }],
      faqs: [{ q: 'No reduction targets yet. Does the example on the page create one?', a: 'No. That sentence is an illustration of the shape. Press New target and type your own.' }],
    }),
    feat({
      id: 'material',
      name: 'Material',
      href: '/dashboard/sustainability/materiality',
      summary: 'Materiality seeds a topic list and lets you score impact and financial materiality.',
      who: WHO,
      prerequisites: ['Seed the topics before you score. A manual topic needs a topic name.'],
      steps: ['Open Material. Press Seed standard topics or Seed topics.', 'Change the scores. Priority updates from the scores. Critical is when either score is maxed or the average is high.'],
      behind: ['The seed is the standard topic list on the page. The scores are the numbers you enter. No journal is posted.'],
      errors: [{ message: 'Seed failed', fix: 'The tables must exist. The error or the hint is in the toast.' }],
      faqs: [{ q: 'No materiality topics. Do I type all 14?', a: 'Press Seed topics. Then score them. You do not have to type the list.' }],
    }),
    feat({
      id: 'certs',
      name: 'Certs',
      href: '/dashboard/sustainability/green-certificates',
      summary: 'Certs records a certificate you already hold. It does not call the issuer.',
      who: WHO,
      prerequisites: ['Name is required.'],
      steps: ['Open Certs. Press Add certificate. Enter Name, the scheme, the issuer, and the document URL. Save.', 'Press Retire on an active certificate. Expiring and Expired are badges from the date.'],
      behind: ['The row stores what you typed and the expiry. View document opens the URL you saved. No journal is posted and no issuer is contacted.'],
      errors: [{ message: 'Name required', fix: 'Enter the certificate name.' }],
      faqs: [{ q: 'No certificates on file. Will the pack invent one?', a: 'No. Add the certificate. The pack lists what is stored.' }],
    }),
    feat({
      id: 'actions',
      name: 'Actions',
      href: '/dashboard/sustainability/initiatives',
      summary: 'Actions are initiatives you own. The impact note is text you type, and it is an estimate.',
      who: WHO,
      prerequisites: ['Title is required.'],
      steps: ['Open Actions. The title is ESG initiatives. Press New initiative.', 'Enter Title. Choose Environment, Social, or Governance. Set the status and Progress. Completed sets progress to 100. In progress sets it to at least 10.'],
      behind: ['Status values are planned, in progress, completed, on hold, and cancelled. The impact sentence is not calculated. No journal is posted.'],
      errors: [{ message: 'Title required', fix: 'Enter the title. The success line is Initiative created.' }],
      faqs: [{ q: 'No initiatives yet. Are they created from materiality?', a: 'Not automatically. Press New initiative. You can link the idea to an SDG or a DMAIC project in the description. The page does not create that project for you.' }],
    }),
    feat({
      id: 'pack',
      name: 'Pack',
      href: '/dashboard/sustainability/reports',
      summary: 'Pack builds the ESG pack for JSON, print, or a snapshot. The footer says it is not a formal audit opinion.',
      who: WHO,
      prerequisites: ['The pack must load before JSON, Print, or Snapshot. Those stay disabled without it.'],
      steps: ['Open Pack. The title is Reports.', 'Press Refresh. Press JSON or Print. Press Snapshot when you want a saved copy.'],
      behind: [
        'The environment block says the inventory is an estimate and not a certified GHG inventory or an audit opinion.',
        'Print’s footer says it is an operational ESG pack, not a formal audit opinion. No ledger journal is posted.',
      ],
      errors: [
        { message: 'Failed to build pack', fix: 'Press Refresh. The page says Could not build pack when nothing came back. It does not fill the sections with zeros.' },
        { message: 'Snapshot failed', fix: 'The pack has to load first. A warning on a saved snapshot is shown with Pack ready.' },
      ],
      faqs: [{ q: 'Can I send this pack as an assurance opinion?', a: 'No. The print footer and the API disclaimer both say it is not a formal audit opinion.' }],
    }),
  ],
};
