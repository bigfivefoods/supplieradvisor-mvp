/**
 * Run: npx --yes tsx lib/b2c/advisor-ap-sync.test.ts
 */
import assert from 'node:assert/strict';
import {
  advisorApRefTag,
  collectAdvisorContractorPeople,
  isAdvisorContractorForAp,
} from './advisor-ap-sync';

assert.equal(
  advisorApRefTag('fitgraph_coach', 'coh_1'),
  'advisor_ap:fitgraph_coach:coh_1'
);

assert.equal(
  isAdvisorContractorForAp({
    id: 'coh_1',
    name: 'Alex',
    engagement: 'contractor',
  }),
  true
);
assert.equal(
  isAdvisorContractorForAp({
    id: 'coh_2',
    name: 'Pat',
    engagement: 'employed',
    hr_employee_id: 9,
  }),
  false
);
assert.equal(
  isAdvisorContractorForAp({
    id: 'coh_3',
    name: 'Gone',
    engagement: 'contractor',
    active: false,
  }),
  false
);

const roster = collectAdvisorContractorPeople({
  coaches: [
    { id: 'coh_1', name: 'Alex', engagement: 'contractor' },
    { id: 'coh_2', name: 'Sam', engagement: 'employed', hr_employee_id: 4 },
  ],
  clinics: [
    {
      kind: 'physiograph_practitioner',
      people: [{ id: 'prac_1', name: 'Dr Lee', engagement: 'contractor' }],
    },
    {
      kind: 'dentalgraph_staff',
      people: [{ id: 'stf_1', name: 'Dentist Jo', engagement: 'employed' }],
    },
  ],
});
assert.deepEqual(
  roster.map((r) => `${r.kind}:${r.person.id}`).sort(),
  ['fitgraph_coach:coh_1', 'physiograph_practitioner:prac_1']
);

console.log('advisor-ap-sync tests ok');
