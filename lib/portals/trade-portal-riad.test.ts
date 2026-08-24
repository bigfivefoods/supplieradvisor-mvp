/**
 * Run: npx --yes tsx lib/portals/trade-portal-riad.test.ts
 */
import assert from 'node:assert/strict';
import {
  parsePortalTaskRiadId,
  portalTaskRiadMark,
  stripPortalTaskRiadMark,
} from './trade-portal';

const mark = portalTaskRiadMark(44);
assert.equal(parsePortalTaskRiadId(mark), 44);
assert.equal(parsePortalTaskRiadId(`${mark}\nOwner note`), 44);
assert.equal(stripPortalTaskRiadMark(`${mark}\nOwner note`), 'Owner note');
assert.equal(parsePortalTaskRiadId('plain notes'), null);
console.log('trade-portal-riad.test.ts ok');
