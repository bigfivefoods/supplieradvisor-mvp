/**
 * Member directory counts, filters, duplicates and the dry-run clean-up.
 * Run: npx --yes tsx lib/fitness/member-directory.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyFitgraphStore, type FitClient } from '@/lib/fitness/fitgraph';
import { mergeKeptFitClients } from '@/lib/fitness/merge-fit-clients';
import {
  buildMemberCleanupReport,
  findPossibleDuplicates,
  formatMemberCleanupReport,
  isPrivateClient,
  memberRole,
  normalizePhoneE164,
  queryMemberDirectory,
  validateMemberFields,
} from '@/lib/fitness/member-directory';

const TODAY = '2026-10-29';

function person(partial: Partial<FitClient> & { id: string; name: string }): FitClient {
  return {
    code: partial.id,
    active: true,
    membership_status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function book() {
  const store = emptyFitgraphStore();
  store.coaches.push({
    id: 'coh_a',
    code: 'A',
    name: 'Coach A',
    specialties: [],
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  });
  store.class_types.push({
    id: 'type_spin',
    code: 'SPIN',
    name: 'Spin',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  });
  store.membership_plans.push({
    id: 'plan_spin',
    code: 'SPIN',
    name: 'Spin class',
    price_zar: 100,
    billing: 'monthly',
    class_type_ids: ['type_spin'],
    default_coach_id: 'coh_a',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  });
  store.clients.push(
    person({
      id: 'p1',
      name: 'Private Only',
      private_client: true,
      coach_id: 'coh_a',
      email: 'private@example.com',
      phone: '0821111111',
    }),
    person({
      id: 'c1',
      name: 'Class Only',
      membership_plan_id: 'plan_spin',
      email: 'class@example.com',
    }),
    person({
      id: 'b1',
      name: 'Both People',
      private_client: true,
      coach_id: 'coh_a',
      coach_ids: ['coh_a'],
      membership_plan_id: 'plan_spin',
    }),
    person({
      id: 'n1',
      name: 'Neither Person',
      email: 'neither@example.com',
    }),
    person({
      id: 'i1',
      name: 'Inactive Person',
      active: false,
      membership_status: 'cancelled',
    }),
    person({
      id: 'flag',
      name: 'Flagged No Coach',
      private_client: true,
      phone: '12',
    })
  );
  return store;
}

const store = book();
const all = queryMemberDirectory(store, {
  status: 'all',
  role: 'all',
  page: 1,
  pageSize: 2,
  today: TODAY,
});

assert.equal(
  all.counts.private + all.counts.class + all.counts.both + all.counts.neither,
  all.counts.people
);
assert.equal(all.counts.active + all.counts.inactive, all.counts.people);
assert.equal(all.counts.people, 6);
assert.equal(all.counts.private, 1);
assert.equal(all.counts.class, 1);
assert.equal(all.counts.both, 1);
assert.equal(all.counts.neither, 3);
assert.equal(all.counts.active, 5);
assert.equal(all.counts.inactive, 1);
assert.equal(all.matching, 6);
assert.equal(all.clients.length, 2);
assert.equal(all.pages, 3);
assert.equal(all.counts.people, queryMemberDirectory(store, {
  status: 'all',
  role: 'all',
  page: 2,
  pageSize: 2,
  today: TODAY,
}).counts.people);

const page2 = queryMemberDirectory(store, {
  status: 'all',
  role: 'all',
  page: 2,
  pageSize: 2,
  today: TODAY,
});
assert.equal(page2.clients.length, 2);
assert.ok(!page2.clients.some((c) => all.clients.some((a) => a.id === c.id)));

const priv = queryMemberDirectory(store, {
  status: 'all',
  role: 'private',
  pageSize: 50,
  today: TODAY,
});
assert.equal(priv.matching, all.counts.private);
assert.ok(priv.clients.every((c) => memberRole(c, store, TODAY) === 'private'));
assert.ok(!priv.clients.some((c) => c.id === 'b1'));

const klass = queryMemberDirectory(store, {
  status: 'all',
  role: 'class',
  pageSize: 50,
  today: TODAY,
});
assert.equal(klass.matching, 1);
assert.equal(klass.clients[0].id, 'c1');
assert.deepEqual(klass.rows[0].class_type_ids, ['type_spin']);

const both = queryMemberDirectory(store, {
  status: 'all',
  role: 'both',
  pageSize: 50,
  today: TODAY,
});
assert.equal(both.matching, 1);
assert.equal(both.clients[0].id, 'b1');

const neither = queryMemberDirectory(store, {
  status: 'all',
  role: 'neither',
  pageSize: 50,
  today: TODAY,
});
assert.equal(neither.matching, 3);

const active = queryMemberDirectory(store, {
  status: 'active',
  role: 'all',
  pageSize: 50,
  today: TODAY,
});
assert.equal(active.matching, all.counts.active);
assert.ok(active.clients.every((c) => c.id !== 'i1'));

const inactive = queryMemberDirectory(store, {
  status: 'inactive',
  role: 'all',
  pageSize: 50,
  today: TODAY,
});
assert.equal(inactive.matching, 1);
assert.equal(inactive.clients[0].id, 'i1');

const byClass = queryMemberDirectory(store, {
  status: 'all',
  classId: 'plan_spin',
  pageSize: 50,
  today: TODAY,
});
assert.equal(byClass.matching, 2);
assert.deepEqual(byClass.clients.map((c) => c.id).sort(), ['b1', 'c1']);

const byType = queryMemberDirectory(store, {
  status: 'all',
  classId: 'type_spin',
  pageSize: 50,
  today: TODAY,
});
assert.equal(byType.matching, 2);

const byCoach = queryMemberDirectory(store, {
  status: 'all',
  coachId: 'coh_a',
  pageSize: 50,
  today: TODAY,
});
assert.ok(byCoach.matching >= 3);
assert.ok(byCoach.clients.some((c) => c.id === 'p1'));

const search = queryMemberDirectory(store, {
  status: 'all',
  q: 'neither@example.com',
  pageSize: 50,
  today: TODAY,
});
assert.equal(search.matching, 1);
assert.equal(search.clients[0].id, 'n1');

assert.equal(isPrivateClient(store.clients.find((c) => c.id === 'flag')!), false);
assert.equal(memberRole(store.clients.find((c) => c.id === 'flag')!, store, TODAY), 'neither');

const phoneBad = normalizePhoneE164('12');
assert.equal(phoneBad.ok, false);
const phoneOk = normalizePhoneE164('0821111111');
assert.equal(phoneOk.ok && phoneOk.e164, '+27821111111');

const badName = validateMemberFields({ name: 'A' }, { requireName: true });
assert.equal(badName.ok, false);
const badMail = validateMemberFields({ email: 'not-an-email' });
assert.equal(badMail.ok, false);
const good = validateMemberFields({
  name: 'Ada Example',
  email: 'Ada@Example.com',
  phone: '0820000000',
  id_number: '9102060069080',
  date_of_birth: '1991-02-06',
});
assert.equal(good.ok, true);
if (good.ok) {
  assert.equal(good.value.email, 'ada@example.com');
  assert.equal(good.value.phone, '+27820000000');
}

const dupStore = book();
const hits = findPossibleDuplicates(dupStore, {
  name: 'New Person',
  email: 'private@example.com',
});
assert.equal(hits.length, 1);
assert.equal(hits[0].client_id, 'p1');
assert.ok(hits[0].reasons.includes('email'));

dupStore.clients.push(
  person({
    id: 'bianca_a',
    name: 'Bianca Westhorpe-Pottow',
    email: 'bianca.one@example.com',
    phone: '0831111111',
  }),
  person({
    id: 'bianca_b',
    name: 'Bianca Westhorpe Pottow',
    email: 'bianca.two@example.com',
    phone: '0832222222',
    date_of_birth: '1990-01-02',
  }),
  person({
    id: 'hawa',
    name: 'Hawa Ismail',
    email: 'shared@example.com',
    phone: '0840000000',
  }),
  person({
    id: 'zubeida',
    name: 'Zubeida Akoob',
    email: 'shared@example.com',
    phone: '0840000000',
  })
);

const report = buildMemberCleanupReport(dupStore, TODAY);
const bianca = report.merges.find((m) =>
  [m.keeper_name, ...m.donor_names].some((n) => /bianca/i.test(n))
);
assert.ok(bianca, 'Bianca Westhorpe-Pottow pair is a proposed merge');
assert.equal(bianca.donor_ids.length + 1, 2);
assert.ok(
  report.manual_reviews.some((r) => /Hawa Ismail/i.test(r.reason) && /Zubeida/i.test(r.reason))
);
assert.ok(
  !report.merges.some((m) =>
    [m.keeper_name, ...m.donor_names].some((n) => /hawa|zubeida/i.test(n))
  )
);
assert.ok(report.private_flag_fixes.some((r) => r.id === 'flag' && r.action === 'clear_flag'));
assert.ok(report.invalid_phones.some((r) => r.id === 'flag'));
assert.ok(report.phone_normalisations.some((r) => r.to.startsWith('+27')));
assert.ok(report.class_type_backfill.some((r) => r.id === 'c1'));
const text = formatMemberCleanupReport(report);
assert.match(text, /DRY RUN/);
assert.match(text, /Bianca/);
assert.match(text, /Do not auto-merge/);
assert.doesNotMatch(text, /INSERT|UPDATE|DELETE/i);

const merged = mergeKeptFitClients(dupStore, {
  keeper_id: 'bianca_a',
  donor_ids: ['bianca_b'],
  now: '2026-10-29T00:00:00.000Z',
});
assert.ok(!('error' in merged));
assert.equal(dupStore.clients.some((c) => c.id === 'bianca_b'), false);
assert.ok((dupStore.member_merge_audit || []).length >= 1);

const clientsPage = readFileSync('app/dashboard/fitgraph/clients/page.tsx', 'utf8');
const allocate = readFileSync('components/fitness/MemberAllocateTable.tsx', 'utf8');
assert.match(clientsPage, /GymMemberQuality/);
assert.match(clientsPage, /possible duplicate/i);
assert.match(allocate, /Private client/);
assert.match(allocate, /Class member/);
assert.match(allocate, /Neither/);
assert.match(allocate, /directory/);
assert.match(allocate, /pageSize/);
assert.match(allocate, /Filter by coach/);
assert.match(allocate, /Filter by class/);

const auditSql = readFileSync('scripts/gym-audit.sql', 'utf8');
assert.match(auditSql, /SELECT/i);
assert.doesNotMatch(
  auditSql,
  /\b(insert|update|delete|drop|alter|truncate|create)\b/i
);
const cleanup = readFileSync('scripts/gym-member-cleanup-dry-run.ts', 'utf8');
assert.match(cleanup, /Refusing to apply/);
assert.match(cleanup, /onkklullmgrdqoertngp/);
assert.doesNotMatch(cleanup, /\.update\(|\.upsert\(|\.insert\(/);

console.log('member-directory.test.ts ok');
