/**
 * Run: npx --yes tsx lib/portals/portal-activity.test.ts
 */
import assert from 'node:assert/strict';
import {
  firstPortalInvite,
  latestPortalLogin,
  portalTimeAgo,
} from './portal-activity';

const now = Date.parse('2026-08-24T12:00:00.000Z');
assert.equal(portalTimeAgo(null, now), null);
assert.equal(portalTimeAgo('2026-08-24T11:59:30.000Z', now), 'just now');
assert.equal(portalTimeAgo('2026-08-24T11:40:00.000Z', now), '20 min ago');
assert.equal(portalTimeAgo('2026-08-24T09:00:00.000Z', now), '3h ago');
assert.equal(portalTimeAgo('2026-08-22T12:00:00.000Z', now), '2d ago');

assert.equal(latestPortalLogin([]), null);
assert.deepEqual(
  latestPortalLogin([
    { name: 'Ada', last_seen_at: '2026-08-01T00:00:00.000Z' },
    { name: 'Ben', last_seen_at: null },
    { name: 'Cara', last_seen_at: '2026-08-20T00:00:00.000Z' },
  ]),
  { at: '2026-08-20T00:00:00.000Z', name: 'Cara' }
);

assert.equal(
  firstPortalInvite([
    { invited_at: '2026-08-12T00:00:00.000Z' },
    { invited_at: '2026-07-01T00:00:00.000Z' },
    { invited_at: null },
  ]),
  '2026-07-01T00:00:00.000Z'
);

console.log('portal-activity.test.ts ok');
