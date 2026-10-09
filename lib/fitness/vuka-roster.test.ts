/**
 * Run: npx --yes tsx lib/fitness/vuka-roster.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { ensureVukaClassCatalog, VUKA_COMPANY_ID } from './vuka-class-catalog';
import {
  FIXTURE_ROSTER,
  FIXTURE_VUKA_SEED,
} from './vuka-member-seed.fixture';
import {
  absorbKnownClientAliases,
  clientsAreSamePerson,
  ensureVukaRoster,
  matchCatalogPlan,
  matchClassHint,
  mergeDuplicateFitClients,
  normalizePersonName,
  vukaDeskSettled,
  VUKA_BILLED_CLASS_IMPORT,
  VUKA_CONTRACTS_IMPORT,
  VUKA_MEMBER_MERGE,
} from './vuka-roster';

const seed = FIXTURE_VUKA_SEED;
const rosterOpts = { now: '2026-08-17T12:00:00.000Z', seed };

assert.equal(normalizePersonName('Sam (S Sample)'), 'sam');
assert.equal(normalizePersonName('QUINN NORTH'), 'quinn north');
assert.equal(normalizePersonName('Yuné Sample'), 'yune sample');
assert.equal(normalizePersonName("Blair O’Fixture"), 'blair ofixture');
assert.equal(FIXTURE_ROSTER.length, 8);
assert.equal(
  FIXTURE_ROSTER.filter((r) => normalizePersonName(r.name) === 'morgan sample')
    .length,
  1
);
assert.equal(
  FIXTURE_ROSTER.some((r) => r.name === 'Morgan Sample'),
  true
);
assert.equal(
  FIXTURE_ROSTER.filter((r) => /samples/i.test(r.name)).length,
  0
);

assert.equal(matchCatalogPlan(1140)?.code, 'VUKA_UNLIM');
assert.equal(matchCatalogPlan(1265)?.code, 'VUKA_PILATES_3');
assert.equal(matchCatalogPlan(855)?.code, 'VUKA_PILATES_2');
assert.equal(matchCatalogPlan(530)?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(529)?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(530, 'Example kids class')?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(770.5), null);
assert.equal(matchCatalogPlan(775), null);
assert.equal(matchClassHint('5AM MWF')?.code, 'VUKA_FSF_5AM');
assert.equal(matchClassHint('BC')?.code, 'VUKA_BOOT_1730');
assert.equal(matchClassHint('KAKB')?.code, 'VUKA_KB_1630');
assert.equal(matchClassHint('PILATES')?.code, 'VUKA_PILATES_2');
assert.equal(matchClassHint('KIDS')?.code, 'VUKA_KIDS');
assert.equal(matchClassHint('5AM T TH')?.code, 'VUKA_GENTS_5AM');
assert.equal(matchClassHint('6:00 AM')?.code, 'VUKA_KB_6AM');
assert.equal(matchCatalogPlan(775, '5AM MWF')?.code, 'VUKA_FSF_5AM');
assert.equal(matchCatalogPlan(855, 'PILATES')?.code, 'VUKA_PILATES_2');

const store = emptyFitgraphStore();
ensureVukaClassCatalog(store, { companyId: VUKA_COMPANY_ID });
const first = ensureVukaRoster(store, rosterOpts);
assert.equal(first.changed, true);
assert.equal(first.added, 4);
assert.ok(store.clients.some((c) => /riley fixture/i.test(c.name)));
assert.ok(store.clients.some((c) => /eden private/i.test(c.name)));
const riley = store.clients.find((c) => /riley fixture/i.test(c.name))!;
assert.ok((riley.contracts || []).length >= 1);
assert.equal(riley.contracts?.[0].parq != null, true);
const blair = store.clients.find((c) => /blair fixture/i.test(c.name));
assert.ok(blair?.debit_bank?.account_number);
assert.equal(blair?.debit_bank?.account_number, '0001112223');
assert.ok(blair?.debit_bank?.bank_name);
assert.equal(
  store.membership_plans.some(
    (p) => String(p.code || '').startsWith('VUKA_DESK_')
  ),
  false
);
assert.equal(store.settings?.vuka_contracts_import, VUKA_CONTRACTS_IMPORT);

store.membership_plans.push({
  id: 'vuka_pln_desk_99900',
  code: 'VUKA_DESK_99900',
  name: 'VUKA membership · R999.00',
  price_zar: 999,
  billing: 'monthly',
  public: false,
  catalog: 'vuka',
  created_at: '2026-08-17T12:00:00.000Z',
});
const cleaned = ensureVukaRoster(store, rosterOpts);
assert.equal(cleaned.changed, true);
assert.equal(
  store.membership_plans.some((p) => String(p.code || '').startsWith('VUKA_DESK_')),
  false
);

const rileyPlan = store.clients.find((c) => /riley fixture/i.test(c.name));
assert.ok(rileyPlan);
assert.equal(rileyPlan?.membership_plan_id, 'vuka_pln_fsf_5am');
const sam = store.clients.find((c) => /^sam sample$/i.test(c.name));
assert.ok(sam);
assert.equal(sam?.membership_plan_id, 'vuka_pln_pilates_2');
const quinn = store.clients.find((c) => /quinn north/i.test(c.name));
assert.ok(quinn);
assert.equal(quinn?.membership_plan_id, 'vuka_pln_gents_5am');

const again = ensureVukaRoster(store, rosterOpts);
assert.equal(again.added, 0);
assert.equal(store.clients.filter((c) => c.active !== false).length, 9);

for (const row of FIXTURE_ROSTER) {
  const hit = store.clients.find(
    (c) =>
      c.active !== false &&
      clientsAreSamePerson(c, {
        id: `probe_${row.name}`,
        code: '',
        name: row.name,
        created_at: '',
        updated_at: '',
      })
  );
  assert.ok(hit, `missing billed member ${row.name}`);
}

assert.equal(
  store.clients.filter(
    (c) => c.active !== false && /^sam sample$/i.test(normalizePersonName(c.name))
  ).length,
  1
);

assert.ok(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Sam (S Sample)',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Sam Sample',
      created_at: '',
      updated_at: '',
    }
  )
);
assert.equal(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Sam North',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Sam South',
      created_at: '',
      updated_at: '',
    }
  ),
  false
);
assert.equal(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Brett van North',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Yune van North',
      created_at: '',
      updated_at: '',
    }
  ),
  false
);
assert.ok(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Morgan Samples',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Morgan Sample',
      created_at: '',
      updated_at: '',
    }
  )
);
assert.equal(
  store.clients.filter((c) => /sample/i.test(c.name) && c.active !== false)
    .length >= 1,
  true
);

const leftover = emptyFitgraphStore();
leftover.clients = [
  {
    id: 'vuka_cli_morgan_samples',
    code: 'VUKA-001',
    name: 'Morgan Samples',
    active: true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cli_morgan',
    code: 'VUKA-002',
    name: 'Morgan Sample',
    email: 'morgan.sample@example.test',
    active: true,
    contracts: [{ id: 'con_m', kind: 'group', source_id: 'jot' }],
    created_at: '2026-07-28T00:00:00.000Z',
    updated_at: '2026-07-28T00:00:00.000Z',
  },
];
leftover.bookings = [
  {
    id: 'bkg_typo',
    session_id: 'ses_1',
    client_id: 'vuka_cli_morgan_samples',
    status: 'booked',
    booked_at: '2026-08-20T00:00:00.000Z',
  },
];
const sampleMerge = mergeDuplicateFitClients(leftover, {
  now: '2026-09-02T12:00:00.000Z',
  preferredNames: FIXTURE_ROSTER.map((r) => r.name),
});
assert.equal(sampleMerge.merged, 1);
assert.equal(leftover.clients.filter((c) => /morgan/i.test(c.name)).length, 1);
const kept = leftover.clients[0];
assert.equal(normalizePersonName(kept.name), 'morgan sample');
assert.equal(leftover.bookings[0].client_id, kept.id);
assert.ok(leftover.removed_ids?.clients?.includes('vuka_cli_morgan_samples'));

assert.equal(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Morgan Samples',
      email: 'typo@example.test',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Morgan Sample',
      email: 'morgan.sample@example.test',
      created_at: '',
      updated_at: '',
    }
  ),
  false
);

const emailClash = emptyFitgraphStore();
emailClash.settings = {
  enabled: true,
  public_token: 'fg_110_testtoken',
  allow_public_booking: true,
  show_coaches: true,
  show_pricing: true,
  vuka_calendar_manual: true,
  vuka_contracts_import: VUKA_CONTRACTS_IMPORT,
  vuka_member_merge: VUKA_MEMBER_MERGE,
  vuka_billed_class_import: VUKA_BILLED_CLASS_IMPORT,
};
emailClash.clients = [
  {
    id: 'vuka_cli_morgan_samples',
    code: 'VUKA-001',
    name: 'Morgan Samples',
    email: 'typo@example.test',
    active: true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cli_morgan',
    code: 'VUKA-002',
    name: 'Morgan Sample',
    email: 'morgan.sample@example.test',
    active: true,
    contracts: [{ id: 'con_m', kind: 'group', source_id: 'jot' }],
    created_at: '2026-07-28T00:00:00.000Z',
    updated_at: '2026-07-28T00:00:00.000Z',
  },
];
emailClash.bookings = [
  {
    id: 'bkg_typo',
    session_id: 'ses_1',
    client_id: 'vuka_cli_morgan_samples',
    status: 'booked',
    booked_at: '2026-08-20T00:00:00.000Z',
  },
];
assert.equal(vukaDeskSettled(emailClash, seed), true);
const folded = ensureVukaRoster(emailClash, {
  now: '2026-09-03T12:00:00.000Z',
  seed,
});
assert.equal(folded.changed, true);
assert.equal(
  emailClash.clients.filter((c) => normalizePersonName(c.name) === 'morgan sample')
    .length,
  1
);
assert.equal(
  emailClash.clients.filter((c) => /morgan samples/i.test(c.name)).length,
  0
);
const foldedKept = emailClash.clients.find((c) => /morgan sample/i.test(c.name))!;
assert.equal(normalizePersonName(foldedKept.name), 'morgan sample');
assert.equal(emailClash.bookings[0].client_id, foldedKept.id);
assert.ok(emailClash.removed_ids?.clients?.includes('vuka_cli_morgan_samples'));

const typoOnly = emptyFitgraphStore();
typoOnly.clients = [
  {
    id: 'vuka_cli_morgan_samples',
    code: 'VUKA-001',
    name: 'Morgan Samples',
    active: true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
];
const renamed = absorbKnownClientAliases(typoOnly, {
  now: '2026-09-03T12:00:00.000Z',
  folds: seed.nameFolds,
});
assert.equal(renamed.changed, true);
assert.equal(typoOnly.clients.length, 1);
assert.equal(typoOnly.clients[0].name, 'Morgan Sample');

assert.equal(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Mira Clark',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Mirah Clarke',
      created_at: '',
      updated_at: '',
    }
  ),
  false
);

const dupStore = emptyFitgraphStore();
dupStore.clients = [
  {
    id: 'cli_old',
    code: 'V1',
    name: 'Was a member previously and wanted to join again!!! Riley Fixture',
    email: 'riley.fixture@example.test',
    portal_token: 'member_110_oldtok',
    contracts: [
      {
        id: 'con_1',
        kind: 'group',
        source_id: 'src1',
        debit_amount_zar: 574,
      },
    ],
    debit_bank: {
      account_holder: 'Riley Fixture',
      bank_name: 'FNB',
      account_number: '12345678901',
      branch_code: '250655',
      account_type: 'cheque',
      debit_order_authorised: true,
      updated_at: '2026-08-17T12:00:00.000Z',
    },
    active: true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cli_new',
    code: 'V2',
    name: 'Riley Fixture',
    portal_token: 'member_110_newtok',
    notes: 'Charged R574.00/pm',
    active: true,
    membership_plan_id: 'vuka_pln_fsf_5am',
    created_at: '2026-08-17T12:00:00.000Z',
    updated_at: '2026-08-17T12:00:00.000Z',
  },
];
dupStore.subscriptions = [
  {
    id: 'sub_old',
    client_id: 'cli_old',
    plan_id: 'vuka_pln_boot_1730',
    status: 'active',
    started_at: '2026-08-01',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'sub_new',
    client_id: 'cli_new',
    plan_id: 'vuka_pln_fsf_5am',
    status: 'active',
    charged_zar: 574,
    started_at: '2026-08-17',
    created_at: '2026-08-17T12:00:00.000Z',
    updated_at: '2026-08-17T12:00:00.000Z',
  },
];
dupStore.bookings = [
  {
    id: 'bk_old',
    session_id: 'ses_1',
    client_id: 'cli_old',
    status: 'attended',
    booked_at: '2026-08-02T00:00:00.000Z',
  },
];
const merged = mergeDuplicateFitClients(dupStore, {
  now: '2026-08-20T12:00:00.000Z',
  preferredNames: FIXTURE_ROSTER.map((r) => r.name),
});
assert.equal(merged.merged, 1);
assert.equal(dupStore.clients.length, 1);
const keptDup = dupStore.clients[0];
assert.equal(normalizePersonName(keptDup.name), 'riley fixture');
assert.equal(keptDup.email, 'riley.fixture@example.test');
assert.ok(keptDup.contracts?.some((c) => c.source_id === 'src1'));
assert.equal(keptDup.debit_bank?.account_number, '12345678901');
assert.ok(
  keptDup.portal_token === 'member_110_oldtok' ||
    (keptDup.portal_token_aliases || []).includes('member_110_oldtok')
);
assert.ok(
  keptDup.portal_token === 'member_110_newtok' ||
    (keptDup.portal_token_aliases || []).includes('member_110_newtok')
);
assert.equal(
  dupStore.subscriptions.filter((s) => s.client_id === keptDup.id).length,
  2
);
assert.equal(dupStore.bookings[0].client_id, keptDup.id);

quinn.active = false;
quinn.membership_status = 'cancelled';
quinn.membership_plan_id = null;
for (const s of store.subscriptions) {
  if (s.client_id === quinn.id) s.status = 'cancelled';
}
riley.membership_plan_id = 'vuka_pln_boot_1730';
const parked = ensureVukaRoster(store, {
  now: '2026-08-20T12:00:00.000Z',
  seed,
});
assert.equal(parked.added, 0);
const quinnParked = store.clients.find((c) => /quinn north/i.test(c.name))!;
assert.equal(quinnParked.active, false);
assert.equal(quinnParked.membership_status, 'cancelled');
assert.equal(quinnParked.membership_plan_id, null);
assert.equal(
  store.clients.find((c) => /riley fixture/i.test(c.name))?.membership_plan_id,
  'vuka_pln_boot_1730'
);
assert.equal(vukaDeskSettled(store, seed), true);
assert.equal(store.settings?.vuka_billed_class_import, VUKA_BILLED_CLASS_IMPORT);
assert.equal(store.settings?.vuka_member_merge, VUKA_MEMBER_MERGE);

if (store.settings) store.settings.vuka_billed_class_import = 'old';
const afterStamp = ensureVukaRoster(store, {
  now: '2026-08-20T13:00:00.000Z',
  seed,
});
assert.equal(afterStamp.added, 0);
assert.equal(
  store.clients.find((c) => /quinn north/i.test(c.name))?.active,
  false
);
assert.equal(
  store.clients.find((c) => /riley fixture/i.test(c.name))?.membership_plan_id,
  'vuka_pln_boot_1730'
);

const skye = store.clients.find((c) => /skye fixture/i.test(c.name));
assert.ok(skye);
skye.active = true;
skye.membership_plan_id = null;
for (const s of store.subscriptions) {
  if (s.client_id === skye.id) {
    s.status = 'cancelled';
    s.updated_at = '2026-08-20T14:00:00.000Z';
  }
}
if (
  !store.subscriptions.some(
    (s) => s.client_id === skye.id && /boot/i.test(s.plan_id)
  )
) {
  const boot = store.membership_plans.find((p) => /boot/i.test(p.code || p.id));
  if (boot) {
    store.subscriptions.push({
      id: 'vuka_sub_skye_fixture',
      client_id: skye.id,
      plan_id: boot.id,
      status: 'cancelled',
      started_at: '2026-03-01',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-08-20T14:00:00.000Z',
    });
  }
}
if (store.settings) store.settings.vuka_contracts_import = 'force-reattach';
ensureVukaRoster(store, { now: '2026-08-20T15:00:00.000Z', seed });
assert.equal(
  store.subscriptions.some(
    (s) =>
      s.client_id === skye.id &&
      (s.status === 'active' || s.status === 'trialing')
  ),
  false,
  'contract import must not put a removed member back on a class'
);

const untouched = emptyFitgraphStore();
untouched.clients = [
  {
    id: 'vuka_cli_keep',
    code: 'VUKA-1',
    name: 'Keep Person',
    active: true,
    membership_status: 'active',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
];
const skipped = ensureVukaRoster(untouched, {
  now: '2026-08-21T00:00:00.000Z',
});
assert.equal(skipped.added, 0);
assert.equal(untouched.clients.length, 1);
assert.equal(untouched.clients[0].active, true);
assert.equal(untouched.clients[0].membership_status, 'active');

console.log('vuka-roster.test.ts ok');
