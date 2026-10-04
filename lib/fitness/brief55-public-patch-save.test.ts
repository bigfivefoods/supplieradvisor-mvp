/**
 * Brief 55 — public GymAdvisor patch-save guards.
 * Run: npx --yes tsx lib/fitness/brief55-public-patch-save.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FITGRAPH_META_KEY,
  emptyFitgraphStore,
  writeFitgraphPatchToMetadata,
  type FitgraphStore,
} from './fitgraph';
import { mergeRowsById } from './fitgraph-merge';

const root = resolve(__dirname, '../..');

function keyedStorePatch<K extends keyof FitgraphStore>(
  store: FitgraphStore,
  ...keys: K[]
): Pick<FitgraphStore, K> {
  const patch = {} as Pick<FitgraphStore, K>;
  for (const key of keys) patch[key] = store[key] as Pick<FitgraphStore, K>[K];
  return patch;
}

function patchMeta(patch: Partial<FitgraphStore>) {
  return writeFitgraphPatchToMetadata({}, patch)[FITGRAPH_META_KEY] as Record<
    string,
    unknown
  >;
}

const fixture = emptyFitgraphStore();
fixture.clients.push({ id: 'cli_1', name: 'Member 1', active: true } as never);
fixture.coaches.push({ id: 'coh_1', name: 'Coach 1', active: true } as never);
fixture.goals = [
  {
    id: 'goal_1',
    client_id: 'cli_1',
    title: '5k',
    category: 'physical',
    status: 'active',
    created_at: '2026-09-01',
    updated_at: '2026-09-01',
  },
] as never;
fixture.sessions.push({
  id: 'ses_1',
  class_type_id: 'ct_1',
  date: '2026-09-20',
  start_time: '06:00',
  end_time: '07:00',
  duration_min: 60,
  status: 'scheduled',
} as never);
fixture.bookings = Array.from({ length: 240 }, (_, i) => ({
  id: `bkg_${i}`,
  session_id: 'ses_1',
  client_id: 'cli_1',
  status: 'booked',
  booked_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
})) as never;

// 1) Member book/cancel patch contains only booking/session keys.
{
  const bookingsOnly = patchMeta(keyedStorePatch(fixture, 'bookings'));
  assert.ok(Array.isArray(bookingsOnly.bookings), 'bookings patch keeps bookings');
  assert.equal(bookingsOnly.sessions, undefined, 'bookings-only patch omits sessions');
  assert.equal(bookingsOnly.clients, undefined, 'bookings patch omits clients');
  assert.equal(bookingsOnly.goals, undefined, 'bookings patch omits goals');
  assert.equal(bookingsOnly.coaches, undefined, 'bookings patch omits coaches');

  const bookingsAndSessions = patchMeta(
    keyedStorePatch(fixture, 'bookings', 'sessions')
  );
  assert.ok(Array.isArray(bookingsAndSessions.bookings), 'bookings+sessions has bookings');
  assert.ok(Array.isArray(bookingsAndSessions.sessions), 'bookings+sessions has sessions');
  assert.equal(bookingsAndSessions.clients, undefined, 'bookings+sessions omits clients');
  assert.equal(bookingsAndSessions.goals, undefined, 'bookings+sessions omits goals');
  assert.equal(bookingsAndSessions.coaches, undefined, 'bookings+sessions omits coaches');
}

// 2) Member goal patches omit sessions/bookings even on large booking fixtures.
{
  const goalPatch = patchMeta(
    keyedStorePatch(fixture, 'goals', 'clients', 'journey_events')
  );
  assert.ok(Array.isArray(goalPatch.goals), 'goal patch includes goals');
  assert.ok(Array.isArray(goalPatch.clients), 'goal patch includes clients');
  assert.equal(goalPatch.sessions, undefined, 'goal patch omits sessions');
  assert.equal(goalPatch.bookings, undefined, 'goal patch omits bookings');
  const encoded = JSON.stringify(goalPatch);
  assert.ok(!encoded.includes('"bookings"'), 'goal patch does not serialize booking payload');
}

// 3) Check-in patch omits clients/goals on attendance-only change.
{
  const checkinPatch = patchMeta(keyedStorePatch(fixture, 'check_ins'));
  assert.ok(Array.isArray(checkinPatch.check_ins), 'check-in patch includes check_ins');
  assert.equal(checkinPatch.clients, undefined, 'check-in patch omits clients');
  assert.equal(checkinPatch.goals, undefined, 'check-in patch omits goals');
}

// 4) Coach attendance patch omits clients/goals.
{
  const attendancePatch = patchMeta(keyedStorePatch(fixture, 'bookings', 'sessions'));
  assert.ok(Array.isArray(attendancePatch.bookings), 'attendance patch includes bookings');
  assert.ok(Array.isArray(attendancePatch.sessions), 'attendance patch includes sessions');
  assert.equal(attendancePatch.clients, undefined, 'attendance patch omits clients');
  assert.equal(attendancePatch.goals, undefined, 'attendance patch omits goals');
}

// 5) Public wrappers must not call saveFitgraphMerged in target route files.
{
  const publicRoutes = [
    'app/api/public/fitgraph/member/route.ts',
    'app/api/public/fitgraph/coach/route.ts',
    'app/api/public/fitgraph/checkin/route.ts',
    'app/api/public/fitgraph/route.ts',
  ];
  for (const rel of publicRoutes) {
    const src = readFileSync(resolve(root, rel), 'utf8');
    const mergedCalls = src.match(/saveFitgraphMerged/g) || [];
    assert.equal(mergedCalls.length, 0, `${rel}: saveFitgraphMerged count must be 0`);
  }
}

// 6) ifUpdatedAt CAS path + stale 409 guard remain present on public POST routes.
{
  const casRoutes = [
    'app/api/public/fitgraph/member/route.ts',
    'app/api/public/fitgraph/coach/route.ts',
    'app/api/public/fitgraph/checkin/route.ts',
    'app/api/public/fitgraph/route.ts',
  ];
  for (const rel of casRoutes) {
    const src = readFileSync(resolve(root, rel), 'utf8');
    assert.match(src, /saveFitgraphPatch\(companyId,\s*patch,\s*\{\s*ifUpdatedAt\s*\}\)/, `${rel}: saveFitgraphPatch must pass ifUpdatedAt`);
    assert.match(src, /error:\s*'stale_store'[\s\S]*\{\s*status:\s*409\s*\}/, `${rel}: stale writes must return 409`);
  }
}

// 7) Brief 53 regression guard: same-id merge keeps photo_url when incoming omits it.
{
  const merged = mergeRowsById(
    [{ id: 'coh_1', name: 'Coach', photo_url: 'https://img/coach.jpg' }],
    [{ id: 'coh_1', name: 'Coach New Name' }]
  );
  assert.equal(merged[0].photo_url, 'https://img/coach.jpg');
}

// 8) Desk route still keeps only Brief 54 whole-store exceptions.
{
  const route = readFileSync(resolve(root, 'app/api/fitness/fitgraph/route.ts'), 'utf8');
  const saveStoreCalls =
    route.match(/await saveStore\(companyId,\s*meta,\s*(withCatalog|store)\);/g) || [];
  assert.equal(saveStoreCalls.length, 2, 'desk route keeps only two saveStore exceptions');
}

console.log('brief55-public-patch-save.test.ts ok');
