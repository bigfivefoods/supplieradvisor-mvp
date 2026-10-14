/**
 * Brief 110 — GymAdvisor saves send only changed id-rows.
 * Run: npx --yes tsx lib/fitness/brief110-gym-delta-saves.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyFitgraphStore, type FitgraphStore } from './fitgraph';
import { fitgraphDeskGetWindow } from './fitgraph-desk-get-window';
import { gymPlanClassesOnDate } from './gym-booking-plan';
import {
  applyModuleStoreMerge,
  diffFitgraphStore,
  formatFitgraphServerTiming,
  prepareFitgraphDeltaWrite,
  snapshotFitgraphBaseline,
} from './fitgraph-delta';

const BOOKINGS = 3000;
const SESSIONS = 1300;
const CLIENTS = 283;

function bigStore(): FitgraphStore {
  const store = emptyFitgraphStore();
  store.updated_at = '2026-10-14T18:40:00.000Z';
  store.sessions = Array.from({ length: SESSIONS }, (_, i) => ({
    id: `ses_${i}`,
    class_type_id: 'ct_1',
    date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
    start_time: i % 2 === 0 ? '06:00' : '18:00',
    end_time: '07:00',
    duration_min: 60,
    status: 'scheduled' as const,
    capacity: 20,
    created_at: `2026-01-01T00:${String(i % 60).padStart(2, '0')}:00.000Z`,
  }));
  store.clients = Array.from({ length: CLIENTS }, (_, i) => ({
    id: `cli_${i}`,
    name: `Member ${i}`,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  })) as never;
  store.bookings = Array.from({ length: BOOKINGS }, (_, i) => ({
    id: `bkg_${i}`,
    session_id: `ses_${i % SESSIONS}`,
    client_id: `cli_${i % CLIENTS}`,
    status: 'booked' as const,
    booked_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T06:00:00.000Z`,
    notes: `class-note-${i}-${'x'.repeat(80)}`,
  }));
  store.goals = [
    {
      id: 'goal_1',
      client_id: 'cli_0',
      title: '5k',
      category: 'physical',
      status: 'active',
      created_at: '2026-09-01',
      updated_at: '2026-09-01',
    },
  ] as never;
  store.check_ins = [
    {
      id: 'ci_1',
      client_id: 'cli_1',
      date: '2026-10-01',
      created_at: '2026-10-01T08:00:00.000Z',
    },
  ] as never;
  return store;
}

const store = bigStore();
const baseline = snapshotFitgraphBaseline(store);
const fullBookingBytes = Buffer.byteLength(JSON.stringify(store.bookings), 'utf8');
const fullSessionBytes = Buffer.byteLength(JSON.stringify(store.sessions), 'utf8');

// 1) Book one member into one class: one booking, no unchanged session, < 10 KB.
{
  const booked = [
    ...store.bookings,
    {
      id: 'bkg_new',
      session_id: 'ses_0',
      client_id: 'cli_0',
      status: 'booked' as const,
      booked_at: '2026-10-14T18:41:00.000Z',
    },
  ];
  const plan = prepareFitgraphDeltaWrite(baseline, {
    bookings: booked,
    sessions: store.sessions,
  });
  assert.equal(plan.write, true);
  assert.equal(plan.patch.bookings?.length, 1);
  assert.equal(plan.patch.bookings?.[0]?.id, 'bkg_new');
  assert.equal(plan.patch.sessions, undefined, 'unchanged sessions are omitted');
  assert.ok(plan.bytes < 10_000, `delta is ${plan.bytes} bytes, want < 10000`);
  assert.ok(fullBookingBytes > 100_000, 'fixture bookings are a large book');
  const fullMergeStarted = performance.now();
  applyModuleStoreMerge(store as unknown as Record<string, unknown>, {
    bookings: store.bookings,
    sessions: store.sessions,
  });
  const fullMergeMs = performance.now() - fullMergeStarted;
  const oneMergeStarted = performance.now();
  applyModuleStoreMerge(store as unknown as Record<string, unknown>, {
    bookings: plan.patch.bookings,
  });
  const oneMergeMs = performance.now() - oneMergeStarted;
  console.log(
    `brief110 before/after bytes: full bookings ${fullBookingBytes}, full sessions ${fullSessionBytes}, one-booking delta ${plan.bytes}`
  );
  console.log(
    `brief110 merge duration: full bookings+sessions ${fullMergeMs.toFixed(1)} ms, one-booking delta ${oneMergeMs.toFixed(1)} ms`
  );

  const sessionChanged = store.sessions.map((session, index) =>
    index === 0 ? { ...session, capacity: (session.capacity || 20) + 1 } : session
  );
  const withSession = prepareFitgraphDeltaWrite(baseline, {
    bookings: booked,
    sessions: sessionChanged,
  });
  assert.equal(withSession.patch.bookings?.length, 1);
  assert.equal(withSession.patch.sessions?.length, 1);
  assert.equal(withSession.patch.sessions?.[0]?.id, 'ses_0');
  assert.ok(withSession.bytes < 10_000, `booking+session delta is ${withSession.bytes} bytes`);
}

// 2) Cancel (row removed): removed_ids + tombstone; the other 2,999 stay.
{
  const dropped = store.bookings[0]!;
  const plan = prepareFitgraphDeltaWrite(baseline, {
    bookings: store.bookings.slice(1),
  });
  assert.equal(plan.patch.bookings?.length, 1);
  assert.equal(plan.patch.bookings?.[0]?.id, dropped.id);
  assert.equal(
    (plan.patch.bookings?.[0] as { _deleted?: boolean })._deleted,
    true
  );
  assert.ok(plan.patch.removed_ids?.bookings?.includes(dropped.id));
  const mergeStarted = performance.now();
  const merged = applyModuleStoreMerge(
    store as unknown as Record<string, unknown>,
    plan.patch as unknown as Record<string, unknown>
  );
  const mergeMs = performance.now() - mergeStarted;
  const bookings = merged.bookings as Array<{ id: string; notes?: string }>;
  assert.equal(bookings.length, BOOKINGS - 1);
  assert.equal(
    bookings.some((row) => row.id === dropped.id),
    false
  );
  assert.equal(bookings[bookings.length - 1]?.id, store.bookings[BOOKINGS - 1]?.id);
  assert.equal(bookings[100]?.notes, store.bookings[101]?.notes);
  console.log(`brief110 cancel merge ${mergeMs.toFixed(1)} ms`);
}

// 3) Edit one client field. Other clients, goals and check-ins survive.
{
  const clients = store.clients.map((client, index) =>
    index === 0 ? { ...client, name: 'Renamed Member' } : client
  );
  const plan = prepareFitgraphDeltaWrite(baseline, {
    clients: clients as never,
    goals: store.goals,
    check_ins: store.check_ins,
  });
  assert.equal(plan.patch.clients?.length, 1);
  assert.equal(plan.patch.clients?.[0]?.id, 'cli_0');
  assert.equal((plan.patch.clients?.[0] as { name?: string }).name, 'Renamed Member');
  assert.equal(plan.patch.goals, undefined);
  assert.equal(plan.patch.check_ins, undefined);
  const merged = applyModuleStoreMerge(
    store as unknown as Record<string, unknown>,
    plan.patch as unknown as Record<string, unknown>
  );
  const mergedClients = merged.clients as Array<{ id: string; name: string }>;
  assert.equal(mergedClients.length, CLIENTS);
  assert.equal(mergedClients.filter((row) => row.id !== 'cli_0').length, 282);
  assert.equal(mergedClients.find((row) => row.id === 'cli_4')?.name, 'Member 4');
  assert.equal((merged.goals as unknown[]).length, 1);
  assert.equal((merged.check_ins as unknown[]).length, 1);
}

// 4) No-op POST does not write.
{
  let puts = 0;
  const plan = prepareFitgraphDeltaWrite(baseline, {
    bookings: store.bookings,
    sessions: store.sessions,
    clients: store.clients as never,
    goals: store.goals,
    check_ins: store.check_ins,
    settings: store.settings,
  });
  assert.equal(plan.write, false);
  assert.equal(plan.bytes, 0);
  assert.equal(plan.updatedAt, store.updated_at);
  assert.equal(Object.keys(diffFitgraphStore(baseline, store)).length, 0);
  if (plan.write) {
    puts += 1;
  }
  assert.equal(puts, 0, 'no-op must not call sa_put_module_store');
}

// 5) Two concurrent deltas for different bookings both survive.
{
  const left = store.bookings.map((row, index) =>
    index === 0 ? { ...row, status: 'attended' as const } : row
  );
  const right = store.bookings.map((row, index) =>
    index === 1 ? { ...row, status: 'no_show' as const } : row
  );
  const patchA = prepareFitgraphDeltaWrite(baseline, { bookings: left }).patch;
  const patchB = prepareFitgraphDeltaWrite(baseline, { bookings: right }).patch;
  assert.equal(patchA.bookings?.length, 1);
  assert.equal(patchB.bookings?.length, 1);
  const afterA = applyModuleStoreMerge(
    store as unknown as Record<string, unknown>,
    patchA as unknown as Record<string, unknown>
  );
  const afterBoth = applyModuleStoreMerge(afterA, patchB as unknown as Record<string, unknown>);
  const rows = afterBoth.bookings as Array<{ id: string; status: string }>;
  assert.equal(rows.length, BOOKINGS);
  assert.equal(rows.find((row) => row.id === 'bkg_0')?.status, 'attended');
  assert.equal(rows.find((row) => row.id === 'bkg_1')?.status, 'no_show');
  assert.equal(rows.find((row) => row.id === 'bkg_2')?.status, 'booked');

  const staleFull = applyModuleStoreMerge(
    applyModuleStoreMerge(store as unknown as Record<string, unknown>, {
      bookings: left,
    }),
    { bookings: right }
  );
  const staleRows = staleFull.bookings as Array<{ id: string; status: string }>;
  assert.equal(
    staleRows.find((row) => row.id === 'bkg_0')?.status,
    'booked',
    'a stale full-array write still clobbers the other booking'
  );
}

// 6) Desk lists stay in date/time order when a patched row is first.
{
  const desk = emptyFitgraphStore();
  desk.sessions = [
    {
      id: 's_late',
      class_type_id: 'ct_1',
      date: '2026-10-02',
      start_time: '18:00',
      status: 'scheduled',
      created_at: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 's_early',
      class_type_id: 'ct_1',
      date: '2026-10-02',
      start_time: '06:00',
      status: 'scheduled',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 's_tie_late',
      class_type_id: 'ct_1',
      date: '2026-10-03',
      start_time: '06:00',
      status: 'scheduled',
      created_at: '2026-02-02T00:00:00.000Z',
    },
    {
      id: 's_tie_early',
      class_type_id: 'ct_1',
      date: '2026-10-03',
      start_time: '06:00',
      status: 'scheduled',
      created_at: '2026-02-01T00:00:00.000Z',
    },
  ];
  desk.bookings = [
    {
      id: 'b_late',
      session_id: 's_late',
      client_id: 'cli_0',
      status: 'booked',
      booked_at: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'b_early',
      session_id: 's_early',
      client_id: 'cli_0',
      status: 'booked',
      booked_at: '2026-09-01T00:00:00.000Z',
    },
  ];
  const windowed = fitgraphDeskGetWindow(desk, {
    now: new Date('2026-10-01T08:00:00.000Z'),
  });
  assert.deepEqual(
    windowed.sessions.map((session) => session.id),
    ['s_early', 's_late', 's_tie_early', 's_tie_late']
  );
  assert.deepEqual(
    windowed.bookings.map((booking) => booking.id),
    ['b_early', 'b_late']
  );
  const sameSlot = gymPlanClassesOnDate(desk, '2026-10-03');
  assert.deepEqual(
    sameSlot.map((card) => card.session.id),
    ['s_tie_early', 's_tie_late']
  );
}

// 7) Settings and id-less arrays are still sent whole. Header shape is fixed.
{
  const settingsPlan = prepareFitgraphDeltaWrite(baseline, {
    settings: { ...store.settings!, brand_name: 'Delta Gym' },
    bookings: store.bookings,
  });
  assert.equal(settingsPlan.patch.settings?.brand_name, 'Delta Gym');
  assert.equal(settingsPlan.patch.bookings, undefined);

  const bare = emptyFitgraphStore();
  bare.watch_sessions = [{ note: 'a' }, { note: 'b' }] as never;
  const bareBase = snapshotFitgraphBaseline(bare);
  bare.watch_sessions = [{ note: 'a' }, { note: 'b' }, { note: 'c' }] as never;
  const whole = prepareFitgraphDeltaWrite(bareBase, {
    watch_sessions: bare.watch_sessions,
  });
  assert.equal(whole.patch.watch_sessions?.length, 3);

  assert.equal(
    formatFitgraphServerTiming({ loadMs: 12.34, saveMs: 80.04, patchBytes: 1840 }),
    'load;dur=12.3, save;dur=80.0, patch_bytes;desc=1840'
  );
}

// 8) Desk route wires the delta, keeps full-book seed/import, and times the POST.
{
  const route = readFileSync(
    resolve(__dirname, '../../app/api/fitness/fitgraph/route.ts'),
    'utf8'
  );
  const savePatchBody =
    route.slice(route.indexOf('async function savePatch'), route.indexOf('function keyedStorePatch')) ||
    '';
  assert.match(savePatchBody, /prepareFitgraphDeltaWrite/);
  assert.match(savePatchBody, /if \(!prepared\.write\) return prepared\.updatedAt/);
  assert.doesNotMatch(savePatchBody, /loadFitgraphMerged/);
  assert.match(route, /rememberFitgraphBaseline\(store\)/);
  assert.match(route, /headers\.set\('Server-Timing', fitgraphServerTimingHeader\(\)\)/);
  const deltaSrc = readFileSync(resolve(__dirname, 'fitgraph-delta.ts'), 'utf8');
  assert.match(deltaSrc, /patch_bytes;desc=/);
  const saveStoreCalls =
    route.match(/await saveStore\(companyId,\s*meta,\s*(withCatalog|store)\);/g) || [];
  assert.equal(saveStoreCalls.length, 2, 'seed_demo and import stay on the full-book save');
  const getHandler = route.slice(
    route.indexOf('export async function GET'),
    route.indexOf('export async function POST')
  );
  assert.match(getHandler, /await saveStore\(companyId, loaded\.meta, next\)/);
}

console.log('brief110-gym-delta-saves.test.ts ok');
