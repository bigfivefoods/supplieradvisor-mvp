/**
 * Run: npx --yes tsx lib/business/company-data.test.ts
 */
import assert from 'node:assert/strict';
import {
  COMPANY_CHROME_META_KEYS,
  isMissingRelation,
  mergeCompanyChromeLayers,
  splitModuleWriteSlice,
} from './company-data';

assert.ok(COMPANY_CHROME_META_KEYS.includes('enabled_modules'));
assert.ok(COMPANY_CHROME_META_KEYS.includes('user_sidebar_orders'));
assert.ok(!COMPANY_CHROME_META_KEYS.includes('fitgraph' as never));

const mergedChrome = mergeCompanyChromeLayers(
  {
    enabled_modules: { fitgraph: true },
    industry_packs: ['fitness_gym'],
  },
  { user_sidebar_orders: { u1: ['home', 'fitgraph'] } }
);
assert.equal(
  (mergedChrome.enabled_modules as { fitgraph?: boolean }).fitgraph,
  true
);
assert.deepEqual(mergedChrome.industry_packs, ['fitness_gym']);
assert.deepEqual(
  (mergedChrome.user_sidebar_orders as { u1?: string[] }).u1,
  ['home', 'fitgraph']
);

assert.equal(isMissingRelation({ code: '42P01', message: 'x' }), true);
assert.equal(
  isMissingRelation({ message: 'Could not find the function sa_get_module_store' }),
  true
);
assert.equal(isMissingRelation({ message: 'permission denied' }), false);

const slice = {
  fitgraph: { settings: { public_token: 'fg_1_abc' }, coaches: [] },
  fitgraph_public_token: 'fg_1_abc',
  fitgraph_coach_tokens: { t1: 'c1' },
  leftover_should_not_stay_on_module: true,
};
const split = splitModuleWriteSlice('fitgraph', slice);
assert.deepEqual(split.data, slice.fitgraph);
assert.equal(split.publicToken, 'fg_1_abc');
assert.equal(split.indexes.fitgraph_public_token, 'fg_1_abc');
assert.equal((split.indexes as { fitgraph?: unknown }).fitgraph, undefined);
assert.equal(split.indexes.leftover_should_not_stay_on_module, true);

const noToken = splitModuleWriteSlice('medicalgraph', {
  medicalgraph: { settings: {} },
});
assert.equal(noToken.publicToken, null);

console.log('company-data.test.ts ok');
