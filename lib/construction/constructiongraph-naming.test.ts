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
  'lib/construction/portal-tokens.ts',
  'lib/construction/sha256.ts',
  'lib/construction/staff-access.ts',
  'lib/construction/metadata-commit.ts',
  'lib/construction/portal-throttle.ts',
  'lib/construction/portal-issue.ts',
  'lib/construction/staff-book.ts',
  'lib/construction/public-book.ts',
  'lib/construction/brief112-portal-tokens.test.ts',
  'lib/construction/brief112-portal-views.test.ts',
  'lib/construction/brief112-portal-routes.test.ts',
  'lib/construction/brief112-staff-route.test.ts',
  'lib/construction/brief112-portal-db.test.ts',
  'supabase/migrations/20261018_constructiongraph_portal_hardening.sql',
  'e2e/constructiongraph-portal-smoke.spec.ts',
  'public/sw.js',
];

const touchedUi = [
  'app/construction/[token]/page.tsx',
  'app/dashboard/constructiongraph/portal/page.tsx',
  'app/dashboard/constructiongraph/page.tsx',
  'public/sw.js',
];
for (const rel of touchedUi) {
  const src = readFileSync(resolve(rel), 'utf8');
  assert.equal(
    /ConstructionAdvisor(?!®)/.test(src),
    false,
    `${rel} must write ConstructionAdvisor®`
  );
}

for (const rel of files) {
  const src = readFileSync(resolve(rel), 'utf8');
  assert.equal(
    /BuilderAdvisor|BuildingAdvisor/i.test(src),
    false,
    `${rel} should not introduce BuilderAdvisor / BuildingAdvisor naming`
  );
}

console.log('constructiongraph-naming.test.ts ok');
