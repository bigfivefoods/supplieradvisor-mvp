/**
 * Run: npx --yes tsx lib/fitness/vuka-roster.test.ts
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore } from './fitgraph';
import { ensureVukaClassCatalog, VUKA_COMPANY_ID } from './vuka-class-catalog';
import {
  clientsAreSamePerson,
  ensureVukaRoster,
  matchCatalogPlan,
  matchClassHint,
  mergeDuplicateFitClients,
  normalizePersonName,
  vukaDeskSettled,
  VUKA_ROSTER,
} from './vuka-roster';

assert.equal(normalizePersonName('Sue (S Westhorpe)'), 'sue');
assert.equal(normalizePersonName('JACQUES VAN ROOYEN'), 'jacques van rooyen');
assert.equal(normalizePersonName('Yuné van Niekerk'), 'yune van niekerk');
assert.equal(normalizePersonName("Dianne O’Connor"), 'dianne oconnor');
assert.ok(VUKA_ROSTER.length >= 64);
assert.equal(
  VUKA_ROSTER.filter((r) => normalizePersonName(r.name) === 'malan snyman')
    .length,
  1
);

assert.equal(matchCatalogPlan(1140)?.code, 'VUKA_UNLIM');
assert.equal(matchCatalogPlan(1265)?.code, 'VUKA_PILATES_3');
assert.equal(matchCatalogPlan(855)?.code, 'VUKA_PILATES_2');
assert.equal(matchCatalogPlan(530)?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(908.5)?.code, 'VUKA_FSF_5AM');
assert.equal(matchCatalogPlan(529)?.code, 'VUKA_KIDS');
assert.equal(matchCatalogPlan(530, 'ZACH kids Gym')?.code, 'VUKA_KIDS');
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
const first = ensureVukaRoster(store, { now: '2026-08-17T12:00:00.000Z' });
assert.equal(first.changed, true);
assert.ok(first.added > 150);
assert.ok(store.clients.some((c) => /aimee le roux/i.test(c.name)));
assert.ok(store.clients.some((c) => /gouweloos/i.test(c.name)));
const aimee = store.clients.find((c) => /aimee le roux/i.test(c.name))!;
assert.ok((aimee.contracts || []).length >= 1);
assert.equal(aimee.contracts?.[0].parq != null, true);
const serah = store.clients.find((c) => /serah shange/i.test(c.name));
if (serah) {
  assert.ok(serah.debit_bank?.account_number);
  assert.ok(serah.debit_bank?.bank_name);
}
assert.equal(
  store.membership_plans.some(
    (p) => String(p.code || '').startsWith('VUKA_DESK_')
  ),
  false
);
assert.equal(store.settings?.vuka_contracts_import != null, true);

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
const cleaned = ensureVukaRoster(store, { now: '2026-08-17T12:00:00.000Z' });
assert.equal(cleaned.changed, true);
assert.equal(
  store.membership_plans.some((p) => String(p.code || '').startsWith('VUKA_DESK_')),
  false
);

const christine = store.clients.find((c) => /christine j brown/i.test(c.name));
assert.ok(christine);
assert.equal(christine?.membership_plan_id, 'vuka_pln_fsf_5am');
const sueW = store.clients.find((c) => /^sue westhorpe$/i.test(c.name));
assert.ok(sueW);
assert.equal(sueW?.membership_plan_id, 'vuka_pln_pilates_2');
const yunis = store.clients.find((c) => /yunis leandre herbert/i.test(c.name));
assert.ok(yunis);
assert.equal(yunis?.membership_plan_id, 'vuka_pln_gents_5am');

const again = ensureVukaRoster(store, { now: '2026-08-17T12:00:00.000Z' });
assert.equal(again.added, 0);
assert.ok(store.clients.filter((c) => c.active !== false).length > 150);

for (const row of VUKA_ROSTER) {
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

const sueCount = store.clients.filter(
  (c) =>
    c.active !== false &&
    /^sue westhorpe$/i.test(normalizePersonName(c.name))
).length;
assert.equal(sueCount, 1);

const yune = store.clients.find((c) => /yune van niekerk/i.test(c.name));
assert.ok(yune);
assert.equal(
  store.clients.filter(
    (c) => c.active !== false && clientsAreSamePerson(c, yune!)
  ).length,
  1
);

const bandile = store.clients.find((c) => /bandile/i.test(c.name));
assert.ok(bandile);
assert.equal(
  store.clients.filter(
    (c) => c.active !== false && /bandile/i.test(c.name)
  ).length,
  1
);

assert.ok(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Sue (S Westhorpe)',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Sue Westhorpe',
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
      name: 'Sue Freese',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Sue Westhorpe',
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
      name: 'Brett van Niekerk',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Yune van Niekerk',
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
      name: 'Athalah Hembert',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Athaliah Hembert',
      created_at: '',
      updated_at: '',
    }
  )
);
assert.ok(
  VUKA_ROSTER.some((r) => r.name === 'Athaliah Hembert')
);
assert.equal(
  VUKA_ROSTER.filter((r) => /athalah/i.test(r.name)).length,
  0
);
assert.equal(
  store.clients.filter((c) => /hembert/i.test(c.name) && c.active !== false)
    .length,
  1
);
assert.equal(
  normalizePersonName(
    store.clients.find((c) => /hembert/i.test(c.name))?.name || ''
  ),
  'athaliah hembert'
);

const leftover = emptyFitgraphStore();
leftover.clients = [
  {
    id: 'vuka_cli_athalah_hembert',
    code: 'VUKA-001',
    name: 'Athalah Hembert',
    active: true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cli_athaliah',
    code: 'VUKA-002',
    name: 'Athaliah Hembert',
    email: 'athaliahhembert9@gmail.com',
    active: true,
    contracts: [{ id: 'con_ath', kind: 'group', source_id: 'jot' }],
    created_at: '2026-07-28T00:00:00.000Z',
    updated_at: '2026-07-28T00:00:00.000Z',
  },
];
leftover.bookings = [
  {
    id: 'bkg_athalah',
    session_id: 'ses_1',
    client_id: 'vuka_cli_athalah_hembert',
    status: 'booked',
    booked_at: '2026-08-20T00:00:00.000Z',
  },
];
const hembertMerge = mergeDuplicateFitClients(leftover, {
  now: '2026-09-02T12:00:00.000Z',
  preferredNames: VUKA_ROSTER.map((r) => r.name),
});
assert.equal(hembertMerge.merged, 1);
assert.equal(
  leftover.clients.filter((c) => /hembert/i.test(c.name)).length,
  1
);
const kept = leftover.clients[0];
assert.equal(normalizePersonName(kept.name), 'athaliah hembert');
assert.equal(leftover.bookings[0].client_id, kept.id);

assert.equal(
  clientsAreSamePerson(
    {
      id: 'a',
      code: 'a',
      name: 'Lynn Clark',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      code: 'b',
      name: 'Lynne Clarke',
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
    name: 'Was a member previously and wanted to join again!!! Bibi Ayesha Yusuf',
    email: 'bibi@test.com',
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
      account_holder: 'Bibi Ayesha Yusuf',
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
    name: 'Bibi Ayesha Yusuf',
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
  preferredNames: VUKA_ROSTER.map((r) => r.name),
});
assert.equal(merged.merged, 1);
assert.equal(dupStore.clients.length, 1);
const bibi = dupStore.clients[0];
assert.equal(normalizePersonName(bibi.name), 'bibi ayesha yusuf');
assert.equal(bibi.email, 'bibi@test.com');
assert.ok(bibi.contracts?.some((c) => c.source_id === 'src1'));
assert.equal(bibi.debit_bank?.account_number, '12345678901');
assert.ok(
  bibi.portal_token === 'member_110_oldtok' ||
    (bibi.portal_token_aliases || []).includes('member_110_oldtok')
);
assert.ok(
  bibi.portal_token === 'member_110_newtok' ||
    (bibi.portal_token_aliases || []).includes('member_110_newtok')
);
assert.equal(
  dupStore.subscriptions.filter((s) => s.client_id === bibi.id).length,
  2
);
assert.equal(dupStore.bookings[0].client_id, bibi.id);

yunis.active = false;
yunis.membership_status = 'cancelled';
yunis.membership_plan_id = null;
for (const s of store.subscriptions) {
  if (s.client_id === yunis.id) s.status = 'cancelled';
}
christine.membership_plan_id = 'vuka_pln_boot_1730';
const parked = ensureVukaRoster(store, { now: '2026-08-20T12:00:00.000Z' });
assert.equal(parked.added, 0);
const yunisParked = store.clients.find((c) => /yunis leandre herbert/i.test(c.name))!;
assert.equal(yunisParked.active, false);
assert.equal(yunisParked.membership_status, 'cancelled');
assert.equal(yunisParked.membership_plan_id, null);
assert.equal(
  store.clients.find((c) => /christine j brown/i.test(c.name))?.membership_plan_id,
  'vuka_pln_boot_1730'
);
assert.equal(vukaDeskSettled(store), true);

if (store.settings) store.settings.vuka_billed_class_import = 'old';
const afterStamp = ensureVukaRoster(store, { now: '2026-08-20T13:00:00.000Z' });
assert.equal(afterStamp.added, 0);
assert.equal(
  store.clients.find((c) => /yunis leandre herbert/i.test(c.name))?.active,
  false
);

console.log('vuka-roster.test.ts ok');
