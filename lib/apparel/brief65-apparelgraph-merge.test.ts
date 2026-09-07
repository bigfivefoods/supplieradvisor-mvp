/**
 * Brief 65 — apparelgraph deep-merge behavior.
 * Run: npx --yes tsx lib/apparel/brief65-apparelgraph-merge.test.ts
 */
import assert from 'node:assert/strict';
import {
  emptyApparelgraphStore,
  mergeApparelgraphStore,
  readApparelgraphFromMetadata,
  writeApparelgraphToMetadata,
} from './apparelgraph';

const existing = mergeApparelgraphStore(emptyApparelgraphStore(), {
  capability: { lines: 2, operators: 18, units_per_day: 520, lead_days: 14 },
  styles: {
    matrix: [
      { id: 'm1', style_code: 'A1', colour: 'Black', size: 'M', planned_qty: 100 },
      { id: 'm2', style_code: 'A2', colour: 'Blue', size: 'L', planned_qty: 120 },
    ],
    techPack: [{ id: 'tp1', style_code: 'A1', version: 'v1' }],
    bom: [],
  },
});

const merged = mergeApparelgraphStore(existing, {
  capability: {
    lines: existing.capability.lines,
    operators: 22,
    units_per_day: existing.capability.units_per_day,
    lead_days: existing.capability.lead_days,
  },
  styles: {
    matrix: [
      { id: 'm2', style_code: 'A2', colour: 'Blue', size: 'L', planned_qty: 180 },
      { id: 'm3', style_code: 'A3', colour: 'Olive', size: 'S', planned_qty: 60 },
    ],
    techPack: [],
    bom: [],
  },
});

assert.equal(merged.capability.lines, 2);
assert.equal(merged.capability.operators, 22);
assert.deepEqual(
  merged.styles.matrix.map((row) => row.id),
  ['m2', 'm3', 'm1']
);
assert.equal(merged.styles.matrix[0]?.planned_qty, 180);

const metadata = writeApparelgraphToMetadata({ timezone: 'Africa/Johannesburg' }, merged);
assert.equal(metadata.timezone, 'Africa/Johannesburg');
const roundTrip = readApparelgraphFromMetadata(metadata);
assert.equal(roundTrip.capability.operators, 22);
assert.equal(roundTrip.styles.matrix.length, 3);

console.log('brief65-apparelgraph-merge.test.ts ok');
