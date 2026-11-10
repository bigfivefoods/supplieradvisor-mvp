import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'The platform pages that live under /dashboard/platform use the platform permission. Owner has admin and Admin has view, so both pass the page. Member, Viewer, Finance, Operations, Sales, and a sales contractor do not. The gate says “Your role (…) cannot access Platform console.” The console API then requires a platform operator or a platform-company owner or admin. An ordinary company owner is stopped there. Gov control, the ops board, and referrals sit on company addresses and use a different check, named on each feature.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const LOCK = {
  message: 'Not available. Sign in as a SupplierAdvisor platform owner to open the admin console.',
  fix: 'The page gate is not enough. The console opens for a platform operator or a platform-company owner or admin. Press Retry after that sign-in. The locked heading is Platform console locked.',
};

export const PLATFORM_GUIDE: ModuleGuide = {
  id: 'platform',
  name: 'Platform',
  href: '/dashboard/platform',
  purpose:
    'Platform in SupplierAdvisor® is the operator console: system health, companies, consumer sign-ins, government activation, and referral settlement. It is not a customer workflow. Customer journals are not posted here.',
  roles: ['Owner', 'Admin'],
  outcome: 'A platform operator can read the console, activate a pending department, and settle referral fees. A company cannot mark its own referral paid.',
  flow: [
    { id: 'console', label: 'Console', hint: 'Operator lock' },
    { id: 'system', label: 'System', hint: 'Read only' },
    { id: 'gov', label: 'Gov control', hint: 'Activate' },
    { id: 'refer', label: 'Referrals', hint: 'Settle' },
  ],
  faqs: [
    {
      q: 'I am the owner of my company and the console is locked. Why?',
      a: 'The sidebar gate lets a company owner and an admin open the address. The console itself then says it is only for a SupplierAdvisor platform owner.',
    },
  ],
  features: [
    feat({
      id: 'console',
      name: 'Console',
      href: '/dashboard/platform',
      summary: 'Console is the admin portal for how the system is working, plus a storage migration that is a dry run until you copy.',
      who: WHO,
      prerequisites: ['You pass the platform page gate and the console API.'],
      steps: [
        'Open Console. The title is Platform console.',
        'Read System health, Companies, Active people, and Activity 24h. Open System reports, Management reports, SA Member access, Ops board, or Gov activation.',
        'Under Sensitive storage migration press Dry run. Copy migrates legacy files. Delete originals asks you to confirm and only removes files that already have a verified private copy.',
      ],
      behind: [
        'Dry run does not move files. Copy migrates. Delete originals does not run unless you confirm.',
        'Ensuring the console can create the platform company. That is not a customer journal.',
      ],
      errors: [
        LOCK,
        { message: 'Could not load', fix: 'Press Retry. The fallback body says the portal is only for platform owners.' },
      ],
      faqs: [{ q: 'Does Delete originals remove files that were never copied?', a: 'No. The copy says it only removes files with a verified private copy, and only after you confirm.' }],
    }),
    feat({
      id: 'system',
      name: 'System',
      href: '/dashboard/platform/system',
      summary: 'System reports infrastructure, schema probes, and readiness. It does not change them.',
      who: WHO,
      prerequisites: ['The same console lock as Console.'],
      steps: [
        'Open System. The title is System reports.',
        'Read Health score, the integration pills, Schema probes, and Core tables. A missing distribution says No data yet.',
      ],
      behind: ['The page is a read-only report. It does not post a journal and it does not rotate a secret.'],
      errors: [LOCK],
      faqs: [{ q: 'Can I edit a schema probe from here?', a: 'No. The table shows OK and a row count. There is no save.' }],
    }),
    feat({
      id: 'management',
      name: 'Management',
      href: '/dashboard/platform/management',
      summary: 'Management reports sign-ups, subscriptions, and module adoption, and downloads an A4 pack.',
      who: WHO,
      prerequisites: ['The same console lock as Console.'],
      steps: [
        'Open Management. The title is Management reports.',
        'Search with Search name, email, city….',
        'Press Download A4 landscape PDF. The toast says the pack downloaded.',
      ],
      behind: ['The PDF is a download of this report. It is not a customer invoice and it does not post a journal.'],
      errors: [
        LOCK,
        { message: 'No sign-ups loaded.', fix: 'The report has no rows yet. A search with no hits says No matches for that search.' },
      ],
      faqs: [{ q: 'Does the PDF include another company’s books?', a: 'It is the platform management pack: sign-ups, subscriptions, and adoption. It is not a company’s general ledger.' }],
    }),
    feat({
      id: 'members',
      name: 'SA Members',
      href: '/dashboard/platform/members',
      summary: 'SA Members lists consumer sign-ins, the last app they opened, and how long they stayed.',
      who: WHO,
      prerequisites: ['The same console lock as Console.'],
      steps: [
        'Open SA Members. The title is SA Member access.',
        'Filter All, Active 24h, Active 7d, New 7d, or Last on PWA. Search with Search name, email, gym….',
        'Press Export CSV. The file is built in the browser.',
      ],
      behind: ['Export does not write a journal. A cell with no email says no email. A place that is not classified says Not yet classified.'],
      errors: [
        LOCK,
        { message: 'No SA Members match that filter yet.', fix: 'Clear the filter. The list is empty for that slice, not hidden.' },
      ],
      faqs: [{ q: 'Can I sign a member in from this list?', a: 'No. The report and the CSV are read-only.' }],
    }),
    feat({
      id: 'gov',
      name: 'Gov control',
      href: '/dashboard/my-business/platform',
      summary: 'Gov control activates a pending government department. It is not the platform-console permission.',
      who: 'The address is a company overview page, so a dashboard role can open it. The list itself loads only for a platform operator. Everyone else sees Not available.',
      prerequisites: ['A department registration is pending. There is nothing to activate when the list is empty.'],
      steps: [
        'Open Gov control. The title is Platform control.',
        'Read Pending government departments. Press Activate on a row.',
      ],
      behind: [
        'Activate writes the agency to active. It does not post a customer journal.',
        'A non-operator does not see the list.',
      ],
      errors: [
        { message: 'Not available', fix: 'The body says this console is only for platform-authorised accounts.' },
        { message: 'No departments awaiting activation.', fix: 'There is no pending department. Activation failed means the activate call did not land.' },
      ],
      faqs: [{ q: 'I am a company admin. Why is Activate missing?', a: 'The page opens, and the operator check still hides the list. Company admin is not the operator check.' }],
    }),
    feat({
      id: 'ops',
      name: 'Ops board',
      href: '/dashboard/my-business/ops',
      summary: 'Ops board is the readiness snapshot: payments pulse, verification backlog, and schema. It does not change them.',
      who: 'The address uses the company overview gate. The data loads for referral operators. The failure names that access.',
      prerequisites: ['Referral-ops access is granted. The helper says platform ops users can open this after that.'],
      steps: [
        'Open Ops board. The title is Ops readiness. Press Refresh.',
        'Read Ready or Blockers present, then the schema rows and the verification sample.',
        'Open Open verifications queue when you need the queue itself.',
      ],
      behind: ['The board is a read-only snapshot. It does not post a journal and it does not settle a claim.'],
      errors: [
        {
          message: 'Platform referral ops only. Use REFERRAL_OPS_SECRET or own the programme root company.',
          fix: 'The page also falls back to Ops board requires referral ops or CRON_SECRET auth. This is operator access, not a company finance role.',
        },
      ],
      faqs: [{ q: 'Can I fix a schema row from the tile?', a: 'No. The tile shows whether the table is present. There is no migrate button.' }],
    }),
    feat({
      id: 'referrals',
      name: 'Referrals',
      href: '/dashboard/my-business/referral-ops',
      summary: 'Referrals approves holds, marks payouts paid, and claws back a refund. A company cannot mark itself paid.',
      who: 'The same referral-ops check as the ops board. The page says root company owner or admin, or the referral ops secret.',
      prerequisites: ['You have an earner company id. Companies do not settle their own fees here.'],
      steps: [
        'Open Referrals. The title is Referrals ops.',
        'Enter Earner company ID and press Load.',
        'Press Approve pending, Mark paid, Fraud snapshot, or Auto-approve holds. Mark paid asks for Paid ref (EFT / batch).',
        'Under Refund clawback enter the payment reference and press Clawback.',
      ],
      behind: [
        'Approve, paid, and clawback change the referral earning status. The page says this is not the company marking itself paid.',
        'It is not a manual journal screen.',
      ],
      errors: [
        { message: 'Enter earner company id', fix: 'Type the id and press Load. The API line is Earner companyId required.' },
        { message: 'Paystack / source ref required', fix: 'Clawback needs the payment reference.' },
        { message: 'Only platform referral operators can approve, pay, or void earnings.', fix: 'A normal company finance role cannot settle these rows.' },
      ],
      faqs: [{ q: 'Can my company press Mark paid on its own earnings?', a: 'No. The banner says companies cannot mark themselves paid. Only platform ops settle referral fees.' }],
    }),
  ],
};
