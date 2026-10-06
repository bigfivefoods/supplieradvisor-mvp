/**
 * Run: npx --yes tsx lib/storage/resolve-stored-doc.test.ts
 */
import assert from 'node:assert/strict';
import { resolveStoredDoc } from '@/lib/storage/private-docs';

const ref = 'sb://sensitive-documents/42/payment/123-file.pdf';
const resolvedRef = resolveStoredDoc(ref);
assert.equal(resolvedRef.legacy, false);
assert.equal(resolvedRef.primary.bucket, 'sensitive-documents');
assert.equal(resolvedRef.primary.path, '42/payment/123-file.pdf');
assert.equal(resolvedRef.candidates.length, 1);

for (const bucket of ['company-documents', 'certificates', 'product-documents']) {
  const input = `https://proj.supabase.co/storage/v1/object/public/${bucket}/9/path/doc.pdf`;
  const resolved = resolveStoredDoc(input);
  assert.equal(resolved.legacy, true);
  assert.equal(resolved.candidates[0].bucket, 'sensitive-documents');
  assert.equal(resolved.candidates[0].path, `legacy/${bucket}/9/path/doc.pdf`);
  assert.equal(resolved.candidates[1].bucket, bucket);
  assert.equal(resolved.candidates[1].path, '9/path/doc.pdf');
}

assert.throws(() => resolveStoredDoc('https://example.com/file.pdf'));
assert.throws(() => resolveStoredDoc('sb://missing-parts'));

console.log('✓ resolveStoredDoc passed');
