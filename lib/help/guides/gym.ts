import type { GuideFeature, ModuleGuide } from '@/lib/help/types';
import { gateMessage, viewRoleLabels } from '@/lib/help/roles';

const WHO =
  'GymAdvisor® opens for the Owner only. The permission is gym_owner, and every other team role has none, so the gate says “Your role (…) cannot access GymAdvisor® (owner only).” Coaches use their coach link. Members use their member link. The GymAdvisor® API checks the owner role. Netcash routes also allow an admin, but an admin still cannot open this dashboard.';

const GATE = {
  message: gateMessage('gym_owner'),
  fix: 'Sign in as the owner of the gym company. A coach or a member uses their own link, not this dashboard.',
};

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const GYM_GUIDE: ModuleGuide = {
  id: 'fitgraph',
  name: 'GymAdvisor®',
  href: '/dashboard/fitgraph',
  purpose:
    'GymAdvisor® in SupplierAdvisor® is the owner’s gym book: members, classes, the floor, debit-order mandates, and the Netcash billing run. An unpaid debit warns at check-in. Access stays open. SupplierAdvisor® does not move the member’s money until a live Netcash call is actually allowed, and this build refuses live Netcash calls.',
  roles: viewRoleLabels('gym_owner'),
  outcome:
    'A member is on the book, the mandate is signed and activated, a billing run is previewed and submitted, and check-in records the visit.',
  flow: [
    { id: 'member', label: 'Member', hint: 'Clients' },
    { id: 'mandate', label: 'Mandate', hint: 'Sign mandate' },
    { id: 'invoice', label: 'Invoice', hint: 'Member fee' },
    { id: 'preview', label: 'Preview run', hint: 'Approve run' },
    { id: 'submit', label: 'Submit', hint: 'Netcash batch' },
    { id: 'reconcile', label: 'Reconcile', hint: 'Fetch results' },
    { id: 'checkin', label: 'Check-in', hint: 'Warn, do not block' },
  ],
  faqs: [
    {
      q: 'A coach cannot see GymAdvisor®. What now?',
      a: 'That is the owner gate. The coach opens the coach work app. Only the owner opens /dashboard/fitgraph.',
    },
    {
      q: 'Does test mode collect debit orders?',
      a: 'No. Test mode says Netcash answers are simulated and no money moves. Live is selected still says this build refuses live Netcash calls, so no money moves.',
    },
  ],
  features: [
    feat({
      id: 'members',
      name: 'Member book',
      href: '/dashboard/fitgraph/clients',
      summary: 'Clients is the member book: who the person is, whether they are active, and how they train.',
      who: WHO,
      prerequisites: ['You are the owner of this gym company.'],
      steps: [
        'Open Clients under People.',
        'Add the member with their full name. Name must be 2–120 characters. Email must be a valid email if you enter one.',
        'A South African ID, when you enter one, is checked as a South African ID.',
        'Set the membership status. The stored values are active, paused, expired, cancelled, trial, frozen, and merged.',
        'Filter the book by active, inactive, or all. A member’s class role is private, class, both, or neither.',
      ],
      behind: [
        'Saving the member writes the gym book and the linked customer record for this company.',
        'Unknown membership status is refused. A possible duplicate is refused with “possible duplicate”.',
      ],
      errors: [
        GATE,
        { message: 'Enter the member’s full name', fix: 'Type the full name before you save.' },
        { message: 'Name must be 2–120 characters', fix: 'Shorten or complete the name so it falls in that length.' },
        { message: 'Enter a valid email', fix: 'Correct the email, or clear it if the form allows a blank email.' },
        { message: 'ID number is not a valid South African ID', fix: 'Check the digits, or leave the ID blank if you are not storing one.' },
        { message: 'Unknown membership status', fix: 'Choose active, paused, expired, cancelled, trial, frozen, or merged.' },
        { message: 'possible duplicate', fix: 'Open the existing member instead of creating a second row.' },
      ],
      faqs: [
        {
          q: 'Can a member be frozen and still be checked in?',
          a: 'Check-in can still be logged. The access check warns. See Check-ins for the exact warning text.',
        },
      ],
    }),
    feat({
      id: 'classes',
      name: 'Classes, movements, and programmes',
      href: '/dashboard/fitgraph/classes',
      summary: 'Classes, the movement library, and programmes are how the floor is taught and sold.',
      who: WHO,
      prerequisites: ['Add the coach on Coaches before you assign them to a class.'],
      steps: [
        'Open Coaches and record the trainer as contract or permanent.',
        'Open Classes. Set the class, the coach, and the calendar. Booked members show on the class.',
        'Open Movements. The screen title is Movement library. Add the exercise and its video.',
        'Open Programmes. Build the plan, then use Assign to clients.',
      ],
      behind: [
        'A class booking can be cancelled or marked attended. Attendance is what the member progress reads.',
        'Assign to clients ties the programme to those members. It does not debit the bank.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Does assigning a programme collect the fee?',
          a: 'No. Fees, mandates, and the billing run are under Accounts, Debit orders, and Billing runs.',
        },
      ],
    }),
    feat({
      id: 'floor',
      name: 'Floor, rooms, and the plan',
      href: '/dashboard/fitgraph/bookings',
      summary: 'The floor is the calendar, the rooms, and the plan of who is booked today.',
      who: WHO,
      prerequisites: ['Rooms exist if a class needs a studio, a court, or a spin room.'],
      steps: [
        'Open Rooms and add the studio, court, or spin room you book against.',
        'Open Calendar to schedule coaches.',
        'Open Plan. The screen is the booking plan for today and the week, including the waitlist.',
        'Open Leadership for the activity board and the age and sex benchmarks.',
        'Open Tasks for follow-ups, and Messages for the desk, coaches, and members.',
      ],
      behind: [
        'Plan reads the bookings already saved. It does not create a debit order.',
        'Messages stay in GymAdvisor®. They do not post a finance journal.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Where do I mark someone attended?',
          a: 'On the class booking, attendance is stored as attended. Check-ins is the separate front-desk log and the phone QR.',
        },
      ],
    }),
    feat({
      id: 'checkins',
      name: 'Check-ins',
      href: '/dashboard/fitgraph/checkins',
      summary: 'Check-ins logs the visit from the desk or from the member’s phone QR, and warns when a membership or a debit looks unpaid.',
      who: WHO,
      prerequisites: ['The member is on Clients. The QR belongs to this gym.'],
      steps: [
        'Open Check-ins. The description says the front-desk log plus phone QR check-ins flags unpaid or frozen memberships.',
        'Under Check in member (desk), select the member.',
        'Choose the method: Front desk, Phone QR, App, Class, or Other.',
        'Press Check in.',
        'Use the gym QR. The copy says “Unique gym QR — members scan to check in on their phones”. Press Full QR & print when you need a printed code.',
      ],
      behind: [
        'A successful desk check-in toasts “Check-in recorded”.',
        'An unpaid debit warns and still logs the visit. The collections note says “An unpaid debit warns at GymAdvisor® check-in. Access stays open.”',
        'The warning text includes “Debit order unpaid — GymAdvisor® access stays open”, “Member marked inactive”, “Membership frozen”, “Membership cancelled”, “Membership expired”, and “Subscription past due — payment outstanding”.',
        'The toast when payment is the problem includes “Member payment issue — check-in logged”.',
      ],
      errors: [
        GATE,
        { message: 'Select client', fix: 'Choose the member before Check in.' },
      ],
      faqs: [
        {
          q: 'Can I turn the unpaid warning into a locked door?',
          a: 'The check-in in the product logs the visit and shows the warning. It does not deny the debit hold. Access stays open.',
        },
      ],
    }),
    feat({
      id: 'mandates',
      name: 'Debit-order mandates',
      href: '/dashboard/fitgraph/debit-orders',
      summary: 'Debit orders stores the signed mandate: the bank account, the debit day, and whether Netcash has validated it.',
      who: WHO,
      prerequisites: [
        'The member exists.',
        'The Netcash merchant account and the Debit Order service key are saved before you submit a run. You can still capture a mandate before that.',
      ],
      steps: [
        'Open Debit orders. The title is Debit orders, and the accent is mandates.',
        'Read the flow Mandate → invoice → Netcash → reconcile.',
        'On the member, enter Account holder, Bank, Branch, Account type (Cheque, Savings, or Transmission), Account number, Debit day, and Amount.',
        'Tick the consent. The button reads Sign mandate, or Tick the consent to sign until the box is ticked.',
        'The table columns are Member, Bank, Account, Signed, Validation, and Status.',
        'When the mandate is pending and validation is valid, press Activate and the member’s name.',
      ],
      behind: [
        'Mandate status is pending, active, suspended, or cancelled. Validation is unchecked, valid, invalid, or error.',
        'Activate requires a signed mandate and a valid bank check. A cancelled mandate cannot be reopened.',
        'The account number is stored encrypted. If the encryption key is missing, activation cannot continue.',
        'The mandate PDF title is “GymAdvisor® debit order mandate”.',
      ],
      errors: [
        GATE,
        { message: 'Validate the bank account before activating the mandate.', fix: 'Run validation until the status is valid, then Activate.' },
        { message: 'The member has not signed the mandate.', fix: 'Tick the consent and press Sign mandate first.' },
        { message: 'A cancelled mandate cannot be reopened.', fix: 'Create a new mandate. The cancelled one stays cancelled.' },
        { message: 'Mandate not found.', fix: 'Reload Debit orders. The member may not have a mandate row yet.' },
        { message: 'Check the bank details.', fix: 'Correct Account holder, Bank, Branch, Account type, and Account number.' },
        { message: 'The debit order encryption key is not set.', fix: 'The server has no key to store the account number. Activation waits until that key is configured. Do not type the account into a note instead.' },
      ],
      faqs: [
        {
          q: 'Does Sign mandate collect this month’s fee?',
          a: 'No. It records consent. Preview run and the billing run are what submit the batch.',
        },
      ],
    }),
    feat({
      id: 'billing',
      name: 'Billing runs',
      href: '/dashboard/fitgraph/billing-runs',
      summary: 'A billing run previews who will be debited, waits for the owner to approve it, and then submits the batch.',
      who: WHO,
      prerequisites: [
        'An active signed mandate for each member you expect to collect. A line with no mandate is skipped.',
        'Merchant account and Debit Order service key are saved on Netcash before submit.',
      ],
      steps: [
        'Open Billing runs. The title says preview first.',
        'Press Preview run. The notice says “Preview updated.”',
        'Read Expected, Collected, and Batch. A run that is not approved says “Needs owner approval before submit”.',
        'Press Approve run. The notice says “This run is approved. It can be submitted.”',
        'Submit the approved run. In test mode the notice says “Batch submitted in test mode.”',
        'Press Fetch results after the batch, and Export CSV when you need the file.',
      ],
      behind: [
        'Run status is preview, submitted, polling, reconciled, failed, or cancelled.',
        'A line is scheduled, submitted, paid, unpaid, reversed, skipped, or review.',
        'A member with no active mandate is skipped. The skip reason used for that case is “No active debit order mandate.”',
        'Submit in test mode does not move money. Live calls are refused by this build, and the mode banner says no money moves.',
        'Approve is stored on the run. A run that is no longer in a state that can be approved is refused.',
      ],
      errors: [
        GATE,
        { message: 'Approve this billing run before it can be submitted.', fix: 'Press Approve run, then submit.' },
        { message: 'Add the Netcash merchant account before submitting.', fix: 'Open Netcash and save Merchant account number.' },
        { message: 'Add the Debit Order service key before submitting.', fix: 'Open Netcash and save the Debit Order service key.' },
        { message: 'This run can no longer be approved.', fix: 'Preview a new run. A submitted, failed, or cancelled run is not approved again.' },
        { message: 'Billing run not found.', fix: 'Reload Billing runs and preview again.' },
        { message: 'Invoicing is not available.', fix: 'The member invoice step is not available for that run. Fix the member fee, then preview again.' },
        { message: 'This gym is locked until debit-order go-live is approved.', fix: 'Collections stay off until go-live is approved for this gym. The other GymAdvisor® screens still open for the owner.' },
      ],
      faqs: [
        {
          q: 'What does the unpaid line do at the door?',
          a: 'Check-in shows “Debit order unpaid — GymAdvisor® access stays open” and still logs the visit.',
        },
      ],
    }),
    feat({
      id: 'netcash',
      name: 'Netcash settings',
      href: '/dashboard/fitgraph/netcash',
      summary: 'Netcash stores the merchant account, the service key, the debit day, and whether the gym is in test or live.',
      who: WHO,
      prerequisites: ['You are the owner. Have the merchant account number and the Debit Order service key from Netcash before you save them.'],
      steps: [
        'Open Netcash.',
        'Enter Merchant account number and Debit Order service key. Press Save. To change a stored key, press Replace key. Press Remove key to clear it.',
        'Set Debit day. Choose Test or Live. Press Save schedule. The notice says “Schedule saved.”',
        'Read the mode banner. Test says answers are simulated and no money moves. Live says this build still refuses live Netcash calls, so no money moves.',
      ],
      behind: [
        'The service key is stored for the billing run. It is not printed back in full after you save it.',
        'Test and Live change the mode flag. They do not start a debit by themselves. Submit stays on Billing runs.',
        'Too many requests returns “Too many requests. Wait a moment and try again.”',
      ],
      errors: [
        GATE,
        { message: 'A company is required.', fix: 'Select the gym company and reopen Netcash.' },
        { message: 'Too many requests. Wait a moment and try again.', fix: 'Wait, then save again.' },
        { message: 'This gym is locked until debit-order go-live is approved.', fix: 'You can still read the gym book. Submitting a batch stays locked until go-live is approved.' },
      ],
      faqs: [
        {
          q: 'I chose Live. Will the next run take money?',
          a: 'The banner on Live says this build refuses live Netcash calls, so no money moves. Test mode is simulated as well.',
        },
      ],
    }),
    feat({
      id: 'collections',
      name: 'Accounts and collections',
      href: '/dashboard/fitgraph/collections',
      summary: 'Collections compares what you expected to debit with what was collected, and lists the unpaid reason.',
      who: WHO,
      prerequisites: ['A billing run has been previewed or submitted, and member invoices exist.'],
      steps: [
        'Open Accounts for member fees, debit banks, and proof.',
        'Open Collections. Read Expected, Collected, Unpaid rate, and Upcoming run.',
        'Read Failed reasons and Access holds.',
        'The member table columns are Member, Invoice, Total, Status, and Reason.',
      ],
      behind: [
        'Unpaid rate is from the run, not from the Finance VAT worksheet.',
        'An access hold is a warning at check-in. The door stays open.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Do these invoices post output VAT in Finance by themselves?',
          a: 'Member fees on GymAdvisor® are the gym book. The Finance VAT-inclusive debit file is Finance → Debit orders. Posting output VAT still follows Mark sent on a Finance invoice or the VAT201 rules.',
        },
      ],
    }),
    feat({
      id: 'grow',
      name: 'Comms, website, and reports',
      href: '/dashboard/fitgraph/management',
      summary: 'Comms and the website publish to members. Reports is the management pack for the gym.',
      who: WHO,
      prerequisites: ['Members exist before a notice has anyone to reach.'],
      steps: [
        'Open Comms to post an ad or a notice to members.',
        'Open Website & apps to publish the site and the member app.',
        'Open Reports. The screen is the management report: slice the pack, read the trends, and use the A4 PDF when you need a printout.',
      ],
      behind: [
        'A notice does not submit a debit order and does not post a journal.',
        'The report reads this gym’s own members, bookings, and collections.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Is the gym report the annual financial statements?',
          a: 'No. Annual statements are Finance → AFS. This report is the GymAdvisor® pack.',
        },
      ],
    }),
  ],
};
