import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Insights opens for anyone who can view Intelligence. On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. A sales contractor cannot. The gate says “Your role (…) cannot access Intelligence.” Summary and actions check that you are a member. Lab can keep going on a baseline when the live pulse fails. Lead can save on this company. None of these screens post a ledger journal.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const INTELLIGENCE_GUIDE: ModuleGuide = {
  id: 'intelligence',
  name: 'Insights',
  href: '/dashboard/intelligence',
  purpose:
    'Insights in SupplierAdvisor® reads the live company: the pulse, the signals, the forecast, the scorecards, a what-if lab, and Super-Cube® leadership training. It is not a read-only page. Log RIAD and Create task write a task. Lead saves progress on the company.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'You can read the scores, turn a signal into a task, and save a Super-Cube® self-assessment on the company profile.',
  flow: [
    { id: 'pulse', label: 'Pulse', hint: 'Live scores' },
    { id: 'signal', label: 'Signal', hint: 'Then a task' },
    { id: 'forecast', label: 'Forecast', hint: 'Not saved' },
    { id: 'lab', label: 'Lab', hint: 'Browser only' },
    { id: 'lead', label: 'Super-Cube®', hint: 'Saved on the company' },
  ],
  faqs: [
    {
      q: 'Is Insights only a report?',
      a: 'The pulse, the forecast, the scorecards, and the lab do not write. Insights can log a RIAD or create a task. Lead saves the Super-Cube® progress on the company profile. None of that is a ledger journal.',
    },
  ],
  features: [
    feat({
      id: 'overview',
      name: 'Overview',
      href: '/dashboard/intelligence',
      summary: 'Overview is the intelligence home, including the link into Super-Cube® leadership.',
      who: WHO,
      prerequisites: ['A company is selected. Otherwise the gate says Select a company and Choose a workspace to open Intelligence.'],
      steps: ['Open Overview. The title is Intelligence Command.', 'Press Refresh. Read Health, Network, and the priority insights. Open a connected system or an insight link.'],
      behind: ['Scores are computed. You do not type them. No journal is posted. An empty insight list says No critical signals — keep trading and connecting.'],
      errors: [
        { message: 'Select a company', fix: 'Press Select company. The summary also says companyId required when the call has none.' },
        { message: 'Intelligence error', fix: 'Press Refresh. Company not found means the selected company is gone.' },
      ],
      faqs: [{ q: 'Loading live intelligence never finishes. What now?', a: 'That is the loading line. If it becomes a red banner, the banner is the error. It does not fill the scores.' }],
    }),
    feat({
      id: 'pulse',
      name: 'Pulse',
      href: '/dashboard/intelligence/pulse-dashboard',
      summary: 'Pulse is the health index and the trade, supply, demand, and finance tiles. Refresh reloads them.',
      who: WHO,
      prerequisites: ['A company is selected.'],
      steps: ['Open Pulse. The title is Business pulse.', 'Press Refresh. Read Overall and the five domain scores, then the network, supply, and finance tiles.'],
      behind: ['The numbers are the same summary as Overview. No journal is posted and nothing is saved from this page.'],
      errors: [{ message: 'Select a company', fix: 'Choose the workspace. A red banner is the summary error.' }],
      faqs: [{ q: 'Can I type the health index?', a: 'No. Overall is the average of the five domain scores.' }],
    }),
    feat({
      id: 'insights',
      name: 'Insights',
      href: '/dashboard/intelligence/neural-insights',
      summary: 'Insights lists rule-based signals. Log RIAD and Create task write a follow-up. Collections only opens the money hub.',
      who: WHO,
      prerequisites: ['A company is selected. Owner and Due date are optional and are sent with the RIAD or the task.'],
      steps: [
        'Open Insights. The title is Business insights. Press Refresh.',
        'Filter All domains and All severities, or search the lists Needs attention, Strengths, and Opportunities.',
        'On a card press Open module, Log RIAD, or Create task. A finance card also has Collections.',
        'Dismiss hides that signal on this device. The footer says so.',
      ],
      behind: [
        'The action writes an activity row. It does not post a ledger journal.',
        'Create task uses the latest active or planning project, or creates a project named Intelligence actions when none exists.',
        'Collections does not create a collection record. The message says to open the money hub, and the link is the customer money screen.',
        'Healed signals drop on refresh. Dismiss does not delete them on the server.',
      ],
      errors: [
        { message: 'Could not create task — projects table missing?', fix: 'The hint names the projects migration. The signal is still on the page.' },
        { message: 'Ensure you are signed in and a company is selected. Auth cookies or Bearer token required in production.', fix: 'Sign in again and select the company. The red banner is the summary error.' },
      ],
      faqs: [{ q: 'All quiet on the intelligence front. Is the engine off?', a: 'No. The empty copy says signals appear as the operating graph grows. Press Discover partners if you have no connections yet.' }],
    }),
    feat({
      id: 'forecast',
      name: 'Forecast',
      href: '/dashboard/intelligence/predictive-forecasts',
      summary: 'Forecast fits a statistical model to this company’s orders, invoices, sales, and stock movements. It does not save the chart.',
      who: WHO,
      prerequisites: ['A company is selected. The horizon is 3, 6, 9, or 12 months.'],
      steps: ['Open Forecast. Pick the horizon. Press Refresh.', 'Open Revenue, Procurement, or Demand units. Read Points, Mean, RMSE, MAPE, and R².'],
      behind: ['The note says it is statistical, not a language model. No journal is posted and the result is not stored as a budget.'],
      errors: [{ message: 'No forecast data available.', fix: 'The series is empty for this company. Widen the history by trading. The panel title is No series.' }],
      faqs: [{ q: 'Can I push this forecast into the budget?', a: 'No. There is no save. Finance budget is a different screen.' }],
    }),
    feat({
      id: 'score',
      name: 'Score',
      href: '/dashboard/intelligence/custom-scorecards',
      summary: 'Score shows composite scores from live metrics. There is no box to type a KPI.',
      who: WHO,
      prerequisites: ['A company is selected. The description says no manual KPI entry is required.'],
      steps: ['Open Score. The title is Performance scorecards.', 'Press Refresh. Read Enterprise score and the domain cards. Press Open module on a card.'],
      behind: ['The header says five domains. The how-to lists seven bullets. The cards are whatever the summary returns. No journal is posted.'],
      errors: [{ message: 'Select a company', fix: 'Choose the workspace. An empty scorecard list leaves the how-to panel and no cards.' }],
      faqs: [{ q: 'Where do I enter a target for the score?', a: 'You do not. The page says the scores are computed. Targets for emissions are in Impact.' }],
    }),
    feat({
      id: 'lab',
      name: 'Lab',
      href: '/dashboard/intelligence/simulation-lab',
      summary: 'Lab moves levers on the live pulse and recomputes in the browser. Reset and Reload base do not save a scenario.',
      who: WHO,
      prerequisites: ['A company pulse is preferred. If it fails, the page says it is running a demo baseline so the lab still works.'],
      steps: [
        'Open Lab. Read Live company pulse or Demo baseline.',
        'Move OTIFEF delta, Low-stock SKUs delta, Open AR invoices delta, Network connections delta, Quote win-rate delta, or Pipeline multiplier.',
        'Read Health impact. Press Reset to clear the levers. Press Reload base to fetch the pulse again.',
      ],
      behind: ['Nothing is posted. The word demo baseline is the label when the live pulse is unavailable. It is not a saved company.'],
      errors: [{ message: 'Live pulse unavailable (…). Running demo baseline so the lab still works.', fix: 'Press Reload base after the company pulse loads. The levers still move on the baseline.' }],
      faqs: [{ q: 'I moved a lever. Did stock or OTIFEF change?', a: 'No. The impact is on this page only. Reset puts the levers back.' }],
    }),
    feat({
      id: 'lead',
      name: 'Super-Cube®',
      href: '/dashboard/intelligence/leadership-development',
      summary: 'Lead is Super-Cube®: six faces, a 1 to 10 self-assessment, a 30-day plan, and a save onto the company profile. It does not post a journal and it does not certify you.',
      who: WHO,
      prerequisites: ['A company is selected for the cloud save. Without that, progress can stay on this device and the toast says so.'],
      steps: [
        'Open Lead. The title is Leadership Super-Cube®.',
        'On Discover press Begin self-assessment or Start assessment. The six faces are Choices, Principles, Mental, Emotional, Physical, and Spiritual.',
        'On Assess score each prompt from 1 (rarely true) to 10 (world-class, consistent). Defaults start at 5. Press View results & growth plan.',
        'On Grow read the combined index out of 60, the spider profile, and the 30-day plan. Weeks are W1 to W4. Tick practices. Write the three commitments. Press Save commitments & practices or Save to company profile.',
        'Press Export report for the JSON file and the print view. The print line says it is a self-assessment for development, not a certification.',
      ],
      behind: [
        'Save writes leadership progress on the company profile. A failed cloud save toasts Saved locally.',
        'Bands are World-class at 9 and above, Strong at 7, Developing at 5, and Priority growth below 5. The index adds the six face averages.',
        'No ledger journal is posted and no return is filed.',
      ],
      errors: [
        { message: 'Saved locally', fix: 'The cloud save failed. The description is the error, or Save failed, or Cloud save unavailable. The progress is on this device. The column hint names leadership progress on the profile.' },
        { message: 'Select a company', fix: 'Choose the company if you want Save to company profile rather than this device only.' },
      ],
      faqs: [
        { q: 'Does Super-Cube® change my trust score or my books?', a: 'No. It saves the assessment and can export a report. Trade, trust, and the ledger are untouched.' },
      ],
    }),
  ],
};
