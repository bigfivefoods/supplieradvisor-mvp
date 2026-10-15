/**
 * FleetAdvisor® portal tokens and the throttle classifier.
 * Run: npx --yes tsx lib/fleet/brief114-tokens.test.ts
 */
import assert from 'node:assert/strict';
import { digestsMatch, hashPortalToken, isPortalTokenShape, newPortalToken, portalTokenHint } from './tokens';
import { throttleDecision } from './portal-throttle';

const first = newPortalToken();
const second = newPortalToken();
assert.match(first, /^fgp_[0-9a-f]{64}$/);
assert.notEqual(first, second);
assert.equal(portalTokenHint(first), first.slice(-4));
assert.equal(portalTokenHint(first).length, 4);
const hash = hashPortalToken(first);
assert.equal(hash.length, 64);
assert.equal(digestsMatch(hash, hashPortalToken(first)), true);
assert.equal(digestsMatch(hash, hashPortalToken(second)), false);
assert.equal(digestsMatch(hash, 'ab'), false);
assert.equal(isPortalTokenShape(first), true);
assert.equal(isPortalTokenShape('fgp_abcd'), false);

assert.equal(throttleDecision({ companyId: null, scope: 'email', keyHash: 'a', emailOrInviteCount: 0, workspaceCount: 0 }), true);
assert.equal(throttleDecision({ companyId: 1, scope: '', keyHash: 'a', emailOrInviteCount: 0, workspaceCount: 0 }), true);
assert.equal(throttleDecision({ companyId: 1, scope: 'email', keyHash: ' ', emailOrInviteCount: 0, workspaceCount: 0 }), true);
assert.equal(throttleDecision({ companyId: 1, scope: 'email', keyHash: 'a', emailOrInviteCount: null, workspaceCount: 0 }), true);
assert.equal(throttleDecision({ companyId: 1, scope: 'email', keyHash: 'a', emailOrInviteCount: 11, workspaceCount: 11 }), true);
assert.equal(throttleDecision({ companyId: 1, scope: 'invite', keyHash: 'a', emailOrInviteCount: 1, workspaceCount: 51 }), true);
assert.equal(throttleDecision({ companyId: 1, scope: 'email', keyHash: 'a', emailOrInviteCount: 10, workspaceCount: 50 }), false);

console.log('brief114-tokens.test.ts ok');
