/**
 * Run: npx --yes tsx lib/chrome/customers-trade-nav.test.ts
 */
import assert from 'node:assert/strict';
import { MODULE_NAV } from './module-nav';

const customers = MODULE_NAV.find((m) => m.id === 'customers');
assert.ok(customers, 'customers module exists');

const tradeRail = customers!.steps
  .filter((s) => s.section === 'Trade' && s.rail !== false)
  .map((s) => s.name);

assert.deepEqual(tradeRail, ['Quote', 'Order', 'Invoice', 'Projects']);

const names = customers!.steps.filter((s) => s.rail !== false).map((s) => s.name);
const invoiceAt = names.indexOf('Invoice');
const projectsAt = names.indexOf('Projects');
assert.ok(invoiceAt >= 0 && projectsAt >= 0);
assert.ok(projectsAt === invoiceAt + 1, 'Projects sits immediately below Invoice');

console.log('customers-trade-nav.test.ts ok');
