import type { GuideFeature, ModuleGuide } from '@/lib/help/types';
import { gateMessage, viewRoleLabels } from '@/lib/help/roles';

const WHO =
  'People uses the people permission. Owner has admin. Admin, Member, Finance, and Operations can change people records on the default matrix. Viewer and Sales can open the screens. A sales contractor cannot. The payroll API checks company membership. The gate says “Your role (…) cannot access People (HR).”';

const GATE = {
  message: gateMessage('people'),
  fix: 'Ask an owner for a role that can view People (HR).',
};

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const PEOPLE_GUIDE: ModuleGuide = {
  id: 'people',
  name: 'People',
  href: '/dashboard/people',
  purpose:
    'People in SupplierAdvisor® is the employee book, leave, and payroll. A payroll run can post a journal when you mark it paid. The PAYE and UIF amounts on the screen are proxies. They are not a SARS submission, and marking the run paid does not pay the employee from a bank.',
  roles: viewRoleLabels('people'),
  outcome: 'The employee is on the directory, leave is approved, and a payroll run moves from calculated to approved to paid with a journal in the ledger.',
  flow: [
    { id: 'directory', label: 'Directory', hint: 'Add the employee' },
    { id: 'leave', label: 'Leave', hint: 'Approve' },
    { id: 'calculate', label: 'Calculate', hint: 'Draft run' },
    { id: 'approved', label: 'Approve', hint: 'Calculated run' },
    { id: 'paid', label: 'Pay + GL', hint: 'Journal, not the bank' },
  ],
  faqs: [
    {
      q: 'People is empty. What now?',
      a: 'No employee has been saved. Add one on Directory. A business unit is required before the record saves. SupplierAdvisor® does not load sample employees.',
    },
    {
      q: 'Are the PAYE figures what I submit to SARS?',
      a: 'No. The payroll screen says the PAYE and UIF figures are illustrative proxies and not SARS tax advice. Nothing on this screen files a return.',
    },
  ],
  features: [
    feat({
      id: 'directory',
      name: 'Directory and where people sit',
      href: '/dashboard/people/directory',
      summary: 'Directory is the employee record. The org chart shows the reporting line. Organisation keeps the business units, cells, stations, and assets.',
      who: WHO,
      prerequisites: ['Create the business unit on Organisation before you save an employee who must belong to one. The directory requires a business unit before the record saves.'],
      steps: [
        'Open Organisation and add the business unit, the cell, the station, or the asset you need.',
        'Open Directory and add the employee. Choose the business unit. Save.',
        'The other employee address only opens this directory.',
        'Open Org to read who reports to whom. Change the manager on the directory, not by dragging the chart.',
        'Open Onboard and tick the onboarding items on the employee. The ticks do not store the documents.',
      ],
      behind: [
        'The employee status used by payroll includes active, probation, and on leave. Other statuses are left out of a calculate run.',
        'Onboarding ticks are flags on the record. They are not uploaded files.',
      ],
      errors: [
        GATE,
        { message: 'Run supabase/migrations/20260723_hr_people_module.sql', fix: 'The people tables are missing. Directory and payroll cannot save until that migration is applied.' },
      ],
      faqs: [
        {
          q: 'Does adding an employee post a salary journal?',
          a: 'No. The journal is posted only when you mark a payroll run paid and the chart has a labour account and a bank account.',
        },
      ],
    }),
    feat({
      id: 'leave',
      name: 'Leave',
      href: '/dashboard/people/leave',
      summary: 'Leave requests annual, sick, and family leave, and an approver accepts or rejects the pending request.',
      who: WHO,
      prerequisites: ['The employee is on the directory. A balance exists for the leave type you are booking.'],
      steps: [
        'Open Leave. The title is Leave management. The description says annual, sick, and family leave — request, approve, and keep balances current.',
        'Press Request leave.',
        'Choose the employee. The type starts as Default annual. Set From and To. Submit.',
        'The toast says “Leave request submitted”.',
        'On a pending row, press Approve or Reject.',
        'Approved leave toasts “Leave approved”.',
      ],
      behind: [
        'A request is pending, approved, rejected, or cancelled.',
        'Approval reduces the stored balance for that employee.',
        'Approved leave can block an Advisor diary on the company calendar. It does not calculate pay.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Does approving leave pay the employee?',
          a: 'No. It updates the balance and the request. Pay is a payroll run.',
        },
      ],
    }),
    feat({
      id: 'payroll',
      name: 'Payroll',
      href: '/dashboard/people/payroll',
      summary: 'Payroll calculates a run, lets you approve it, and can post a journal when you mark it paid. It does not pay salaries from the bank and it does not file PAYE.',
      who: WHO,
      prerequisites: [
        'At least one employee is active, on probation, or on leave.',
        'To post the journal, the chart needs a labour account (6100 or 5200) and a bank account (1110). PAYE needs a liability account such as 2130 or 2120 if you want the deduction credited.',
      ],
      steps: [
        'Open Payroll.',
        'Set Year and Month.',
        'Press Calculate run. While it works the button reads Working….',
        'Read the lines. Columns are Employee, Basic, PAYE, UIF, and Net.',
        'The screen states that PAYE and UIF figures are illustrative proxies for demo — not SARS tax advice.',
        'When the status is calculated, press Approve.',
        'When the status is approved or calculated, press Mark paid + GL.',
        'Recent runs lists older periods. If there are none, it says “No payroll runs yet. Calculate a period above.”',
        'Open Directory from the link on the page if an employee is missing.',
      ],
      behind: [
        'Calculate builds a run in calculated from employees in active, probation, or on leave. PAYE uses the proxy brackets in the payroll code. UIF uses a 1% cap proxy. Neither is a statutory table.',
        'Approve sets the run to approved. It does not post and it does not pay anyone.',
        'Mark paid + GL sets the run to paid and posts source hr_payroll: debit labour (6100 or 5200) for the gross, credit bank 1110 for the net, and credit the PAYE liability for the deductions when that account exists.',
        'The journal number comes back in the toast “Paid · GL {entry number}”. If the accounts are missing, the run can still be marked paid without that journal.',
        'The run does not instruct a bank to pay the net. Record the actual payment on Finance → Bank when the statement line arrives, or match it there.',
        'Statuses are draft, calculated, approved, paid, and void.',
      ],
      errors: [
        GATE,
        { message: 'Invalid period_month', fix: 'Choose a month from 1 to 12.' },
        { message: 'Payroll {period} is already {status}', fix: 'That month already has a run in that state. Open it under Recent runs instead of calculating it again.' },
        { message: 'companyId required', fix: 'Select the company and reopen Payroll.' },
        { message: 'Run not found', fix: 'Reload Payroll. The run id is no longer on this company.' },
        { message: 'Failed to create run', fix: 'Check that employees exist, then Calculate run again.' },
      ],
      faqs: [
        {
          q: 'Why does the disclaimer say the tax amounts are proxies?',
          a: 'The screen says they are illustrative proxies and not SARS tax advice. Use them to see the shape of the run. Do not copy them onto a SARS form as the statutory value.',
        },
        {
          q: 'Does Mark paid + GL use VAT account 2120?',
          a: 'Only as a fallback liability account if that code exists and the PAYE liability account is not found. Output VAT for invoices is a different journal. Payroll does not file the VAT201.',
        },
      ],
    }),
    feat({
      id: 'grow',
      name: 'Performance, training, and discipline',
      href: '/dashboard/people/performance',
      summary: 'Rate records a rating, Train assigns a course, and Discipline opens a case. None of these pay the employee.',
      who: WHO,
      prerequisites: ['The employee is on the directory.'],
      steps: [
        'Open Rate and record the rating. Formal reviews appear in the list. This screen does not edit a review after it is listed.',
        'Open Train, assign the course, and mark it complete. The screen does not attach a certificate.',
        'Open Discipline, open the case, and set the status and the outcome. The status list includes a hearing. The screen does not keep a hearing log.',
      ],
      behind: [
        'A rating, a course completion, and a case outcome are stored on the employee book.',
        'They do not post the payroll journal and they do not change leave balances.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'Can I attach the warning letter?',
          a: 'Discipline stores the status and the outcome. It does not keep a hearing log or the letter file. Keep the file in your own records.',
        },
      ],
    }),
  ],
};
