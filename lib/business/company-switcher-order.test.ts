/**
 * Run: npx --yes tsx lib/business/company-switcher-order.test.ts
 */
import assert from 'node:assert/strict';
import { sortCompaniesForSwitcher } from './company-switcher-order';

const sorted = sortCompaniesForSwitcher([
  { id: '110', trading_name: 'VUKA Fitness' },
  { id: '123', trading_name: 'Big Five Foods Kenya Limmited' },
  { id: '102', trading_name: 'Big Five Foods' },
  { id: '124', trading_name: 'Big Five Direct' },
  { id: '5748', trading_name: 'Big Five Group' },
  { id: '5743', trading_name: 'Big Five Connect', entity_kind: 'platform' },
]);

assert.deepEqual(
  sorted.map((c) => c.trading_name),
  [
    'Big Five Connect',
    'Big Five Group',
    'Big Five Foods',
    'VUKA Fitness',
    'Big Five Direct',
    'Big Five Foods Kenya Limmited',
  ]
);

const byName = sortCompaniesForSwitcher([
  { id: '9', trading_name: 'VUKA Fitness' },
  { id: '8', trading_name: 'Big Five Foods' },
  { id: '7', trading_name: 'Big Five Group' },
  { id: '6', trading_name: 'Big Five Connect' },
]);
assert.deepEqual(
  byName.map((c) => c.trading_name),
  ['Big Five Connect', 'Big Five Group', 'Big Five Foods', 'VUKA Fitness']
);

console.log('company-switcher-order.test.ts ok');
