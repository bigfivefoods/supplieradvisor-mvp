import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Home opens for anyone who can view the dashboard: Owner, Admin, Member, Viewer, Finance, Operations, and Sales. A sales contractor is sent to Sales. The gate says “Your role (…) cannot access Dashboard.” Finance stays on this page. Another role whose company has an advisor home is replaced away to that advisor.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const HOME_GUIDE: ModuleGuide = {
  id: 'home',
  name: 'Home',
  href: '/dashboard',
  purpose:
    'Home in SupplierAdvisor® is the company command page: the first-run checklist, the domain boards, and the links into Messages and the company calendar. It reads the company. It does not post a journal.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'You can see the company pulse, finish the five setup steps when the records exist, and open Messages or the calendar.',
  flow: [
    { id: 'company', label: 'Company', hint: 'Select it' },
    { id: 'setup', label: 'First run', hint: 'Five records' },
    { id: 'boards', label: 'Boards', hint: 'Read only' },
    { id: 'inbox', label: 'Messages', hint: 'Your threads' },
    { id: 'week', label: 'Calendar', hint: 'No new leave' },
  ],
  faqs: [
    {
      q: 'The process picture says a sales contractor stays on this page. Do they?',
      a: 'No. A sales contractor cannot open the dashboard and is sent to Sales. Finance does stay here. Another role with an advisor home is replaced away.',
    },
  ],
  features: [
    feat({
      id: 'command',
      name: 'Command',
      href: '/dashboard',
      summary: 'Command is the company pulse and the first-run checklist. A step is done only when the record exists.',
      who: WHO,
      prerequisites: ['A company is selected. Otherwise the page says Select a company to open your command center.'],
      steps: [
        'Open Home. The title is One company. Zero blind spots.',
        'Press Refresh. Press Expand all or Collapse all on the domain boards: Business, Finance, CRM, SRM, Operations, Manufacturing, Quality, and Intelligence.',
        'Read Network, Pipeline, Open POs, AR open, In motion, and Attention.',
        'On the checklist, use Edit profile, Add supplier, Add customer, Raise PO, Invite teammate, or Verify company. Dismiss setup checklist hides it on this browser only.',
      ],
      behind: [
        'The five required steps are a profile at least 70% complete, a supplier, a customer, any purchase order, and a team invite or at least two active people. Verification is optional.',
        'Done is computed from those records. There is no Mark done button and nothing is written to a progress table. Dismissal is stored on this browser.',
        'This page does not post a journal.',
      ],
      errors: [
        { message: 'Failed to load dashboard', fix: 'Press Retry. Keep the company selected.' },
        { message: 'Select a company to open your command center.', fix: 'Press Select company and choose the workspace.' },
      ],
      faqs: [
        { q: 'I dismissed the checklist. Did that finish setup?', a: 'No. It only hides the card on this browser. The steps are done when the records exist.' },
      ],
    }),
    feat({
      id: 'messages',
      name: 'Messages',
      href: '/dashboard/messages?from=home',
      summary: 'Messages is the company inbox for conversations you are on. It is not the whole company’s mail.',
      who: 'The inbox path is opened as Network. Every dashboard role except a sales contractor can view Network. A viewer who can open the page can post, because the save checks membership.',
      prerequisites: ['A company is selected. A supplier or customer thread needs a connection.'],
      steps: [
        'Open Messages from Home. The title is Messages, company inbox.',
        'Press New conversation. Choose Colleague, Supplier, Customer, or Any connection.',
        'For a colleague, Whole team / general… is the first option. For a partner, pick Connected company…. Enter Subject (optional) and Write the first message…. Press Start.',
        'Filter All, Team, Suppliers, Customers, or Trade / care. Reply with Write a reply…. Press Archive on a thread.',
      ],
      behind: [
        'You only see conversations you are on. A non-colleague thread is also written to the other company.',
        'Nothing here posts a journal, a stock movement, or an invoice.',
      ],
      errors: [
        { message: 'Write a message', fix: 'The first message cannot be empty.' },
        { message: 'Pick a connected company', fix: 'Connect the supplier or customer in Network, then start the thread.' },
        { message: 'No matching connections yet', fix: 'The picker is empty. Connect someone first. The empty inbox says the same.' },
        { message: 'Thread not found', fix: 'Reload. You can only open a thread you are on.' },
      ],
      faqs: [
        { q: 'Can I read every colleague thread?', a: 'No. The description says you only see conversations you are on, not the whole company inbox.' },
      ],
    }),
    feat({
      id: 'calendar',
      name: 'Calendar',
      href: '/dashboard/calendar',
      summary: 'Calendar shows the company week. It does not create leave, a booking, or a delivery.',
      who: WHO,
      prerequisites: ['A company is selected. The page says Select a company first when none is open.'],
      steps: [
        'Open Calendar. The title is Company calendar.',
        'Set From and To.',
        'Filter with all, gym, clinic, hire, leave, or delivery.',
      ],
      behind: [
        'The week reads events other modules already saved. An empty day says Clear.',
        'Leave on a coach blocks that coach’s diary. You do not approve the leave here.',
      ],
      errors: [
        { message: 'Select a company first.', fix: 'Choose the company. A failed load shows an empty week rather than an error sentence.' },
      ],
      faqs: [{ q: 'How do I add a delivery to the week?', a: 'Create it in Ship or on the purchase order. This screen only displays the week.' }],
    }),
  ],
};
