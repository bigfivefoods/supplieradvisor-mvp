import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'ContainerAdvisor® opens for anyone who can view it. On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. A sales contractor cannot. The gate says “Your role (…) cannot access ContainerAdvisor.” Most saves only check that you are an active member. They do not check the write level. Extra role sentences are named on the feature.';

const MEMBER = 'You are not an active member of this company';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'command',
    name: 'Command',
    href: '/dashboard/containers',
    summary: 'Command is the outlet network home. It counts the book and opens the other screens. It does not edit an outlet.',
    who: WHO,
    prerequisites: ['A company is selected. If the containers module is off, the page says to enable it under Company → Profile → Modules.'],
    steps: [
      'Open Command. The title is Containers Command.',
      'Press Refresh to reload the summary.',
      'Open a card: Manage containers, Live map, Food security & jobs, Deploy feasibility, Add container, Contractors, Resellers, Training hub, Inventory & orders, Container RIAD, Network metrics, Share on website, or Reports.',
    ],
    behind: [
      'The counts come from the containers summary. If the summary function is missing, the desk folds the outlet list instead. It does not invent outlets.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Your role (…) cannot access ContainerAdvisor.', fix: 'Ask an owner for a role that can view ContainerAdvisor®.' },
      { message: MEMBER, fix: 'Open a company you belong to, or ask an owner to invite you.' },
    ],
    faqs: [
      {
        q: 'The hub talks about people fed and jobs. Are those a head count?',
        a: 'No. People fed and jobs are calculated from the impact assumptions and the sales the desk can see. They are not a register of named people.',
      },
    ],
  }),
  feat({
    id: 'manage',
    name: 'Manage',
    href: '/dashboard/containers/manage',
    summary: 'Manage is the outlet list. You search it, open an outlet, edit it, or delete it.',
    who: WHO,
    prerequisites: ['A company is selected.'],
    steps: [
      'Open Manage. The title is Manage containers.',
      'Search with “Search code, name, city, contractor…”.',
      'Press Map, Refresh, or Add container.',
      'On a row press Open or Edit. Delete asks “Delete this container outlet? This cannot be undone.”',
    ],
    behind: [
      'The list loads this company’s outlets, up to 200 rows.',
      'Delete removes that outlet. It does not post a journal.',
    ],
    errors: [
      { message: 'Failed to load', fix: 'Press Refresh. The company must be selected.' },
      { message: 'Container not in this company', fix: 'The outlet belongs to another company. Open the company that owns it.' },
      { message: 'Delete failed', fix: 'You need to be an active member. Reload and try the delete again.' },
    ],
    faqs: [
      { q: 'The list says No containers yet. What now?', a: 'Press Add your first outlet. Nothing is filled in for you.' },
    ],
  }),
  feat({
    id: 'add',
    name: 'Add',
    href: '/dashboard/containers/add',
    summary: 'Add creates one outlet with a code, a name, a country, and an optional pin. A contractor is optional.',
    who: WHO,
    prerequisites: ['A company is selected. Code, display name, and country are required before Create container will succeed.'],
    steps: [
      'Open Add. The note says you do not need a contractor first.',
      'Enter Code and Display name. Set Status to Active, Inactive, Maintenance, or Pending deploy.',
      'Set Outlet type to Retail, Hub, Distribution, or Storage, and Container size to 20ft, 40ft, or Custom build.',
      'Leave the contractor as Leave unassigned (assign later), or press Appoint new, enter Full name, and press Save contractor & select.',
      'Choose the country, set Street address, and use Pin GPS on map if you have a latitude and longitude. Add a photo only if you want one. Press Create container.',
    ],
    behind: [
      'Create container saves the outlet and returns you to Manage. No journal is posted and nobody is emailed by this save.',
      'A photo must be an image under 8MB.',
    ],
    errors: [
      { message: 'Code and name are required', fix: 'Fill Code and Display name.' },
      { message: 'Please select a country', fix: 'Choose a country before you create the outlet.' },
      { message: 'Image must be under 8MB', fix: 'Choose a smaller JPG or PNG, or skip the photo.' },
      { message: 'Contractor name is required', fix: 'If you pressed Appoint new, enter Full name, or cancel and leave the outlet unassigned.' },
    ],
    faqs: [
      { q: 'Can I add the outlet and appoint someone later?', a: 'Yes. Leave unassigned (assign later), then appoint them on Contractors.' },
    ],
  }),
  feat({
    id: 'map',
    name: 'Map',
    href: '/dashboard/containers/map',
    summary: 'Map shows outlet pins and four modes. It does not create the public share link.',
    who: WHO,
    prerequisites: ['Outlets exist. A pin needs a GPS point saved on the outlet.'],
    steps: [
      'Open Map. The title is Container map.',
      'Switch Street or Satellite.',
      'Choose Stock on hand, People fed, Jobs created, or Locations.',
      'Press Refresh. The title on that button is Refresh live stock now. Press Impact report to open the impact screen.',
    ],
    behind: [
      'The map reads the impact feed and refreshes on a timer. People fed and jobs are calculated. They are not a head count.',
      'Share links are created on Share, not here.',
    ],
    errors: [
      { message: 'No GPS — edit to pin', fix: 'Open the outlet and set Latitude and Longitude, or use Pin GPS on map.' },
    ],
    faqs: [
      { q: 'A pin says No inventory lines yet. What now?', a: 'That outlet has no stock lines. Stock is kept on the outlet inventory screen, not on the map.' },
    ],
  }),
  feat({
    id: 'contractors',
    name: 'Contractors',
    href: '/dashboard/containers/contractors',
    summary: 'Contractors appoints an operator, optionally checks an ID, sets training, and emails a contract invite. The invite does not wait for the ID check.',
    who: WHO,
    prerequisites: ['A company is selected. An invite also needs an email and a container.'],
    steps: [
      'Open Contractors. The title is Independent contractors. Press Appoint contractor.',
      'Enter Full name. Email and Phone are optional until you invite.',
      'Identity check is optional. The SA ID number is 13 digits. Attach an image or PDF if you have one, and tick the consent line before VerifyNow runs.',
      'Set Training status. The options are pending, in progress, certified, and expired. Payout banking asks for Bank name and Account number.',
      'Press Appoint contractor.',
      'On a row, press Verify with VerifyNow. The confirm says the contractor has authorised an identity check. Or choose Select container to allocate and press Send contract invitation email.',
    ],
    behind: [
      'Training status is saved on the contractor. The Train screen only reads it.',
      'The invite emails a contract link. It does not read whether the ID check passed.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'companyId and full_name are required', fix: 'Enter Full name and keep a company selected.' },
      { message: 'Invalid South African ID number format or checksum', fix: 'The ID must be 13 digits and pass the checksum. Fix it before Verify with VerifyNow.' },
      { message: 'Contractor email is required to invite', fix: 'Add an email on the contractor, then send the invitation.' },
      { message: 'Select a container for this operator', fix: 'Choose Select container to allocate before you send the email.' },
      { message: 'ID document must be under 12MB', fix: 'Use a smaller JPG, PNG, or PDF.' },
    ],
    faqs: [
      { q: 'Must the ID check pass before I invite them?', a: 'No. Send contract invitation email does not look at the verification status.' },
    ],
  }),
  feat({
    id: 'resellers',
    name: 'Resellers',
    href: '/dashboard/containers/resellers',
    summary: 'Resellers adds a person, checks them, sets a commission, and draws stock. A draw is blocked until verification is verified or mismatch.',
    who: `${WHO} A QA hold can be overridden only by an owner or an admin, and the screen does not show that override.`,
    prerequisites: ['At least one reseller is verified or mismatch before Draw stock will succeed.'],
    steps: [
      'Open Resellers. The title is Container resellers.',
      'Add a reseller with Full name and an email or a mobile.',
      'Press VerifyNow. The confirm names the person and the fee that will be charged on success.',
      'Set the commission and press Save rate.',
      'Choose the reseller and the container, enter quantities, and press Transfer stock to reseller or Draw stock.',
    ],
    behind: [
      'The transfer checks verification_status. verified and mismatch are allowed. Anything else is refused.',
      'An open or failed QA inspection on a lot blocks the draw. The screen does not offer the owner override.',
      'No finance journal is posted by the draw.',
    ],
    errors: [
      { message: 'Reseller must pass VerifyNow verification before receiving stock', fix: 'Verify the reseller first. The status must be verified or mismatch.' },
      { message: 'QA hold override requires owner or admin role. Clear inspections first.', fix: 'Clear the inspection. The screen cannot send the override.' },
      { message: 'Name required', fix: 'Enter Full name.' },
      { message: 'Enter quantities to transfer', fix: 'Put a quantity on a line before you draw.' },
    ],
    faqs: [
      { q: 'Where do outlet orders and receipts live?', a: 'On the outlet inventory screen. Sales and payouts addresses redirect. They are not sidebar items.' },
    ],
  }),
  feat({
    id: 'train',
    name: 'Train',
    href: '/dashboard/containers/training',
    summary: 'Train lists operators and their stored training status. It does not change the status.',
    who: WHO,
    prerequisites: ['Contractors exist. Otherwise the screen says No contractors yet.'],
    steps: [
      'Open Train. The title is Training hub.',
      'Read Pending, In progress, and Certified.',
      'Press Manage contractors to change a status. That save happens on Contractors, and the toast there is Training status updated.',
    ],
    behind: ['This page only reads the contractor list. It does not write and it does not post a journal.'],
    errors: [
      { message: 'No contractors yet.', fix: 'Press Appoint contractors and add someone on Contractors first.' },
    ],
    faqs: [
      { q: 'Why can I not set certified here?', a: 'The control is on Contractors, under Training status. This hub only displays it.' },
    ],
  }),
  feat({
    id: 'impact',
    name: 'Impact',
    href: '/dashboard/containers/impact',
    summary: 'Impact shows people fed and jobs from the assumptions you save. It is not a head count.',
    who: `${WHO} Save assumptions is limited. The API says “Only owners, admins, or operations can edit impact settings”. Member, Viewer, Finance, and Sales are refused.`,
    prerequisites: ['The impact settings table exists. If it does not, the page shows a one-time setup banner and still reads defaults.'],
    steps: [
      'Open Impact. The title is Food security & jobs.',
      'Press View on map or Refresh.',
      'Edit the assumptions and press Save assumptions.',
    ],
    behind: [
      'People fed and jobs use the saved assumptions and the sales the desk can see.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Only owners, admins, or operations can edit impact settings', fix: 'Ask an owner, an admin, or an operations user to press Save assumptions. You can still read the page.' },
      { message: 'Save failed', fix: 'The settings table must exist. The banner names the setup. Until then the report uses defaults.' },
    ],
    faqs: [
      { q: 'The numbers are zero. Did the desk invent a community?', a: 'No. Zero means there are no outlets or no sales to apply the assumptions to.' },
    ],
  }),
  feat({
    id: 'feasibility',
    name: 'Feasibility',
    href: '/dashboard/containers/feasibility',
    summary: 'Feasibility is a scenario you edit and save. The model runs on the inputs on the page.',
    who: `${WHO} Save is limited. The API says “Only owners, admins, operations, or finance can save scenarios”. Member, Viewer, and Sales are refused.`,
    prerequisites: ['A company is selected. The scenarios table must exist before a save lands.'],
    steps: [
      'Open Feasibility. The title is Deploy feasibility.',
      'Press New. Fill Region & scenario, demand, capex, monthly opex, and the income model.',
      'Press Save scenario, Update, or Save as new.',
      'Reopen a row under Saved scenarios.',
    ],
    behind: ['The scenario is stored for this company. It does not post a journal and it does not create an outlet.'],
    errors: [
      { message: 'Only owners, admins, operations, or finance can save scenarios', fix: 'Read the model on any view role. Ask an owner, admin, operations, or finance user to save it.' },
      { message: 'Feasibility scenarios table not set up yet', fix: 'The save cannot land until that table exists. The inputs still calculate on the page.' },
    ],
    faqs: [
      { q: 'What does No payback at this cashflow mean?', a: 'The inputs on the page do not produce a payback. Change the demand or the cost and read the model again.' },
    ],
  }),
  feat({
    id: 'metrics',
    name: 'Metrics',
    href: '/dashboard/containers/metrics',
    summary: 'Metrics counts the outlets, pins, contractors, and certified operators already loaded. It does not forecast.',
    who: WHO,
    prerequisites: ['A company is selected. Counts are capped by the list the page loads.'],
    steps: [
      'Open Metrics. The title is Network metrics.',
      'Read Total containers, Mapped outlets, Contractors, and Certified operators.',
      'Press Share on website or Manage outlets. The Coming next panel is a note, not a control.',
    ],
    behind: [
      'Active includes a blank status and the statuses active, deployed, operational, and open.',
      'Verified on this page is verification_status verified only. mismatch is not counted here.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Your role (…) cannot access ContainerAdvisor.', fix: 'Metrics uses the same gate as the rest of the module.' },
    ],
    faqs: [
      { q: 'Why is a verified person missing from Certified operators?', a: 'Certified operators counts training complete, not the ID check. Verification and training are different fields.' },
    ],
  }),
  feat({
    id: 'reports',
    name: 'Reports',
    href: '/dashboard/containers/reports',
    summary: 'Reports links to impact, feasibility, feedback, and the RIAD log, and downloads CSV files. Contractor payouts is marked coming soon.',
    who: WHO,
    prerequisites: ['A company is selected. A CSV downloads this company’s rows.'],
    steps: [
      'Open Reports. The title is Container reports.',
      'Open Food security & jobs, Deploy feasibility, Reseller customer feedback, or Reseller RIAD log.',
      'Press Download CSV on Monthly performance, Inventory & stock, Outlet network, Contractors, or Regional summary.',
      'Leave Contractor payouts. Its badge is Coming soon and it has no export.',
    ],
    behind: ['Download CSV reads the export for this company. It does not post a journal.'],
    errors: [
      { message: 'Export failed', fix: 'Keep the company selected and press Download CSV again.' },
    ],
    faqs: [
      { q: 'Can I export contractor payouts?', a: 'No. That card is Coming soon and does not download a file.' },
    ],
  }),
  feat({
    id: 'share',
    name: 'Share',
    href: '/dashboard/containers/settings',
    summary: 'Share creates the public map link and the embed. The map screen does not create it.',
    who: `${WHO} Create public share link is limited. The API says “Only owners, admins, or operations can create share links”. Member, Viewer, Finance, and Sales are refused.`,
    prerequisites: ['A company is selected. The share table must exist.'],
    steps: [
      'Open Share. The title is Share & settings.',
      'Set Title, Brand name, and Brand website URL.',
      'Tick the switches you want: Show people fed & jobs (impact), Show network metrics, Show outlet list, Show contractor names, Show photos.',
      'Press Create public share link. Later the same button reads Refresh link.',
      'Press Copy on the public URL or Copy iframe code. Press Save options, Rotate token, or Disable share.',
    ],
    behind: [
      'The link is a token for this company. Rotate token replaces it. Disable share turns the public page off.',
      'No journal is posted.',
    ],
    errors: [
      { message: 'Only owners, admins, or operations can create share links', fix: 'Ask an owner, an admin, or an operations user. Viewing the page is wider than creating the link.' },
      { message: 'Could not copy — select and copy manually', fix: 'The browser blocked the clipboard. Select the URL and copy it yourself.' },
    ],
    faqs: [
      { q: 'I made a link on the map. Why is there no URL?', a: 'The map does not create the link. Use Create public share link on this screen.' },
    ],
  }),
  feat({
    id: 'riad',
    name: 'RIAD',
    href: '/dashboard/containers/riad-log',
    summary: 'RIAD is the outlet risk, issue, action, and decision register. Contractors can log from their portal and the rows land here.',
    who: `${WHO} Delete says “Only company admins can delete RIAD entries”. A contractor actor gets “Contractors cannot delete RIAD entries”.`,
    prerequisites: ['A container is allocated before a new row can be saved against one.'],
    steps: [
      'Open RIAD. The title is Container RIAD register.',
      'Filter All, Open, In progress, On hold, Closed, or Critical open. Switch All types, Risks, Issues, Actions, or Decisions.',
      'Press Log RIAD. Enter a title. Set status, priority, and category. Press save.',
      'Press Update status, or tick Close this RIAD item and add a resolution note.',
    ],
    behind: [
      'Statuses include Open, In progress, Mitigated, Resolved, Closed, and On hold.',
      'No journal is posted and this screen does not send email.',
    ],
    errors: [
      { message: 'Title is required', fix: 'Enter a short title before you save.' },
      { message: 'No container allocated', fix: 'Add an outlet first, then log the RIAD against it.' },
      { message: 'Only company admins can delete RIAD entries', fix: 'Ask an admin or an owner to delete it. You can still update the status.' },
    ],
    faqs: [
      { q: 'No RIAD entries yet. Is the register broken?', a: 'No. Press Log first entry. The desk does not seed risks.' },
    ],
  }),
];

export const CONTAINERS_GUIDE: ModuleGuide = {
  id: 'containers',
  name: 'ContainerAdvisor®',
  href: '/dashboard/containers',
  purpose:
    'ContainerAdvisor® in SupplierAdvisor® is the outlet book: add a container, pin it, appoint a contractor, draw stock to a verified reseller, and read impact from the assumptions you save. It does not post the company ledger.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'An outlet is on the book, a contractor can be invited without an ID check, and stock can be drawn only after the reseller is verified or marked mismatch.',
  flow: [
    { id: 'add', label: 'Add outlet', hint: 'Code and name' },
    { id: 'pin', label: 'Map', hint: 'GPS pin' },
    { id: 'staff', label: 'Contractor', hint: 'Invite is separate' },
    { id: 'draw', label: 'Reseller draw', hint: 'After verify' },
    { id: 'read', label: 'Impact', hint: 'From assumptions' },
    { id: 'share', label: 'Share', hint: 'Public link' },
  ],
  faqs: [
    {
      q: 'The command copy says operators log sales so the people and jobs stay real. Is that a head count?',
      a: 'No. People fed and jobs are calculated from impact assumptions and sales. Train does not change training status. Stock orders and receipts are on the outlet inventory screen, which is not a sidebar item.',
    },
  ],
  features,
};
