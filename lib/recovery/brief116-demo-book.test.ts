/**
 * Run: npx --yes tsx lib/recovery/brief116-demo-book.test.ts
 */
import assert from 'node:assert/strict';
import { harbourBatches, harbourBookPayload, HARBOUR_CREDITORS, HARBOUR_TEAM } from './harbour-seed';
import { assertDemoBookAllowed, assertRealDataAllowed, DemoBookBlockedError, RealDataBlockedError } from './real-data-guard';
import { allowedBookOps } from './roles';
import { validateSaId } from './sa-id';

const batches = harbourBatches();
assert.equal(batches.length, 3);
const rows = batches.flatMap((batch) => batch.rows);
assert.ok(rows.length >= 60);
for (const row of rows) {
  const id = validateSaId(row.id_plain);
  assert.equal(id.ok, false);
  if (!id.ok) assert.equal(id.reason, 'checksum');
  for (const contact of row.contacts) {
    if (contact.kind === 'email') assert.match(contact.value, /\.example$/);
    if (contact.kind === 'phone') assert.match(contact.value, /^\+2710/);
  }
}
assert.equal(HARBOUR_CREDITORS.length, 5);
assert.equal(HARBOUR_TEAM.length, 6);
const payload = JSON.stringify(harbourBookPayload());
assert.equal(payload.includes('id_plain'), false);
assert.equal(payload.includes('id_number'), false);

assert.throws(() => assertDemoBookAllowed({ real_data_enabled: true }), DemoBookBlockedError);
assert.doesNotThrow(() => assertDemoBookAllowed({ real_data_enabled: false }));
assert.throws(() => assertRealDataAllowed({ real_data_enabled: false }), RealDataBlockedError);
assert.equal(allowedBookOps('owner').has('import.load_demo'), true);
assert.equal(allowedBookOps('owner').has('import.clear_demo'), true);
assert.equal(allowedBookOps('manager').has('import.load_demo'), true);
assert.equal(allowedBookOps('manager').has('import.clear_demo'), false);
assert.equal(allowedBookOps('agent').has('import.load_demo'), false);

console.log('brief116-demo-book.test.ts ok');
