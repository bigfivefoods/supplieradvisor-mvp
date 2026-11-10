import type { ModuleGuide } from '@/lib/help/types';

const WHO =
  'The sales portal API allows Owner, Admin, Finance, Sales, and Sales contractor. Anyone else gets “Sales contractor portal is only available to the customer sales team.” A sales contractor cannot open the rest of the dashboard. Owner, Admin, and Finance are not sent to checkout and do not have to sign the agreement. Sales and Sales contractor sign the agreement, then subscribe after the free period.';

export const SALES_GUIDE: ModuleGuide = {
  id: 'sales-portal',
  name: 'Sales',
  href: '/sales',
  purpose:
    'Sales in SupplierAdvisor® is the contractor and sales desk: the agreement, the pipeline, the quote, the order, the invoice, and earnings. It uses the same document desk as Customers. A sales contractor sees only this portal.',
  roles: ['Owner', 'Admin', 'Finance', 'Sales', 'Sales contractor'],
  outcome: 'The agreement is signed when your role needs it, a lead becomes a quote, an order, and an invoice, and earnings show what is projected, earned, and paid.',
  flow: [
    { id: 'agreement', label: 'Agreement', hint: 'Sales signs' },
    { id: 'pipeline', label: 'Pipeline', hint: 'Leads' },
    { id: 'quote', label: 'Quote', hint: 'Document desk' },
    { id: 'order', label: 'Order', hint: 'Document desk' },
    { id: 'invoice', label: 'Invoice', hint: 'Document desk' },
    { id: 'earn', label: 'Earn', hint: 'Then subscribe' },
  ],
  faqs: [
    {
      q: 'I am a sales contractor and the dashboard will not open. What now?',
      a: 'That is expected. Your home is Sales. The company owns the customer records. You do not get the Finance, Inventory, or Suppliers modules.',
    },
  ],
  features: [
    {
      id: 'agreement',
      name: 'Agreement',
      href: '/sales/agreement',
      summary: 'Sales and a sales contractor sign the agreement here. Owner, Admin, and Finance open the portal without that signature.',
      who: WHO,
      prerequisites: ['You are on a role the portal allows, and a company is selected.'],
      steps: [
        'Open Agreement from Sales.',
        'Read the agreement. If your role is Sales or Sales contractor, sign it before you rely on the rest of the portal.',
        'Owner, Admin, and Finance are not asked to sign and are not sent to checkout.',
      ],
      behind: [
        'The signed agreement is stored for that person and that company. It does not post a journal.',
        'The company name on the agreement is the company’s own name when one is set.',
      ],
      errors: [
        {
          message: 'Sales contractor portal is only available to the customer sales team.',
          fix: 'Use an Owner, Admin, Finance, Sales, or Sales contractor login.',
        },
      ],
      faqs: [
        {
          q: 'Does signing the agreement subscribe me?',
          a: 'No. Subscribe is a separate step after the free period, and only for Sales and Sales contractor.',
        },
      ],
    },
    {
      id: 'sell',
      name: 'Pipeline, quote, order, and invoice',
      href: '/sales/pipeline',
      summary: 'Pipeline, Diary, Quote, Order, and Invoice are the sale. Quote, order, and invoice use the same document desk as Customers.',
      who: WHO,
      prerequisites: ['The agreement is signed if your role requires it. The customer can be added from this portal.'],
      steps: [
        'Open Pipeline and add the lead. Move the opportunity along the pipeline.',
        'Open Diary for calls, meetings, emails, follow-ups, and tasks.',
        'Open Quote and use the document desk. Statuses match Customers: enquiry, draft, sent, accepted, and the deposit and converted states. Press Issue quote and Mark sent.',
        'Open Order. Press Convert to invoice when the order is ready. Statuses match the sales order: draft, confirmed, processing, shipped, fulfilled, cancelled, and invoiced.',
        'Open Invoice. Mark sent to issue it. Record the receipt from the document or from Finance if your role can open Finance. A sales contractor cannot open Finance.',
      ],
      behind: [
        'The documents are the company CRM documents. A sales contractor does not get a private copy.',
        'Mark sent on an invoice is what allows revenue recognition in the ledger, subject to the chart accounts existing. A sales contractor’s save still writes the company invoice.',
      ],
      errors: [
        {
          message: 'Cannot edit a converted quotation. Create a new quote or convert from draft/sent only.',
          fix: 'The same sentence is used when the status is accepted. Start a new draft.',
        },
      ],
      faqs: [
        {
          q: 'Will my invoice hit the company ledger?',
          a: 'Yes. It is the company invoice. Recognition runs when it is issued and the chart has AR, revenue, and VAT output. You do not need the Finance sidebar for the save. You need it to post journals and to file VAT201, and a sales contractor does not have that sidebar.',
        },
      ],
    },
    {
      id: 'earn',
      name: 'Earnings and subscribe',
      href: '/sales/earnings',
      summary: 'Earnings shows projected, earned, and paid commission. Subscribe starts the paid period after the free period for Sales and Sales contractor.',
      who: WHO,
      prerequisites: ['Commission rules come from the company sales program. This screen does not let you type a private rate.'],
      steps: [
        'Open Earn. Read projected, earned, and paid.',
        'Open the forecast from the earnings area when you need the forward view.',
        'After the free period, Sales and Sales contractor open Subscribe and check out.',
        'Owner, Admin, and Finance are not sent to checkout.',
      ],
      behind: [
        'The free period and the paid term are the subscription rules on the sales program. Paying the subscription is not the customer’s invoice and it does not post their receipt.',
        'There is no rate field on the process picture. The rate is the company program.',
      ],
      errors: [
        {
          message: 'Sales contractor portal is only available to the customer sales team.',
          fix: 'Subscribe is part of the portal. A role outside Owner, Admin, Finance, Sales, and Sales contractor cannot open it.',
        },
      ],
      faqs: [
        {
          q: 'Can I change my commission percent here?',
          a: 'No. The company sales program sets the tiers. Earnings reads them.',
        },
      ],
    },
  ],
};
