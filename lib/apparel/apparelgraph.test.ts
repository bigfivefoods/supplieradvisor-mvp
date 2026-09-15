/**
 * ApparelAdvisor® store: range, costing, ATS, portal.
 * Run: npx --yes tsx lib/apparel/apparelgraph.test.ts
 */
import assert from 'node:assert/strict';
import {
  APPARELGRAPH_MODULE_ID,
  APPARELGRAPH_TOKEN_KEY,
  apparelgraphSeedStore,
  availableToSell,
  bomLanded,
  emptyApparelgraphStore,
  mergeApparelgraphStore,
  portalViewForToken,
  rangeReport,
  readApparelgraphFromMetadata,
  styleBomCost,
  summariseApparelgraph,
  wholesaleReport,
  writeApparelgraphToMetadata,
} from './apparelgraph';

assert.equal(APPARELGRAPH_MODULE_ID, 'apparelgraph');

const seed = apparelgraphSeedStore('2026-09-10T08:00:00.000Z');
assert.ok(seed.seasons.length >= 1);
assert.equal(seed.styleBook.length, 2);
assert.ok(seed.styles.matrix.length >= 3);
assert.ok(seed.settings.public_token);
assert.ok(seed.portals.some((p) => p.kind === 'public'));

const teeCost = styleBomCost(seed, 'BFF-T01');
assert.ok(teeCost > 0);
const fabric = seed.styles.bom.find((b) => b.id === 'bom_1')!;
assert.ok(bomLanded(fabric) > 1.35 * 42);

const navy = seed.styles.matrix.find((r) => r.id === 'smx_1')!;
assert.equal(availableToSell(navy), 1090 - 144);

const wholesale = wholesaleReport(seed);
assert.ok(wholesale.ats > 0);
assert.equal(wholesale.booked, 144 + 96 + 72);

const range = rangeReport(seed);
assert.equal(range.length, 1);
assert.equal(range[0]?.styleCount, 2);

const summary = summariseApparelgraph(seed, '2026-09-10T08:00:00.000Z');
assert.equal(summary.styleCount, 2);
assert.equal(summary.seasons, 1);
assert.ok(summary.ats > 0);
assert.equal(summary.holdBlocked, false);

const view = portalViewForToken(seed, seed.settings.public_token!, 'CutHouse');
assert.ok(view);
assert.ok(view.lines.length >= 3);
assert.ok(view.sheets.length >= 1);

const written = writeApparelgraphToMetadata({}, seed);
assert.equal(written[APPARELGRAPH_TOKEN_KEY], seed.settings.public_token);

const noMint = readApparelgraphFromMetadata({});
assert.equal(noMint.settings.public_token, undefined);
assert.equal(noMint.portals.length, 0);

const backfill = readApparelgraphFromMetadata({
  apparelgraph: {
    styles: {
      matrix: [{ id: 'm1', style_code: 'X1', colour: 'Red', size: 'S', planned_qty: 10 }],
    },
  },
});
assert.equal(backfill.styleBook.length, 1);
assert.equal(backfill.styleBook[0]?.code, 'X1');

const merged = mergeApparelgraphStore(emptyApparelgraphStore(), {
  seasons: [{ id: 's1', code: 'AW26', name: 'Winter' }],
});
assert.equal(merged.seasons[0]?.code, 'AW26');

console.log('apparelgraph.test.ts ok');
