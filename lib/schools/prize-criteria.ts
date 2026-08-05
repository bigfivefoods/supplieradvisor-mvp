/**
 * Clear, public prize criteria for schools and service providers.
 * Single source of truth for UI copy + scoring docs.
 */
import { PRIZE_WEIGHTS } from '@/lib/schools/types';

export type PrizeCriterion = {
  id: string;
  label: string;
  weight: number;
  how: string;
  tip: string;
};

/** School headmaster prize — sum of weights = 100 */
export const SCHOOL_PRIZE_CRITERIA: PrizeCriterion[] = [
  {
    id: 'approvedBrand',
    label: 'Approved brand procurement',
    weight: PRIZE_WEIGHTS.approvedBrand,
    how: '% of kitchen GRN lines on the DBE/PEU approved foods list this quarter.',
    tip: 'Order only catalogue products from preferred SPs. Off-list lines never enter prize-friendly stock.',
  },
  {
    id: 'zeroNonapproved',
    label: 'Zero off-catalogue events',
    weight: PRIZE_WEIGHTS.zeroNonapproved,
    how: 'Full points if no non-compliant GRN / blocked off-list receives. Each event steps the pillar down.',
    tip: 'Dispute wrong brands at the gate — do not receive off-list into the kitchen.',
  },
  {
    id: 'menuAdherence',
    label: 'Menu adherence',
    weight: PRIZE_WEIGHTS.menuAdherence,
    how: 'How closely received/served foods match the department menu cycle.',
    tip: 'Plan POs from the published menu for each weekday.',
  },
  {
    id: 'feedingCompleteness',
    label: 'Feeding completeness',
    weight: PRIZE_WEIGHTS.feedingCompleteness,
    how: 'Serve-day logs on weekdays in the quarter (meals served recorded).',
    tip: 'Log every feeding day — present, meals, waste.',
  },
  {
    id: 'stockDiscipline',
    label: 'Stock discipline',
    weight: PRIZE_WEIGHTS.stockDiscipline,
    how: 'Clean GRNs, receive against delivery notes, no ghost stock.',
    tip: 'Use one-tap receive when quantities match; adjust only when needed.',
  },
  {
    id: 'dataQuality',
    label: 'Data quality',
    weight: PRIZE_WEIGHTS.dataQuality,
    how: 'Verified learners / EMIS-quality register.',
    tip: 'Keep the learner register verified and EMIS attested.',
  },
];

/** SP prize scorecard — sum of weights = 100 */
export const SP_PRIZE_CRITERIA: PrizeCriterion[] = [
  {
    id: 'onCatalogue',
    label: 'On-catalogue + brand fidelity',
    weight: 50,
    how: 'Weighted % by quantity: exact school brand = full credit; approved same-category substitute (OOS) = half credit; unapproved = zero. Unapproved brands are not allowed.',
    tip: 'Buy the brand the school chose. If OOS, only switch to another approved brand in the same category — that scores half.',
  },
  {
    id: 'fullCompliance',
    label: 'Full-compliance deliveries',
    weight: 25,
    how: 'Bonus for deliveries where every line is the exact school-selected brand (no substitutes, no off-list).',
    tip: 'When the ordered brand is available, ship it. Keep NSNP DNs free of unapproved products.',
  },
  {
    id: 'podPhotos',
    label: 'Photo POD discipline',
    weight: 15,
    how: '% of deliveries with a POD photo (or POD file) attached by SP or school.',
    tip: 'Take a phone photo of the signed POD at the school gate on every drop.',
  },
  {
    id: 'otif',
    label: 'On-time reliability',
    weight: 10,
    how: 'Share of deliveries marked OTIF (on/before expected date) when expected_date is set.',
    tip: 'Set expected date on dispatch and deliver on time.',
  },
];

export const SCHOOL_PRIZE_SUMMARY =
  'Schools compete for the quarterly headmaster prize (0–100). About 55% of points reward approved-only procurement and zero off-catalogue events. Full claim funding also needs ≥98% on-catalogue GRNs.';

export const SP_PRIZE_SUMMARY =
  'Service providers earn a 0–100 preferred-supplier score. You may deliver additional (non-catalogue) items on the note, but full points go to DBE-approved products, clean DNs, photo POD, and on-time drop-offs. Preferred SPs are listed first when schools order.';

export const POD_PHOTO_TIP =
  'Both school and SP can attach a photo as proof of delivery (POD). Use the camera on site — photos count toward SP prize POD discipline.';
