/**
 * Keep product naming as ConstructionAdvisor®.
 * Run: npx --yes tsx lib/construction/constructiongraph-naming.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'lib/construction/constructiongraph.ts',
  'app/api/construction/constructiongraph/route.ts',
  'app/api/public/constructiongraph/route.ts',
  'app/construction/[token]/page.tsx',
  'components/construction/ConstructiongraphShell.tsx',
  'components/construction/ConstructiongraphWorkbench.tsx',
  'app/dashboard/constructiongraph/layout.tsx',
  'app/dashboard/constructiongraph/page.tsx',
  'app/dashboard/constructiongraph/clients/page.tsx',
  'app/dashboard/constructiongraph/quotes/page.tsx',
  'app/dashboard/constructiongraph/sites/page.tsx',
  'app/dashboard/constructiongraph/drawings/page.tsx',
  'app/dashboard/constructiongraph/subcontractors/page.tsx',
  'app/dashboard/constructiongraph/materials/page.tsx',
  'app/dashboard/constructiongraph/programme/page.tsx',
  'app/dashboard/constructiongraph/payments/page.tsx',
  'app/dashboard/constructiongraph/costs/page.tsx',
  'app/dashboard/constructiongraph/safety/page.tsx',
  'app/dashboard/constructiongraph/variations/page.tsx',
  'app/dashboard/constructiongraph/certificates/page.tsx',
  'app/dashboard/constructiongraph/handover/page.tsx',
  'app/dashboard/constructiongraph/reports/page.tsx',
  'app/dashboard/constructiongraph/portal/page.tsx',
];

for (const rel of files) {
  const src = readFileSync(resolve(rel), 'utf8');
  assert.equal(
    /BuilderAdvisor|BuildingAdvisor/i.test(src),
    false,
    `${rel} should not introduce BuilderAdvisor / BuildingAdvisor naming`
  );
}

console.log('constructiongraph-naming.test.ts ok');
