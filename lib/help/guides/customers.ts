import type { GuideFeature, ModuleGuide } from '@/lib/help/types';
import { gateMessage, viewRoleLabels } from '@/lib/help/roles';

const WHO =
  'Customers uses the customers permission. Owner, Admin, Member, Finance, and Sales can change customer records. Viewer and Operations can open the screens. A sales contractor has customers write for the Sales API, and the dashboard blocks that role from this page. They use Sales. The gate says “Your role (…) cannot access Customers.”';

const GATE = {
  message: gateMessage('customers'),
  fix: 'Ask an owner for a role that can view Customers, or use Sales if you are a sales contractor.',
};

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const CUSTOMERS_GUIDE: ModuleGuide = {
  id: 'customers',
  name: 'Customers',
  href: '/dashboard/customers',
  purpose:
    'Customers in SupplierAdvisor® is the path from a lead to a quote, a sales order, an invoice, and the money you collect. Inbound purchase orders from a buyer sit on the same orders screen. The books for the invoice are posted when you issue it from Finance, or when the commercial document is sent and the recognition rules apply.',
  roles: viewRoleLabels('customers').filter((label) => label !== 'Sales contractor'),
  outcome:
    'A lead becomes a sent quote, a sales order, an invoice, and a collected balance, or an inbound purchase order is accepted and then invoiced.',
  flow: [
    { id: 'lead', label: 'Lead', hint: 'Source' },
    { id: 'quote', label: 'Quote', hint: 'Mark sent' },
    { id: 'order', label: 'Order', hint: 'Convert' },
    { id: 'invoice', label: 'Invoice', hint: 'Send' },
    { id: 'collect', label: 'Collect', hint: 'Money' },
  ],
  faqs: [
    {
      q: 'Customers is empty. What now?',
      a: 'No customer has been saved for this company. Add one on Profiles or onboard. SupplierAdvisor® does not insert sample customers.',
    },
    {
      q: 'Is a sales order the same as a purchase order?',
      a: 'No. Sales orders are what you sell. Inbound purchase orders are what a buyer sent you. Your own purchase orders are under Suppliers → Order.',
    },
  ],
  features: [
    feat({
      id: 'book',
      name: 'Customer book and leads',
      href: '/dashboard/customers/profiles',
      summary: 'Profiles is the customer book. Source is the lead list. 360 opens the member, patient, hirer, debit, and invoice view of one account.',
      who: WHO,
      prerequisites: ['You can open Customers for this company.'],
      steps: [
        'Open Profiles and add the customer, or open the onboard screen from the book.',
        'Open Source for leads and the pipeline.',
        'Open 360 when you need one account’s memberships, claims, and invoices together.',
        'Open Invite to ask a buyer onto the platform.',
        'Open Enquiry for enquiries that are not yet a quote.',
      ],
      behind: [
        'A new customer is stored on this company. The finance party account is created when you use Customer & supplier accounts on the chart, or when the books next need an AR number.',
        'A lead is not an invoice and does not post revenue.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Why can a sales contractor not open Profiles?',
          a: 'A sales contractor is blocked from the dashboard. They add the same kind of document from Sales.',
        },
      ],
    }),
    feat({
      id: 'quote',
      name: 'Quotes',
      href: '/dashboard/customers/quotes',
      summary: 'Quotes issues a quotation and can convert an accepted quote into a sales order.',
      who: WHO,
      prerequisites: ['The customer is on the book. A locked quote cannot be issued again.'],
      steps: [
        'Open Quote. The title is Enquiries & quotes.',
        'Statuses you will see are enquiry, draft, sent, accepted, deposit due, deposit paid, rejected, expired, and converted.',
        'Press Issue quote to prepare it, then Mark sent when it should go to the customer.',
        'Press Convert to order when the quote is accepted and you want a sales order. The quote becomes converted.',
      ],
      behind: [
        'Mark sent is what moves the quote out of draft. Convert to order writes the sales order as confirmed or processing and leaves the quote converted.',
        'A quote does not debit AR. The invoice does, once it is issued.',
      ],
      errors: [
        GATE,
        {
          message: 'Cannot edit a converted quotation. Create a new quote or convert from draft/sent only.',
          fix: 'The same sentence is used when the status is accepted. Start a new draft. Do not edit the converted or accepted quote.',
        },
      ],
      faqs: [
        {
          q: 'Does Mark sent email the PDF?',
          a: 'Mark sent changes the status. Send the PDF from the document actions on that quote when you want the customer to receive the file.',
        },
      ],
    }),
    feat({
      id: 'orders',
      name: 'Sales orders and inbound purchase orders',
      href: '/dashboard/customers/orders',
      summary: 'Orders has two tabs: sales orders you raise, and inbound purchase orders a buyer sent you.',
      who: WHO,
      prerequisites: ['A quote converted to an order, or an inbound purchase order in sent, before you can accept it.'],
      steps: [
        'Open Order. Stay on Sales orders for your own orders.',
        'Sales-order statuses are draft, confirmed, processing, shipped, fulfilled, cancelled, and invoiced.',
        'Press Convert to invoice when the order should become a draft customer invoice. The order then shows invoiced.',
        'Open the Inbound purchase orders tab. The title is Inbound purchase orders.',
        'On a sent inbound order, press Accept or Decline.',
        'After accept, press Mark paid or Complete when that is the next seller action. You can also raise the invoice. The API refuses the invoice until the purchase order is accepted: “PO status is {status} — accept the PO before invoicing”.',
      ],
      behind: [
        'Seller transitions on an inbound order start at sent, which can go to accepted or cancelled. Accepted can go to paid, completed, invoiced, or cancelled.',
        'Convert to invoice creates the customer invoice as a draft. It does not post revenue until the invoice is sent or otherwise issued.',
        'Accept on an inbound order is the seller accepting the buyer’s PO. It is not Mark accepted on your own purchase order under Suppliers.',
      ],
      errors: [
        GATE,
        { message: 'PO status is {status} — accept the PO before invoicing', fix: 'Press Accept on the inbound order, then invoice.' },
      ],
      faqs: [
        {
          q: 'Which screen receives stock?',
          a: 'Your purchases are received on Suppliers → Order with Receive into stock. A sales order is fulfilled on the order, and warehouse issues are on Inventory.',
        },
      ],
    }),
    feat({
      id: 'invoices',
      name: 'Customer invoices and delivery notes',
      href: '/dashboard/customers/invoices',
      summary: 'Invoice drafts a customer invoice, sends it, and can raise a delivery note from that invoice.',
      who: WHO,
      prerequisites: ['The customer and the lines exist. A draft does not post AR until it is issued.'],
      steps: [
        'Open Invoice. Statuses are draft, sent, paid, partial, overdue, and void.',
        'Create the draft, then Mark sent when it should be issued.',
        'Generate the delivery note from the invoice when the goods are going out. The delivery note is produced from that invoice.',
        'Record the receipt on Money, or on Finance → AR with Record payment, when the cash is in the books.',
      ],
      behind: [
        'Mark sent is an issued status. Finance recognition then debits AR and credits revenue and output VAT, using 1130, 4100, and 2120 when those accounts exist.',
        'Void reverses those journals. Paid and partial follow the amount recorded on the payment.',
        'A delivery note does not post a second sales journal.',
      ],
      errors: [
        GATE,
        { message: 'Cannot set promise on {status} invoice', fix: 'Promises are refused on an invoice status that is already closed. Use a sent, partial, or overdue invoice.' },
        { message: 'COA missing AR (1130) or sales revenue (4100) — seed Chart of Accounts', fix: 'Seed the chart in Finance, then Mark sent again.' },
      ],
      faqs: [
        {
          q: 'Does the invoice take the money?',
          a: 'No. Mark sent records the debt. Record payment on Finance, or collect on Money, records the receipt. Neither sends a bank instruction.',
        },
      ],
    }),
    feat({
      id: 'money',
      name: 'Money, credit, and ratings',
      href: '/dashboard/customers/money',
      summary: 'Money is where you collect: claims, reminders, and the receipts still to match. Credit and Rate sit beside it.',
      who: WHO,
      prerequisites: ['An issued invoice exists before there is a balance to collect.'],
      steps: [
        'Open Money. Work the open invoices, the claim decision, and the bank suggestions shown on the page.',
        'Open Credit for the credit position on the account.',
        'Open Rate after the trade if you are leaving a peer rating.',
        'Open Report for the customer report rows.',
      ],
      behind: [
        'A receipt that is recorded through Finance posts debit bank and credit AR. Money coordinates the collection. It does not submit a debit order to a bank by itself.',
        'A rating does not change the invoice balance.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Where is the VAT return for these invoices?',
          a: 'On Finance → VAT and Finance → VAT201. Customers shows the invoice. It does not file the VAT201.',
        },
      ],
    }),
  ],
};
