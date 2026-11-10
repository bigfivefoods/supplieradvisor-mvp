import type { GuideFeature, ModuleGuide } from '@/lib/help/types';
import { gateMessage, viewRoleLabels } from '@/lib/help/roles';

const WHO =
  'Suppliers uses the suppliers permission. Owner, Admin, Member, and Operations can change the book. Viewer, Finance, and Sales can open it. A sales contractor has no suppliers access and cannot open the dashboard. The purchase-order API checks that you are a member of the company. There is no separate approver role. The gate says “Your role (…) cannot access Suppliers.”';

const GATE = {
  message: gateMessage('suppliers'),
  fix: 'Ask an owner for a role that can view Suppliers.',
};

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const SUPPLIERS_GUIDE: ModuleGuide = {
  id: 'suppliers',
  name: 'Suppliers',
  href: '/dashboard/suppliers',
  purpose:
    'Suppliers in SupplierAdvisor® is the supplier book and the purchase order. You add the supplier, raise the order, mark it accepted, receive the quantity into the warehouse, and record the supplier bill. /dashboard/procurement and /dashboard/procurement/po both open this book. There is no Approve status on a purchase order.',
  roles: viewRoleLabels('suppliers'),
  outcome:
    'The supplier is on the book, the purchase order moves from draft to sent, accepted, received, invoiced, and paid, and the inventory quantity is updated without a second stock journal.',
  flow: [
    { id: 'draft', label: 'Draft', hint: 'Save draft' },
    { id: 'sent', label: 'Sent', hint: 'Save & email' },
    { id: 'accepted', label: 'Accepted', hint: 'Mark accepted' },
    { id: 'receive', label: 'Receive', hint: 'Warehouse qty' },
    { id: 'invoiced', label: 'Invoiced', hint: 'Supplier bill' },
    { id: 'paid', label: 'Paid', hint: 'Record payment' },
    { id: 'completed', label: 'Completed', hint: 'OTIFEF first' },
  ],
  faqs: [
    {
      q: 'Where is the Approve button?',
      a: 'There is not one. The buyer statuses are draft, sent, accepted, funded, invoiced, paid, completed, and cancelled. The button that accepts the order is Mark accepted.',
    },
    {
      q: 'The supplier list is empty. What now?',
      a: 'No supplier has been added for this company. SupplierAdvisor® does not fill the book with sample suppliers. Use Source or Invite, then raise the order.',
    },
  ],
  features: [
    feat({
      id: 'source',
      name: 'Find and add a supplier',
      href: '/dashboard/suppliers/discover',
      summary: 'Source, Connect, Profiles, and Invite put a supplier on the book before you can raise an order.',
      who: WHO,
      prerequisites: ['You can open Suppliers for this company.'],
      steps: [
        'Open Source to search the directory.',
        'Open Connect to shortlist a partner.',
        'Open Profiles for the suppliers already on your book. Profiles opens the network screen.',
        'Open Invite to send an off-platform supplier an invite.',
        'A blocked supplier, or a suspended connection, cannot take a new purchase order.',
      ],
      behind: [
        'The purchase order requires a supplier on your book. The API says “supplierProfileId or a srmSupplierId is required (add the supplier to your book first)” when that link is missing.',
        'The document vault stores a record and a pasted file link. It does not store the file. Contracts opens that same vault.',
      ],
      errors: [
        GATE,
        { message: 'Supplier not found in your book', fix: 'Add the supplier on Profiles or Invite, then raise the order.' },
        { message: 'Supplier is blocked', fix: 'Choose a supplier that is not blocked, or unblock them on the book first.' },
        { message: 'Connection is suspended — cannot raise new POs', fix: 'Restore the connection, or pick another supplier.' },
      ],
      faqs: [
        {
          q: 'Does Invite create the purchase order?',
          a: 'No. It asks the supplier to connect. The order is raised on Order after they are on the book.',
        },
      ],
    }),
    feat({
      id: 'po',
      name: 'Purchase orders',
      href: '/dashboard/suppliers/po',
      summary: 'Order is where you raise a purchase order, email it, mark it accepted, and receive it into stock.',
      who: WHO,
      prerequisites: [
        'The supplier is on the book and is not blocked.',
        'At least one line has an item name, a quantity, and a unit price.',
        'The chart needs Inventory 1140 and an AP account before Mark accepted can post the books.',
      ],
      steps: [
        'Open Order. The title is Purchase orders. /dashboard/procurement/po redirects here.',
        'Open the Raise PO tab. The Pipeline tab lists orders. Process guide is the short lifecycle on the page.',
        'Choose the supplier and add a line. Payment terms include COD (Cash on delivery) and CIA (Cash in advance).',
        'Press Save draft to keep status draft. Press Save & email to save and email the PDF. The standard path uses Standard PO.',
        'On Pipeline, filter All, Open, Completed, or On-chain. Switch List or Board. The layout control is labelled Purchase order layout.',
        'Press Email PO to send the PDF again. The supplier profile needs an email. You are copied.',
        'Press Mark accepted when the supplier has accepted. That is the accept step. It is not labelled Approve.',
        'Press Receive into stock to add the warehouse quantity. Press Receive + OTIFEF when you are also recording delivery performance. The badge Received shows after the quantity is in.',
        'Create the supplier invoice from the order when you are ready to bill it in Finance. The prefill on Accounts payable says it is buyer AP, not a customer invoice.',
        'Optional escrow uses Escrow PO and Send escrow PO. A standard order does not need a wallet.',
      ],
      behind: [
        'Buyer transitions are: draft to sent or cancelled; sent to accepted or cancelled; accepted to funded, completed, or cancelled; funded to completed or cancelled; invoiced to completed or cancelled; paid to completed. Completed and cancelled do not move again.',
        'Open orders are sent, accepted, funded, and invoiced. A draft is not counted as open.',
        'Mark accepted posts debit Inventory 1140 and credit the supplier AP (2180-* or 2110) for the goods cost. A hub order does not post. A zero amount is skipped.',
        'If the order is tied to a sale that was already issued, a second journal can debit 5100 and credit 1140.',
        'Receive into stock writes the warehouse movement and sets inventory received at. It does not post a second 1140 journal. The screen says receive posts warehouse quantity only.',
        'Receiving again is ignored. The warning is “Stock already received from this PO”.',
        'Completing the order requires a delivered quantity for OTIFEF. Cancelling a completed order is refused.',
        'Email and Mark accepted do not send the supplier the money. Pay the bill on Finance → AP or Payments.',
      ],
      errors: [
        GATE,
        { message: 'Select a supplier — or add & invite a new one below', fix: 'Pick a supplier on Raise PO before you save.' },
        { message: 'Add at least one line item', fix: 'Enter item name, quantity, and unit price on a line.' },
        { message: 'At least one line item is required', fix: 'Add a line. Each line needs item_name, a valid quantity, and a valid unit price.' },
        { message: 'COA missing Inventory (1140) or AP — seed Chart of Accounts', fix: 'Open Finance → Chart and press Seed defaults, then Mark accepted again.' },
        { message: 'Cannot transition from {status} to {next}', fix: 'Use the next status the order allows. You cannot jump from draft to paid.' },
        { message: 'Cannot cancel a completed PO', fix: 'A completed order stays completed.' },
        { message: 'Record delivered quantity (OTIFEF) before completing this PO', fix: 'Press Receive + OTIFEF and enter the delivered quantity, including 0 if nothing arrived, and the actual delivery date.' },
        { message: 'Finished goods need a lot number on the PO before receive', fix: 'Put a lot number on the finished-goods line, then Receive into stock.' },
        { message: 'PO not found', fix: 'Reload Order. The order may belong to another company.' },
        { message: 'Add an email on the supplier profile, then tap Email PO. You will be copied.', fix: 'Open the supplier profile, add the email, then Email PO.' },
        { message: 'Actual delivery date is required for OTIFEF', fix: 'Enter the delivery date on Receive + OTIFEF.' },
        { message: 'Enter delivered quantity (use 0 if nothing arrived)', fix: 'Type a quantity. Zero is allowed when nothing arrived.' },
      ],
      faqs: [
        {
          q: 'Does Receive into stock post the stock value again?',
          a: 'No. Mark accepted already posted 1140 and AP. Receive only updates the warehouse quantity. Doing it twice does not double the journal.',
        },
        {
          q: 'What is Funded?',
          a: 'Funded is a real status after accepted, used when escrow is funded. A standard order does not have to pass through funded. It can be invoiced and paid on the bill.',
        },
      ],
    }),
    feat({
      id: 'escrow',
      name: 'Escrow purchase orders',
      href: '/dashboard/suppliers/po',
      summary: 'Escrow PO is optional. It needs a platform-linked supplier with a payout wallet. A standard order does not use it.',
      who: WHO,
      prerequisites: [
        'The supplier is connected on the platform.',
        'The supplier has set a payout wallet.',
        'Your wallet is connected if you are sending an on-chain escrow order.',
      ],
      steps: [
        'On Raise PO, choose Escrow PO instead of Standard PO.',
        'Press Send escrow PO.',
        'If the supplier is not linked, the screen says to invite them first or raise a standard PO.',
      ],
      behind: [
        'On-chain escrow is refused for a supplier who is not platform-linked.',
        'It is also refused when the supplier has no payout wallet. The API says “This supplier has not set a payout wallet on SupplierAdvisor®. Escrow cannot be opened.”',
        'A standard PO never opens escrow.',
      ],
      errors: [
        { message: 'Escrow needs a platform-linked supplier. Invite them first, or raise a standard PO.', fix: 'Invite and connect the supplier, or switch back to Standard PO.' },
        { message: 'Connect wallet for on-chain escrow', fix: 'Connect the wallet, or raise a Standard PO.' },
        { message: 'On-chain escrow requires a platform-linked supplier. Invite them to connect first.', fix: 'Use Invite, wait until they connect, then send the escrow order.' },
      ],
      faqs: [
        {
          q: 'Do I have to use escrow to mark an order accepted?',
          a: 'No. Save draft or Save & email, then Mark accepted, works for a Standard PO.',
        },
      ],
    }),
    feat({
      id: 'after',
      name: 'Portal, score, and the report',
      href: '/dashboard/suppliers/performance',
      summary: 'After the order, the portal link, the OTIFEF score, ratings, the risk log, and the supplier report stay on the book.',
      who: WHO,
      prerequisites: ['The supplier is already on the book before you issue a portal link.'],
      steps: [
        'Open Portal and issue the link for a supplier on the book.',
        'Open Score for OTIFEF performance, and Rate for a peer rating after trade.',
        'Open the risk log to record a risk, an issue, an action, or a decision against the supplier.',
        'Open Report and export the rows on the screen you are reading.',
      ],
      behind: [
        'The portal issues a link. It does not change the purchase-order status.',
        'OTIFEF is recorded when you Receive + OTIFEF. The score screen reads those deliveries.',
        'The risk log stores the register entry against the supplier. It does not post a journal.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Does the report include another company’s suppliers?',
          a: 'No. It reads the book for the company you have open.',
        },
      ],
    }),
  ],
};
