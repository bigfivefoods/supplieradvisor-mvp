/**
 * Run: npx --yes tsx lib/b2c/member-account.test.ts
 */
import assert from 'node:assert/strict';
import {
  chargeMatchesMember,
  chargesForMember,
  gymAccountPeople,
  isSuggestionBilled,
  openChargesCoveredByAmount,
  paymentsForMember,
  writeMemberAccountStore,
} from './member-account';
import {
  emptyMemberAccountStore,
  type MemberAccountCharge,
} from './member-account-types';
import { emptyFitgraphStore, writeFitgraphToMetadata } from '@/lib/fitness/fitgraph';
import { groupPortalStatements } from './member-account-portal';

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

const payStore = {
  ...emptyMemberAccountStore(),
  charges: [charge({ id: 'a' })],
  payments: [
    {
      id: 'p1',
      charge_ids: ['a'],
      amount_zar: 850,
      method: 'eft' as const,
      status: 'confirmed' as const,
      paid_at: '2026-08-20T10:00:00.000Z',
      ref_id: 'pat_1',
    },
  ],
};
assert.equal(paymentsForMember(payStore, { ref_id: 'pat_1' }).length, 1);

const open = [
  charge({ id: 'o1', amount_zar: 400, created_at: '2026-08-01T00:00:00Z' }),
  charge({ id: 'o2', amount_zar: 400, created_at: '2026-08-02T00:00:00Z' }),
  charge({ id: 'o3', amount_zar: 400, created_at: '2026-08-03T00:00:00Z' }),
];
assert.equal(openChargesCoveredByAmount(open, 800).map((c) => c.id).join(), 'o1,o2');
assert.equal(openChargesCoveredByAmount(open, 100).length, 0);

const billed = new Set(['mem:c1:2026-08']);
assert.equal(isSuggestionBilled(billed, 'mem:c1:2026-08:class'), true);
assert.equal(isSuggestionBilled(billed, 'mem:c1:2026-08:private'), true);
assert.equal(isSuggestionBilled(billed, 'mem:c2:2026-08:class'), false);

const gym = emptyFitgraphStore();
gym.clients.push(
  {
    id: 'm1',
    name: 'Ada',
    code: 'A',
    created_at: '',
    updated_at: '',
    membership_plan_id: 'p1',
  } as never,
  {
    id: 'p1',
    name: 'Bea',
    code: 'B',
    created_at: '',
    updated_at: '',
    private_client: true,
    private_rate_zar: 1200,
  } as never,
  {
    id: 'l1',
    name: 'Cam',
    code: 'C',
    created_at: '',
    updated_at: '',
    active: false,
  } as never
);
const people = gymAccountPeople(writeFitgraphToMetadata({}, gym));
assert.equal(people.find((p) => p.ref_id === 'm1')?.group, 'member');
assert.equal(people.find((p) => p.ref_id === 'p1')?.group, 'private');
assert.equal(people.find((p) => p.ref_id === 'l1')?.group, 'left');

const stmts = groupPortalStatements({
  charges: [
    {
      id: 'c1',
      description: 'August membership',
      amount_zar: 800,
      status: 'paid',
      created_at: '2026-08-01T00:00:00Z',
      due_date: '2026-08-01',
    },
  ],
  payments: [
    {
      id: 'pay1',
      amount_zar: 800,
      method: 'eft',
      status: 'confirmed',
      paid_at: '2026-08-03T00:00:00Z',
    },
  ],
});
assert.equal(stmts[0]?.label, 'August 2026');
assert.equal(stmts[0]?.charges.length, 1);
assert.equal(stmts[0]?.payments.length, 1);

const persisted = writeMemberAccountStore({}, payStore);
assert.ok((persisted.member_accounts as { charges: unknown[] }).charges.length);

console.log('member-account.test.ts ok');
