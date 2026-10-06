/**
 * Run: npx --yes tsx lib/credit/brief79-validate.test.ts
 */
import assert from 'node:assert/strict';
import { maskAccountNumber, maskIdNumber } from '@/lib/credit/mask';
import {
  isValidCipc,
  isValidSaId,
  isValidSarsVat,
  validateDraft,
  validateSubmit,
  validateUploadFile,
} from '@/lib/credit/validate';

assert.equal(isValidSaId('8001015009087'), true, 'valid SA ID should pass');
assert.equal(isValidSaId('8001015009086'), false, 'invalid SA ID should fail Luhn');
assert.equal(isValidCipc('2018/123456/07'), true, 'valid CIPC should pass');
assert.equal(isValidCipc('A018/123/07'), false, 'invalid CIPC should fail');
assert.equal(isValidSarsVat('4123456789'), true, 'valid VAT should pass');
assert.equal(isValidSarsVat('3123456789'), false, 'invalid VAT should fail');

const draft = validateDraft({
  business: { trading_name: '  Big Foods  ' },
});
assert.equal(draft.ok, true, 'draft should allow partial payload');
if (draft.ok) {
  assert.equal(draft.value.business?.trading_name, 'Big Foods');
}

const baseSubmit = {
  country_code: 'ZA',
  business: {
    trading_name: 'Big Foods',
    registered_name: 'Big Foods Pty Ltd',
    entity_type: 'pty',
    registration_number: '2018/123456/07',
    vat_number: '4123456789',
  },
  contacts: {
    accounts: { name: 'Alice', email: 'a@x.com', phone: '123' },
    buyer: { name: 'Bob', email: 'b@x.com', phone: '456' },
  },
  bank: {
    bank_name: 'FNB',
    branch_code: '250655',
    account_holder: 'Big Foods Pty Ltd',
    account_number: '1234567890',
  },
  requested_terms: '30 days from statement',
  requested_limit: 50000,
  trade_references: [
    { company: 'A', contact: 'A', phone: '1', email: 'a@a.com' },
    { company: 'B', contact: 'B', phone: '2', email: 'b@b.com' },
    { company: 'C', contact: 'C', phone: '3', email: 'c@c.com' },
  ],
  principals: [{ full_name: 'Principal A', role: 'Director', id_type: 'sa_id', id_number: '8001015009087' }],
  consent: { popia: true, credit_check: true, terms_accepted: true },
  signature: { typed_name: 'Alice A', capacity: 'Director' },
};

const missingDocs = validateSubmit(baseSubmit, []);
assert.equal(missingDocs.ok, false, 'submit should fail if required docs are missing');

const missingConsent = validateSubmit(
  { ...baseSubmit, consent: { popia: false, credit_check: true, terms_accepted: true } },
  [
    { doc_type: 'cipc_registration' },
    { doc_type: 'bank_confirmation' },
    { doc_type: 'vat_certificate' },
    { doc_type: 'id_copy' },
  ]
);
assert.equal(missingConsent.ok, false, 'submit should fail missing consent');

const validSubmit = validateSubmit(baseSubmit, [
  { doc_type: 'cipc_registration' },
  { doc_type: 'bank_confirmation' },
  { doc_type: 'vat_certificate' },
  { doc_type: 'id_copy' },
]);
assert.equal(validSubmit.ok, true, 'submit should pass with all required fields/docs');

const withUnknown = validateDraft({
  business: { trading_name: 'Big', unknown_key: 'x' } as unknown as Record<string, unknown>,
});
assert.equal(withUnknown.ok, false, 'unknown keys must be rejected');

const longInput = validateDraft({
  business: { trading_name: '   X'.repeat(200) },
});
assert.equal(longInput.ok, true);
if (longInput.ok) {
  assert.ok(String(longInput.value.business?.trading_name || '').length <= 240, 'strings should be capped');
}

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
assert.equal(validateUploadFile({ fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 100, bytes: pdfBytes }).ok, true);
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert.equal(validateUploadFile({ fileName: 'a.png', mimeType: 'image/png', sizeBytes: 100, bytes: pngBytes }).ok, true);
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
assert.equal(validateUploadFile({ fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 100, bytes: jpgBytes }).ok, true);
const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
assert.equal(validateUploadFile({ fileName: 'a.webp', mimeType: 'image/webp', sizeBytes: 100, bytes: webpBytes }).ok, true);
const exePretendPdf = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
assert.equal(validateUploadFile({ fileName: 'virus.pdf', mimeType: 'application/pdf', sizeBytes: 100, bytes: exePretendPdf }).ok, false);
assert.equal(validateUploadFile({ fileName: 'big.pdf', mimeType: 'application/pdf', sizeBytes: 11 * 1024 * 1024, bytes: pdfBytes }).ok, false);

assert.equal(maskAccountNumber('1234567890'), '•••• 7890');
assert.equal(maskIdNumber('8001015009087').endsWith('9087'), true);

console.log('brief79-validate.test.ts ok');
