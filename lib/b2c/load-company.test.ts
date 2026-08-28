/**
 * Run: npx --yes tsx lib/b2c/load-company.test.ts
 */
import assert from 'node:assert/strict';
import { overlayAdvisorStores, splitWalletMetaForSave } from './load-company';

const base = {
  member_accounts: { payments: [] },
  fitgraph: { clients: [{ id: 'c1' }] },
  fitgraph_public_token: 'fg_110_abc',
  leftover: true,
};

const overlaid = overlayAdvisorStores(base, [
  { module: 'fitgraph', data: { clients: [{ id: 'live' }] } },
  { module: 'nope', data: { x: 1 } },
]);
assert.equal(
  (overlaid.fitgraph as { clients: Array<{ id: string }> }).clients[0].id,
  'live'
);
assert.deepEqual(overlaid.member_accounts, { payments: [] });
assert.equal(overlaid.leftover, true);

const nested = overlayAdvisorStores(
  {},
  [{ module: 'fitgraph', data: { fitgraph: { clients: [{ id: 'nested' }] } } }]
);
assert.equal(
  (nested.fitgraph as { clients: Array<{ id: string }> }).clients[0].id,
  'nested'
);

const split = splitWalletMetaForSave(overlaid);
assert.equal(split.modules.length, 1);
assert.equal(split.modules[0].key, 'fitgraph');
assert.deepEqual(split.modules[0].slice.fitgraph, overlaid.fitgraph);
assert.equal(split.modules[0].slice.fitgraph_public_token, 'fg_110_abc');
assert.equal((split.patch as { fitgraph?: unknown }).fitgraph, undefined);
assert.equal(split.patch.fitgraph_public_token, undefined);
assert.deepEqual(split.patch.member_accounts, { payments: [] });
assert.equal(split.patch.leftover, true);

const walletOnly = splitWalletMetaForSave({
  member_accounts: { payments: [1] },
});
assert.equal(walletOnly.modules.length, 0);
assert.deepEqual(walletOnly.patch, { member_accounts: { payments: [1] } });

console.log('load-company.test.ts ok');
