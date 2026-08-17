/**
 * Run: npx --yes tsx lib/fitness/session-scheduled-by.test.ts
 */
import assert from 'node:assert/strict';
import { sessionScheduledBy } from './fitgraph';

assert.equal(sessionScheduledBy({ origin: 'coach' }), 'coach');
assert.equal(sessionScheduledBy({ origin: 'owner' }), 'owner');
assert.equal(sessionScheduledBy({ origin: 'series' }), 'owner');
assert.equal(sessionScheduledBy({}), 'owner');

console.log('session-scheduled-by.test.ts ok');
