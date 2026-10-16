/**
 * Run: npx --yes tsx lib/recovery/brief116-import-book.test.ts
 */
import assert from 'node:assert/strict';
import { decodeBookUtf8, fileSha256, parseBookCsv, suggestMapping, validateBook } from './import-book';
import { withChecksum } from './sa-id';

const csv = '\uFEFFaccount number,debtor name,principal\r\n"ACC-1","Line\nTwo","R 1 234,56"\r\n';
const parsed = parseBookCsv(csv);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.headers[0], 'account number');
  assert.equal(parsed.rows[0][1], 'Line\nTwo');
  const mapping = suggestMapping(parsed.headers);
  assert.equal(mapping.creditor_account_ref, 'account number');
  const validated = validateBook(parsed, mapping, { today: '2026-06-15' });
  assert.equal(validated.rows[0].principal_cents, 123456);
  assert.equal(JSON.stringify(validated.errors).includes('1 234'), false);
}

const semi = parseBookCsv('acc no;name;amount\nA-1;Ada;10.00\n');
assert.equal(semi.ok, true);

const dup = parseBookCsv('reference,name,principal\nA-1,Ada,10\nA-1,Bea,10\nA-2,Cee,10\n');
assert.equal(dup.ok, true);
if (dup.ok) {
  const result = validateBook(dup, suggestMapping(dup.headers), { existingRefs: ['A-2'], today: '2026-06-15' });
  assert.equal(result.errors.filter((issue) => issue.code === 'duplicate_account').length, 2);
  assert.equal(result.summary.will_create, 1);
  assert.equal(JSON.stringify(result.errors).includes('Ada'), false);
}

const badId = withChecksum('900101500008');
const flipped = `${badId.slice(0, 12)}${(Number(badId[12]) + 1) % 10}`;
const idFile = parseBookCsv(`reference,name,principal,id number\nA-9,Ada,10,${flipped}\n`);
assert.equal(idFile.ok, true);
if (idFile.ok) {
  const result = validateBook(idFile, suggestMapping(idFile.headers), { today: '2026-06-15' });
  assert.equal(result.warnings.some((issue) => issue.code === 'invalid_id'), true);
  assert.equal(result.rows[0].id_plain, null);
  assert.equal(JSON.stringify(result.warnings).includes(flipped), false);
}

const phone = parseBookCsv('reference,name,principal,phone\nA-8,Ada,10,not-a-phone\n');
assert.equal(phone.ok, true);
if (phone.ok) {
  const result = validateBook(phone, suggestMapping(phone.headers), { today: '2026-06-15' });
  assert.equal(result.warnings.some((issue) => issue.code === 'invalid_phone'), true);
  assert.equal(result.rows[0].contacts.length, 0);
}

const badType = parseBookCsv('reference,name,principal,id type\nA-7,Ada,10,passport_card\n');
assert.equal(badType.ok, true);
if (badType.ok) {
  const result = validateBook(badType, suggestMapping(badType.headers), { today: '2026-06-15' });
  assert.equal(result.errors.some((issue) => issue.code === 'invalid_id_type'), true);
  assert.equal(result.rows.length, 0);
  assert.equal(JSON.stringify(result.errors).includes('passport_card'), false);
}

assert.equal(parseBookCsv('a,b\n' + '1,2\n'.repeat(2001)).ok, false);
assert.equal(decodeBookUtf8(Uint8Array.from([0xff, 0xfe, 0xfd])).ok, false);
async function hashes() {
  const hashA = await fileSha256('reference,name,principal\nA,B,1\n');
  const hashB = await fileSha256('reference,name,principal\nA,B,1\n');
  assert.equal(hashA, hashB);
  assert.equal(hashA.length, 64);
  console.log('brief116-import-book.test.ts ok');
}

void hashes();
