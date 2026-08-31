/**
 * Brief 27 — receive-from-po select guards
 * Run: npx --yes tsx lib/procurement/brief27-receive-from-po.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve('lib/procurement/receive-from-po.ts'), 'utf8');

// 1. Initial PO select does NOT include order_number
// Extract the PO_SELECT_BASE constant value
const selectMatch = src.match(/PO_SELECT_BASE\s*=\s*['"`]([^'"`]+)['"`]/);
assert.ok(selectMatch, 'PO_SELECT_BASE constant must be defined in receive-from-po.ts');
const poSelectBase = selectMatch![1];
assert.equal(
  poSelectBase.includes('order_number'),
  false,
  'PO_SELECT_BASE must not include order_number'
);

// 2. Initial PO select DOES include po_number
assert.match(src, /po_number/, 'receive-from-po.ts must select po_number');

// 3. Uses strip-retry helpers from lib/portals/select-retry
assert.match(
  src,
  /stripSelectColumn/,
  'receive-from-po.ts must import/use stripSelectColumn from select-retry'
);
assert.match(
  src,
  /missingSelectColumn/,
  'receive-from-po.ts must import/use missingSelectColumn from select-retry'
);

// 4. PO_WIDE / PO_SOFT in host-purchase-orders still omit order_number (regression)
const hostSrc = readFileSync(
  resolve('lib/portals/host-purchase-orders.ts'),
  'utf8'
);
// Extract the PO_WIDE and PO_SOFT constant regions by checking the exported const lines
const wideLine = hostSrc.match(/PO_WIDE\s*=\s*['"`]([^'"`]+)['"`]/)?.[1] || '';
const softLine = hostSrc.match(/PO_SOFT\s*=\s*['"`]([^'"`]+)['"`]/)?.[1] || '';
assert.equal(
  wideLine.includes('order_number'),
  false,
  'PO_WIDE must not include order_number'
);
assert.equal(
  softLine.includes('order_number'),
  false,
  'PO_SOFT must not include order_number'
);

console.log('Brief 27 receive-from-po tests passed ✓');
