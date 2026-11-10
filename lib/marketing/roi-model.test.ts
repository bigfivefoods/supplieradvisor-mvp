import assert from 'node:assert/strict';
import { calculateRoiModel, DEFAULT_ROI_INPUTS } from '@/lib/marketing/roi-model';

const result = calculateRoiModel(DEFAULT_ROI_INPUTS);

assert.equal(result.labourMonth, 72744);
assert.equal(result.toolsMonth, 6000);
assert.equal(result.wasteMonth, 78744);
assert.equal(result.reclaimed, 47283.6);
assert.equal(result.toolsSaved, 3300.0000000000005);
assert.equal(result.monthlyGain, 50284.6);
assert.equal(result.annualGain, 603415.2);
assert.equal(result.hoursReclaimed, 135.096);
assert.equal(result.saCost, 299);

console.log('roi-model.test.ts ok');
