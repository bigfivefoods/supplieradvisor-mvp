/**
 * Run: npx --yes tsx lib/messaging/user-inbox.test.ts
 */
import assert from 'node:assert/strict';
import {
  threadVisibleToPlatformUser,
  threadsForPlatformUser,
} from './user-inbox';
import type { CompanyThread } from './company-inbox';

const me = 'did:privy:craig';
const them = 'did:privy:other';

function thread(
  id: string,
  people: Array<{ kind: 'user' | 'desk'; ref_id: string }>
): CompanyThread {
  return {
    id,
    channel: 'colleague',
    subject: id,
    company_ids: [1],
    participants: people.map((p) => ({
      kind: p.kind,
      ref_id: p.ref_id,
      company_id: 1,
      name: p.ref_id,
    })),
    messages: [
      {
        id: `${id}-m`,
        body: 'hi',
        author: {
          kind: people[0].kind,
          ref_id: people[0].ref_id,
          company_id: 1,
          name: 'A',
        },
        created_at: '2026-08-20T10:00:00.000Z',
      },
    ],
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z',
  };
}

const mine = thread('mine', [
  { kind: 'user', ref_id: me },
  { kind: 'user', ref_id: them },
]);
const theirs = thread('theirs', [{ kind: 'user', ref_id: them }]);
const deskWide = thread('desk', [{ kind: 'desk', ref_id: 'desk' }]);
const authored = thread('authored', [{ kind: 'desk', ref_id: 'desk' }]);
authored.messages[0].author = {
  kind: 'user',
  ref_id: 'craig',
  company_id: 1,
  name: 'Craig',
};

assert.equal(threadVisibleToPlatformUser(mine, me), true);
assert.equal(threadVisibleToPlatformUser(theirs, me), false);
assert.equal(threadVisibleToPlatformUser(deskWide, me), false);
assert.equal(threadVisibleToPlatformUser(authored, me), true);

const visible = threadsForPlatformUser([mine, theirs, deskWide, authored], me);
assert.deepEqual(
  visible.map((t) => t.id).sort(),
  ['authored', 'mine']
);

console.log('user-inbox visibility tests ok');
