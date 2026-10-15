/**
 * Run: npx --yes tsx lib/recovery/brief116-normalise.test.ts
 */
import assert from 'node:assert/strict';
import { normaliseEmail, normaliseName, normalisePhoneZA, parseAmountCents, parseDateStrict } from './normalise';

assert.equal(normalisePhoneZA('0821234567').ok && normalisePhoneZA('0821234567').value, '+27821234567');
assert.equal(normalisePhoneZA('27821234567').ok && normalisePhoneZA('27821234567').value, '+27821234567');
assert.equal(normalisePhoneZA('+27 82-123-4567').ok && normalisePhoneZA('+27 82-123-4567').value, '+27821234567');
assert.equal(normalisePhoneZA('010 000 0001').ok && normalisePhoneZA('010 000 0001').value, '+27100000001');
assert.equal(normalisePhoneZA('not-a-phone').ok, false);
assert.equal(normaliseEmail(' Ada@Example.com ').ok && normaliseEmail(' Ada@Example.com ').value, 'ada@example.com');
assert.equal(normaliseEmail('ada').ok, false);
assert.equal(normaliseName('  Élsa   Botha '), 'elsa botha');

assert.equal(parseAmountCents('R 1 234,56').ok && parseAmountCents('R 1 234,56').cents, 123456);
assert.equal(parseAmountCents('1,234.56').ok && parseAmountCents('1,234.56').cents, 123456);
assert.equal(parseAmountCents('1234.56').ok && parseAmountCents('1234.56').cents, 123456);
assert.equal(parseAmountCents('-1').ok, false);
assert.equal(parseAmountCents('NaN').ok, false);
assert.equal(parseAmountCents('1e6').ok, false);
assert.equal(parseAmountCents('999999999999').ok, false);

assert.equal(parseDateStrict('2026-01-20', { purpose: 'default_date', today: '2026-06-15' }).ok, true);
assert.equal(parseDateStrict('20/01/2026', { purpose: 'default_date', today: '2026-06-15' }).ok, true);
assert.equal(parseDateStrict('31/02/2026').ok, false);
assert.equal(parseDateStrict('2026-12-01', { purpose: 'default_date', today: '2026-06-15' }).ok, false);
assert.equal(parseDateStrict('1989-12-31', { purpose: 'default_date', today: '2026-06-15' }).ok, false);

console.log('brief116-normalise.test.ts ok');
