/**
 * Run: npx --yes tsx lib/recovery/brief116-brand.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RECOVER_BRAND } from './brand';

assert.equal(RECOVER_BRAND.accent, '#00b4d8');
assert.equal(RECOVER_BRAND.accentHover, '#00b4d8');
assert.equal(RECOVER_BRAND.ink, '#0f172a');

const files = [
  'components/recovery/book-views.tsx',
  'components/recovery/RecoverInstalled.tsx',
  'components/recovery/RecoverProcessFlow.tsx',
  'components/recovery/RecoverUi.tsx',
  'lib/recovery/harbour-seed.ts',
  'lib/recovery/process-flow.ts',
  'docs/recoveradvisor-book.md',
  'docs/recoveradvisor-process-flow.md',
];
const bannedName = [ ['kwa', 'den'].join(''), ['dr', 'inc'].join('') ];
const claims = ['compliant', 'certified', 'legally', 'lawful', 'approved by the regulator'];
for (const file of files) {
  let text = '';
  try {
    text = readFileSync(resolve(file), 'utf8');
  } catch {
    continue;
  }
  const lower = text.toLowerCase();
  for (const word of bannedName) assert.equal(lower.includes(word), false, file);
  assert.doesNotMatch(text, /stone-|amber-/);
  assert.doesNotMatch(text, /<aside/);
  assert.doesNotMatch(text, /window\.(alert|confirm|prompt)/);
  assert.equal(text.includes('110'), false, file);
  assert.equal(lower.includes('vuka'), false, file);
  for (const claim of claims) assert.equal(lower.includes(claim), false, `${file} ${claim}`);
  const legal = text.match(/legal/gi) || [];
  if (legal.length) {
    assert.match(text, /gives no legal advice|legal matter|legal step|legal hand-over/);
  }
  if (file.startsWith('components/') || file.startsWith('docs/')) {
    assert.equal(text.match(/RecoverAdvisor(?!®)/), null, file);
  }
}

const favicon = createHash('sha256').update(readFileSync(resolve('app/favicon.ico'))).digest('hex');
assert.equal(favicon, '8881d68ceb8c7ab3fb3512824d5d1a6e69055ea28c74270bfeb00ad650c18712');

console.log('brief116-brand.test.ts ok');
