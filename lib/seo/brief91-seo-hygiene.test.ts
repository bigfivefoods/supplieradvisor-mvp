/**
 * Brief 91 regression guardrails.
 * Run: npx --yes tsx lib/seo/brief91-seo-hygiene.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INDUSTRIES, industrySlugs } from '../marketing/industries';
import { DEFAULT_DESCRIPTION } from './site';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const industryPage = read('app/industries/[slug]/page.tsx');
const nextConfig = read('next.config.js');

assert.match(industryPage, /title:\s*ind\.name/, 'industry metadata title should come from industry name');
assert.doesNotMatch(
  industryPage,
  /title:\s*['"`][^'"`]*SupplierAdvisor/i,
  'industry metadata title must not embed SupplierAdvisor'
);

for (const ind of INDUSTRIES) {
  assert.ok(
    ind.metaDescription.length <= 160,
    `${ind.slug} metaDescription exceeds 160 chars (${ind.metaDescription.length})`
  );
}
assert.ok(
  DEFAULT_DESCRIPTION.length <= 160,
  `DEFAULT_DESCRIPTION exceeds 160 chars (${DEFAULT_DESCRIPTION.length})`
);

assert.ok(!industrySlugs().includes('staffing-recruitment' as never), 'industrySlugs() must exclude staffing-recruitment');

assert.match(
  nextConfig,
  /source:\s*'\/industries\/staffing-recruitment'[\s\S]*destination:\s*'\/industries\/hire-rental'[\s\S]*permanent:\s*true/,
  'next.config.js must keep permanent staffing-recruitment redirect'
);

console.log('brief91-seo-hygiene.test.ts ok');
