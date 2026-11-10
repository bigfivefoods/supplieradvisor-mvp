import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'HealthAdvisor® is not a separate permission. The sidebar resource is schools, and a /dashboard/health path is checked as the dashboard. On the default matrix anyone who can open the dashboard except a sales contractor can open these pages. The programme role is separate: a health-family department is DoH, a health facility profile is Facility, and a service-provider row is SP. The default is a facility.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'command',
    name: 'Command',
    href: '/dashboard/health',
    summary: 'Command is the health programme home. The title changes with the role: Department of Health, Health supply, or Clinic / hospital.',
    who: WHO,
    prerequisites: ['A company is selected. Education programmes stay in SchoolAdvisor®. The home says so.'],
    steps: [
      'Open Command.',
      'A department sees the programme desk and the link to approved foods.',
      'A facility sees profile, approved foods, orders, kitchen, and nutrition. Those open the schools screens.',
      'A service provider sees deliveries, which is the schools deliveries screen.',
    ],
    behind: [
      'There is no separate health foods list, health purchase desk, clinic dispatch desk, or clinic kitchen. The cards open the schools pages.',
      'Map redirects to the schools map. Facilities redirects to the department desk. Management redirects to the coverage report.',
    ],
    errors: [
      { message: 'Not a health department — use Schools → DBE', fix: 'This company is an education department. Register it on SchoolAdvisor®.' },
      { message: 'Your role (…) cannot access Dashboard.', fix: 'A sales contractor cannot open HealthAdvisor®. Use a dashboard role.' },
    ],
    faqs: [
      { q: 'Why does Approved foods open a schools page?', a: 'The catalogue is the schools catalogue. The health home links to it. There is not a second list.' },
    ],
  }),
  feat({
    id: 'agency',
    name: 'DoH desk',
    href: '/dashboard/health/agency',
    summary: 'DoH desk registers a health department and approves facilities. An education department is refused.',
    who: `${WHO} Activation needs platform authorisation. Approval of a facility is the department.`,
    prerequisites: ['The organisation type is a health department. A pending registration stays locked until platform activation.'],
    steps: [
      'Open DoH desk. The title says Department of Health only.',
      'Register the department. If you are not authorised to activate it, the tools stay pending.',
      'Approve a facility from the join list. Approve sets the link active. Suspend sets suspended. Reject sets left.',
    ],
    behind: [
      'Join stores a pending link with the note that it is a health facility join request.',
      'No ledger journal is posted.',
    ],
    errors: [
      { message: 'Department activation requires platform authorisation.', fix: 'A platform operator activates the department. The pending message says programme tools unlock after approval.' },
      { message: 'Health module only accepts DoH / provincial health types', fix: 'Do not register a DBE type here.' },
      { message: 'That department is DBE/education. Join it from the Schools module.', fix: 'Use SchoolAdvisor® for an education department.' },
      { message: 'Only DoH can approve health facilities', fix: 'Open the department company. A facility cannot approve itself.' },
    ],
    faqs: [
      { q: 'Facilities is a separate list. Where is it?', a: 'The facilities address redirects to this desk. The list lives here.' },
    ],
  }),
  feat({
    id: 'join',
    name: 'Join',
    href: '/dashboard/health/join',
    summary: 'Join is where a facility or a service provider asks to join the department, and where the department adds them.',
    who: WHO,
    prerequisites: ['A health department exists. A facility needs a facility profile.'],
    steps: [
      'Open Join & add.',
      'A facility requests the association. The toast on approval is Facility approved.',
      'A service provider uses the same join to associate.',
    ],
    behind: ['The link is the same association table as the schools programme, with a health note. No journal is posted.'],
    errors: [
      { message: 'No facility profile', fix: 'Create the facility profile before the join can attach.' },
      { message: 'Facility not found', fix: 'The id is not a facility on this programme.' },
    ],
    faqs: [{ q: 'Can a clinic join an education department here?', a: 'No. An education department tells you to join from SchoolAdvisor®.' }],
  }),
  feat({
    id: 'report',
    name: 'Coverage report',
    href: '/dashboard/health/report',
    summary: 'The coverage report is the department’s management pack. It is not a clinical record.',
    who: `${WHO} The page says DoH only, then Health coverage report.`,
    prerequisites: ['The company is the health department if the report is restricted to it.'],
    steps: ['Open Management report. Read the coverage pack. The management address on the old path scrolls to the same report.'],
    behind: ['The report reads programme rows. It does not post a journal and it does not replace the schools nutrition norms.'],
    errors: [
      { message: 'DoH only', fix: 'Open the department company. A facility does not get this pack.' },
    ],
    faqs: [{ q: 'Is the nutrition roll-up a clinic record?', a: 'No. Nutrition on the facility sidebar opens the schools nutrition screen and compares meals with those norms.' }],
  }),
  feat({
    id: 'shared',
    name: 'Shared school screens',
    href: '/dashboard/schools/approved-list',
    summary: 'Catalogue, profile, orders, kitchen, deliveries, and nutrition open the schools screens. They are not a second health product.',
    who: WHO,
    prerequisites: ['Use the health home so you land on the right schools page for your role.'],
    steps: [
      'Open Catalogue or Approved foods. You are on the schools approved list.',
      'Open Profile. You are on the schools profile.',
      'Open Orders or Deliver. You are on the schools order and delivery screens.',
      'Open Kitchen or Nutrition. You are on the schools kitchen and the schools nutrition screen.',
    ],
    behind: [
      'A save on those pages follows the schools rules. A department-only catalogue edit still says only the agency can edit it.',
      'No separate clinic purchase order is created.',
    ],
    errors: [
      { message: 'Only the DBE / PEU agency can edit this catalogue', fix: 'The foods list is the schools catalogue. A health facility reads it. The department that owns the list edits it.' },
    ],
    faqs: [
      { q: 'The process picture says these are schools screens. Is there a health copy?', a: 'No. The notes on the health flow match the redirects. Use the schools how-to for the buttons on those pages.' },
    ],
  }),
];

export const HEALTH_GUIDE: ModuleGuide = {
  id: 'health',
  name: 'HealthAdvisor®',
  href: '/dashboard/health',
  purpose:
    'HealthAdvisor® in SupplierAdvisor® is the health programme: a department, a facility, and a service provider. Catalogue, orders, kitchen, and deliveries are the schools screens. Education stays in SchoolAdvisor®.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'A health department can be registered and a facility can be approved. Supply still runs on the shared programme screens.',
  flow: [
    { id: 'dept', label: 'Department', hint: 'Platform activates' },
    { id: 'join', label: 'Facility join', hint: 'Department approves' },
    { id: 'list', label: 'Catalogue', hint: 'Schools list' },
    { id: 'supply', label: 'Order', hint: 'Schools order' },
    { id: 'kitchen', label: 'Kitchen', hint: 'Schools kitchen' },
  ],
  faqs: [
    {
      q: 'Why is the permission not called Health?',
      a: 'The path is opened as the dashboard, the sidebar resource is the schools resource, and the module id is health. The programme role is what picks DoH, Facility, or SP.',
    },
  ],
  features,
};
