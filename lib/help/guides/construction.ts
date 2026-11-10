import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

/**
 * Desk roles come from lib/construction/roles.ts.
 * Owner and Admin are the desk owner.
 * Member and Operations are the site manager (operations write, no accounting view).
 * Finance is the office (accounting write).
 * Viewer and Sales are viewers.
 * The book is company metadata. It does not post a ledger journal.
 */
const WHO =
  'ConstructionAdvisor® opens for anyone who can view Operations. Owner and Admin are the desk owner. Member and Operations are the site manager. Finance is the office. Viewer and Sales are viewers. A sales contractor cannot open the dashboard. The module gate says “Your role (…) cannot access Operations.” A desk action the role cannot take says “Not available for your role”.';

const BOOK =
  'The book is stored on this company. Amounts stay as entered. ConstructionAdvisor® does not calculate VAT and does not post a finance journal.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'command',
    name: 'Command',
    href: '/dashboard/constructiongraph',
    summary: 'Command is the desk home: projects on site, programme plan and actual, and the claims the money roles can see.',
    who: WHO,
    prerequisites: ['Open the company whose construction book you are using.', 'You can view Operations.'],
    steps: [
      'Open Command from ConstructionAdvisor®.',
      'Read Projects on site, Programme plan, and Programme actual. Plan and actual come from the stored row percents.',
      'Owner, office, and viewer also see Certified to date and Outstanding claims when the payments list is on the book. The site manager does not.',
      'On an empty book the owner sees Load sample project. That button is only for an empty book. Remove sample takes those illustration rows off. They are not this company’s own projects.',
      'The checklist marks Done or Still open for Client, Quote, Programme, Subcontractor, Diary, and Portal.',
    ],
    behind: [
      BOOK,
      'Load sample project and Remove sample are owner actions. Any other role that posts them is refused.',
      'A site manager’s home lists projects whose status is on site. It does not show contract values.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'Load sample project and Remove sample are for the desk owner (Owner or Admin). Use Add client and New project for this company’s own book.',
      },
      {
        message: 'Your role (…) cannot access Operations.',
        fix: 'Ask an owner for a role that can view Operations. A sales contractor uses Sales and cannot open this desk.',
      },
    ],
    faqs: [
      {
        q: 'Does Command post to Finance?',
        a: 'No. The figures are the construction book as entered. Finance journals are a separate module.',
      },
    ],
  }),
  feat({
    id: 'clients',
    name: 'Clients',
    href: '/dashboard/constructiongraph/clients',
    summary: 'Clients is the register of people you build for. One client can hold many projects.',
    who: `${WHO} Add client and Save client need the desk owner.`,
    prerequisites: ['You are the desk owner if you need to add a client. Other roles can open the list when their desk role allows the collection.'],
    steps: [
      'Open Clients.',
      'Press Add client. The empty state says “No clients yet” and “Add the first client, then attach a project.”',
      'Enter Name, City, and Contact. Press Save client.',
      'On a saved client, press Issue client link when you want a client portal. Copy the link when it is shown. It is shown once.',
    ],
    behind: [
      'Save client writes the client onto this company’s construction book.',
      'Issue client link stores a client portal token. The full link is not kept on the list. The row shows a hint of the last characters.',
      'No customer invoice is created here.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'Site manager, office, and viewer cannot add a client. Ask an Owner or Admin.',
      },
    ],
    faqs: [
      {
        q: 'Can one client have more than one project?',
        a: 'Yes. Projects are separate rows. You link a project to the client after both exist.',
      },
    ],
  }),
  feat({
    id: 'quotes',
    name: 'Quotes',
    href: '/dashboard/constructiongraph/quotes',
    summary: 'Quotes stores a draft title and lists BOQ lines already on the book. There is no control that issues or accepts a quote.',
    who: `${WHO} The screen is shown to the desk owner and the office, because they can see costs. Saving a quote is a quotes collection. The office is not allowed to write that collection, so the save is refused. The site manager and the viewer see “Not available for your role” before the form.`,
    prerequisites: ['You are the desk owner (Owner or Admin) if the quote must be saved. Finance can open the list and cannot save it.'],
    steps: [
      'Open Quotes. The page says amounts are shown as entered and this book does not calculate VAT.',
      'Filter with All, Draft, Issued, Accepted, or Lost. Lost is the declined status.',
      'Press New quote. Enter Title. Press Save quote. The row is stored as draft.',
      'Read BOQ lines under the list. The screen lists lines already on the book. It does not have an add-line button, and it does not have an Issue button.',
    ],
    behind: [
      'Save quote writes status draft. The filters Issued, Accepted, and Lost only match rows that already have those statuses.',
      'There is a server function that would mark a quote accepted and move a tender project to awarded. The Quotes screen does not call it.',
      'Nothing is posted to the ledger, and VAT is not added.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'Quotes and the BOQ are hidden from the site manager and from a viewer. Open them as Owner, Admin, or Finance.',
      },
    ],
    faqs: [
      {
        q: 'The empty hint says to issue the quote. Where is Issue?',
        a: 'There is no Issue control. New quote only saves a draft. The process picture that says issuing a quote is still closed matches the screen.',
      },
    ],
  }),
  feat({
    id: 'projects',
    name: 'Projects',
    href: '/dashboard/constructiongraph/sites',
    summary: 'Projects are the contracts and building sites. A new project starts as tender.',
    who: `${WHO} New project is the desk owner. Update status is accepted from the desk owner and, as a status-only change, from the site manager.`,
    prerequisites: ['Add the client first if you want the project linked to one. The create form itself only asks for Name and Code.'],
    steps: [
      'Open Projects. Switch Cards or Table.',
      'Press New project. Enter Name and Code. Both are required. Press Save project.',
      'Open a project. The sections are Overview, Programme, Team, Documents, and Snags. Money is added for roles that can see money.',
      'On Overview, press Update status. If the project is on site, that sets practical completion. Any other status becomes on site.',
    ],
    behind: [
      'Save project stores status tender. The status list also contains awarded, final account, and closed, and this button does not set those.',
      'A site manager may send a status and notes change. A wider edit of the project, including a contract value, is refused.',
      'The office cannot write the project list.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'New project is for Owner or Admin. A priced edit from the site manager, and any project write from the office or a viewer, is refused.',
      },
    ],
    faqs: [
      {
        q: 'How does a project leave tender?',
        a: 'Update status moves it to on site, and from on site to practical completion. There is no button on this screen for awarded, final account, or closed.',
      },
    ],
  }),
  feat({
    id: 'programme',
    name: 'Programme',
    href: '/dashboard/constructiongraph/programme',
    summary: 'Programme is the plan, the baseline, and the actual percent for one project.',
    who: `${WHO} Add task, Save task, and Baseline need a role that can edit the programme: the desk owner or the site manager. The office cannot.`,
    prerequisites: ['A project exists. The Project list is empty until one is saved.'],
    steps: [
      'Open Programme. Choose Project.',
      'Read Plan end, Revised end, and Forecast.',
      'Press Add task. Enter Activity and, if you need it, Depends on. None means no predecessor. Press Save task.',
      'Press Baseline. If the programme was already baselined, the button becomes Confirm re-baseline. Press it to replace the baseline.',
      'An approved variation adds its days beside the bar. The screen says so.',
    ],
    behind: [
      'Save task stores kind task, status planned, and planned and actual percents at zero, on today’s dates.',
      'Baseline stores the current plan as the baseline. Re-baseline asks for confirmation before it replaces that baseline.',
      'The office is read-only here.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'Finance, Viewer, and Sales cannot add a task or baseline the programme.',
      },
    ],
    faqs: [
      {
        q: 'Why is there no programme?',
        a: 'The empty state is “No programme yet”. Add a task on a project. Older rows without a kind still show as tasks.',
      },
    ],
  }),
  feat({
    id: 'diary',
    name: 'Site diary',
    href: '/dashboard/constructiongraph/diary',
    summary: 'One diary entry per project per day. Sign off locks that day.',
    who: `${WHO} Start today’s diary and Sign off need the desk owner or the site manager.`,
    prerequisites: ['A project is on the book.'],
    steps: [
      'Open Diary. Choose Day or Month, then Project.',
      'Press Start today’s diary when the day is empty.',
      'Set the weather with Clear, Cloudy, Rain, or Wind. Write Progress.',
      'Press Sign off. The day then reads Signed off, and Progress is disabled.',
    ],
    behind: [
      'Sign off stores the time and the name on that diary row. A second entry for the same project and day is not how this screen works.',
      'The page text says later edits are addenda. There is no addendum button. After sign-off the Progress field stays disabled.',
      'The diary does not post a journal and does not notify Finance.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'The office and a viewer can read the diary when the collection is visible. They cannot start or sign off a day.',
      },
    ],
    faqs: [
      {
        q: 'Can I change Progress after Sign off?',
        a: 'No. The field is disabled once the day is signed off.',
      },
    ],
  }),
  feat({
    id: 'subcontractors',
    name: 'Subcontractors',
    href: '/dashboard/constructiongraph/subcontractors',
    summary: 'Subcontractors is a record of the trades on a site. They do not get a login here.',
    who: `${WHO} Add subcontractor is the desk owner. A site manager cannot save a contract value.`,
    prerequisites: ['You are the desk owner to add a row.'],
    steps: [
      'Open Subcontractors. The empty state says they use TradeAdvisor®.',
      'Press Add subcontractor. Enter Name and Trade. Press Save subcontractor.',
      'Open a row to see the programme activities linked to that trade.',
    ],
    behind: [
      'The row is stored with status tendering. There is no subcontractor login and no file upload on this list.',
      'A site manager write that includes a contract value is refused. Prices stay with the office and the owner.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'Adding a subcontractor is for Owner or Admin. A priced subcontractor row from the site manager is refused.',
      },
    ],
    faqs: [
      {
        q: 'Do subcontractors sign in to ConstructionAdvisor®?',
        a: 'No. This list is a record. Their own jobs, if they use the product, are in TradeAdvisor®.',
      },
    ],
  }),
  feat({
    id: 'materials',
    name: 'Materials',
    href: '/dashboard/constructiongraph/materials',
    summary: 'Materials records orders and deliveries against the project. Files are not uploaded.',
    who: `${WHO} Add material is available to roles that can write this collection, including the desk owner and the site manager.`,
    prerequisites: ['A project exists if you want the row tied to one. The form asks for the item.'],
    steps: [
      'Open Materials. The page says orders and deliveries are recorded against the project, and there is no file upload.',
      'Press Add material. Enter Item. Press Save material.',
    ],
    behind: [
      'The row is stored on the construction book. It does not create a purchase order and it does not receive inventory.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'The office and a viewer cannot add a material row.',
      },
    ],
    faqs: [
      {
        q: 'Does a material row hit Inventory?',
        a: 'No. It stays on the construction book.',
      },
    ],
  }),
  feat({
    id: 'variations',
    name: 'Variations',
    href: '/dashboard/constructiongraph/variations',
    summary: 'A variation records extra scope and days. Prices stay with the office.',
    who: `${WHO} The site manager and the desk owner can raise a variation. Approve, Reject, and Query need the office or the desk owner.`,
    prerequisites: ['A project is on the book if the variation should sit against one.'],
    steps: [
      'Open Variations. Press Raise variation.',
      'Enter Title and Days. Press Save variation. Do not put a price on a site-manager variation.',
      'The office opens the variation, writes a Decision note, and presses Approve, Reject, or Query.',
    ],
    behind: [
      'A site-manager variation that includes an amount or a rate is refused before it is saved.',
      'Approve, Reject, and Query store that decision, the note, and the date. An approved variation adds its days beside the programme bar.',
      'No ledger journal is posted.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'A priced variation from the site manager is refused. A viewer cannot raise or decide one.',
      },
    ],
    faqs: [
      {
        q: 'Where do I put the variation price?',
        a: 'On the office or owner desk. The site manager form asks for Title and Days only, and a price on that role is rejected.',
      },
    ],
  }),
  feat({
    id: 'payments',
    name: 'Payments',
    href: '/dashboard/constructiongraph/payments',
    summary: 'Payments are progress claims. Certify issues the certificate. Record pay marks the claim paid. None of this posts Finance.',
    who: `${WHO} The site manager does not see this screen. Add claim is the desk owner. Certify and Record pay need a role that can certify: the desk owner or the office.`,
    prerequisites: ['A project exists. The new claim is attached to the first project on the book.'],
    steps: [
      'Open Payments. The page says amounts are as entered and VAT is not calculated.',
      'Press Add claim. Enter Title and Amount as entered. Press Save claim. The row starts as planned.',
      'Read Claimed, Certified, and Paid.',
      'Press Certify on a claim that is not yet certified. Retention is 10% of the certified amount.',
      'Press Record pay on a certified claim that is not yet paid.',
    ],
    behind: [
      'Save claim stores status planned and the amount as the planned amount.',
      'Certify sets the claim to certified, writes the certified amount, stores retention at 10%, and creates an interim payment certificate numbered from the claim.',
      'Record pay sets the claim and that certificate to paid. It does not send money and it does not post a journal.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'The site manager cannot open payments. Add claim is owner-only. Certify is for Owner, Admin, or Finance.',
      },
    ],
    faqs: [
      {
        q: 'Does Certify create a tax invoice?',
        a: 'No. It writes an interim payment certificate on this book. The certificate screen lists it. Finance is unchanged.',
      },
    ],
  }),
  feat({
    id: 'certificates',
    name: 'Certificates',
    href: '/dashboard/constructiongraph/certificates',
    summary: 'Certificates lists interim payment certificates created when a claim is certified.',
    who: `${WHO} The site manager sees “Interim payment certificates stay with the office.” The office, the desk owner, and a viewer who can see money can read the list. There is no add button.`,
    prerequisites: ['A progress claim has been certified.'],
    steps: [
      'Open Certificates.',
      'Read Number, Period, Certified, Retention, and Status. The empty state says to certify a progress claim.',
    ],
    behind: [
      'A certificate is created by Certify on Payments. Its status starts as issued, and Record pay moves it to paid.',
      'Retention is the amount stored at certify, which is 10% of the certified amount.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'Open this screen as Owner, Admin, Finance, or a viewer. The site manager is kept out.',
      },
    ],
    faqs: [
      {
        q: 'Why is the list empty after I saved a claim?',
        a: 'Save claim only plans the claim. Press Certify on Payments. The certificate appears after that.',
      },
    ],
  }),
  feat({
    id: 'costs',
    name: 'Costs',
    href: '/dashboard/constructiongraph/costs',
    summary: 'Costs are actuals allocated to a project, as entered. The form stores the kind as other.',
    who: `${WHO} The site manager does not see costs. Add cost is the desk owner. The office can read the list.`,
    prerequisites: ['A project exists. The cost is attached to the first project on the book.'],
    steps: [
      'Open Costs. Press Add cost.',
      'Enter Description and Amount as entered. Press Save cost.',
      'Read Description, Kind, As entered, and Project.',
    ],
    behind: [
      'Save cost stores kind other, today’s date, and the first project on the book. There is no kind picker, no project picker, and no BOQ picker.',
      'The save does not allocate the amount onto a BOQ line. The sidebar line about allocating actuals to the BOQ is not what this form does.',
      'No finance journal is posted. The empty hint says “Post an actual”. That means save the cost on this book.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'The site manager sees “Actuals and margin stay with the office.” Add cost needs Owner or Admin.',
      },
    ],
    faqs: [
      {
        q: 'Can I choose labour or material?',
        a: 'Not on this form. Save cost always stores the kind as other.',
      },
    ],
  }),
  feat({
    id: 'safety',
    name: 'Safety',
    href: '/dashboard/constructiongraph/safety',
    summary: 'Safety records toolbox talks, incidents, permits, and inductions. Dates are the only expiry signal.',
    who: `${WHO} Logging a talk or an induction needs the desk owner or the site manager.`,
    prerequisites: ['A project on the book is used as the site for a new row.'],
    steps: [
      'Open Safety. The title is Health and safety.',
      'Switch Toolbox talks, Incidents, Inspections and permits, or Inductions and documents.',
      'Enter a title and press Log toolbox talk, or enter the person and press Log induction.',
      'Read Title, Status, Who, Date, and Expiry. A row with no date says No expiry date.',
      'Use Open the Core SHEQ hub when the incident belongs in SHEQ as well.',
    ],
    behind: [
      'Log toolbox talk stores kind toolbox and status closed. Log induction stores kind induction and status open.',
      'The screen does not file a statutory return and does not notify a regulator.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'The office and a viewer do not get Log toolbox talk or Log induction.',
      },
    ],
    faqs: [
      {
        q: 'Does an incident here replace SHEQ?',
        a: 'No. This list is the site record. The link Open the Core SHEQ hub goes to the SHEQ module.',
      },
    ],
  }),
  feat({
    id: 'documents',
    name: 'Documents',
    href: '/dashboard/constructiongraph/drawings',
    summary: 'Documents records what was issued, to whom, and which revision is current. Files are not stored.',
    who: `${WHO} Record issue is the desk owner, and also a role that can write the diary.`,
    prerequisites: ['You can write drawings or the diary.'],
    steps: [
      'Open Documents. The page says files are not stored in ConstructionAdvisor® yet.',
      'Press Record issue. Enter Number, Title, and Issued to. Press Save register row.',
    ],
    behind: [
      'The row is a register entry. No file is uploaded and no drawing binary is kept.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'The office and a viewer do not see Record issue.',
      },
    ],
    faqs: [
      {
        q: 'Can I attach the PDF?',
        a: 'No. The register tracks the issue. The file itself is not stored.',
      },
    ],
  }),
  feat({
    id: 'handover',
    name: 'Handover',
    href: '/dashboard/constructiongraph/handover',
    summary: 'Handover is the snag list. Closing a snag records the day. Photos are not stored.',
    who: `${WHO} Add snag and Close need the desk owner or the site manager.`,
    prerequisites: ['A project is on the book if the snag should sit against one.'],
    steps: [
      'Open Handover. Press Add snag. Enter Item. Press Save snag.',
      'Press Close on an open snag. The row becomes closed and the closed day is stored.',
    ],
    behind: [
      'Close sets status closed and closed_on to today. Photos are not stored.',
      'Practical completion on the project is a separate Update status action. Closing a snag does not change the project status.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'The office and a viewer cannot add or close a snag.',
      },
    ],
    faqs: [
      {
        q: 'Does Close finish the project?',
        a: 'No. It closes that snag. The project status changes only from Update status on Projects.',
      },
    ],
  }),
  feat({
    id: 'reports',
    name: 'Reports',
    href: '/dashboard/constructiongraph/reports',
    summary: 'Reports is one card per project from the book. There is no benchmark filled in when the book is empty.',
    who: `${WHO} Money lines on a card are hidden from the site manager.`,
    prerequisites: ['At least one project is saved. Otherwise the screen says “No projects yet”.'],
    steps: [
      'Open Reports.',
      'Read the project, its status, programme plan against actual, and Open snags.',
      'Where your role can see money, the card also shows Certified and costs, as entered.',
    ],
    behind: [
      'Figures are calculated from this company’s book. Nothing is invented to fill a gap, and nothing is posted.',
    ],
    errors: [
      {
        message: 'Your role (…) cannot access Operations.',
        fix: 'Reports uses the same Operations gate as the rest of ConstructionAdvisor®.',
      },
    ],
    faqs: [
      {
        q: 'Why is a money line missing?',
        a: 'The site manager’s card stops at the programme and the open snags. Certified and costs stay with roles that can see money.',
      },
    ],
  }),
  feat({
    id: 'portal',
    name: 'Portal',
    href: '/dashboard/constructiongraph/portal',
    summary: 'Portal issues an open programme link, a client link, and a workers link. The owner copies each link once.',
    who: `${WHO} Issuing links is the desk owner. Everyone else sees “Links are issued by the owner.”`,
    prerequisites: ['A client exists before the client card can attach one. A project exists before the workers card can attach one.'],
    steps: [
      'Open Portal.',
      'Under Workers and money, press Allow workers to see certified and paid, or Hide certified and paid from workers. Certified and paid stay off the workers app until you allow them.',
      'Set Expiry to No expiry, 90 days, or 1 year.',
      'On Open programme, Client, or Workers, press Issue. When a link already exists the button reads Reissue. Press Revoke to kill the current link. Press Preview to open that kind.',
      'When the link is created, the screen says “Copy this link now. It is shown once.” Press Copy.',
    ],
    behind: [
      'Issue stores a token hash. The full token is returned once and is not listed again. The card shows a short hint.',
      'Revoke marks that portal revoked. Reissue replaces the live link.',
      'The workers app does not show certified and paid until the owner allows it. The API enforces that switch.',
    ],
    errors: [
      {
        message: 'Not available for your role',
        fix: 'Only Owner or Admin can issue, reissue, or revoke a link.',
      },
    ],
    faqs: [
      {
        q: 'I closed the page before I copied the link. What now?',
        a: 'Press Reissue. The previous full link is not shown again.',
      },
    ],
  }),
];

export const CONSTRUCTION_GUIDE: ModuleGuide = {
  id: 'constructiongraph',
  name: 'ConstructionAdvisor®',
  href: '/dashboard/constructiongraph',
  purpose:
    'ConstructionAdvisor® in SupplierAdvisor® is the site book: the client, a draft quote, the project, the programme and diary, variations, progress claims, and handover. Money on this desk is as entered. It does not post the company ledger.',
  roles: ['Owner', 'Admin', 'Member', 'Operations', 'Finance', 'Viewer', 'Sales'],
  outcome:
    'A client and a tender project are on the book, the programme and diary are kept, a claim can be certified into an interim payment certificate, and snags can be closed.',
  flow: [
    { id: 'client', label: 'Client', hint: 'Then a project' },
    { id: 'quote', label: 'Draft quote', hint: 'No issue button' },
    { id: 'project', label: 'Project', hint: 'Starts tender' },
    { id: 'build', label: 'Programme', hint: 'Diary and safety' },
    { id: 'change', label: 'Variation', hint: 'Days, then price' },
    { id: 'claim', label: 'Claim', hint: 'Certify, then pay' },
    { id: 'hand', label: 'Handover', hint: 'Close snags' },
  ],
  faqs: [
    {
      q: 'The process picture says a quote is issued to the client. Where do I do that?',
      a: 'You do not. Quotes only saves a draft. There is no Issue control and the accept function is not on this screen.',
    },
    {
      q: 'Will a certified claim appear in Finance?',
      a: 'No. Certify writes an interim payment certificate on the construction book. It does not post a journal and it does not send the money.',
    },
  ],
  features,
};
