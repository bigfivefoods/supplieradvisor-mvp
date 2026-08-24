/**
 * Run: npx --yes tsx lib/portals/portal-documents.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyPortalDocSlotUrl,
  emptyRequiredDocSlots,
  isPortalDocUrl,
  isPortalRequiredDocField,
  mergePortalDocSlots,
  mergeRequiredDocIntoMetadata,
  mergeExtraDocIntoMetadata,
  PORTAL_REQUIRED_DOCS,
} from './portal-documents';

assert.equal(PORTAL_REQUIRED_DOCS.length, 7);
assert.equal(
  PORTAL_REQUIRED_DOCS.some((d) => d.field === 'bank_confirmation_url'),
  true
);
assert.equal(isPortalRequiredDocField('bank_confirmation_url'), true);
assert.equal(isPortalRequiredDocField('logo_url'), false);
assert.equal(isPortalDocUrl('https://files.example/bank.pdf'), true);
assert.equal(isPortalDocUrl('ftp://nope'), false);

const empty = emptyRequiredDocSlots();
assert.equal(empty.length, 7);
assert.equal(
  empty.every((s) => s.url === null),
  true
);

const slots = mergePortalDocSlots({
  profileRow: {
    registration_certificate_url: 'https://h/reg.pdf',
    vat_document_url: 'https://h/vat.pdf',
    metadata: {
      documents: [{ name: 'Policy', url: 'https://h/policy.pdf', category: 'Other' }],
    },
  },
  metadata: {
    required_documents: {
      bank_confirmation_url: 'https://a/bank.pdf',
    },
    documents: [
      { name: 'VAT certificate', url: 'https://a/vat-newer.pdf' },
      { name: 'Contract', url: 'https://a/contract.pdf', category: 'Legal' },
    ],
  },
});
assert.equal(slots.find((s) => s.field === 'registration_certificate_url')?.url, 'https://h/reg.pdf');
assert.equal(slots.find((s) => s.field === 'vat_certificate_url')?.url, 'https://a/vat-newer.pdf');
assert.equal(slots.find((s) => s.field === 'bank_confirmation_url')?.url, 'https://a/bank.pdf');
assert.equal(slots.find((s) => s.field === 'bee_certificate_url')?.url, null);
assert.equal(slots.some((s) => s.name === 'Contract' && s.extra), true);
assert.equal(slots.filter((s) => !s.extra).length, 7);

const patched = applyPortalDocSlotUrl(slots, 'bee_certificate_url', 'https://a/bee.pdf');
assert.equal(patched.find((s) => s.field === 'bee_certificate_url')?.url, 'https://a/bee.pdf');

const meta = mergeRequiredDocIntoMetadata(
  { documents: [{ name: 'Keep', url: 'https://k.pdf' }] },
  'bank_confirmation_url',
  'https://bank.pdf',
  '2026-08-24T00:00:00.000Z'
);
assert.equal(
  (meta.required_documents as Record<string, string>).bank_confirmation_url,
  'https://bank.pdf'
);
assert.equal(
  (meta.documents as Array<{ name: string }>)[0].name,
  'Bank confirmation letter'
);

const extraMeta = mergeExtraDocIntoMetadata(
  { documents: [] },
  {
    name: 'Pack spec',
    url: 'https://files.example/spec.pdf',
    category: 'Quality',
    nowIso: '2026-08-24T00:00:00.000Z',
  }
);
assert.equal(
  (extraMeta.documents as Array<{ name: string; extra?: boolean }>)[0].name,
  'Pack spec'
);
assert.equal(
  (extraMeta.documents as Array<{ extra?: boolean }>)[0].extra,
  true
);

console.log('portal-documents.test.ts ok');
