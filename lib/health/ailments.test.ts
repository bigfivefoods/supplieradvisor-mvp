/**
 * Run: npx --yes tsx lib/health/ailments.test.ts
 */
import assert from 'node:assert/strict';
import { buildPatientMedicalShare } from '../clinic/medical-share';
import { mergeHealthProfile } from './body-map';
import {
  MEDICAL_AILMENTS,
  PHYSIO_AILMENTS,
  GYM_AILMENTS,
  DENTAL_AILMENTS,
  PSYCHIATRY_AILMENTS,
  ailmentsForModule,
  normalizeConditions,
} from './ailments';

assert.ok(PHYSIO_AILMENTS.length > 20);
assert.ok(GYM_AILMENTS.length > PHYSIO_AILMENTS.length);
assert.equal(ailmentsForModule('gym'), GYM_AILMENTS);
assert.ok(MEDICAL_AILMENTS.some((a) => a.label.includes('Hypertension')));
assert.ok(DENTAL_AILMENTS.some((a) => a.label.includes('Periodontitis')));
assert.ok(PSYCHIATRY_AILMENTS.some((a) => a.label.includes('anxiety')));

const clinical = mergeHealthProfile(null, {
  conditions: [
    { label: 'Hypertension', share: true, notes: 'On ACEI' },
    { label: 'HIV', share: false, notes: 'desk only' },
  ],
  diagnosis_notes: 'Private diagnosis',
  goals: 'Walk daily',
  share: {
    conditions: true,
    diagnosis_notes: false,
    goals: true,
  },
});
assert.equal(clinical.conditions?.length, 2);

const share = buildPatientMedicalShare({
  share_medical: true,
  clinical,
});
assert.ok(share);
const conds = share.conditions as Array<{ label: string }>;
assert.deepEqual(
  conds.map((c) => c.label),
  ['Hypertension']
);
assert.equal(share.diagnosis_notes, undefined);
assert.equal(share.goals, 'Walk daily');

const legacy = buildPatientMedicalShare({
  share_medical: true,
  clinical: { diagnosis_notes: 'Legacy shares all' },
});
assert.equal(legacy?.diagnosis_notes, 'Legacy shares all');

assert.equal(normalizeConditions([{ label: '  Knee  ' }])[0].label, 'Knee');

console.log('ailments.test.ts ok');
