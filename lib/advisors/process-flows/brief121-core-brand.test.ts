/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief121-core-brand.test.ts
 * Same word, digit and mark rules as Brief 120, on the core files. Does not edit that test.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'components/advisors/CoreProcessFlow.tsx',
  'lib/advisors/process-flows/core-caps.ts',
  'lib/advisors/process-flows/core/index.ts',
  'lib/advisors/process-flows/core/step.ts',
  'lib/advisors/process-flows/core/home.ts',
  'lib/advisors/process-flows/core/suppliers.ts',
  'lib/advisors/process-flows/core/customers.ts',
  'lib/advisors/process-flows/core/sales-portal.ts',
  'lib/advisors/process-flows/core/manufacturing.ts',
  'lib/advisors/process-flows/core/distribution.ts',
  'lib/advisors/process-flows/core/inventory.ts',
  'lib/advisors/process-flows/core/quality.ts',
  'lib/advisors/process-flows/core/sheq.ts',
  'docs/advisor-process-flows.md',
  'e2e/core-process-flows.spec.ts',
];

const bannedName = [['kwa', 'den'].join(''), ['dr', 'inc'].join('')];
const claims = [
  ['compl', 'iant'].join(''),
  ['cert', 'ified'].join(''),
  ['leg', 'ally'].join(''),
  ['law', 'ful'].join(''),
  ['approved by the ', 'regulator'].join(''),
  ['guaran', 'teed'].join(''),
  ['revolut', 'ionary'].join(''),
  ['ai-', 'powered'].join(''),
];
const classBan = new RegExp([['st', 'one-'].join(''), ['am', 'ber-'].join('')].join('|'));
const asideBan = new RegExp('<' + 'aside');
const windowBan = new RegExp('window\\.' + '(alert|confirm|prompt)');
const headersBan = new RegExp('next/' + 'headers');
const cookiesBan = new RegExp('cookies' + '\\(');
const bannedNumber = ['1', '10'].join('');
const bannedPlace = ['vu', 'ka'].join('');
const advisorWord = ['Advi', 'sor'].join('');
const mark = '®';
const advisorRe = new RegExp(
  `(Supplier|School|Gym|Recover|Trade|Construction|Fleet|Apparel|Container|Health|Crop|Quarry|Hire|Retail|Physio|Dental|Psychiatry|Medical|Vet)${advisorWord}(?!${mark})`,
  'g'
);

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lower = text.toLowerCase();
  for (const word of bannedName) assert.equal(lower.includes(word), false, file);
  advisorRe.lastIndex = 0;
  const hit = advisorRe.exec(text);
  assert.equal(hit, null, `${file} ${hit?.[0] || ''}`);
  assert.doesNotMatch(text, classBan, file);
  assert.doesNotMatch(text, asideBan, file);
  assert.doesNotMatch(text, windowBan, file);
  assert.doesNotMatch(text, headersBan, file);
  assert.doesNotMatch(text, cookiesBan, file);
  assert.equal(text.includes(bannedNumber), false, file);
  assert.equal(lower.includes(bannedPlace), false, file);
  for (const claim of claims) assert.equal(lower.includes(claim), false, `${file} ${claim}`);
  const legal = text.match(/legal/gi) || [];
  if (legal.length) assert.match(text, /gives no legal advice|legal matter|legal step|legal hand-over/);
}

console.log('brief121-core-brand.test.ts ok');
