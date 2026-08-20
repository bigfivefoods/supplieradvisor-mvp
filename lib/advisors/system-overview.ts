/**
 * Advisor system overview - high-level "why this OS" copy for the
 * command hub (before the E2E process design) and the A4 one-pager PDF.
 *
 * Client-safe: no pdfkit. PDF builder lives in system-overview-pdf.ts.
 */

export const ADVISOR_OVERVIEW_MODULES = [
  'medicalgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'fitgraph',
  'hiregraph',
  'retailgraph',
] as const;

export type AdvisorOverviewModule = (typeof ADVISOR_OVERVIEW_MODULES)[number];

export type OverviewBullet = { title: string; body: string };

export type AdvisorSystemOverviewCopy = {
  module: AdvisorOverviewModule;
  brand: string;
  clientNoun: string;
  headline: string;
  promise: string;
  core: OverviewBullet[];
  advisor: OverviewBullet[];
  clients: OverviewBullet[];
  enhance: OverviewBullet[];
  closer: string;
};

const CORE_CLINIC: OverviewBullet[] = [
  {
    title: 'People',
    body: 'Employed staff and contractors on one workforce book. Leave blocks that clinician diary - no double-book.',
  },
  {
    title: 'Customers 360',
    body: 'Every patient dual-writes CRM: visits, invoices, household. One customer record for the whole company.',
  },
  {
    title: 'Finance',
    body: 'Visit and pack fees post AR, revenue and VAT once. Company SaaS stays on SupplierAdvisor - not on the client invoice.',
  },
  {
    title: 'Messages',
    body: 'Care and team threads deliver in-app by platform user ID when the person is on SupplierAdvisor.',
  },
  {
    title: 'Intelligence + calendar',
    body: 'Attendance, no-shows, feedback and recalls land on the company pulse. The week calendar overlays the Advisor diary.',
  },
];

const CORE_GYM: OverviewBullet[] = [
  {
    title: 'People',
    body: 'Coaches as employed or contractors. Leave blocks their diary so the floor cannot assign them that day.',
  },
  {
    title: 'Customers 360',
    body: 'Members dual-write CRM: class subscriptions, debit bank, invoices, household.',
  },
  {
    title: 'Finance',
    body: 'Membership and class fees post AR, revenue and VAT. Debit-order file from Finance. SaaS stays on SupplierAdvisor.',
  },
  {
    title: 'Messages',
    body: 'Desk, coaches and members on one thread - in-app by system user ID when the member is on-platform.',
  },
  {
    title: 'Intelligence + calendar',
    body: 'Plan vs actual, no-shows and feedback write CRM activity. Company calendar overlays the class week.',
  },
];

const CORE_HIRE: OverviewBullet[] = [
  {
    title: 'Core Suppliers',
    body: 'Gear owners live in SRM. HireAdvisor lists against those rows - not a second supplier book.',
  },
  {
    title: 'Customers 360',
    body: 'Renters land on CRM: hires, deposits, invoices, household.',
  },
  {
    title: 'Inventory',
    body: 'Catalogue items sit on shared SKUs so stock, hire and other Advisors use one product book.',
  },
  {
    title: 'Finance',
    body: 'Hire value posts AR and VAT. Platform commission is on the listing business. SaaS stays on SupplierAdvisor.',
  },
  {
    title: 'Messages + calendar',
    body: 'Handover notes and company week view stay on Core - not in a side chat.',
  },
];

const CORE_RETAIL: OverviewBullet[] = [
  {
    title: 'Inventory',
    body: 'Till SKUs sync to the shared product book - gym shop, hire and clinic consumables can use the same SKU.',
  },
  {
    title: 'Customers 360',
    body: 'Walk-ins and SA Member shoppers land on CRM: baskets, open bills, household.',
  },
  {
    title: 'Finance',
    body: 'Takings post AR, revenue and VAT. Open bills collect at the till like other Advisors.',
  },
  {
    title: 'People',
    body: 'Staff on the workforce book. Roles, not a shared till login.',
  },
  {
    title: 'Intelligence',
    body: 'Sales today, week and month sit on the same company pulse as the rest of the OS.',
  },
];

const CLOSER =
  'SupplierAdvisor bills the company subscription. Member card and Apple Pay settle to your bank (1 percent admin). Cash and proof of payment stay with you.';

const BY_MODULE: Record<AdvisorOverviewModule, AdvisorSystemOverviewCopy> = {
  medicalgraph: {
    module: 'medicalgraph',
    brand: 'MedicalAdvisor®',
    clientNoun: 'patients',
    headline:
      'Run the practice on MedicalAdvisor. Run the company on Core. Patients use SA Member.',
    promise:
      'One workspace instead of a diary, a spreadsheet, a WhatsApp group and a separate accounts pack. The floor, the books and the client app stay in step - so you keep the relationship after they leave the room.',
    core: CORE_CLINIC,
    advisor: [
      {
        title: 'Rooms & assets',
        body: 'Consult rooms and surgeries on the Rooms desk, with equipment assigned to each room.',
      },
      {
        title: 'Diary that opens the visit',
        body: 'Click a booked slot to open that appointment. Empty slots book new - never a second record on the profile.',
      },
      {
        title: 'Floor',
        body: 'Rooms with equipment, optionally assigned to a medical advisor. Waitlist, 30-day outcomes, the treatment board today and rehab recalls.',
      },
      {
        title: 'Branded session emails',
        body: 'Practice-logo mail 24h before (update SA Member + ailments) and after (rate the session and the practice).',
      },
      {
        title: 'Consented referral',
        body: 'With patient consent, share selected patient + practice info with another practice (GP to physio / psychiatry).',
      },
      {
        title: 'Website & pay-out',
        body: 'Public profile, booking and marketplace listing. Card / Apple Pay already works; add a bank for where split funds go.',
      },
    ],
    clients: [
      {
        title: 'Free SA Member app',
        body: 'Profile, ailments and household on their phone - reminded before each visit to keep it current.',
      },
      {
        title: 'Book, waitlist, family',
        body: 'Open slots with a preferred clinician, or another when allowed. Household members on the same book.',
      },
      {
        title: 'Visit history',
        body: 'The same past visits and notes the practice sees - on the desk and on the PWA.',
      },
      {
        title: 'Rate session + practice',
        body: 'After the visit, branded mail to score the session and the practice. Feedback lands on your outcomes.',
      },
      {
        title: 'Messages & pay',
        body: 'In-app care when they are on SupplierAdvisor. Card / Apple Pay to your bank, or cash at the practice.',
      },
      {
        title: 'Consented share',
        body: 'When referred, they choose what another practice may see. No silent hand-off of the chart.',
      },
    ],
    enhance: [
      {
        title: 'One book of truth',
        body: 'Stop re-typing the same patient into a diary, a sheet and an invoice.',
      },
      {
        title: 'A fuller diary',
        body: 'Waitlist, 24h reminders and recalls fill cancellations and bring people back.',
      },
      {
        title: 'A brand they remember',
        body: 'Logo on mail, website and ratings - one practice from invite to feedback.',
      },
      {
        title: 'Money that posts once',
        body: 'CRM and Finance show the same fee. Card / Apple Pay lands in your bank.',
      },
    ],
    closer: CLOSER,
  },
  physiograph: {
    module: 'physiograph',
    brand: 'PhysioAdvisor®',
    clientNoun: 'patients',
    headline:
      'Run the clinic on PhysioAdvisor. Run the company on Core. Patients use SA Member.',
    promise:
      'Allied health on one diary and one patient book - connected to People, Customers 360 and Finance. Rehab packs, waitlist and recalls stay in the same OS the rest of the company already uses.',
    core: CORE_CLINIC,
    advisor: [
      {
        title: 'Practitioners & rooms',
        body: 'Physio, OT, biokinetics - rates, bios, exclusive diaries. Rooms as resources on the floor.',
      },
      {
        title: 'Diary that opens the visit',
        body: 'Click a booked slot to open that treatment. Empty slots book new - never a second appointment.',
      },
      {
        title: 'Packs & plans',
        body: 'Multi-session rehab packs and step plans. Book next from the plan onto an open diary slot.',
      },
      {
        title: 'Floor',
        body: 'Rooms with equipment, optionally assigned to a practitioner. Waitlist, 30-day outcomes, the treatment board today and rehab recalls.',
      },
      {
        title: 'Website & pay-out',
        body: 'Clinic profile, booking and marketplace. Card / Apple Pay settles to your bank.',
      },
    ],
    clients: [
      {
        title: 'Free SA Member app',
        body: 'Profile, injury notes and household on their phone.',
      },
      {
        title: 'Book, waitlist, family',
        body: 'Open slots, next-available queue, household members on the same book.',
      },
      {
        title: 'Visit history',
        body: 'Past treatments they and the clinician can both see.',
      },
      {
        title: 'After the visit',
        body: 'Rate how they felt and whether they would return. Feedback lands on your outcomes.',
      },
      {
        title: 'Messages & pay',
        body: 'In-app care when they are on-platform. Card / Apple Pay or cash at the clinic.',
      },
    ],
    enhance: [
      {
        title: 'One clinic book',
        body: 'Practitioners, packs and invoices stop living in three tools.',
      },
      {
        title: 'Fill the diary',
        body: 'Waitlist and recalls turn cancellations into attended visits.',
      },
      {
        title: 'Plans that book',
        body: 'The next session is a click from the treatment plan - not a phone tag.',
      },
      {
        title: 'Money that posts once',
        body: 'Pack charges hit CRM and Finance together. SaaS is not on the patient bill.',
      },
    ],
    closer: CLOSER,
  },
  dentalgraph: {
    module: 'dentalgraph',
    brand: 'DentalAdvisor®',
    clientNoun: 'patients',
    headline:
      'Run the practice on DentalAdvisor. Run the company on Core. Patients use SA Member.',
    promise:
      'Dentists, hygienists and the front desk on one chair book - dual-written to People, Customers 360 and Finance. Hygiene recalls and waitlist keep the chairs full.',
    core: CORE_CLINIC,
    advisor: [
      {
        title: 'Staff & chairs',
        body: 'Dentists and the dental team with exclusive diaries. Rooms as chair resources.',
      },
      {
        title: 'Diary that opens the visit',
        body: 'Click a booked slot to open that treatment - never a second record.',
      },
      {
        title: 'Care plans',
        body: 'Multi-visit plans and packs with a session ledger that posts VAT.',
      },
      {
        title: 'Floor',
        body: 'Rooms and chairs with equipment, optionally assigned to a clinician. Waitlist, outcomes, the chair board today and hygiene / check-up recalls.',
      },
      {
        title: 'Website & pay-out',
        body: 'Practice profile, booking and marketplace. Card / Apple Pay to your bank.',
      },
    ],
    clients: [
      {
        title: 'Free SA Member app',
        body: 'Profile and household on their phone.',
      },
      {
        title: 'Book, waitlist, family',
        body: 'Open chairs, next-available queue, household on the same book.',
      },
      {
        title: 'Visit history',
        body: 'Past treatments the practice and the patient both see.',
      },
      {
        title: 'After the visit',
        body: 'Rate the visit and the practice. Feedback lands on outcomes.',
      },
      {
        title: 'Messages & pay',
        body: 'In-app care when they are on-platform. Card / Apple Pay or cash at the desk.',
      },
    ],
    enhance: [
      {
        title: 'One practice book',
        body: 'Chairs, patients and invoices in the same OS as the rest of the company.',
      },
      {
        title: 'Chairs that fill',
        body: 'Waitlist plus hygiene recalls bring people back before they drift.',
      },
      {
        title: 'A brand they trust',
        body: 'Website, portal and ratings look like one practice.',
      },
      {
        title: 'Money that posts once',
        body: 'The fee on the visit is the fee on Finance. SaaS stays off the patient bill.',
      },
    ],
    closer: CLOSER,
  },
  psychiatrygraph: {
    module: 'psychiatrygraph',
    brand: 'PsychiatryAdvisor®',
    clientNoun: 'patients',
    headline:
      'Run the practice on PsychiatryAdvisor. Run the company on Core. Patients use SA Member.',
    promise:
      'Psychiatry and psychology on one session book - connected to People, Customers 360 and Finance. Exclusive clinician diaries, waitlist and follow-up recalls without a second ledger.',
    core: CORE_CLINIC,
    advisor: [
      {
        title: 'Practitioners & rooms',
        body: 'Psychiatrists and psychologists with exclusive diaries. Rooms as session resources.',
      },
      {
        title: 'Diary that opens the session',
        body: 'Click a booked slot to open that visit - never a second appointment on the profile.',
      },
      {
        title: 'Care packs',
        body: 'Multi-session packs and step plans. Book next from the plan.',
      },
      {
        title: 'Floor',
        body: 'Rooms with equipment, optionally assigned to a clinician. Waitlist, 30-day outcomes, the session board today and review / follow-up recalls.',
      },
      {
        title: 'Website & pay-out',
        body: 'Practice profile, booking and marketplace. Card / Apple Pay to your bank.',
      },
    ],
    clients: [
      {
        title: 'Free SA Member app',
        body: 'Profile and household on their phone, with a privacy notice on the portal.',
      },
      {
        title: 'Book, waitlist, family',
        body: 'Open sessions, next-available queue, household when appropriate.',
      },
      {
        title: 'Visit history',
        body: 'Past sessions they and the clinician can both see.',
      },
      {
        title: 'After the session',
        body: 'Rate the session and the practice. Feedback lands on outcomes.',
      },
      {
        title: 'Messages & pay',
        body: 'In-app care when they are on-platform. Card / Apple Pay or cash at the practice.',
      },
    ],
    enhance: [
      {
        title: 'One clinical book',
        body: 'Diaries, notes and invoices stop living in separate tools.',
      },
      {
        title: 'Sessions that hold',
        body: 'Reminders, waitlist and follow-up recalls reduce no-shows.',
      },
      {
        title: 'Consent first',
        body: 'POPIA on create; share only what the patient agrees to.',
      },
      {
        title: 'Money that posts once',
        body: 'The session fee is the Finance journal. SaaS is not on the client invoice.',
      },
    ],
    closer: CLOSER,
  },
  fitgraph: {
    module: 'fitgraph',
    brand: 'GymAdvisor®',
    clientNoun: 'members',
    headline:
      'Run the floor on GymAdvisor. Run the company on Core. Members use SA Member.',
    promise:
      'Coaches, classes, memberships and training programmes on one gym OS - dual-written to People, Customers 360 and Finance. Plan vs actual, waitlist and programme follow without a second spreadsheet.',
    core: CORE_GYM,
    advisor: [
      {
        title: 'Coaches & classes',
        body: 'Tenure, rates, contracts and class types. Rooms on the calendar.',
      },
      {
        title: 'Movements & programmes',
        body: 'Library of movements. Week-by-weekday programmes you build, sell or assign. Coach and member see the same calendar.',
      },
      {
        title: 'Plan vs actual',
        body: 'Who was planned, who came. No-show soft-block. Attendance writes CRM.',
      },
      {
        title: 'Floor',
        body: 'The floor board today, 30-day outcomes, member re-engagement.',
      },
      {
        title: 'Memberships',
        body: 'Class subscriptions set the fee. Debit-order bank or card / Apple Pay.',
      },
      {
        title: 'Grow · portal & apps',
        body: 'Member dock (Class · Progress · You · Shop · Share), coach PWA, programme follow, optional public website.',
      },
    ],
    clients: [
      {
        title: 'Free SA Member app',
        body: 'Class, Progress, You in the centre circle, Shop and Share on their phone.',
      },
      {
        title: 'Book & waitlist',
        body: 'Covered classes, waitlist, family members on the same membership.',
      },
      {
        title: 'Follow a programme',
        body: 'Calendar of movements on Progress. Log feel and effort after each day. Coach notes come back.',
      },
      {
        title: 'After class',
        body: 'Rate feel and intensity. Coaches can rate too. Feedback slices on reports.',
      },
      {
        title: 'Pay their way',
        body: 'Card / Apple Pay to your bank, or wait for the owner debit-order file. Buy a programme in Shop.',
      },
      {
        title: 'Messages',
        body: 'In-app with desk and coaches when they are on SupplierAdvisor.',
      },
    ],
    enhance: [
      {
        title: 'One gym book',
        body: 'Coaches, members and invoices stop living in three apps.',
      },
      {
        title: 'A fuller floor',
        body: 'Waitlist and re-engagement fill empty spots before the class starts.',
      },
      {
        title: 'Honest attendance',
        body: 'Plan vs actual is the same story CRM and Intelligence see.',
      },
      {
        title: 'Money that posts once',
        body: 'The class fee is the Finance journal. SaaS stays on SupplierAdvisor.',
      },
    ],
    closer: CLOSER,
  },
  hiregraph: {
    module: 'hiregraph',
    brand: 'HireAdvisor®',
    clientNoun: 'customers',
    headline:
      'List on HireAdvisor. Own the relationship on Core. Customers hire from their phone.',
    promise:
      'Gear owners in Core Suppliers, renters in Customers 360, stock on Inventory. HireAdvisor is the floor - not a second company.',
    core: CORE_HIRE,
    advisor: [
      {
        title: 'Catalogue',
        body: 'Items against a core supplier and Inventory SKU - rate, deposit, stock, category rules.',
      },
      {
        title: 'Bookings & calendar',
        body: 'Open hires, out-now, month income on the command hub.',
      },
      {
        title: 'Requirements',
        body: 'Category KYC and docs before handover - plant, vehicles, tools, events.',
      },
      {
        title: 'Handover',
        body: 'Out and return on the same booking. Settlement to Finance.',
      },
      {
        title: 'B2C portal',
        body: 'Customers browse, request, complete docs and track hires on SA Member.',
      },
    ],
    clients: [
      {
        title: 'Free SA Member app',
        body: 'Browse the catalogue and track hires on their phone.',
      },
      {
        title: 'Request & docs',
        body: 'Raise a hire, complete the category requirements, get a clear status.',
      },
      {
        title: 'Handover they can follow',
        body: 'Out and return on the same booking - not a WhatsApp trail.',
      },
      {
        title: 'Pay',
        body: 'Card / Apple Pay to your bank where offered. Deposits sit on the same bill.',
      },
      {
        title: 'One customer book',
        body: 'They are a Core customer - invoices and household stay after the hire.',
      },
    ],
    enhance: [
      {
        title: 'No second supplier book',
        body: 'Owners already live in SRM. Hire just lists them.',
      },
      {
        title: 'Stock that matches',
        body: 'The SKU on the hire is the SKU in Inventory.',
      },
      {
        title: 'Handover you can audit',
        body: 'Docs, out and return on the booking - not in a chat thread.',
      },
      {
        title: 'Money that posts once',
        body: 'Hire value hits Finance. Commission is on the listing business, not a surprise fee on the renter.',
      },
    ],
    closer: CLOSER,
  },
  retailgraph: {
    module: 'retailgraph',
    brand: 'RetailAdvisor®',
    clientNoun: 'shoppers',
    headline:
      'Ring up on RetailAdvisor. Keep the books on Core. Shoppers pay on SA Member.',
    promise:
      'A till that is not a separate company. Catalogue SKUs, Customers 360 and Finance stay the same book the rest of SupplierAdvisor already uses.',
    core: CORE_RETAIL,
    advisor: [
      {
        title: 'Till',
        body: 'Basket, cash, or present QR / NFC so the shopper pays on their phone.',
      },
      {
        title: 'Catalogue',
        body: 'Price the SKUs you ring up. Sync them into Inventory as shared products.',
      },
      {
        title: 'Accounts',
        body: 'Store credit and open bills collect at the till like gym and clinic Advisors.',
      },
      {
        title: 'Comms',
        body: 'Ads and notices to shoppers on SA Member.',
      },
      {
        title: 'Website',
        body: 'SA Member QR, public shop page, embed for your own site.',
      },
    ],
    clients: [
      {
        title: 'Free SA Member app',
        body: 'Pay by QR or NFC. No extra app from the store.',
      },
      {
        title: 'Pay on their phone',
        body: 'Card / Apple Pay settles to your bank. Cash still works at the till.',
      },
      {
        title: 'Open bills',
        body: 'Collect store credit and member bills at the counter - same path as other Advisors.',
      },
      {
        title: 'One customer book',
        body: 'Walk-in or member, they land on Customers 360.',
      },
      {
        title: 'Notices',
        body: 'They see your comms in SA Member - not only a till slip.',
      },
    ],
    enhance: [
      {
        title: 'One product book',
        body: 'The SKU on the till is the SKU in Inventory.',
      },
      {
        title: 'A faster desk',
        body: 'Present QR / NFC. The shopper pays; you do not re-key the card.',
      },
      {
        title: 'Bills that collect',
        body: 'Open SA Member accounts close at the same till.',
      },
      {
        title: 'Money that posts once',
        body: 'Takings hit Finance. SaaS stays on SupplierAdvisor.',
      },
    ],
    closer: CLOSER,
  },
};

export function isAdvisorOverviewModule(
  raw: string | null | undefined
): raw is AdvisorOverviewModule {
  return (ADVISOR_OVERVIEW_MODULES as readonly string[]).includes(
    String(raw || '')
  );
}

export function parseAdvisorOverviewModule(
  raw: string | null | undefined
): AdvisorOverviewModule | null {
  const v = String(raw || '').trim().toLowerCase();
  return isAdvisorOverviewModule(v) ? v : null;
}

export function advisorSystemOverview(
  module: AdvisorOverviewModule
): AdvisorSystemOverviewCopy {
  return BY_MODULE[module];
}

export function advisorSystemOverviewPdfUrl(
  module: AdvisorOverviewModule,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('module', module);
  if (opts?.download) q.set('download', '1');
  return `/api/advisors/system-overview/pdf?${q.toString()}`;
}

export function advisorSystemOverviewFilename(
  module: AdvisorOverviewModule
): string {
  const brand = BY_MODULE[module].brand.replace(/®/g, '').replace(/\s+/g, '');
  return `${brand}-System-Overview-A4.pdf`;
}
