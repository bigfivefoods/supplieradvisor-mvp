/**
 * FleetAdvisor® CSV parser and formula guard.
 * Run: npx --yes tsx lib/fleet/brief115-csv.test.ts
 */
import assert from 'node:assert/strict';
import { decodeUtf8, guardFormula, parseCsv, writeCsv } from './csv';

const bom = parseCsv('\uFEFFreg_no,kind\r\nSAMPLE 1,rigid\r\n');
assert.equal(bom.ok, true);
if (bom.ok) {
  assert.equal(bom.table.headers[0], 'reg_no');
  assert.equal(bom.table.records[0].cells[0], 'SAMPLE 1');
}

const quoted = parseCsv('name,note\n"Sample, Driver","line1\nline2 ""quoted"""\n');
assert.equal(quoted.ok, true);
if (quoted.ok) {
  assert.equal(quoted.table.records[0].cells[0], 'Sample, Driver');
  assert.equal(quoted.table.records[0].cells[1], 'line1\nline2 "quoted"');
}

const semi = parseCsv('reg_no;kind\nSAMPLE 2;van\n');
assert.equal(semi.ok, true);
if (semi.ok) assert.equal(semi.table.delimiter, ';');

const ragged = parseCsv('a,b,c\n1,2\n');
assert.equal(ragged.ok, true);

const bytes = new Uint8Array([0xff, 0xfe, 0x41]);
assert.equal(decodeUtf8(bytes).ok, false);
assert.equal(decodeUtf8(new TextEncoder().encode('SAMPLE')).ok, true);

for (const lead of ['=', '+', '-', '@', '\t', '\r']) {
  const cell = guardFormula(`${lead}cmd`);
  assert.equal(cell.startsWith("'"), true, lead);
  const csv = writeCsv(['value'], [[`${lead}cmd`]]);
  assert.equal(csv.includes(`'${lead}cmd`), true);
}

const blocked = parseCsv('full_name,licence_number\nSample,123\n');
assert.equal(blocked.ok, false);
if (!blocked.ok) {
  assert.equal(blocked.errors[0].code, 'forbidden_header');
  assert.match(blocked.errors[0].message || '', /ignored/);
  assert.equal(JSON.stringify(blocked.errors).includes('123'), false);
}

for (const header of ['ID Number', 'Licence Number', 'Identity Number', 'id number', 'LICENCE NUMBER']) {
  const parsed = parseCsv(`${header},full_name\n123,Sample\n`);
  assert.equal(parsed.ok, false, header);
  if (!parsed.ok) {
    assert.equal(parsed.errors[0].code, 'forbidden_header');
    assert.match(parsed.errors[0].message || '', /was ignored/);
    assert.equal(JSON.stringify(parsed.errors).includes('123'), false);
  }
}

const passport = parseCsv('passport,name\nA,Sample\n');
assert.equal(passport.ok, false);

const huge = `a\n${'x'.repeat(501)}\n`;
const capped = parseCsv(huge);
assert.equal(capped.ok, false);

console.log('brief115-csv.test.ts ok');
