import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'SHEQ opens for anyone who can view SHEQ. On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. Create and status changes need SHEQ write or operations write: Owner, Admin, Member, and Operations. Viewer, Finance, and Sales do not see the create panel. The gate says “Your role (…) cannot access SHEQ.” The write API uses the same SHEQ resource.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const SHEQ_GUIDE: ModuleGuide = {
  id: 'sheq',
  name: 'SHEQ',
  href: '/dashboard/sheq',
  purpose:
    'SHEQ in SupplierAdvisor® is incidents, hazards, nonconformances, and corrective actions. A failed inspection can open a nonconformance and a draft action. Nothing here posts the ledger.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'An incident or a hazard can be logged, a nonconformance raised, and a corrective action moved to closed or effective.',
  flow: [
    { id: 'incident', label: 'Incident', hint: 'Open' },
    { id: 'hazard', label: 'Hazard', hint: 'Score 1–5' },
    { id: 'ncr', label: 'NCR', hint: 'Or from a failed check' },
    { id: 'capa', label: 'CAPA', hint: 'Then close' },
  ],
  faqs: [
    {
      q: 'What scale is the hazard score?',
      a: 'Likelihood and severity are each 1 to 5. The score is the product. 16 and above is critical, 10 and above is high, 5 and above is medium, and the rest is low.',
    },
  ],
  features: [
    feat({
      id: 'overview',
      name: 'Overview',
      href: '/dashboard/sheq',
      summary: 'Overview counts open incidents, nonconformances, actions, and quality holds. It does not log them.',
      who: WHO,
      prerequisites: ['A company is selected. If the SHEQ tables are missing, the page says migration required.'],
      steps: [
        'Open Overview. The title is SHEQ Command.',
        'Read Open incidents, Open NCRs, Open CAPAs, and QA holds.',
        'Open Incidents, Hazards & risks, NCR, CAPA, QA inspections, or Quality & HACCP.',
      ],
      behind: ['Counts come from the SHEQ summary. A failed inspection is included in the hold count. No journal is posted. A failed fetch shows zeros.'],
      errors: [
        { message: 'SHEQ tables missing — run 20260712_sheq_module.sql', fix: 'The banner means the tables are not there. Logging will not succeed until they are. This is not a sample incident.' },
      ],
      faqs: [{ q: 'No incidents yet. Should I see an example?', a: 'No. Recent incidents, NCRs, and CAPAs stay empty until a row is logged.' }],
    }),
    feat({
      id: 'incidents',
      name: 'Incidents',
      href: '/dashboard/sheq/incidents',
      summary: 'Incidents logs a near miss, an injury, or another type, then moves the status.',
      who: WHO,
      prerequisites: ['A company is selected. The page says Select a company to open incidents when none is open. Title is required.'],
      steps: [
        'Open Incidents. Under Report incident enter Title, Location / site, Description, and Immediate action taken.',
        'Choose the type and the severity. Severity is low, medium, high, or critical. Press Log incident.',
        'Change the status on the row when you can write. Statuses are open, investigating, awaiting capa, closed, and cancelled.',
      ],
      behind: [
        'A new row is open unless you send another allowed status. Closing sets the closed time.',
        'An audit row is written. No journal is posted.',
      ],
      errors: [
        { message: 'Title required', fix: 'Enter what happened. The API says title required.' },
        { message: 'Your role (…) does not have write access to sheq. Contact an admin.', fix: 'Viewer, finance, and sales can read. They do not see Log incident.' },
      ],
      faqs: [{ q: 'No incidents recorded yet. Is the list filtered?', a: 'No. Log the first one. The desk does not seed an incident.' }],
    }),
    feat({
      id: 'hazards',
      name: 'Hazards',
      href: '/dashboard/sheq/hazards',
      summary: 'Hazards scores likelihood times severity. The sliders are 1 to 5. The list does not change the status.',
      who: WHO,
      prerequisites: ['Title is required. Category defaults to general if you leave the example text.'],
      steps: [
        'Open Hazards. The title is Hazards & risks.',
        'Enter Hazard title, category, location, description, and existing controls.',
        'Set Likelihood (1–5) and Severity (1–5). Read Risk score. Press Save hazard.',
      ],
      behind: [
        'The score is likelihood times severity after each slider is clamped from 1 to 5. The band is critical, high, medium, or low.',
        'The row is stored open. The status list also has controlled, accepted, and closed, and this screen does not edit them.',
        'No journal is posted.',
      ],
      errors: [{ message: 'Title required', fix: 'Enter the hazard title before Save hazard.' }],
      faqs: [{ q: 'The picture said it states no scale. What do I use?', a: 'Use the sliders. The page says score likelihood × severity (1–5).' }],
    }),
    feat({
      id: 'ncr',
      name: 'NCR',
      href: '/dashboard/sheq/ncrs',
      summary: 'NCR raises a nonconformance. A failed inspection can create one and a draft action. An open inspection does not.',
      who: WHO,
      prerequisites: ['Title is required. The lot number is optional.'],
      steps: [
        'Open NCR. The title is Nonconformances.',
        'Under Raise NCR enter Title, Lot number, Description, and Immediate containment. Choose the domain and the severity. Press Raise NCR.',
        'Change the status when you can write. Open a linked action from Linked CAPA.',
      ],
      behind: [
        'A manual raise is stored as source manual and status open. Statuses are open, containment, capa linked, closed, and cancelled.',
        'A failed inspection writes an NCR and a draft CAPA, and moves the NCR to capa linked. Doing it again for the same inspection does not duplicate them.',
        'No journal is posted.',
      ],
      errors: [
        { message: 'Title required', fix: 'Enter the title. The empty state also tells you to fail a QA inspection or create one manually.' },
      ],
      faqs: [{ q: 'An open inspection did not raise an NCR. Why?', a: 'Only a failed inspection does. Open is not a fail.' }],
    }),
    feat({
      id: 'capa',
      name: 'CAPA',
      href: '/dashboard/sheq/capas',
      summary: 'CAPA records the cause and the actions. Closing or marking it effective stores the closed time.',
      who: WHO,
      prerequisites: ['Title is required. An NCR id is optional.'],
      steps: [
        'Open CAPA. Under New CAPA enter Title, Link NCR id, Owner, the date, Root cause, Corrective action, and Preventive action.',
        'Set the priority. Press Create CAPA.',
        'Change the status. Statuses include open, in progress, pending verify, effective, ineffective, closed, and cancelled.',
      ],
      behind: [
        'Linking an NCR sets that NCR to capa linked and a linked incident to awaiting capa.',
        'Effective and closed set the closed time. Effective also sets the verified time. The form does not ask for the effectiveness check. The API would accept it. This page does not show those fields.',
        'No journal is posted.',
      ],
      errors: [{ message: 'Title required', fix: 'Enter the title. Failed inspections create draft actions. This form is the manual one.' }],
      faqs: [{ q: 'No CAPAs yet. Do I have to type one?', a: 'Not if a failed inspection already drafted one. Otherwise press Create CAPA.' }],
    }),
  ],
};
