/**
 * Run: npx --yes tsx lib/fitness/vuka-class-catalog.test.ts
 */
import assert from 'node:assert/strict';
import {
  emptyFitgraphStore,
  findCoachForPortalSignIn,
  newId,
  type FitSession,
} from './fitgraph';
import {
  ensureVukaClassCatalog,
  ensureVukaShopOffers,
  gymHasClassSpecificPlans,
  isVukaFitnessCompany,
  listSubscribeClasses,
  persistVukaCatalogIfNeeded,
  ensureVukaCoachOrder,
  ensureVukaCoaches,
  membersOnClassSession,
  storeUsesClassSubscribe,
  memberMayBookSession,
  planCoversSession,
  catalogSlotForSession,
  VUKA_COMPANY_ID,
  VUKA_MEMBERSHIP_PLANS,
} from './vuka-class-catalog';
import { gymShopCatalog } from './gym-shop';
import { DEMO_SHOP_PROGRAMME_ID } from './demo-shop-programme';
import {
  VUKA_BILLED_CLASS_IMPORT,
  VUKA_CONTRACTS_IMPORT,
  VUKA_MEMBER_MERGE,
  vukaDeskSettled,
} from './vuka-roster';
import { applyMemberDebitBank } from './member-debit-bank';

assert.equal(isVukaFitnessCompany({ companyId: VUKA_COMPANY_ID }), true);
assert.equal(isVukaFitnessCompany({ tradingName: 'VUKA Fitness' }), true);
assert.equal(isVukaFitnessCompany({ legalName: 'Vuka' }), true);
assert.equal(isVukaFitnessCompany({ companyId: 999, tradingName: 'Other Gym' }), false);

const other = emptyFitgraphStore();
const skipped = ensureVukaClassCatalog(other, { companyId: 999 });
assert.equal(skipped.applied, false);
assert.equal(skipped.changed, false);
assert.equal(other.membership_plans.length, 0);

const vuka = emptyFitgraphStore();
const first = ensureVukaClassCatalog(vuka, {
  companyId: VUKA_COMPANY_ID,
  now: '2026-08-17T10:00:00.000Z',
  weeks: 2,
});
assert.equal(first.applied, true);
assert.equal(first.changed, true);
assert.ok(vuka.membership_plans.some((p) => p.code === 'VUKA_UNLIM'));
assert.ok(vuka.membership_plans.some((p) => p.price_zar === 910));
assert.ok(vuka.membership_plans.some((p) => p.price_zar === 1140));
assert.ok(vuka.class_types.some((c) => c.code === 'VUKA_FSF'));
assert.equal(vuka.sessions.length, 0);
assert.equal(vuka.settings?.vuka_calendar_manual, true);
assert.equal(
  vuka.class_types.filter((c) => String(c.code || '').startsWith('VUKA_'))
    .length,
  10
);
assert.equal(vuka.settings?.joining_fee_zar, 600);
assert.equal(vuka.settings?.joining_fee_waived, true);
assert.equal(vuka.settings?.class_subscribe, true);
assert.equal(vuka.settings?.collect_debit_bank, true);
assert.equal(vuka.settings?.require_debit_bank, true);
assert.equal(gymHasClassSpecificPlans(vuka), true);
assert.equal(storeUsesClassSubscribe(vuka), true);
assert.ok(
  (vuka.programmes || []).some(
    (p) =>
      p.id === DEMO_SHOP_PROGRAMME_ID &&
      p.public === true &&
      Number(p.price_zar) === 450
  )
);
assert.ok(
  gymShopCatalog(vuka).some(
    (i) => i.kind === 'programme' && i.id === DEMO_SHOP_PROGRAMME_ID
  )
);
const offer = listSubscribeClasses(vuka);
assert.ok(offer.length >= 14);
const hiddenShop = emptyFitgraphStore();
ensureVukaClassCatalog(hiddenShop, { companyId: VUKA_COMPANY_ID });
for (const p of hiddenShop.membership_plans) {
  if (p.id.startsWith('vuka_pln_')) p.public = false;
}
assert.equal(
  gymShopCatalog(hiddenShop).filter((i) => i.kind === 'membership').length,
  0
);
assert.equal(ensureVukaShopOffers(hiddenShop), true);
assert.ok(
  gymShopCatalog(hiddenShop).filter((i) => i.kind === 'membership').length >= 14
);
assert.ok(offer.some((c) => c.price_zar === 910 && c.schedule_label.includes('5:00am')));
assert.ok(offer.some((c) => c.unlocks_all && c.price_zar === 1140));
assert.equal(listSubscribeClasses(other).length, 0);

const again = ensureVukaClassCatalog(vuka, {
  companyId: VUKA_COMPANY_ID,
  now: '2026-08-17T10:00:00.000Z',
  weeks: 2,
});
assert.equal(again.changed, false);

vuka.membership_plans.push({
  id: 'pln_old',
  code: 'UNLIM',
  name: 'Old unlimited',
  price_zar: 899,
  billing: 'monthly',
  public: true,
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
});
const hidden = ensureVukaClassCatalog(vuka, {
  companyId: VUKA_COMPANY_ID,
  now: '2026-08-17T10:00:00.000Z',
  weeks: 2,
});
assert.equal(hidden.changed, true);
assert.equal(vuka.membership_plans.find((p) => p.id === 'pln_old')?.public, false);

vuka.class_types.push({
  id: 'cls_owner_extra',
  code: 'HIIT',
  name: 'HIIT I added',
  category: 'HIIT',
  default_duration_min: 45,
  capacity: 16,
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
});
vuka.sessions.push({
  id: 'ses_owner_extra',
  class_type_id: 'cls_owner_extra',
  date: '2026-08-20',
  start_time: '06:00',
  status: 'scheduled',
  created_at: '2026-08-01T00:00:00.000Z',
});
const pruned = ensureVukaClassCatalog(vuka, {
  companyId: VUKA_COMPANY_ID,
  now: '2026-08-17T10:00:00.000Z',
});
assert.equal(pruned.changed, true);
assert.equal(
  vuka.class_types.some((c) => c.id === 'cls_owner_extra'),
  false
);
assert.equal(
  vuka.sessions.find((s) => s.id === 'ses_owner_extra')?.status,
  'cancelled'
);

const unlim = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_UNLIM')!;
const kidsPlan = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_KIDS')!;
const fsfPlan = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_FSF_5AM')!;
const kb6 = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_KB_6AM')!;
const kb1630 = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_KB_1630')!;
const pilates1 = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_PILATES_1')!;

const fsfSession: FitSession = {
  id: 's1',
  class_type_id: 'vuka_cls_fsf',
  series_id: 'vuka_ser_fsf_5am',
  date: '2026-08-17',
  start_time: '05:00',
  status: 'scheduled',
  created_at: '2026-08-17T00:00:00.000Z',
};
const kidsSession: FitSession = {
  ...fsfSession,
  id: 's2',
  class_type_id: 'vuka_cls_kids',
  series_id: 'vuka_ser_kids_mon',
};
const kbEvening: FitSession = {
  ...fsfSession,
  id: 's3',
  class_type_id: 'vuka_cls_kb',
  series_id: 'vuka_ser_kb_1630',
};

assert.equal(planCoversSession(unlim, fsfSession, vuka), true);
assert.equal(planCoversSession(unlim, kidsSession, vuka), false);
assert.equal(planCoversSession(fsfPlan, fsfSession, vuka), true);
assert.equal(planCoversSession(fsfPlan, kbEvening, vuka), false);
assert.equal(planCoversSession(kb6, kbEvening, vuka), false);
assert.equal(planCoversSession(kb1630, kbEvening, vuka), true);
assert.equal(
  planCoversSession(
    unlim,
    { ...fsfSession, session_kind: 'coach_personal' },
    vuka
  ),
  false
);

const ownerFsf = { ...fsfSession, series_id: 'ser_owner_fsf' };
assert.equal(planCoversSession(fsfPlan, ownerFsf, vuka), true);
assert.equal(planCoversSession(kb6, ownerFsf, vuka), false);
assert.equal(catalogSlotForSession(ownerFsf)?.series_id, 'vuka_ser_fsf_5am');

const ownerKbEve = {
  ...kbEvening,
  series_id: 'ser_owner_kb',
  start_time: '16:30',
};
assert.equal(planCoversSession(kb6, ownerKbEve, vuka), false);
assert.equal(planCoversSession(kb1630, ownerKbEve, vuka), true);
assert.equal(catalogSlotForSession(ownerKbEve)?.series_id, 'vuka_ser_kb_1630');

const client = {
  id: 'cli_1',
  code: 'M1',
  name: 'Ada',
  email: 'ada@example.com',
  membership_status: 'active' as const,
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};
vuka.clients.push(client);
assert.equal(memberMayBookSession(vuka, client, fsfSession).need_plan, true);

vuka.subscriptions.push({
  id: newId('sub'),
  client_id: client.id,
  plan_id: fsfPlan.id,
  status: 'active',
  started_at: '2026-08-01',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
assert.equal(memberMayBookSession(vuka, client, fsfSession).need_debit_bank, true);
assert.equal(
  memberMayBookSession(vuka, client, fsfSession, { ignoreDebitBank: true }).ok,
  true
);
assert.equal(
  applyMemberDebitBank(client, {
    account_holder: 'Ada Lovelace',
    bank_name: 'FNB',
    account_number: '62123456789',
    branch_code: '250655',
    account_type: 'cheque',
    debit_order_authorised: true,
  }).ok,
  true
);
assert.equal(memberMayBookSession(vuka, client, fsfSession).ok, true);
assert.equal(memberMayBookSession(vuka, client, kbEvening).ok, false);

vuka.subscriptions.push({
  id: newId('sub'),
  client_id: client.id,
  plan_id: pilates1.id,
  status: 'active',
  started_at: '2026-08-01',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
});
const pilA: FitSession = {
  id: 'pil_a',
  class_type_id: 'vuka_cls_pilates',
  series_id: 'vuka_ser_pilates_mon',
  date: '2026-08-17',
  start_time: '17:30',
  status: 'scheduled',
  created_at: '2026-08-17T00:00:00.000Z',
};
const pilB: FitSession = {
  ...pilA,
  id: 'pil_b',
  series_id: 'vuka_ser_pilates_tue',
  date: '2026-08-18',
  start_time: '08:00',
};
vuka.sessions.push(pilA, pilB);
vuka.bookings.push({
  id: 'bk1',
  session_id: 'pil_a',
  client_id: client.id,
  status: 'booked',
  booked_at: '2026-08-17T00:00:00.000Z',
});
const secondPilates = memberMayBookSession(vuka, client, pilB);
assert.equal(secondPilates.ok, false);
assert.match(String(secondPilates.error), /1 class/);

assert.ok(kidsPlan.price_zar === 530);
const sib = VUKA_MEMBERSHIP_PLANS.find((p) => p.code === 'VUKA_KIDS_SIB')!;
assert.equal(sib.price_zar, 265);

void (async () => {
  const settled = emptyFitgraphStore();
  settled.settings = {
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
  assert.equal(vukaDeskSettled(settled), true);
  let saved = 0;
  await persistVukaCatalogIfNeeded(VUKA_COMPANY_ID, settled, async () => {
    saved += 1;
  });
  assert.equal(saved, 1);
  assert.ok(
    (settled.programmes || []).some((p) => p.id === DEMO_SHOP_PROGRAMME_ID)
  );
  saved = 0;
  await persistVukaCatalogIfNeeded(VUKA_COMPANY_ID, settled, async () => {
    saved += 1;
  });
  assert.equal(saved, 0);
  let otherSaved = 0;
  await persistVukaCatalogIfNeeded(999, settled, async () => {
    otherSaved += 1;
  });
  assert.equal(otherSaved, 0);
const coaches = emptyFitgraphStore();
coaches.coaches = [
  {
    id: 'sophie',
    code: 'SP',
    name: 'Sophie Pearce',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'bianca',
    code: 'BW',
    name: 'Bianca Westhorpe-Pottow',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'jared',
    code: 'JM',
    name: 'Jared Martin',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];
assert.equal(ensureVukaCoachOrder(coaches), true);
assert.deepEqual(
  coaches.coaches.map((c) => c.id),
  ['bianca', 'jared', 'sophie']
);

const vukaCoaches = emptyFitgraphStore();
vukaCoaches.coaches = [
  {
    id: 'jared',
    code: 'J',
    name: 'Jared',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];
assert.equal(ensureVukaCoaches(vukaCoaches, '2026-08-25T00:00:00.000Z'), true);
const jared = findCoachForPortalSignIn(vukaCoaches, {
  name: 'Jared',
  email: 'jaredcawood77@gmail.com',
});
assert.equal(jared?.id, 'jared');
assert.equal(jared?.email, 'jaredcawood77@gmail.com');
assert.equal(jared?.name, 'Jared-Wade Cawood');
assert.equal(jared?.can_manage_classes, true);
assert.equal(jared?.engagement, 'contractor');
assert.equal(
  findCoachForPortalSignIn(vukaCoaches, {
    name: 'Jared Cawood',
    email: 'jaredcawood77@gmail.com',
  })?.id,
  'jared'
);
assert.equal(ensureVukaCoaches(vukaCoaches, '2026-08-25T00:00:00.000Z'), false);
assert.ok(vukaCoaches.coaches.some((c) => c.name === 'Bianca Westhorpe-Pottow'));
assert.equal(
  vukaCoaches.coaches.find((c) => /^miri$/i.test(c.name))?.email,
  'mirjam@roosgroup.co.za'
);
assert.equal(
  vukaCoaches.coaches.filter((c) => /jared/i.test(c.name)).length,
  1
);

const msgStore = emptyFitgraphStore();
msgStore.clients = [
  {
    id: 'cli_a',
    code: 'A',
    name: 'Ada',
    membership_status: 'active',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];
msgStore.sessions = [
  {
    id: 'ses_1',
    class_type_id: 'ct1',
    date: '2026-08-24',
    start_time: '06:00',
    status: 'scheduled',
    created_at: '2026-01-01T00:00:00.000Z',
  } as FitSession,
];
msgStore.bookings = [
  {
    id: 'bkg_1',
    session_id: 'ses_1',
    client_id: 'cli_a',
    status: 'booked',
    booked_at: '2026-08-20T00:00:00.000Z',
  },
];
assert.deepEqual(membersOnClassSession(msgStore, msgStore.sessions[0]), [
  { id: 'cli_a', name: 'Ada' },
]);

  console.log('vuka-class-catalog.test.ts ok');
})();
