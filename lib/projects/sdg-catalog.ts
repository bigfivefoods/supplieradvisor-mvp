/**
 * UN Sustainable Development Goals (SDGs) — goals and official target codes.
 * Targets are abbreviated for product UI; full text is UN-owned.
 */

export type SdgTarget = {
  code: string;
  title: string;
};

export type SdgGoal = {
  id: number;
  name: string;
  short: string;
  color: string;
  targets: SdgTarget[];
};

export const SDG_GOALS: SdgGoal[] = [
  {
    id: 1,
    name: 'No Poverty',
    short: 'End poverty in all its forms',
    color: '#E5243B',
    targets: [
      { code: '1.1', title: 'Eradicate extreme poverty' },
      { code: '1.2', title: 'Reduce poverty by at least 50%' },
      { code: '1.3', title: 'Implement social protection systems' },
      { code: '1.4', title: 'Equal rights to resources & services' },
      { code: '1.5', title: 'Build resilience to shocks & disasters' },
      { code: '1.a', title: 'Mobilize resources to end poverty' },
      { code: '1.b', title: 'Create pro-poor policy frameworks' },
    ],
  },
  {
    id: 2,
    name: 'Zero Hunger',
    short: 'End hunger, achieve food security',
    color: '#DDA63A',
    targets: [
      { code: '2.1', title: 'End hunger and ensure access to food' },
      { code: '2.2', title: 'End all forms of malnutrition' },
      { code: '2.3', title: 'Double smallholder productivity & incomes' },
      { code: '2.4', title: 'Sustainable food production systems' },
      { code: '2.5', title: 'Maintain genetic diversity of seeds' },
      { code: '2.a', title: 'Invest in rural infrastructure & research' },
      { code: '2.b', title: 'Prevent agricultural trade distortions' },
      { code: '2.c', title: 'Ensure food commodity markets function' },
    ],
  },
  {
    id: 3,
    name: 'Good Health and Well-being',
    short: 'Ensure healthy lives for all ages',
    color: '#4C9F38',
    targets: [
      { code: '3.1', title: 'Reduce maternal mortality' },
      { code: '3.2', title: 'End preventable deaths of children' },
      { code: '3.3', title: 'End epidemics of communicable diseases' },
      { code: '3.4', title: 'Reduce premature mortality from NCDs' },
      { code: '3.5', title: 'Strengthen substance abuse prevention' },
      { code: '3.6', title: 'Halve road traffic deaths' },
      { code: '3.7', title: 'Universal access to sexual & reproductive health' },
      { code: '3.8', title: 'Universal health coverage' },
      { code: '3.9', title: 'Reduce deaths from pollution & chemicals' },
    ],
  },
  {
    id: 4,
    name: 'Quality Education',
    short: 'Inclusive and equitable education',
    color: '#C5192D',
    targets: [
      { code: '4.1', title: 'Free, equitable primary & secondary education' },
      { code: '4.2', title: 'Quality early childhood development' },
      { code: '4.3', title: 'Equal access to technical & tertiary education' },
      { code: '4.4', title: 'Increase youth & adult skills for employment' },
      { code: '4.5', title: 'Eliminate education disparities' },
      { code: '4.6', title: 'Universal literacy and numeracy' },
      { code: '4.7', title: 'Education for sustainable development' },
    ],
  },
  {
    id: 5,
    name: 'Gender Equality',
    short: 'Achieve gender equality',
    color: '#FF3A21',
    targets: [
      { code: '5.1', title: 'End all forms of discrimination against women' },
      { code: '5.2', title: 'Eliminate violence against women and girls' },
      { code: '5.3', title: 'Eliminate harmful practices' },
      { code: '5.4', title: 'Recognize unpaid care and domestic work' },
      { code: '5.5', title: 'Ensure women’s full participation & leadership' },
      { code: '5.6', title: 'Universal access to reproductive health' },
    ],
  },
  {
    id: 6,
    name: 'Clean Water and Sanitation',
    short: 'Water and sanitation for all',
    color: '#26BDE2',
    targets: [
      { code: '6.1', title: 'Safe and affordable drinking water' },
      { code: '6.2', title: 'Adequate sanitation and hygiene' },
      { code: '6.3', title: 'Improve water quality, reduce pollution' },
      { code: '6.4', title: 'Increase water-use efficiency' },
      { code: '6.5', title: 'Integrated water resources management' },
      { code: '6.6', title: 'Protect water-related ecosystems' },
    ],
  },
  {
    id: 7,
    name: 'Affordable and Clean Energy',
    short: 'Sustainable energy for all',
    color: '#FCC30B',
    targets: [
      { code: '7.1', title: 'Universal access to modern energy' },
      { code: '7.2', title: 'Increase share of renewable energy' },
      { code: '7.3', title: 'Double the rate of energy efficiency' },
      { code: '7.a', title: 'Enhance international cooperation on energy' },
      { code: '7.b', title: 'Expand infrastructure for modern energy' },
    ],
  },
  {
    id: 8,
    name: 'Decent Work and Economic Growth',
    short: 'Inclusive growth and decent work',
    color: '#A21942',
    targets: [
      { code: '8.1', title: 'Sustain per capita economic growth' },
      { code: '8.2', title: 'Achieve higher economic productivity' },
      { code: '8.3', title: 'Promote development-oriented policies' },
      { code: '8.4', title: 'Improve resource efficiency in consumption' },
      { code: '8.5', title: 'Full employment and decent work' },
      { code: '8.6', title: 'Reduce youth not in employment/education' },
      { code: '8.7', title: 'Eradicate forced labour and child labour' },
      { code: '8.8', title: 'Protect labour rights and safe workplaces' },
    ],
  },
  {
    id: 9,
    name: 'Industry, Innovation and Infrastructure',
    short: 'Resilient infrastructure & innovation',
    color: '#FD6925',
    targets: [
      { code: '9.1', title: 'Develop quality, reliable infrastructure' },
      { code: '9.2', title: 'Promote inclusive sustainable industrialization' },
      { code: '9.3', title: 'Increase access of SMEs to finance' },
      { code: '9.4', title: 'Upgrade infrastructure, clean technologies' },
      { code: '9.5', title: 'Enhance scientific research & innovation' },
    ],
  },
  {
    id: 10,
    name: 'Reduced Inequalities',
    short: 'Reduce inequality within and among countries',
    color: '#DD1367',
    targets: [
      { code: '10.1', title: 'Achieve income growth of bottom 40%' },
      { code: '10.2', title: 'Empower and promote social inclusion' },
      { code: '10.3', title: 'Ensure equal opportunity, reduce inequalities' },
      { code: '10.4', title: 'Adopt fiscal & social protection policies' },
      { code: '10.7', title: 'Facilitate orderly, safe migration' },
    ],
  },
  {
    id: 11,
    name: 'Sustainable Cities and Communities',
    short: 'Inclusive, safe, resilient cities',
    color: '#FD9D24',
    targets: [
      { code: '11.1', title: 'Adequate, safe, affordable housing' },
      { code: '11.2', title: 'Safe, affordable, sustainable transport' },
      { code: '11.3', title: 'Inclusive urbanization and planning' },
      { code: '11.6', title: 'Reduce environmental impact of cities' },
      { code: '11.7', title: 'Universal access to green public spaces' },
    ],
  },
  {
    id: 12,
    name: 'Responsible Consumption and Production',
    short: 'Sustainable consumption & production',
    color: '#BF8B2E',
    targets: [
      { code: '12.2', title: 'Sustainable management of natural resources' },
      { code: '12.3', title: 'Halve global food waste' },
      { code: '12.4', title: 'Environmentally sound chemical management' },
      { code: '12.5', title: 'Reduce waste generation' },
      { code: '12.6', title: 'Encourage companies to adopt sustainable practices' },
      { code: '12.7', title: 'Promote sustainable public procurement' },
    ],
  },
  {
    id: 13,
    name: 'Climate Action',
    short: 'Combat climate change and its impacts',
    color: '#3F7E44',
    targets: [
      { code: '13.1', title: 'Strengthen resilience to climate hazards' },
      { code: '13.2', title: 'Integrate climate measures into policies' },
      { code: '13.3', title: 'Improve education & capacity on climate' },
      { code: '13.a', title: 'Implement UNFCCC commitments' },
      { code: '13.b', title: 'Promote climate planning in LDCs' },
    ],
  },
  {
    id: 14,
    name: 'Life Below Water',
    short: 'Conserve oceans, seas and marine resources',
    color: '#0A97D9',
    targets: [
      { code: '14.1', title: 'Prevent and reduce marine pollution' },
      { code: '14.2', title: 'Sustainably manage marine ecosystems' },
      { code: '14.4', title: 'Effectively regulate harvesting & overfishing' },
      { code: '14.5', title: 'Conserve coastal and marine areas' },
    ],
  },
  {
    id: 15,
    name: 'Life on Land',
    short: 'Protect terrestrial ecosystems',
    color: '#56C02B',
    targets: [
      { code: '15.1', title: 'Conserve terrestrial & freshwater ecosystems' },
      { code: '15.2', title: 'Sustainable forest management' },
      { code: '15.3', title: 'Combat desertification, restore land' },
      { code: '15.5', title: 'Halt biodiversity loss' },
      { code: '15.9', title: 'Integrate ecosystem values into planning' },
    ],
  },
  {
    id: 16,
    name: 'Peace, Justice and Strong Institutions',
    short: 'Peaceful, inclusive societies',
    color: '#00689D',
    targets: [
      { code: '16.1', title: 'Reduce all forms of violence' },
      { code: '16.3', title: 'Promote rule of law and equal access to justice' },
      { code: '16.5', title: 'Reduce corruption and bribery' },
      { code: '16.6', title: 'Develop effective, accountable institutions' },
      { code: '16.7', title: 'Ensure responsive, inclusive decision-making' },
    ],
  },
  {
    id: 17,
    name: 'Partnerships for the Goals',
    short: 'Strengthen means of implementation',
    color: '#19486A',
    targets: [
      { code: '17.1', title: 'Strengthen domestic resource mobilization' },
      { code: '17.6', title: 'Enhance North-South, South-South cooperation' },
      { code: '17.11', title: 'Significantly increase exports of developing countries' },
      { code: '17.16', title: 'Enhance multi-stakeholder partnerships' },
      { code: '17.17', title: 'Encourage effective public-private partnerships' },
    ],
  },
];

export function getSdgGoal(id: number | null | undefined): SdgGoal | null {
  if (id == null || !Number.isFinite(Number(id))) return null;
  return SDG_GOALS.find((g) => g.id === Number(id)) || null;
}

export function sdgTargetOptions(goalId: number): SdgTarget[] {
  return getSdgGoal(goalId)?.targets || [];
}
