/**
 * Run: npx --yes tsx lib/b2c/member-account.test.ts
 */
import assert from 'node:assert/strict';
import { chargeMatchesMember, chargesForMember } from './member-account';
import {
  emptyMemberAccountStore,
  type MemberAccountCharge,
} from './member-account-types';

function charge(
  patch: Partial<MemberAccountCharge> & Pick<MemberAccountCharge, 'id'>
): MemberAccountCharge {
  return {
    kind: 'physio',
    ref_id: 'pat_1',
    member_name: 'Ada',
    member_email: 'ada@example.com',
    description: 'Consult',
    amount_zar: 850,
    status: 'open',
    created_at: '2026-08-19T10:00:00.000Z',
    source: 'visit',
    ...patch,
  };
}

const store = {
  ...emptyMemberAccountStore(),
  charges: [
    charge({ id: 'a' }),
    charge({
      id: 'b',
      kind: 'medical',
      ref_id: 'pat_other',
      member_email: 'ada@example.com',
    }),
    charge({
      id: 'c',
      ref_id: 'pat_2',
      member_email: 'other@example.com',
      member_user_id: 'did:privy:ada',
    }),
  ],
};

assert.equal(
  chargesForMember(store, { kind: 'physio', ref_id: 'pat_1' }).map((c) => c.id).join(),
  'a'
);
assert.equal(
  chargesForMember(store, {
    kind: 'physio',
    email: 'ada@example.com',
  }).map((c) => c.id).join(),
  'a'
);
assert.equal(
  chargesForMember(store, { email: 'ada@example.com' })
    .map((c) => c.id)
    .sort()
    .join(),
  'a,b'
);
assert.equal(
  chargesForMember(store, { userId: 'did:privy:ada' }).map((c) => c.id).join(),
  'c'
);
assert.equal(
  chargeMatchesMember(store.charges[0], { kind: 'gym', email: 'ada@example.com' }),
  false
);
assert.equal(chargesForMember(store, {}).length, 0);

console.log('member-account.test.ts ok');
