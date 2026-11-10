import type { GuideFeature, ModuleGuide } from '@/lib/help/types';
import { gateMessage, viewRoleLabels } from '@/lib/help/roles';

const WHO =
  'TradeAdvisor® uses the Operations permission. Owner, Admin, Member, and Operations can change records. Viewer, Finance, and Sales can open the screens and not write through the module gate. A sales contractor cannot open the dashboard. The TradeAdvisor® save API checks that you are a member of the company. It does not apply a second write check. Money on the technician work app is shown only when the person can view accounting (Owner, Admin, or Finance).';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const gate = {
  message: gateMessage('operations'),
  fix: 'Ask an owner to give you a role that can view Operations, then open TradeAdvisor® again.',
};

export const TRADE_GUIDE: ModuleGuide = {
  id: 'tradegraph',
  name: 'TradeAdvisor®',
  href: '/dashboard/tradegraph',
  purpose:
    'TradeAdvisor® in SupplierAdvisor® is the job book for a trade business: the customer and the site, the quote, the visit, the materials, the invoice, and the certificate. VAT on a quote is 15% on top of the price-book lines. Money is stored in cents.',
  roles: viewRoleLabels('operations'),
  outcome:
    'An enquiry becomes a quote, a scheduled visit, work on site, an invoice, and a paid job, with the certificate and the review after handover.',
  flow: [
    { id: 'enquiry', label: 'Enquiry', hint: 'New job' },
    { id: 'quoted', label: 'Quoted', hint: 'Send to customer' },
    { id: 'scheduled', label: 'Scheduled', hint: 'Calendar' },
    { id: 'site', label: 'On site', hint: 'I have arrived' },
    { id: 'invoiced', label: 'Invoiced', hint: 'Deposit or progress' },
    { id: 'paid', label: 'Paid', hint: 'Balance cleared' },
  ],
  faqs: [
    {
      q: 'TradeAdvisor® is empty. What now?',
      a: 'No customer or job has been saved for this company. SupplierAdvisor® does not load a sample book on production. Add a customer, then press New job.',
    },
    {
      q: 'Does accepting a quote charge the customer?',
      a: 'No. Accept and sign moves the quote to accepted and opens the job as scheduled. The invoice and the Paystack link are a later step.',
    },
  ],
  features: [
    feat({
      id: 'customers',
      name: 'Customers and sites',
      href: '/dashboard/tradegraph/customers',
      summary: 'Customers keeps the person you work for, their phone, and a link into the company customer book. Sites keeps each property.',
      who: WHO,
      prerequisites: ['You are in the company that owns the job book.'],
      steps: [
        'Open Customers under People. The detail says “Sites, phones, and the link into the company customer book.”',
        'Under Add a customer, enter Name and press Save.',
        'Press Open in Customers when you want the same person on the company customer book.',
        'Open Sites. Choose Customer, enter Label and Address, and press Save site.',
        'Press Open in maps when you want the address in maps.',
      ],
      behind: [
        'Save writes the customer onto the TradeAdvisor® book and can link them to the company customer record.',
        'A site is stored against that customer. It does not create a job.',
      ],
      errors: [
        gate,
        {
          message: 'Customer name is required',
          fix: 'Enter Name before Save.',
        },
        {
          message: 'Choose a customer',
          fix: 'Pick the customer on the site form before Save site.',
        },
      ],
      faqs: [
        {
          q: 'Is the TradeAdvisor® customer a different person from Customers in the sidebar?',
          a: 'They can be linked. Open in Customers jumps to the company customer book. The job still uses the TradeAdvisor® customer row.',
        },
      ],
    }),
    feat({
      id: 'jobs',
      name: 'Jobs',
      href: '/dashboard/tradegraph/board',
      summary: 'Jobs is the board from enquiry through to paid. You open a card to move the job. Dragging a visit is on the Gantt, not on this board.',
      who: WHO,
      prerequisites: ['Add the customer first. A job needs a short title.'],
      steps: [
        'Open Jobs. The detail says “Drag is on the Gantt. Open a card to move the job.”',
        'Press New job. Set Customer, Title, and Site address, then press Save job. Press Cancel to close the form without saving.',
        'The columns are Enquiry, Quoted, Scheduled, In progress, Done, Invoiced, and Paid. An empty column says Nothing here.',
        'A request card has Make this a job. That turns the request into an enquiry job.',
        'Open the card when you need to change the status. Cancelled jobs stay off the board.',
      ],
      behind: [
        'Statuses stored on a job are enquiry, quoted, scheduled, in progress, done, invoiced, paid, and cancelled. The board does not show a cancelled column.',
        'A non-deposit invoice moves the job to invoiced unless it is already paid. When payments cover every invoice that is not void, the job becomes paid.',
        'Accepting a quote creates the job as scheduled.',
        'I have arrived can move a scheduled or quoted job to in progress.',
      ],
      errors: [
        {
          message: 'Give the job a short title',
          fix: 'Fill Title on New job.',
        },
        {
          message: 'Job not found',
          fix: 'Reload Jobs. The card may have been removed or it belongs to another company.',
        },
        {
          message: 'Cancelled jobs are not invoiced',
          fix: 'Open a job that is not cancelled, or raise a new job.',
        },
      ],
      faqs: [
        {
          q: 'Why can I not drag the card?',
          a: 'The Jobs detail says drag is on the Gantt. Open the card here to move the status. Move the visit on the Gantt or the Calendar.',
        },
      ],
    }),
    feat({
      id: 'quote',
      name: 'Quote',
      href: '/dashboard/tradegraph/quote',
      summary: 'Quote prices lines from the price book, adds VAT at 15% on top, and can ask for a deposit. The customer signs on their own link.',
      who: WHO,
      prerequisites: [
        'The price book needs at least one line. Add lines before Send to customer.',
        'A customer must exist. Linking a job is optional.',
      ],
      steps: [
        'Open Quote. The detail says “Lines come from the price book. VAT is 15% on top.”',
        'Read Drafts, Waiting, and Accepted.',
        'Set Customer, Link to a job (or No job yet), Title, and Deposit %. Press Save draft.',
        'Tap a price-book chip to add the line. Press Make optional or Included on a line that the customer may decline.',
        'On a draft, press Send to customer. The quote becomes sent.',
        'Press Accept and invoice on a draft or a sent quote when you are accepting it in the office.',
        'Press Quote sheet for the PDF. It shows Ex VAT, VAT 15%, and Incl VAT, and the deposit percent on acceptance.',
        'The customer opens Quotes on their link, enters Your name, for the signature, and presses Accept and sign. A variation uses Approve and sign or Decline.',
      ],
      behind: [
        'Quote statuses are draft, sent, accepted, declined, and expired.',
        'Send to customer moves draft to sent. Accept and sign accepts the quote and schedules the job.',
        'The deposit percent is stored on the quote. It is not collected until you raise a deposit invoice.',
        'VAT is 15% exclusive on the line totals. Amounts are integer cents.',
      ],
      errors: [
        {
          message: 'Add at least one line from the price book',
          fix: 'Tap a price-book chip before Save draft.',
        },
        {
          message: 'Add line items before sending',
          fix: 'Add a line, save, then press Send to customer.',
        },
        {
          message: 'Sign with your name',
          fix: 'On the customer link, fill Your name, for the signature before Accept and sign.',
        },
        {
          message: 'This quote can no longer be accepted',
          fix: 'The quote is already accepted, declined, or expired. Start a new draft.',
        },
        {
          message: 'Job was not opened',
          fix: 'Accept again after the customer exists. If it still fails, open Jobs and create the job with New job.',
        },
      ],
      faqs: [
        {
          q: 'Does Send to customer take payment?',
          a: 'No. It marks the quote sent so the customer can open it. Payment starts when you raise an invoice and use Paystack pay link.',
        },
      ],
    }),
    feat({
      id: 'calendar',
      name: 'Calendar',
      href: '/dashboard/tradegraph/calendar',
      summary: 'Calendar places the visit on a day, week, or month, and can publish an ICS feed.',
      who: WHO,
      prerequisites: ['A job should already exist. Booking requests appear when a customer has asked for a time.'],
      steps: [
        'Open Calendar. Switch day, week, or month.',
        'Tap a visit to move it one day later. The page detail says tap a visit to move it one day later.',
        'Press Download ICS or Subscribe to calendar for the feed.',
        'On a booking request, press Confirm booking.',
        'If you rotate the link, the notice says “Calendar link rotated. Subscribe again with the new link.”',
      ],
      behind: [
        'Confirm booking moves a request to confirmed. A declined request stays declined.',
        'The ICS feed is a public link for this book. Rotating it invalidates the previous link.',
        'Moving a visit does not by itself change the job from enquiry to scheduled. Accepting the quote or scheduling the job does that.',
      ],
      errors: [
        gate,
        {
          message: 'Apply supabase/migrations/20261016_tradegraph_ics_token.sql before using TradeAdvisor®.',
          fix: 'The calendar token table is missing in this database. Subscribe stays unavailable until that migration is applied. The rest of the job book still opens.',
        },
      ],
      faqs: [
        {
          q: 'Does the feed show every company’s jobs?',
          a: 'No. The link is for the book you subscribed from.',
        },
      ],
    }),
    feat({
      id: 'materials',
      name: 'Materials',
      href: '/dashboard/tradegraph/materials',
      summary: 'Materials orders supplier lines against a job and can pull products from the company catalogue.',
      who: WHO,
      prerequisites: ['A job to order against. Inventory products exist if you want to import them.'],
      steps: [
        'Open Materials.',
        'Use Price book for the lines you quote from.',
        'Press Import from inventory to pull SupplierAdvisor® products into the price book. Press Open inventory if you need to edit the catalogue first.',
        'Press Order from supplier to raise the order against the job. Press Purchase orders to open the company purchase-order desk.',
        'An order shows draft, ordered, or received.',
      ],
      behind: [
        'Import from inventory reads this company’s products. It does not copy another company’s catalogue.',
        'Order from supplier can raise a SupplierAdvisor® purchase order for a signed-in company.',
        'Received means the material order was marked received on the job. Warehouse quantity is still received on the purchase order or on Inventory → Receive.',
      ],
      errors: [
        {
          message: 'Could not update that record',
          fix: 'Reload Materials and try the save again. If the company is not selected, the desk says Choose a company first.',
        },
      ],
      faqs: [
        {
          q: 'Does ordering materials invoice the customer?',
          a: 'No. It records the supplier order. The customer invoice is on Invoices.',
        },
      ],
    }),
    feat({
      id: 'onsite',
      name: 'Gantt, arrival, and variations',
      href: '/dashboard/tradegraph/gantt',
      summary: 'The Gantt compares plan with actual and prices a change as a variation. Arrival clocks the visit in.',
      who: WHO,
      prerequisites: ['Put the job on the calendar before you expect it under Arrival.'],
      steps: [
        'Open Gantt. Press Lock a new plan when you are fixing the plan.',
        'On Variation orders, fill Variation title, Scope change, Cost in rands, ex VAT, and Extra days. Press Save variation. On a draft, press Send for signature. The customer uses Approve and sign or Decline.',
        'After approval you can invoice the variation. On the job, press Invoice the balance or Progress invoice 40%. Press Log time to add minutes.',
        'Open Arrival. The list is jobs that are scheduled or in progress. Press I have arrived.',
        'If nothing is listed, the empty state says “Nothing is scheduled. Put a job on the calendar first.”',
      ],
      behind: [
        'A variation is draft, sent, approved, or declined. It can be invoiced only after it is approved.',
        'I have arrived can move a scheduled or quoted job to in progress.',
        'Progress 40% raises a progress invoice. It does not take the card payment by itself.',
      ],
      errors: [
        {
          message: 'Name the variation',
          fix: 'Enter a name before you send the variation.',
        },
        {
          message: 'Describe the scope change',
          fix: 'Fill the scope before you send it.',
        },
        {
          message: 'Approve the variation before invoicing it',
          fix: 'Wait for Approve and sign, or approve it in the office, then invoice.',
        },
      ],
      faqs: [
        {
          q: 'Does I have arrived post a timesheet to payroll?',
          a: 'No. It records arrival on the job and can move the status to in progress. Payroll is on People.',
        },
      ],
    }),
    feat({
      id: 'invoices',
      name: 'Invoices and Paystack',
      href: '/dashboard/tradegraph/invoices',
      summary: 'Invoices raises a deposit, progress, final, or variation invoice and can open a Paystack pay link.',
      who: `${WHO} Opening Paystack checkout needs the company’s Paystack secret. Without it the pay page shows the amount and the reference and does not charge a card.`,
      prerequisites: [
        'The job has something left to invoice. A cancelled job cannot be invoiced.',
        'A variation invoice waits until the variation is approved.',
      ],
      steps: [
        'Open Invoices. The detail says “Deposits, progress bills, and Paystack links.”',
        'Raise the deposit, the progress bill, the final bill, or the variation from the job.',
        'Press Paystack pay link on an open invoice. The pay page kicker is Paystack. Press Continue.',
        'On an overdue invoice, press Send reminder.',
        'Record a payment received when the money arrived outside Paystack. Enter the amount.',
      ],
      behind: [
        'Invoice statuses are issued, part paid, paid, and void. Kinds are deposit, progress, final, and variation.',
        'A live book with a Paystack secret opens Paystack checkout from Continue. SupplierAdvisor® records the invoice either way. It does not move the money itself when the secret is absent.',
        'When recorded payments cover the job’s invoices, the job status becomes paid.',
        'A non-deposit invoice sets the job to invoiced if it was not already paid.',
      ],
      errors: [
        {
          message: 'Invoice not found',
          fix: 'Reload Invoices. The invoice may have been voided.',
        },
        {
          message: 'This invoice is not open for payment',
          fix: 'A paid or void invoice has no Paystack link. Raise another invoice if there is still a balance.',
        },
        {
          message: 'Nothing left to invoice',
          fix: 'The job is fully invoiced. Record a payment, or add a variation first.',
        },
        {
          message: 'Enter a payment amount',
          fix: 'Type the amount before you record the payment.',
        },
        {
          message: 'Payment is more than the balance',
          fix: 'Enter an amount up to the open balance.',
        },
      ],
      faqs: [
        {
          q: 'Does the pay link post the Finance invoice?',
          a: 'The TradeAdvisor® invoice is stored on the job book. The Finance customer invoice is a separate screen under Finance → AR. Recording a payment here updates the job. It does not by itself post the 1130 journal unless that payment is also recorded on Finance.',
        },
      ],
    }),
    feat({
      id: 'compliance',
      name: 'Compliance and reviews',
      href: '/dashboard/tradegraph/compliance',
      summary: 'Compliance stores certificates and their expiry. Reviews are what the customer leaves after handover.',
      who: WHO,
      prerequisites: ['Record the certificate against the job or the holder. Reviews appear after the customer submits one.'],
      steps: [
        'Open Compliance. Kinds are coc, pirb, gas, and other. A row shows the kind and the holder.',
        'A certificate that is past its date shows overdue. One that is close shows due.',
        'Press Open VerifyNow to jump to the company verification screen.',
        'Open Reviews. A score is shown out of 5. If the list is empty it says “No reviews yet. Ask after handover.”',
      ],
      behind: [
        'The certificate record stores the kind, the holder, and the expiry. It does not file the certificate with a regulator.',
        'A review is left from the customer app. The office screen reads it. It does not invent a rating.',
      ],
      errors: [gate],
      faqs: [
        {
          q: 'Does an overdue certificate stop the invoice?',
          a: 'No. The row is marked overdue or due so you can see it. Invoicing is not blocked by that flag.',
        },
      ],
    }),
    feat({
      id: 'reports',
      name: 'Reports',
      href: '/dashboard/tradegraph/reports',
      summary: 'Reports shows cash received, what is still open, the win rate, and profit on jobs that have cost.',
      who: WHO,
      prerequisites: ['Invoices, payments, and job costs have to be recorded before the figures move.'],
      steps: [
        'Open Reports. The detail says “Received cash, what is still open, and profit on each job.”',
        'Read Received, Outstanding, Win rate, and Jobs with cost.',
        'If a job has no cost, the list says “No job costs yet” and tells you to log time and materials on a job to see profit.',
      ],
      behind: [
        'Received and outstanding come from the job invoices and the payments recorded on them.',
        'Profit needs cost logged on the job. An empty cost list is left empty.',
      ],
      errors: [gate],
      faqs: [
        {
          q: 'Is this the Finance profit and loss?',
          a: 'No. These figures are the TradeAdvisor® job book. The company profit and loss is Finance → Management.',
        },
      ],
    }),
    feat({
      id: 'team',
      name: 'Team and the work app',
      href: '/dashboard/tradegraph/team',
      summary: 'Team lists owners and technicians and opens each person’s work app.',
      who: WHO,
      prerequisites: ['The person is on the company team. TradeAdvisor® then gives them a work-app link.'],
      steps: [
        'Open Team. The detail says “Owners and technicians. Each person has a work app.”',
        'Press Open their work app. That opens the crew link for that person.',
        'Press Company permissions when you need to change the company role. That role, not the owner-or-technician label on this book, decides the dashboard.',
      ],
      behind: [
        'The book stores owner or technician for the work app. Dashboard access still follows the company role and the Operations permission.',
        'A technician without accounting view does not see money on the work app.',
      ],
      errors: [gate],
      faqs: [
        {
          q: 'Can a technician open the Finance VAT201?',
          a: 'Only if their company role can open Finance. The technician label on this screen does not grant accounting access.',
        },
      ],
    }),
    feat({
      id: 'around',
      name: 'Tasks, messages, notices, and the website',
      href: '/dashboard/tradegraph/tasks',
      summary: 'Tasks, messages, notices, and the website sit beside the job. They do not change the quote or the invoice by themselves.',
      who: WHO,
      prerequisites: ['A job or a customer exists if you want the note tied to that work.'],
      steps: [
        'Open Tasks and press Add task for a follow-up.',
        'Open Messages and press Send on the customer thread.',
        'Open Notices and press Post notice for the team.',
        'Open Website for the brand, the embed, and the customer app link.',
      ],
      behind: [
        'These screens write the task, the thread, the notice, or the website settings on this company’s book.',
        'Post notice does not email SARS, a bank, or a customer invoice.',
      ],
      errors: [
        {
          message: 'Choose a company first.',
          fix: 'Select the company, then reopen TradeAdvisor®.',
        },
        {
          message: 'Save failed',
          fix: 'Check the required fields and save again.',
        },
      ],
      faqs: [
        {
          q: 'Where is the customer’s signed quote stored?',
          a: 'On the quote, after Accept and sign. Messages does not replace that signature.',
        },
      ],
    }),
  ],
};
