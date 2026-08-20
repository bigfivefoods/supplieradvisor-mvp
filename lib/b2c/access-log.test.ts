/**
 * Run: npx --yes tsx lib/b2c/access-log.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyAccessTouch,
  B2C_SESSION_GAP_MS,
  formatDurationMs,
  normalizeSurface,
  touchB2cAccessOnProfile,
} from './access-log';
import type { B2cProfile } from './types';

assert.equal(normalizeSurface(null, '/me'), 'sa_member');
assert.equal(normalizeSurface(null, '/me/'), 'sa_member');
assert.equal(normalizeSurface(null, '/member/fitgraph/abc'), 'gym');
assert.equal(normalizeSurface('hire', '/x'), 'hire');
assert.equal(formatDurationMs(0), '—');
assert.equal(formatDurationMs(12_000), '12s');
assert.equal(formatDurationMs(5 * 60_000), '5m');
assert.equal(formatDurationMs(90 * 60_000), '1h 30m');

const t0 = new Date('2026-08-20T10:00:00.000Z');
const first = applyAccessTouch({}, { at: t0, surface: 'sa_member', path: '/me' });
assert.equal(first.changed, true);
assert.equal(first.access.session_count, 1);
assert.equal(first.access.visit_count, 1);
assert.equal(first.access.last_surface, 'sa_member');
assert.equal(first.access.total_active_ms, 0);

const t1 = new Date(t0.getTime() + 10_000);
const throttled = applyAccessTouch(
  { access: first.access },
  { at: t1, surface: 'sa_member', path: '/me' }
);
assert.equal(throttled.changed, false);

const t2 = new Date(t0.getTime() + 2 * 60_000);
const continued = applyAccessTouch(
  { access: first.access },
  { at: t2, surface: 'sa_member', path: '/me', display: 'standalone' }
);
assert.equal(continued.changed, true);
assert.equal(continued.access.session_count, 1);
assert.equal(continued.access.total_active_ms, 2 * 60_000);
assert.equal(continued.access.last_display, 'standalone');

const t3 = new Date(t2.getTime() + B2C_SESSION_GAP_MS + 1_000);
const nextSession = applyAccessTouch(
  { access: continued.access },
  { at: t3, surface: 'gym', path: '/member/fitgraph/x' }
);
assert.equal(nextSession.access.session_count, 2);
assert.equal(nextSession.access.last_login_at, t3.toISOString());
assert.equal(nextSession.access.last_surface, 'gym');
assert.ok(nextSession.access.surfaces.gym.visits >= 1);

const profile: B2cProfile = {
  user_id: 'did:privy:test',
  email: 'a@b.com',
  memberships: [],
  metadata: {},
};
const touched = touchB2cAccessOnProfile(profile, {
  at: t0,
  surface: 'sa_member',
  path: '/me',
});
assert.equal(touched.changed, true);
assert.equal(
  (touched.profile.metadata?.access as { last_surface?: string })?.last_surface,
  'sa_member'
);

console.log('access-log tests ok');
