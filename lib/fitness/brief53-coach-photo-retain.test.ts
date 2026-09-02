/**
 * Brief 53 — Coach profile-photo retention tests.
 * Run: npx --yes tsx lib/fitness/brief53-coach-photo-retain.test.ts
 *
 * Tests:
 * 1. mergeRowsById — same-id incoming without photo_url keeps existing photo_url
 * 2. mergeRowsById — incoming with a new photo_url wins
 * 3. mergeRowsById — tombstone still removes the coach
 * 4. mergeFitgraphStores — coaches array deep-merges (photo_url retained)
 * 5. Coaches desk page still renders ProfilePhotoField with kind=coach_photo
 * 6. Coach PWA page still renders ProfilePhotoField with kind=coach_photo
 * 7. API upsert path keeps prev.photo_url when rec omits it (string-scan guard)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { emptyFitgraphStore } from './fitgraph';
import { mergeFitgraphStores, mergeRowsById } from './fitgraph-merge';

// ---------------------------------------------------------------------------
// 1. Same-id incoming WITHOUT photo_url keeps existing photo_url
// ---------------------------------------------------------------------------
{
  const existing = [
    {
      id: 'coh_test_1',
      name: 'Bianca',
      photo_url: 'https://storage.example.com/company-documents/110/profile/coach_photo-1787601657053.jpeg',
      code: 'C-1',
      updated_at: '2026-09-01T10:00:00Z',
    },
  ];
  const incoming = [
    {
      id: 'coh_test_1',
      name: 'Bianca',
      // photo_url intentionally omitted — simulates a desk save that didn't include it
      code: 'C-1',
      updated_at: '2026-09-01T12:00:00Z',
    },
  ];
  const result = mergeRowsById(existing, incoming);
  assert.equal(result.length, 1, 'test 1: result length');
  assert.equal(
    result[0].photo_url,
    'https://storage.example.com/company-documents/110/profile/coach_photo-1787601657053.jpeg',
    'test 1: photo_url must be preserved when incoming omits it'
  );
  console.log('✓ test 1 — same-id without photo_url keeps existing photo_url');
}

// ---------------------------------------------------------------------------
// 2. Incoming WITH a new photo_url wins
// ---------------------------------------------------------------------------
{
  const existing = [
    {
      id: 'coh_test_2',
      name: 'Jared',
      photo_url: 'https://storage.example.com/old-photo.jpg',
      updated_at: '2026-09-01T10:00:00Z',
    },
  ];
  const incoming = [
    {
      id: 'coh_test_2',
      name: 'Jared',
      photo_url: 'https://storage.example.com/new-photo.jpg',
      updated_at: '2026-09-01T12:00:00Z',
    },
  ];
  const result = mergeRowsById(existing, incoming);
  assert.equal(result.length, 1, 'test 2: result length');
  assert.equal(
    result[0].photo_url,
    'https://storage.example.com/new-photo.jpg',
    'test 2: new photo_url from incoming must win'
  );
  console.log('✓ test 2 — incoming with new photo_url wins');
}

// ---------------------------------------------------------------------------
// 3. Tombstone still removes the coach
// ---------------------------------------------------------------------------
{
  const existing = [
    { id: 'coh_tombstone', name: 'Gone', photo_url: 'https://example.com/x.jpg', updated_at: '2026-09-01T10:00:00Z' },
    { id: 'coh_kept', name: 'Stay', updated_at: '2026-09-01T10:00:00Z' },
  ];
  // tombstone: object with _tombstone=true signals removal in id-array semantics
  const incoming = [
    { id: 'coh_tombstone', _tombstone: true, updated_at: '2026-09-01T12:00:00Z' },
    { id: 'coh_kept', name: 'Stay', updated_at: '2026-09-01T12:00:00Z' },
  ];
  // mergeRowsById doesn't handle tombstones itself — tombstone IDs are collected
  // externally (see mergeFitgraphStores / sa_module_store_merge_id_array).
  // Use the explicit omit parameter to simulate tombstone drop:
  const result = mergeRowsById(existing, incoming, ['coh_tombstone']);
  assert.ok(!result.find((r) => r.id === 'coh_tombstone'), 'test 3: tombstone removed');
  assert.ok(result.find((r) => r.id === 'coh_kept'), 'test 3: non-tombstone kept');
  console.log('✓ test 3 — tombstone still removes the coach');
}

// ---------------------------------------------------------------------------
// 4. mergeFitgraphStores — coaches array deep-merges (photo_url retained)
// ---------------------------------------------------------------------------
{
  const latest = emptyFitgraphStore();
  (latest as unknown as Record<string, unknown>).coaches = [
    {
      id: 'coh_store_1',
      name: 'Sophie',
      photo_url: 'https://storage.example.com/sophie.jpg',
      code: 'C-2',
      role: 'coach',
      specialties: [],
      updated_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'coh_store_2',
      name: 'Miri',
      photo_url: 'https://storage.example.com/miri.jpg',
      code: 'C-3',
      role: 'coach',
      specialties: [],
      updated_at: '2026-09-01T10:00:00Z',
    },
  ];

  const incoming = emptyFitgraphStore();
  (incoming as unknown as Record<string, unknown>).coaches = [
    {
      id: 'coh_store_1',
      name: 'Sophie Peace',
      // photo_url omitted — simulates gym-book save that didn't carry it
      code: 'C-2',
      role: 'coach',
      specialties: ['yoga'],
      updated_at: '2026-09-01T12:00:00Z',
    },
  ];

  const merged = mergeFitgraphStores(latest, incoming);
  const coaches = (merged as unknown as Record<string, unknown[]>).coaches as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(coaches), 'test 4: coaches is array');

  const sophie = coaches.find((c) => c.id === 'coh_store_1');
  assert.ok(sophie, 'test 4: sophie present');
  assert.equal(sophie?.name, 'Sophie Peace', 'test 4: incoming name wins');
  assert.equal(
    sophie?.photo_url,
    'https://storage.example.com/sophie.jpg',
    'test 4: photo_url preserved from latest'
  );

  const miri = coaches.find((c) => c.id === 'coh_store_2');
  assert.ok(miri, 'test 4: miri present (existing-only coach not dropped)');
  assert.equal(miri?.photo_url, 'https://storage.example.com/miri.jpg', 'test 4: miri photo preserved');

  console.log('✓ test 4 — mergeFitgraphStores deep-merges coaches, photo_url retained');
}

// ---------------------------------------------------------------------------
// 5 & 6. String-scan: ProfilePhotoField with kind=coach_photo still present
// ---------------------------------------------------------------------------
{
  const root = path.resolve(__dirname, '../..');
  const deskPage = fs.readFileSync(
    path.join(root, 'app/dashboard/fitgraph/coaches/page.tsx'),
    'utf8'
  );
  assert.ok(
    deskPage.includes('ProfilePhotoField') && deskPage.includes('coach_photo'),
    'test 5: Coaches desk page must render ProfilePhotoField with kind=coach_photo'
  );
  console.log('✓ test 5 — Coaches desk page has ProfilePhotoField kind=coach_photo');

  const pwaPage = fs.readFileSync(
    path.join(root, 'app/coach/fitgraph/[token]/page.tsx'),
    'utf8'
  );
  assert.ok(
    pwaPage.includes('ProfilePhotoField') && pwaPage.includes('coach_photo'),
    'test 6: Coach PWA page must render ProfilePhotoField with kind=coach_photo'
  );
  console.log('✓ test 6 — Coach PWA page has ProfilePhotoField kind=coach_photo');
}

// ---------------------------------------------------------------------------
// 7. API upsert keeps prev.photo_url when rec omits it (string-scan guard)
// ---------------------------------------------------------------------------
{
  const root = path.resolve(__dirname, '../..');
  const routeTs = fs.readFileSync(
    path.join(root, 'app/api/fitness/fitgraph/route.ts'),
    'utf8'
  );
  // Verify the guard pattern is still present
  assert.ok(
    routeTs.includes('rec.photo_url !== undefined') &&
      routeTs.includes('prev?.photo_url'),
    'test 7: API route must keep prev.photo_url when rec omits photo_url'
  );
  console.log('✓ test 7 — API route keeps prev.photo_url when rec omits it');
}

console.log('\nAll Brief 53 tests passed.');
