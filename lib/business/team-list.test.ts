/**
 * Run: npx --yes tsx lib/business/team-list.test.ts
 */
import assert from 'node:assert/strict';
import { isListedTeamMember, teamLastLoginAt } from './types';

assert.equal(isListedTeamMember('active'), true);
assert.equal(isListedTeamMember('invited'), true);
assert.equal(isListedTeamMember('pending'), true);
assert.equal(isListedTeamMember(null), true);
assert.equal(isListedTeamMember('removed'), false);
assert.equal(isListedTeamMember('expired'), false);
assert.equal(isListedTeamMember('suspended'), false);
assert.equal(isListedTeamMember('REMOVED'), false);

assert.equal(
  teamLastLoginAt({
    last_active_at: '2026-08-24T10:00:00.000Z',
    joined_at: '2026-01-01T00:00:00.000Z',
  }),
  '2026-08-24T10:00:00.000Z'
);
assert.equal(
  teamLastLoginAt({ last_active_at: null, joined_at: '2026-01-01T00:00:00.000Z' }),
  '2026-01-01T00:00:00.000Z'
);
assert.equal(teamLastLoginAt({ last_active_at: null, joined_at: null }), null);

console.log('team-list.test.ts ok');
