import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'SchoolAdvisor® opens for anyone who can view SchoolAdvisor® (NSNP). On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. Operations can write. A sales contractor cannot open the dashboard. The gate says “Your role (…) cannot access SchoolAdvisor® (NSNP).” Which sidebar you see depends on the programme role: a live education department is DBE, a service-provider row is SP, and a school profile that is not a hospital, clinic, or shelter is School. Anything else falls back from the organisation type, and the default is a school.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'home',
    name: 'Home',
    href: '/dashboard/schools',
    summary: 'Home is the programme command for the role you are: department, school, or service provider. The same address changes its copy with that role.',
    who: WHO,
    prerequisites: ['A company is selected. The schools module is on.'],
    steps: [
      'Open Home. Read the role the desk resolved.',
      'A department sees the DBE tools. A school sees readiness and the kitchen. A service provider sees the supply queue.',
      'Messages opens the company inbox for DBE, school, and SP threads. It does not submit a claim.',
    ],
    behind: [
      'The role is resolved in order: an active education agency, then a service-provider profile, then a school profile that is not a health facility, then the organisation type.',
      'Health organisation types are not a SchoolAdvisor® department. They use HealthAdvisor®.',
    ],
    errors: [
      { message: 'Your role (…) cannot access SchoolAdvisor® (NSNP).', fix: 'Ask an owner for a role that can view the schools module.' },
      { message: 'companyId required', fix: 'Select a company and reopen Home.' },
    ],
    faqs: [
      { q: 'Why do I see a different sidebar from a colleague?', a: 'The sidebar group follows the programme role of the company you have open, not the team role alone.' },
    ],
  }),
  feat({
    id: 'department',
    name: 'Department',
    href: '/dashboard/schools/agency',
    summary: 'Department is the DBE / PEU desk. A health department cannot register here.',
    who: `${WHO} Registering a department that is not education is refused.`,
    prerequisites: ['You are registering an education department. Platform operators activate it. Everyone else stays pending.'],
    steps: [
      'Open Department. The title is DBE / PEU desk, accent Education only.',
      'Register the department. The default type is forced to DBE when the family is education.',
      'Wait for activation if you are not a platform operator. The pending line says programme tools unlock after approval.',
    ],
    behind: [
      'An operator save is stored active. Any other save is stored pending.',
      'A health-family registration is refused. Non-education types are forced back to DBE.',
    ],
    errors: [
      { message: 'Only DBE / PEU education departments register on the Schools desk.', fix: 'Register a health department on HealthAdvisor®.' },
      { message: 'This company is not a Schools (DBE / PEU) department.', fix: 'Open the company that is the education department, or use HealthAdvisor® for a health department.' },
    ],
    faqs: [
      { q: 'Can I switch a department into a private company here?', a: 'No. Public-sector packaging stays a government process. Core hubs such as Finance can still be turned on.' },
    ],
  }),
  feat({
    id: 'registry',
    name: 'Schools and service providers',
    href: '/dashboard/schools/registry-report',
    summary: 'The school register and the service-provider register are department lists. Bulk import is department-only.',
    who: `${WHO} The pages say only the department can view and bulk-import the provincial lists.`,
    prerequisites: ['The company is the education department.'],
    steps: [
      'Open Schools. The title is School register report.',
      'Open the import when you are loading the provincial list. The description says only the department can bulk-import it.',
      'Open SPs. The title is Service providers. Import service providers is the same department-only rule.',
    ],
    behind: ['Import writes the provincial list for this department. It does not post a journal.'],
    errors: [
      { message: 'Only the department can bulk-import the provincial school list.', fix: 'Open the department company. A school and a service provider do not get this import.' },
    ],
    faqs: [
      { q: 'I am a school and the register is missing. Where is my profile?', a: 'Use Profile. The provincial register is the department screen.' },
    ],
  }),
  feat({
    id: 'join',
    name: 'Join',
    href: '/dashboard/schools/join',
    summary: 'Join is where a school or a service provider asks to associate, and where the department approves.',
    who: WHO,
    prerequisites: ['The department must approve before a school can order and claim, and before a service provider can supply those schools.'],
    steps: [
      'A department opens Add & approve. Create or search a company, add it as a school or a service provider, and approve the request.',
      'A school or a service provider opens Join DBE and requests the association.',
      'Pending means waiting for approval. Active is labelled Approved. Press Leave on an active or pending link.',
    ],
    behind: [
      'The link status active is what later gates orders and claims. left links are omitted from the list.',
      'No journal is posted by an approval.',
    ],
    errors: [
      { message: 'Need active DBE/PEU association', fix: 'This is the claim block. The department must approve the link before a claim will submit.' },
    ],
    faqs: [
      { q: 'What does Pending approval mean?', a: 'The request is stored and the department has not approved it. Ordering and claiming stay closed until the link is Approved.' },
    ],
  }),
  feat({
    id: 'foods',
    name: 'Foods, recipes, menu, and calendar',
    href: '/dashboard/schools/approved-list',
    summary: 'The department edits the approved catalogue, the recipes, the week menu, and the feeding calendar. Schools and service providers follow those records.',
    who: `${WHO} The edit APIs say only the DBE / PEU agency can change them.`,
    prerequisites: ['An education department exists. Schools read the result.'],
    steps: [
      'Open Foods. The title is NSNP approved foods. Edit only as the department.',
      'Open Recipes. The department accent is BOM · MPS · MRP. A school sees From DBE.',
      'Open Menu. The department title is Programme menu. Everyone else sees This week’s menu. The toast if you are not the department is “Only the department can set the menu”.',
      'Open Calendar. The title is Feeding calendar. Only the department can edit the days and terms.',
    ],
    behind: [
      'Schools and service providers follow the department menu. They do not keep a second menu.',
      'Deactivating a catalogue item is also department-only.',
    ],
    errors: [
      { message: 'Only the DBE / PEU agency can edit this catalogue', fix: 'Ask the department to change Foods. A school orders from the list.' },
      { message: 'Only DBE / PEU can set the programme menu. Schools and SPs follow the department menu.', fix: 'Read the week. Do not expect a save to land.' },
      { message: 'Only DBE/PEU can edit the feeding calendar', fix: 'The department sets feeding days. Plan orders against that calendar.' },
    ],
    faqs: [
      { q: 'Can a school change Thursday’s meal?', a: 'No. The mandated menu is the department’s. The school serves it and claims against it.' },
    ],
  }),
  feat({
    id: 'safety',
    name: 'Kitchen safety',
    href: '/dashboard/schools/kitchen-safety',
    summary: 'Kitchen safety scores the kitchen against the certificate of acceptability and R638. A hard gate can block a claim. A soft gate does not.',
    who: WHO,
    prerequisites: ['A school kitchen record exists. The department sees the register. The school sees its own kitchen.'],
    steps: [
      'Open Safety. A school sees Kitchen food safety. The department sees Kitchen safety register.',
      'Read the band: compliant, at risk, non-compliant, or unknown.',
      'The default policy is a soft claim gate. Soft risk does not block submit. A hard gate blocks when the band is red, or when the certificate is missing or expired.',
    ],
    behind: [
      'The hard block sentence starts “Kitchen food safety hard gate”.',
      'The advisory when the kitchen is only at risk says the department can still review.',
    ],
    errors: [
      { message: 'Kitchen food safety hard gate: …', fix: 'Remediate the certificate or the R638 finding. The screen also says the agency policy blocks submit until that is done.' },
    ],
    faqs: [
      { q: 'The kitchen is at risk and the claim still submits. Is that a bug?', a: 'Not on the default soft gate. Only a hard policy blocks amber or red, and a missing or expired certificate when the gate is hard.' },
    ],
  }),
  feat({
    id: 'visits',
    name: 'Visits',
    href: '/dashboard/schools/visits',
    summary: 'Visits are the department’s monitoring trips. A school sees the visits to that school. Planning and the official form are department-only.',
    who: `${WHO} Planning, reschedule, reassignment, the monitoring tool, and a RIAD against a school or a service provider are department-only.`,
    prerequisites: ['The company is the department if you are planning the trip.'],
    steps: [
      'A department opens Monitoring trips. Plan the stop and open the form from it.',
      'A school opens PEU visits and reads the result.',
    ],
    behind: ['A visit plan does not post a journal and does not submit a claim.'],
    errors: [
      { message: 'Only DBE/PEU can plan visits', fix: 'Use the department company. A school cannot plan the circuit.' },
      { message: 'Only DBE / PEU field workers can complete the monitoring tool', fix: 'The form is for the department visitor, not the school.' },
    ],
    faqs: [{ q: 'Can a school raise the visit RIAD?', a: 'No. The API says only the department can raise RIADs against schools or service providers.' }],
  }),
  feat({
    id: 'orders',
    name: 'Orders and deliveries',
    href: '/dashboard/schools/orders',
    summary: 'A school sends a purchase order to a service provider that has an active link. The service provider delivers. The school receives.',
    who: WHO,
    prerequisites: ['The service provider has an active link to the school. A draft can be deleted only by the school that created it, and only before it is sent.'],
    steps: [
      'A school opens Orders. The title is Kitchen orders. Press Send this draft PO to your service provider when it is ready. Delete draft is only before it is sent.',
      'A service provider opens Orders. The title is School orders.',
      'Open Deliveries. Print delivery note is the hard copy for the school. Print goods received note is the copy for the service provider. The matching report is PO · DN · GRN.',
      'From Kitchen stock you can create a draft weekly reorder or a draft monthly reorder from menu demand minus what is on hand.',
    ],
    behind: [
      'Send moves the draft to the service provider. Substitute on a delivery is the service provider only.',
      'No finance journal is posted by the order or the delivery note.',
    ],
    errors: [
      { message: 'Select a service provider. Only SPs with an active link to your school can receive orders.', fix: 'Approve the link on Join first, then pick that service provider.' },
      { message: 'Only the school that created this PO can delete it', fix: 'Delete is the school’s draft. A sent order is not deleted here.' },
      { message: 'Only the SP can substitute', fix: 'The school receives. The service provider changes the line.' },
    ],
    faqs: [{ q: 'Can I order from a supplier who has not been approved?', a: 'No. The order API requires an active link to that service provider.' }],
  }),
  feat({
    id: 'serve',
    name: 'Serve',
    href: '/dashboard/schools/serve-day',
    summary: 'Serve day records meals and attendance for the feeding day. Claims use those meals.',
    who: WHO,
    prerequisites: ['The day is a feeding day on the department calendar if you expect it to count. Meals served in the period are required before a claim will submit.'],
    steps: ['Open Serve. The accent is Today when the date is today. Record the meals and the attendance for that day.'],
    behind: ['The claim amount starts from meals served times the department meal tariff, then scales by approved-foods adherence. Serve does not submit the claim and does not post a journal.'],
    errors: [
      { message: 'No meals served in period', fix: 'Record serve days in the claim period before you submit.' },
    ],
    faqs: [{ q: 'Does Serve pay the school?', a: 'No. It records the day. Submit on Claims emails the department.' }],
  }),
  feat({
    id: 'claims',
    name: 'Claims',
    href: '/dashboard/schools/claims',
    summary: 'Claims builds a pack and emails it to the department. The department approves, rejects, or marks it paid. Nothing here posts the ledger.',
    who: `${WHO} Submit is the school, after the declaration. In-app review says only the department can review. Paid requires the claim to already be approved.`,
    prerequisites: [
      'An active department link, at least one feeding day with meals, approved foods at the required percent, and a clean three-way match when purchase orders exist.',
      'The department contact email must be on the department desk.',
      'Tick the declaration and type the principal or claim officer’s full name.',
    ],
    steps: [
      'Open Claims. The title is Claims & cost. Read Days fed, Meals served, and Claim amount.',
      'Read Three-way match. The chip is Clean or Not clean.',
      'Tick I accept this declaration on behalf of the school and enter Principal / claim officer full name.',
      'Press Submit claim pack to DBE. One-click claim from clean match is only when the match, the feed days, and the approved brands are ready. Auto-draft from clean match saves a draft. CSV downloads the pack view.',
      'The department approves or rejects from the emailed link or the claims inbox. Mark paid only after approval.',
    ],
    behind: [
      'Statuses are draft, submitted, approved, rejected, and paid. under review is accepted as a current status and no route sets it.',
      'Submit writes an audit note on the claim pack and emails the department. It does not insert an accounting journal.',
      'The first block wins: a locked period, a department claims lock, no active association, no meals, approved foods under the minimum, a service provider on probation or under 60% OTIFEF, a hard kitchen gate, then a three-way match that is not clean when purchase orders exist. A period with no purchase orders is treated as clean.',
      'Approved foods must reach 98% for a full submit. Under 80% uses the blocked sentence. Soft kitchen risk does not block.',
      'Paid refuses a claim that is not already approved.',
    ],
    errors: [
      { message: 'Confirm the school declaration and type the principal / claim officer full name before submitting to DBE.', fix: 'Tick the declaration and type the full name. The same toast is on the page if you skip it.' },
      { message: 'One-click claim blocked — three-way match is not clean for this period', fix: 'Fix the proof of delivery and the goods received note. The button title says it needs a clean match, feed days, and approved brands.' },
      { message: 'DBE contact email is not set. The department must record an official email on Schools → DBE desk before claims can be submitted for approval.', fix: 'The department adds the contact email. You cannot invent one on the claim.' },
      { message: 'Approved foods only …% — claim blocked until kitchen receipts use the department list (min 98%)', fix: 'Receive and issue from the approved catalogue until the percent clears the gate.' },
      { message: 'Agency locked this claim period', fix: 'Ask the department to unlock the period. A department-wide claims lock is a separate sentence.' },
      { message: 'Claim must be approved by DBE before it can be marked paid', fix: 'Approve first. Paid is not a shortcut from submitted.' },
      { message: 'Only DBE can review claims in-app', fix: 'The school submits. The department decides.' },
    ],
    faqs: [
      { q: 'Does a paid claim hit Finance?', a: 'No. Paid is a status on the claim pack. There is no ledger post on submit, approve, reject, or paid.' },
    ],
  }),
  feat({
    id: 'scores',
    name: 'Scores',
    href: '/dashboard/schools/prizes',
    summary: 'School score is the headmaster prize. SP score is supplier performance. A service provider opening prizes sees the preferred-supplier score.',
    who: WHO,
    prerequisites: ['Feeding and delivery history exists if you expect a score above an empty read.'],
    steps: [
      'Open School score. The title is Headmaster prizes unless the role is the service provider, in which case it is SP prize score.',
      'Open SP score. The title is SP SLA · OTIFEF.',
    ],
    behind: ['The scores read the programme. They do not post a journal and they do not change a claim status.'],
    errors: [
      { message: 'SP OTIFEF …% is below 60% for this period — fix late / short / off-catalogue deliveries before full claim submit', fix: 'This block is on the claim, not on the score screen. Improve the deliveries, then submit again.' },
    ],
    faqs: [{ q: 'Can I type the prize score?', a: 'No. The screen calculates it from the programme records.' }],
  }),
];

export const SCHOOLS_GUIDE: ModuleGuide = {
  id: 'schools',
  name: 'SchoolAdvisor®',
  href: '/dashboard/schools',
  purpose:
    'SchoolAdvisor® in SupplierAdvisor® is the feeding programme for a department, a school, and a service provider. The department sets the list, the menu, and the calendar. The school orders, receives, serves, and claims. The department approves the claim by email. The claim does not post the ledger.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'A school with an approved department link can order, serve, and submit a claim that waits for the department’s email decision.',
  flow: [
    { id: 'join', label: 'Join', hint: 'Department approves' },
    { id: 'menu', label: 'Menu', hint: 'Department sets it' },
    { id: 'order', label: 'Order', hint: 'Active SP only' },
    { id: 'serve', label: 'Serve', hint: 'Meals in the period' },
    { id: 'claim', label: 'Claim', hint: 'Email, no journal' },
    { id: 'decide', label: 'Decision', hint: 'Then paid' },
  ],
  faqs: [
    {
      q: 'The kitchen is amber and the claim still went. Why?',
      a: 'The default gate is soft. Amber and red block submit only when the department has set a hard gate, or the certificate is missing or expired on that hard gate.',
    },
  ],
  features,
};
