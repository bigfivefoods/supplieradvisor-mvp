/**
 * Run: npx --yes tsx lib/trades/statement-pdf.test.ts
 */
import assert from 'node:assert/strict';
import { customerPortalView, seedDemoTradegraph } from './tradegraph';
import { buildStatementPdf } from './statement-pdf';

async function main() {
  const portal = customerPortalView(
    seedDemoTradegraph('2026-10-14T08:00:00.000Z'),
    'tc_demo_thandi'
  );
  const pdf = await buildStatementPdf(portal);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 500);
  console.log('statement-pdf.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
