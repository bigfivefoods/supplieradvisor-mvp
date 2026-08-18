/**
 * Run: npx --yes tsx lib/dental/dental-appointment-inventory.test.ts
 */
import assert from 'node:assert/strict';
import {
  billableTotal,
  markMaterialsPosted,
  materialsIssueDelta,
  normalizeDentalMaterials,
} from './dental-appointment-inventory';

const lines = normalizeDentalMaterials([
  {
    product_id: 12,
    name: 'Composite A2',
    quantity: 2,
    unit_price: 85,
    billable: true,
    posted_qty: 1,
  },
  { product_id: 'demo', name: 'Etch', quantity: 1, unit_price: 0, billable: false },
  { name: '', quantity: 3 },
  { product_id: 9, name: 'Skip', quantity: 0 },
]);
assert.equal(lines.length, 2);
assert.equal(lines[0].product_id, 12);
assert.equal(lines[0].posted_qty, 1);
assert.equal(billableTotal(lines), 170);

const issue = materialsIssueDelta(lines);
assert.equal(issue.length, 1);
assert.equal(issue[0].product_id, 12);
assert.equal(issue[0].quantity, 1);

const posted = markMaterialsPosted(lines);
assert.equal(posted[0].posted_qty, 2);
assert.equal(materialsIssueDelta(posted).length, 0);

console.log('dental-appointment-inventory ok');
