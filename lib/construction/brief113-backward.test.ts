/**
 * Pre-113 books still load, and unknown keys survive a round trip.
 * Run: npx --yes tsx lib/construction/brief113-backward.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mergeConstructiongraphStore,
  readConstructiongraphFromMetadata,
  writeConstructiongraphToMetadata,
} from './constructiongraph';

const fixture = JSON.parse(readFileSync(resolve('lib/construction/fixtures/pre113-store.json'), 'utf8'));
const store = readConstructiongraphFromMetadata(fixture);
assert.equal(store.clients[0]?.name, 'Old Client');
assert.equal((store.clients[0] as { extra_city?: string }).extra_city, 'Kept');
assert.equal((store as { legacy_note?: string }).legacy_note, 'pre-113');
assert.equal(store.programme[0]?.kind, 'task');
assert.deepEqual(store.programme[0]?.depends_on, []);
assert.equal(store.programme[0]?.eot_days, 0);
assert.equal(store.programme[0]?.activity, 'Dig');
assert.deepEqual(store.diary, []);
assert.equal(store.settings.public_token, 'cg_oldtoken1');
assert.equal((store.settings as { custom_flag?: boolean }).custom_flag, true);

const written = writeConstructiongraphToMetadata(fixture, store);
assert.equal(written.kept_outside, 'still-here');
assert.equal(written.timezone, 'Africa/Johannesburg');
const again = readConstructiongraphFromMetadata(written);
assert.equal((again as { legacy_note?: string }).legacy_note, 'pre-113');
assert.equal(again.programme[0]?.kind, 'task');

const merged = mergeConstructiongraphStore(store, { sites: [{ id: 's2', code: 'NEW', name: 'Annex' }] });
assert.ok(merged.sites.some((row) => row.id === 's1'));
assert.ok(merged.sites.some((row) => row.id === 's2'));

console.log('brief113-backward.test.ts ok');
