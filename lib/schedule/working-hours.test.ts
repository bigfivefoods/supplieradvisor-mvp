/**
 * Run: npx --yes tsx lib/schedule/working-hours.test.ts
 */
import assert from 'node:assert/strict';
import { compactWorkingHours, defaultWorkingHours } from './working-hours';

const rows = compactWorkingHours(defaultWorkingHours());
assert.equal(rows[0]?.days, 'Mon–Fri');
assert.equal(rows[0]?.hours, '08:00–17:00');
assert.equal(rows[1]?.days, 'Sat');
assert.equal(rows[1]?.hours, '08:00–13:00');
assert.equal(rows[2]?.days, 'Sun');
assert.equal(rows[2]?.hours, 'Closed');

console.log('working-hours compact: ok');
