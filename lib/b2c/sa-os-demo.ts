/**
 * Copy for the SupplierAdvisor OS demo inside SA Member (Places).
 */
import { COMPANY_SUBSCRIPTION_MONTHLY_ZAR, COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

export const SA_OS_DEMO_PATH = '/me/supplieradvisor';

export const SA_OS_DEMO_MODULES = [
  {
    id: 'trade',
    mock: 'srm',
    label: 'Trade',
    title: 'Suppliers · customers · one loop',
    body: 'Invite a supplier, raise a PO, they accept, you receive, invoice, pay, rate. OTIFEF and trust sit on the same books.',
  },
  {
    id: 'ops',
    mock: 'ops',
    label: 'Operations',
    title: 'Workboards, not inboxes',
    body: 'Inbound, outbound, exceptions and next action — the desk sees the same live board the floor uses.',
  },
  {
    id: 'stock',
    mock: 'inv',
    label: 'Inventory',
    title: 'Lots, holds, warehouses',
    body: 'Stock levels, lots and QA holds that actually block a sale. Connected buyers see what you publish.',
  },
  {
    id: 'make',
    mock: 'mfg',
    label: 'Make',
    title: 'Manufacturing to GL',
    body: 'Work orders, cost to the ledger, and finished goods that land in inventory ready to sell.',
  },
  {
    id: 'money',
    mock: 'fin',
    label: 'Finance',
    title: 'Journals, bank, VAT',
    body: 'AR/AP, bank rec that learns how you allocate, VAT, and posted books — not a sidecar spreadsheet.',
  },
  {
    id: 'net',
    mock: 'net',
    label: 'Network',
    title: 'Verified companies',
    body: 'CIPC, bank and ID on the same graph. Trade only with companies the OS can name.',
  },
] as const;

export const SA_OS_ADVISORS = [
  {
    id: 'gym',
    name: 'GymAdvisor®',
    forWho: 'Studios & coaches',
    memberSees: 'Classes, programmes, shop, RSVP, progress on the phone.',
    deskSees: 'Diary, memberships, debit file, till, Apple Pay split to your bank.',
    tone: 'from-[#E8E830] to-[#6B6B00]',
  },
  {
    id: 'clinic',
    name: 'Clinic Advisors',
    forWho: 'Physio · dental · medical · psychiatry',
    memberSees: 'Open slots, records you share, invoices, family bookings.',
    deskSees: 'Exclusive diaries, packs, waitlist, claims, member wallet link.',
    tone: 'from-teal-500 to-emerald-800',
  },
  {
    id: 'hire',
    name: 'HireAdvisor®',
    forWho: 'Plant, events, party gear',
    memberSees: 'Request → docs → pay → out → return, deposit on the phone.',
    deskSees: 'Catalogue rules, golden path, settlements, 2.5% take-rate on GMV.',
    tone: 'from-cyan-500 to-sky-800',
  },
  {
    id: 'crop',
    name: 'CropAdvisor®',
    forWho: 'Farms & mills',
    memberSees: 'Season plans and trade with verified buyers.',
    deskSees: 'Fields, harvest, fleet fuel, regen, farm-to-buyer POs.',
    tone: 'from-lime-500 to-green-900',
  },
  {
    id: 'shop',
    name: 'RetailAdvisor®',
    forWho: 'Shops & till',
    memberSees: 'Pay at the counter from SA Member — gym and clinic bills too.',
    deskSees: 'SKU till, present QR, same Paystack rails as Advisors.',
    tone: 'from-orange-500 to-amber-800',
  },
] as const;

export const SA_OS_DAY = [
  {
    t: '07:40',
    kicker: 'Member app',
    title: 'Class booked on the phone',
    body: 'A member RSVPs “will be attending”. Coach and desk see it. No clipboard.',
    metric: '1 RSVP',
    metricHint: 'Coach notified',
  },
  {
    t: '09:15',
    kicker: 'Suppliers',
    title: 'PO accepted',
    body: 'You raised PO-1042. The supplier accepted in their workspace. OTIFEF starts now.',
    metric: 'PO-1042',
    metricHint: 'Accepted',
  },
  {
    t: '12:02',
    kicker: 'Till',
    title: 'Apple Pay at the desk',
    body: 'Member pays the listed price. SupplierAdvisor collects; the gym bank is the split destination.',
    metric: 'R 450',
    metricHint: 'Paid · split',
  },
  {
    t: '14:30',
    kicker: 'Finance',
    title: 'Bank line allocated',
    body: 'Statement hits bank rec. The OS suggests the GL from how you posted last time. You confirm.',
    metric: '1 line',
    metricHint: 'Learned GL',
  },
  {
    t: '16:50',
    kicker: 'Trust',
    title: 'Loop closed · rated',
    body: 'Goods in, invoice paid, rating published. That score is what the next buyer sees.',
    metric: '4.8',
    metricHint: 'Network score',
  },
] as const;

export const SA_OS_WHY = [
  {
    title: 'One OS',
    body: 'Trade, inventory, finance, gym, clinic and hire share a company book — not five logins.',
  },
  {
    title: 'Verified',
    body: 'CIPC, bank and personal ID sit on the company. Members stay free on SA Member.',
  },
  {
    title: `${COMPANY_TRIAL_DAYS} days free`,
    body: `Core workspace R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month after trial. Industry packs when you need them.`,
  },
] as const;

export const SA_OS_REPLACE = [
  'Excel supplier books',
  'Xero with no gym diary',
  'WhatsApp POs',
  'Clipboard class lists',
  'A separate till app',
] as const;
