import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'RecoverAdvisor® opens for a company role that can view RecoverAdvisor®. Sales and a sales contractor are none. Owner is the desk owner. Admin without a staff row is the manager. Finance without a staff row is finance. Member, Viewer, and Operations without a staff row are viewers. A staff row can make a collector an agent, a finance view finance, a compliance user compliance, and a manager only when the company role is admin or operations. The refused action says “You do not have access to do that.” RecoverAdvisor® gives no legal advice. That sentence is on the desk.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'command',
    name: 'Command centre',
    href: '/dashboard/recovergraph',
    summary: 'Command centre is today’s picture. What you see depends on the desk role. An empty book says no accounts yet.',
    who: WHO,
    prerequisites: ['A company is selected. An agent only sees Overview and Work. Other resolved roles see the sections their role allows.'],
    steps: [
      'Open Command centre.',
      'An agent is told the queue is the only work, and that accounts show up after a creditor book is placed.',
      'Finance is told trust and remittance stay blank until those books exist. Compliance is told collection work is not open. A viewer is told the desk is read-only.',
    ],
    behind: [
      'Nothing on this home contacts a debtor.',
      'CFDC is either not required for this operator or recorded as current. The desk does not decide the law.',
    ],
    errors: [
      { message: 'You do not have access to do that.', fix: 'The desk role refused the action. Owner and manager edit the books. An agent can add a note.' },
      { message: 'Your role (…) cannot access RecoverAdvisor®.', fix: 'Sales cannot open this module. Ask an owner for a role that can view it.' },
    ],
    faqs: [{ q: 'Does the home send a letter?', a: 'No. Letters and notices are not open. The process step that says nothing contacts a debtor matches the product.' }],
  }),
  feat({
    id: 'queue',
    name: 'Queue',
    href: '/dashboard/recovergraph/queue',
    summary: 'Queue lists accounts waiting for work. An agent sees My queue. An owner or manager sees All queues.',
    who: WHO,
    prerequisites: ['A book has been placed. Until then the description says no account book yet.'],
    steps: [
      'Open Queue.',
      'With a book, a manager sees how many accounts are not assigned. Anyone else sees how many are assigned to them.',
    ],
    behind: ['Assigned accounts can stay hidden until the database setup is approved. The empty line says that. No letter is sent from the queue.'],
    errors: [
      { message: 'No accounts yet', fix: 'Import a book after a creditor and an active mandate exist. The queue does not invent accounts.' },
      { message: 'Assigned accounts stay hidden until the database setup is approved.', fix: 'This is the pending-setup state, not a filter you can clear on the page.' },
    ],
    faqs: [{ q: 'Can an agent see every account?', a: 'No. The agent nav is My queue, and the agent section list is Overview and Work.' }],
  }),
  feat({
    id: 'accounts',
    name: 'Accounts',
    href: '/dashboard/recovergraph/accounts',
    summary: 'Accounts is the placed book. An owner or manager can flag, adjust, or recall. An agent can add a note. There is no payment button.',
    who: `${WHO} Recall and adjustment need a role that can change accounts: the owner or the manager. The process picture that names only the manager for recall is short of the owner, who can recall too.`,
    prerequisites: ['The account is on the book you can see. An agent cannot open someone else’s account.'],
    steps: [
      'Open Accounts. The state chip shows the stored state with spaces instead of underscores.',
      'Press Stop flag, choose a flag, and press Set flag. Press Clear flag to remove it. The copy says the flag does not send or block a message.',
      'Flags are debt review, deceased, insolvency, represented, dispute, and do not contact.',
      'Under Adjustment enter Replacement amount in rands and press Record adjustment. Confirm the amount. It replaces the current adjustment. It is not added on top.',
      'Under Recall account enter Recall reason and press Recall account. Confirm. Recall closes the account off the active book only when it is active.',
      'An agent writes a note. The success line is Note recorded.',
    ],
    behind: [
      'Recall sets the state to recalled and only from active. It does not set closed, paid, or arrangement.',
      'There is no screen action that writes paid, arrangement, dispute, legal, prescribed, stopped, or closed. Those words exist as stored states and as filters. Payments are not recorded. An adjustment is not a receipt.',
      'The change is written to an append-only audit log. It is not an accounting journal.',
      'A flag does not contact the debtor.',
    ],
    errors: [
      { message: 'That adjustment would take the balance below zero.', fix: 'Enter a replacement that leaves the balance at zero or above.' },
      { message: 'RecoverAdvisor® could not save that change.', fix: 'A recall of an account that is not active fails this way. Recall only from active. Reload if the row changed.' },
      { message: 'That account is not on your book.', fix: 'An agent can open assigned accounts. Ask a manager to assign it.' },
      { message: 'Write a note first.', fix: 'The note cannot be empty.' },
      { message: 'Choose a recorded flag.', fix: 'Use one of the flags on the control.' },
    ],
    faqs: [
      { q: 'The filter says paid. How do I mark an account paid?', a: 'You do not. Payments are not recorded yet. The paid filter is there. No button sets that state.' },
    ],
  }),
  feat({
    id: 'creditors',
    name: 'Creditors',
    href: '/dashboard/recovergraph/creditors',
    summary: 'Creditors are the clients who place accounts. The detail line says RecoverAdvisor® gives no legal advice.',
    who: `${WHO} Adding a creditor is the owner or the manager.`,
    prerequisites: ['Name is required. A customer link must be a customer of this company, or left as no customer link.'],
    steps: [
      'Open Creditors. Press Add your first creditor or Add a creditor.',
      'Enter Name. Customer can stay No customer link. Registration and Email are on the form. Press Save creditor.',
    ],
    behind: [
      'A new creditor is active. Archive sets inactive.',
      'No journal is posted and no debtor is contacted.',
    ],
    errors: [
      { message: 'Enter a creditor name.', fix: 'Name is required.' },
      { message: 'A creditor with that name is already on the book.', fix: 'Open the existing creditor instead of adding a second one.' },
      { message: 'Choose a customer from this company.', fix: 'Pick a customer already on this company, or leave No customer link.' },
      { message: 'Creditors could not be opened.', fix: 'Reload. If setup is pending, the book cannot be read yet.' },
    ],
    faqs: [{ q: 'Does Save creditor start collection?', a: 'No. You still need a mandate and a placed book. This row is the client.' }],
  }),
  feat({
    id: 'mandates',
    name: 'Mandates',
    href: '/dashboard/recovergraph/mandates',
    summary: 'A mandate records authority to collect. The form stores a draft. It does not collect the signature date or the agreement reference, so it does not become active.',
    who: `${WHO} Adding a mandate is the owner or the manager.`,
    prerequisites: ['A creditor exists. The product type is required.'],
    steps: [
      'Open Mandates. Press Add a mandate.',
      'Choose a creditor and a product: Trade, Credit, Levy, Rent, Medical, Utility, or Other.',
      'Read the lines on commission and on allocation order. Both say RecoverAdvisor® gives no legal advice. Commission is recorded for later. No fee is calculated or charged.',
      'Save. The chip will show Draft unless something else has set the status. The form does not ask for a signed date or an agreement reference.',
    ],
    behind: [
      'A row with no status is stored as draft. Active is legal only when a signed date is set and the agreement reference is present and at most 120 characters. This form sends neither, and the save path does not include a status change.',
      'The National Credit Act copy says the notice steps are not applied yet.',
      'The agreement document is not stored.',
      'An import will not place a book against a draft. The database places only an active mandate for an active creditor.',
    ],
    errors: [
      { message: 'Choose a product type.', fix: 'Pick one of the products on the form.' },
      { message: 'Choose a creditor.', fix: 'Add the creditor first.' },
      { message: 'Mandates could not be opened.', fix: 'Reload the desk.' },
    ],
    faqs: [
      { q: 'The import says to add an active mandate. Why does mine stay draft?', a: 'The form does not collect the signed date or the agreement reference, and there is no button that sets the mandate active. A draft will not place a book.' },
    ],
  }),
  feat({
    id: 'imports',
    name: 'Imports',
    href: '/dashboard/recovergraph/imports',
    summary: 'Imports places a creditor’s book after a dry run. Placement requires an active mandate. A draft mandate does not place.',
    who: `${WHO} Import is the owner. The manager can work the book and cannot clear the demo book. Only the owner can turn on real debtor data.`,
    prerequisites: ['A creditor exists. The mandate must already be active. The screen says to add a creditor and an active mandate before placing a book.'],
    steps: [
      'Open Imports & batches.',
      'Choose a creditor and a mandate. Run the dry run. Read the result. The success line is Dry run finished.',
      'Place the book only when the dry run has no rows that cannot be placed. The success line is Placed, with the count.',
      'Roll back only while no account from the batch has been noted, assigned, flagged, adjusted, or merged.',
    ],
    behind: [
      'Place writes the accounts and an audit row. It does not post a finance journal and it does not contact a debtor.',
      'The commit refuses a mandate that is not active. The page then says the book could not be placed.',
      'Real debtor data stays off until the owner completes the sign-off. The owner is the only role that can change that switch, and the confirmation phrase must be typed exactly.',
    ],
    errors: [
      { message: 'Choose an active mandate.', fix: 'The id must be a real mandate. A draft still will not place, and the failed status comes back as could not place that book.' },
      { message: 'Run a dry run on this file before placing it.', fix: 'Dry run first. Commit is refused without it.' },
      { message: 'The dry run found rows that cannot be placed.', fix: 'Fix the file. Do not place over the errors.' },
      { message: 'This batch can only be rolled back while no account from the batch has been worked (noted, assigned, flagged, adjusted, merged).', fix: 'Leave the batch. Worked accounts cannot be rolled back.' },
      { message: 'RecoverAdvisor® is in demo-data mode until data-location and operator-agreement sign-off is complete.', fix: 'An owner completes that sign-off before real debtor rows are accepted.' },
      { message: 'Only the company owner can change real debtor data.', fix: 'Admin and finance cannot flip that switch.' },
    ],
    faqs: [
      { q: 'Can I load a demo book?', a: 'Only an owner, and only while real debtor data is off. Clear it from the same desk. Do not treat those rows as a creditor’s book.' },
    ],
  }),
  feat({
    id: 'team',
    name: 'Team and registrations',
    href: '/dashboard/recovergraph/settings/team',
    summary: 'Team stores the operator, the Council registration you type, and the trust mode. The trust ledger is not open.',
    who: `${WHO} Workspace setup is the owner and the manager. Real-data confirmation is the owner.`,
    prerequisites: ['Choose an operator type and a trust mode. Collections is the only programme.'],
    steps: [
      'Open Team & registrations.',
      'Set Display name. Operator is Agency, In-house, or Attorney. Programme stays Collections.',
      'Choose Trust account or Paid direct to the creditor. Read the line that says the ledger itself is not open yet.',
      'Enter CFDC number and CFDC expiry if you are recording them. The checkbox can block assignment when a Council registration is missing or recorded as expired. The copy says to verify who must register, and that RecoverAdvisor® gives no legal advice.',
    ],
    behind: [
      'Trust mode is a label. Money is not held and not remitted here.',
      'Assignment can be refused when the collector has no Council number, or when the recorded expiry is past. The desk does not check a register outside what you typed.',
      'Staff roles are manager, collector (shown as Agent), compliance, and finance view (shown as Finance).',
    ],
    errors: [
      { message: 'That person has no Council registration recorded.', fix: 'Record the number, or turn off the block if you are allowed to. The desk is not deciding the legal duty.' },
      { message: 'That registration is recorded as expired.', fix: 'Enter a later expiry you have on file, or assign someone else.' },
      { message: 'Collections is the only programme in this version.', fix: 'Leave Programme on Collections.' },
      { message: 'Choose a trust mode.', fix: 'Pick Trust account or Paid direct to the creditor. Neither opens a ledger.' },
    ],
    faqs: [{ q: 'Does Trust account create a trust ledger?', a: 'No. The screen says the ledger is not open yet. Remittance and statements are not a screen.' }],
  }),
  feat({
    id: 'portals',
    name: 'Portals',
    href: '/dashboard/recovergraph/settings/portals',
    summary: 'Portals describes three signed-out doors. This version does not issue a link, a code, or a count.',
    who: WHO,
    prerequisites: ['You can open the settings section. An agent does not see Setup.'],
    steps: ['Open Portals & install. Read the description. There is no issue button.'],
    behind: ['No token is created. No debtor is invited. No journal is posted.'],
    errors: [
      { message: 'You do not have access to do that.', fix: 'There is no portal action to retry. The screen is descriptive.' },
    ],
    faqs: [{ q: 'Where is the debtor link?', a: 'It is not issued. The page says none of the doors issue a link in this version.' }],
  }),
];

export const RECOVER_GUIDE: ModuleGuide = {
  id: 'recovergraph',
  name: 'RecoverAdvisor®',
  href: '/dashboard/recovergraph',
  purpose:
    'RecoverAdvisor® in SupplierAdvisor® is the collections desk: a creditor, a draft mandate, a placed book, a queue, and notes, flags, adjustments, and recall. It does not contact a debtor, record a payment, or post a trust ledger. It gives no legal advice.',
  roles: ['Owner', 'Manager', 'Agent', 'Finance', 'Compliance', 'Viewer'],
  outcome: 'A creditor is on the book. A mandate saved from the form stays draft, so a file will not place until that mandate is active. Recall works from active to recalled.',
  flow: [
    { id: 'creditor', label: 'Creditor', hint: 'The client' },
    { id: 'mandate', label: 'Draft mandate', hint: 'Not active yet' },
    { id: 'place', label: 'Place', hint: 'Needs active' },
    { id: 'queue', label: 'Queue', hint: 'Assign' },
    { id: 'work', label: 'Note or flag', hint: 'No letter' },
    { id: 'recall', label: 'Recall', hint: 'From active only' },
  ],
  faqs: [
    {
      q: 'The process picture says the mandate step is live and then you place the book. Can I?',
      a: 'You can save a mandate, and it is stored as a draft. Placement runs only for an active mandate. The form does not set it active, so a real file does not place against that draft.',
    },
    {
      q: 'Can I record the payment that closes the account?',
      a: 'No. Adjustment replaces a figure and is not a receipt. Recall from active sets recalled. Paid, arrangement, and closed are not buttons.',
    },
  ],
  features,
};
