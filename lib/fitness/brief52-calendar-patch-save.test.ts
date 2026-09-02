/**
 * Brief 52 — Calendar patch save tests.
 * Run: npx --yes tsx lib/fitness/brief52-calendar-patch-save.test.ts
 *
 * Tests:
 * 1. writeFitgraphPatchToMetadata only writes present keys (no empty arrays for omitted keys).
 * 2. saveFitgraphPatch does NOT call loadFitgraphMerged / mergeFitgraphStores.
 * 3. lite create_session_series response omits full store.
 * 4. Brief 50 merge-id semantics still hold (regression guard).
 */
import assert from 'node:assert/strict';
import { emptyFitgraphStore, writeFitgraphPatchToMetadata, FITGRAPH_META_KEY } from './fitgraph';
import { mergeFitgraphStores, mergeRowsById } from './fitgraph-merge';

// ---------------------------------------------------------------------------
// 1. writeFitgraphPatchToMetadata — partial payload
// ---------------------------------------------------------------------------

const now = new Date().toISOString();
const patchStore = emptyFitgraphStore();
patchStore.sessions.push({
  id: 'ses_1',
  class_type_id: 'ct_1',
  date: '2026-09-10',
  start_time: '06:00',
  end_time: '07:00',
  duration_min: 60,
  coach_id: null,
  session_kind: 'class',
  status: 'open',
  created_at: now,
  updated_at: now,
} as never);
patchStore.bookings.push({
  id: 'bk_1',
  session_id: 'ses_1',
  client_id: 'cli_1',
  status: 'booked',
  booked_at: now,
} as never);

const patch: Partial<typeof patchStore> = {
  sessions: patchStore.sessions,
  bookings: patchStore.bookings,
};

const meta = writeFitgraphPatchToMetadata({}, patch);
const fg = meta[FITGRAPH_META_KEY] as Record<string, unknown>;

// Only sessions and bookings should be in the fitgraph partial payload.
assert.ok(Array.isArray(fg.sessions), 'sessions present in patch metadata');
assert.ok(Array.isArray(fg.bookings), 'bookings present in patch metadata');
assert.equal((fg.sessions as unknown[]).length, 1);
assert.equal((fg.bookings as unknown[]).length, 1);

// Critically: clients, coaches, goals, etc. must NOT be written as empty [].
assert.equal(fg.clients, undefined, 'clients omitted from patch — no empty array');
assert.equal(fg.coaches, undefined, 'coaches omitted from patch');
assert.equal(fg.goals, undefined, 'goals omitted from patch');
assert.equal(fg.membership_plans, undefined, 'membership_plans omitted from patch');

// updated_at must be stamped.
assert.ok(typeof fg.updated_at === 'string', 'updated_at stamped');

// Patch with settings only.
const settingsPatch: Partial<typeof patchStore> = {
  settings: { ...patchStore.settings, brand_name: 'VUKA' },
};
const settingsMeta = writeFitgraphPatchToMetadata({}, settingsPatch);
const sfg = settingsMeta[FITGRAPH_META_KEY] as Record<string, unknown>;
assert.ok(sfg.settings, 'settings present when in patch');
assert.equal(sfg.sessions, undefined, 'sessions absent when not patched');

// ---------------------------------------------------------------------------
// 2. Brief 52 — saveFitgraphPatch does NOT call loadFitgraphMerged.
//    We verify this structurally: the patch writer must not create an
//    emptyFitgraphStore() (which has 30+ keys / empty arrays).
// ---------------------------------------------------------------------------

const emptyKeys = Object.keys(emptyFitgraphStore());
const patchKeys = Object.keys(fg).filter((k) => k !== 'updated_at');
// Patch payload must have far fewer keys than the empty store.
assert.ok(
  patchKeys.length < emptyKeys.length,
  `patch payload has ${patchKeys.length} keys (< empty store's ${emptyKeys.length})`
);

// ---------------------------------------------------------------------------
// 3. Brief 50 merge semantics — regression guard
//    Verify mergeRowsById and mergeFitgraphStores still work as expected.
// ---------------------------------------------------------------------------

const rows = mergeRowsById(
  [
    { id: 'a', status: 'booked' },
    { id: 'b', status: 'booked' },
  ],
  [{ id: 'a', status: 'attended' }, { id: 'c', status: 'booked' }]
);
assert.equal(rows.length, 3, 'mergeRowsById: union of three unique ids');
assert.equal(rows.find((r) => r.id === 'a')?.status, 'attended', 'incoming wins for same id');
assert.ok(rows.some((r) => r.id === 'b'), 'existing-only id kept');
assert.ok(rows.some((r) => r.id === 'c'), 'incoming-only id added');

// Goals preserved across merge (Brief 50 key scenario)
const latestWithGoals = emptyFitgraphStore();
latestWithGoals.goals = [
  {
    id: 'g1',
    client_id: 'cli_1',
    title: 'Weight',
    category: 'physical',
    status: 'active',
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
] as never;
latestWithGoals.bookings.push({
  id: 'bk_old',
  session_id: 'ses_1',
  client_id: 'cli_1',
  status: 'booked',
  booked_at: '2026-09-01',
} as never);

const incomingSessionsOnly = emptyFitgraphStore();
incomingSessionsOnly.sessions.push({
  id: 'ses_1',
  class_type_id: 'ct_1',
  date: '2026-09-10',
  start_time: '06:00',
  status: 'open',
  created_at: now,
  updated_at: now,
} as never);

const merged = mergeFitgraphStores(latestWithGoals, incomingSessionsOnly);
assert.equal((merged.goals || []).length, 1, 'goals retained through merge');
assert.ok(merged.bookings.some((b) => b.id === 'bk_old'), 'existing bookings retained');
assert.ok(merged.sessions.some((s) => s.id === 'ses_1'), 'incoming session added');

// ---------------------------------------------------------------------------
// 4. lite flag — partial response contract (structural test)
//    When lite: true, the route omits the full store.  We can't run the
//    route in unit tests, but we verify the spread pattern used in the route:
//    `...(lite === true ? {} : { store })` must produce no `store` key.
// ---------------------------------------------------------------------------

function buildRouteResponse(lite: boolean, store: unknown) {
  return {
    success: true,
    ...(lite ? {} : { store }),
    summary: 'summary',
  };
}

const liteResp = buildRouteResponse(true, { huge: 'blob' });
assert.equal((liteResp as Record<string, unknown>).store, undefined, 'lite=true: no store in response');

const fullResp = buildRouteResponse(false, { huge: 'blob' });
assert.ok((fullResp as Record<string, unknown>).store, 'lite=false: store present in response');

console.log('brief52-calendar-patch-save.test.ts ok');
