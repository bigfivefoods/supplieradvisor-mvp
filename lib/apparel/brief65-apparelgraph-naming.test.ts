/**
 * Brief 65 — keep new product naming as ApparelAdvisor®.
 * Run: npx --yes tsx lib/apparel/brief65-apparelgraph-naming.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'lib/apparel/apparelgraph.ts',
  'app/api/apparel/apparelgraph/route.ts',
  'components/apparel/ApparelgraphShell.tsx',
  'components/apparel/ApparelgraphWorkbench.tsx',
  'app/dashboard/apparelgraph/layout.tsx',
  'app/dashboard/apparelgraph/page.tsx',
  'app/dashboard/apparelgraph/capability/page.tsx',
  'app/dashboard/apparelgraph/styles/page.tsx',
  'app/dashboard/apparelgraph/samples/page.tsx',
  'app/dashboard/apparelgraph/materials/page.tsx',
  'app/dashboard/apparelgraph/floor/page.tsx',
  'app/dashboard/apparelgraph/quality/page.tsx',
  'app/dashboard/apparelgraph/ship/page.tsx',
];

for (const rel of files) {
  const src = readFileSync(resolve(rel), 'utf8');
  assert.equal(
    /ClothingAdvisor/i.test(src),
    false,
    `${rel} should not introduce ClothingAdvisor naming`
  );
}

console.log('brief65-apparelgraph-naming.test.ts ok');
