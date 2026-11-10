import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Quality uses the SHEQ permission. The gate says “Your role (…) cannot access SHEQ.” Inspections hide New inspection unless the role can write operations, and the inspections API checks SHEQ write. On the default matrix those are the same people: Owner, Admin, Member, and Operations. HACCP saves check membership only, so a view role that can open the page can post a plan.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const QUALITY_GUIDE: ModuleGuide = {
  id: 'quality',
  name: 'Quality',
  href: '/dashboard/quality',
  purpose:
    'Quality in SupplierAdvisor® is inspections, HACCP, the lot graph, a recall drill, and an export pack. A failed or open inspection can block a shipment. The drill does not recall anything. The pack is not a submission.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'A lot can be inspected, held, and traced. Ship refuses a lot with an open or failed inspection. Recall only searches.',
  flow: [
    { id: 'receive', label: 'Receive', hint: 'Scan does not block' },
    { id: 'inspect', label: 'Inspect', hint: 'Pass or fail' },
    { id: 'hold', label: 'Hold', hint: 'Ship blocks' },
    { id: 'trace', label: 'Trace', hint: 'The graph' },
    { id: 'pack', label: 'Pack', hint: 'Not a submission' },
  ],
  faqs: [
    {
      q: 'Receive warned me and still took the stock. Ship then refused. Why?',
      a: 'Scan receive does not block. It can return a warning that the lot stays on hold. The transfer refuses with QA hold until the inspection is cleared. An owner or admin can override. The scan screen does not show that warning.',
    },
  ],
  features: [
    feat({
      id: 'overview',
      name: 'Overview',
      href: '/dashboard/quality',
      summary: 'Overview is the release path: receive, inspect, trace, ship, and the recall pack.',
      who: WHO,
      prerequisites: ['A company is selected. Inspections need their table. The banner names the migration when it is missing.'],
      steps: [
        'Open Overview. The title is Quality Command.',
        'Follow Receive, Inspect, Trace, Ship, and Recall pack. The heading also says hold/clear between inspect and ship.',
        'Open the cards for inspections, the lots list, HACCP, the graph, the simulator, or regulatory reports.',
      ],
      behind: ['The hub reads the quality summary. It does not post a journal. Trace on the path opens the graph. The lots list is a different card.'],
      errors: [
        { message: 'Apply migration 20260711_quality_inspections.sql in Supabase to enable inspections.', fix: 'Until that table exists, inspections cannot be stored. The counts fall back to zero when the summary does not load.' },
      ],
      faqs: [{ q: 'Which Trace is the sidebar item?', a: 'The sidebar Trace is the graph. The lots list is the Traceability card, and it is not a sidebar item.' }],
    }),
    feat({
      id: 'inspect',
      name: 'Inspect',
      href: '/dashboard/quality/inspections',
      summary: 'Inspect creates a lot check. Pass releases it. Fail holds it and can raise a nonconformance.',
      who: WHO,
      prerequisites: ['You are signed in and a company is selected. The button title says operations write is required when it is disabled.'],
      steps: [
        'Open Inspect. The title is Inspections.',
        'Press New inspection. Set Type, Lot number, Inspector, Defects found, Initial status, and Notes. Press Create inspection.',
        'On an open row press Pass & release, Fail / hold, or Conditional.',
      ],
      behind: [
        'Statuses are open, passed, failed, conditional, and cancelled. Types include incoming, in process, outgoing, hold review, and other.',
        'Fail creates the SHEQ nonconformance and a draft action. Open does not.',
        'Ship is blocked in the warehouse transfer, not by a lock on this row. No journal is posted.',
      ],
      errors: [
        { message: 'Your role (…) cannot create or update inspections. Ask operations or an admin.', fix: 'The button is disabled. The API, if called, says the role does not have write access to sheq.' },
        { message: 'Sign in and select a company', fix: 'Both are required before Create inspection.' },
        { message: 'Invalid status', fix: 'Use pass, fail, or conditional on an open row. The status must be one the API allows.' },
        { message: 'QA hold: lot(s) … have open or failed inspections. Clear Quality → Inspections before shipping.', fix: 'Pass the inspection, or an owner or admin overrides. The override refusal says to clear inspections first.' },
      ],
      faqs: [{ q: 'No inspections yet. Does receive create one?', a: 'No. Press Create inspection when goods arrive or before ship. Receive does not open this row.' }],
    }),
    feat({
      id: 'haccp',
      name: 'HACCP',
      href: '/dashboard/quality/haccp',
      summary: 'HACCP stores a plan, its critical control points, and monitoring logs. It does not issue a certificate.',
      who: `${WHO} The buttons are not hidden for a view role. The save checks membership.`,
      prerequisites: ['A plan name is required. A control point needs a plan.'],
      steps: [
        'Open HACCP. Press New plan, enter Plan name, and press Create plan.',
        'Select the plan and press + Add CCP. Enter the code, name, hazard, critical limit, and corrective action. Press Add CCP.',
        'Press Log monitoring. Tick Within critical limit when the reading is inside the limit. Press Save log.',
        'Press Mark approved on a plan that is not yet approved.',
      ],
      behind: ['A log is stored as ok or breach. The list shows OK or BREACH. No journal and no certificate are posted.'],
      errors: [
        { message: 'Plan name required', fix: 'Enter the name before Create plan.' },
        { message: 'Select a plan', fix: 'Add CCP stays disabled until a plan is selected. The API says plan_id required.' },
      ],
      faqs: [{ q: 'No plans yet. Will the recall drill invent one?', a: 'No. Create the plan here. The drill only searches logs you already have.' }],
    }),
    feat({
      id: 'trace',
      name: 'Trace',
      href: '/dashboard/quality/traceability-graph',
      summary: 'Trace is the pedigree graph. The lots list is a separate page and only paints a hold for open inspections.',
      who: WHO,
      prerequisites: ['Lots exist if you expect nodes. Receive stock with lot numbers.'],
      steps: [
        'Open Trace. Enter Filter by lot number if you want one lot. Press Build graph.',
        'Read the hold banner and the groups. Click a node to select it. Nothing is saved.',
      ],
      behind: [
        'The graph treats open and failed inspections as holds.',
        'The lots list, which is not this sidebar item, asks only for open inspections and then can leave a failed lot looking clear.',
        'No journal is posted.',
      ],
      errors: [
        { message: 'Failed to load graph', fix: 'Keep the company selected. A missing lots table shows the pedigree migration hint.' },
        { message: 'No pedigree nodes yet. Receive stock with lot numbers or clear the filter.', fix: 'Receive a lot in Inventory, or clear the filter.' },
      ],
      faqs: [{ q: 'The lots list says Clear and the graph says hold. Which is right for shipping?', a: 'Ship uses open and failed. Trust the graph and the transfer error. The lots list can miss a failed inspection.' }],
    }),
    feat({
      id: 'recall',
      name: 'Recall',
      href: '/dashboard/quality/recall-simulator',
      summary: 'Recall is a drill. Simulate searches what you already have. It does not quarantine, fail, notify, or write a corrective action.',
      who: WHO,
      prerequisites: ['Type a lot number. A blank search does nothing.'],
      steps: [
        'Open Recall. Enter Lot number. Press Simulate.',
        'Read HOLD / investigate, No open holds found, or No matching lot records.',
        'Recommended next steps are sentences. They are not buttons.',
      ],
      behind: ['The search filters lots, inspections, and HACCP logs in the browser. No status changes and no journal is posted.'],
      errors: [{ message: 'No matching lot records', fix: 'The lot is not on this company, or the lists failed to load. It is not a recall.' }],
      faqs: [{ q: 'I pressed Simulate. Did customers get notified?', a: 'No. Notify is one of the recommended sentences. Nothing was sent.' }],
    }),
    feat({
      id: 'export',
      name: 'Export',
      href: '/dashboard/quality/regulatory-reports',
      summary: 'Export builds a JSON and print pack from live inspections, HACCP, and holds. It is not a certification and it is not submitted.',
      who: `${WHO} The page uses the SHEQ gate. The pack API checks operations view.`,
      prerequisites: ['A company is selected. Generate before JSON or Print. Those stay disabled until a pack exists.'],
      steps: [
        'Open Export. The title is Regulatory reports.',
        'Choose 30 days, 90 days, 180 days, or 365 days. Press Generate.',
        'Press JSON or Print. Read the disclaimer on the pack.',
      ],
      behind: [
        'Generate writes an audit row that a pack was exported. It does not change an inspection and it does not post a journal.',
        'The disclaimer says it is not a third-party certification or a formal legal opinion.',
      ],
      errors: [
        { message: 'Select a company', fix: 'Choose the company before Generate.' },
        { message: 'Your role (…) does not have view access to operations. Contact an admin.', fix: 'The pack API checks operations view even though the page gate says SHEQ.' },
      ],
      faqs: [{ q: 'Does Generate file the pack with a regulator?', a: 'No. JSON and Print stay on your side. The page does not say it submits.' }],
    }),
  ],
};
