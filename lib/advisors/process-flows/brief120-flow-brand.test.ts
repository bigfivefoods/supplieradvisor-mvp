/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-brand.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FLOW_BRAND } from './brand';

assert.equal(FLOW_BRAND.accent, '#00b4d8');
assert.equal(FLOW_BRAND.ink, '#0f172a');
assert.equal(FLOW_BRAND.link, '#0077b6');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|md)$/.test(name)) acc.push(full);
  }
  return acc;
}

const files = [
  ...walk('lib/advisors/process-flows'),
  'components/advisors/AdvisorProcessFlow.tsx',
  'docs/advisor-process-flows.md',
  'e2e/advisor-process-flows.spec.ts',
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

function openingTag(source: string, marker: string): string {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = source.lastIndexOf('<button', at);
  assert.ok(start >= 0, marker);
  let end = start + '<button'.length;
  while (end < source.length && !(source[end] === '>' && source[end - 1] !== '=')) end += 1;
  assert.ok(end < source.length, marker);
  return source.slice(start, end + 1);
}

const whiteOnToggle = /color\s*:\s*['"](?:#fff\b|#ffffff\b|white)['"]/i;
for (const [file, marker] of [
  ['components/advisors/AdvisorProcessFlow.tsx', 'advisor-flow-toggle'],
  ['components/recovery/RecoverProcessFlow.tsx', 'recover-flow-toggle'],
] as const) {
  const tag = openingTag(readFileSync(file, 'utf8'), marker);
  assert.equal(whiteOnToggle.test(tag), false, `${file} toggle ${tag}`);
}

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lower = text.toLowerCase();
  const isTest = file.includes('.test.');
  for (const word of bannedName) assert.equal(lower.includes(word), false, file);
  advisorRe.lastIndex = 0;
  const hit = advisorRe.exec(text);
  assert.equal(hit, null, `${file} ${hit?.[0] || ''}`);
  if (isTest) continue;
  assert.doesNotMatch(text, classBan);
  assert.doesNotMatch(text, asideBan);
  assert.doesNotMatch(text, windowBan);
  assert.doesNotMatch(text, headersBan);
  assert.doesNotMatch(text, cookiesBan);
  assert.equal(text.includes(bannedNumber), false, file);
  assert.equal(lower.includes(bannedPlace), false, file);
  for (const claim of claims) assert.equal(lower.includes(claim), false, `${file} ${claim}`);
  const legal = text.match(/legal/gi) || [];
  if (legal.length) {
    assert.match(text, /gives no legal advice|legal matter|legal step|legal hand-over/);
  }
}

console.log('brief120-flow-brand.test.ts ok');
