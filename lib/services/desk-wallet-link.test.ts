/**
 * Run: npx --yes tsx lib/services/desk-wallet-link.test.ts
 */
import assert from 'node:assert/strict';
import { namesLikelySame } from './desk-wallet-link';
import { parseServiceMemberInviteToken } from './member-invite';

assert.equal(namesLikelySame('Craig', 'Craig Richardson'), true);
assert.equal(namesLikelySame('Craig Richardson', 'Craig'), true);
assert.equal(namesLikelySame('craig', 'Craig'), true);
assert.equal(namesLikelySame('Sam', 'Alex'), false);
assert.equal(namesLikelySame('', 'Craig'), false);
assert.equal(namesLikelySame('craig', 'craig'), true);

const psy = parseServiceMemberInviteToken(
  'sinv_psy_5746_abc123_def4567890'
);
assert.equal(psy.module, 'psychiatrygraph');
assert.equal(psy.companyId, 5746);
const med = parseServiceMemberInviteToken('sinv_med_1_x_yyyyyyyyyy');
assert.equal(med.module, 'medicalgraph');

console.log('desk-wallet-link tests ok');
