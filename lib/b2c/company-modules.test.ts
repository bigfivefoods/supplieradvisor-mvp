/**
 * Run: npx --yes tsx lib/b2c/company-modules.test.ts
 */
import assert from 'node:assert/strict';
import {
  hasPersonalWalletDesk,
  isPersonalWalletKind,
  isWalletVisibleMembership,
} from './company-modules';

assert.equal(isPersonalWalletKind('gym'), true);
assert.equal(isPersonalWalletKind('physio'), true);
assert.equal(isPersonalWalletKind('account'), false);
assert.equal(isPersonalWalletKind('retail'), false);

assert.equal(hasPersonalWalletDesk({ retailgraph: { settings: {} } }), false);
assert.equal(
  hasPersonalWalletDesk({ fitgraph: { settings: {} } }),
  true
);

const owned = [120, 124];
assert.equal(
  isWalletVisibleMembership(
    { kind: 'account', company_id: 120, active: true },
    owned
  ),
  false
);
assert.equal(
  isWalletVisibleMembership(
    { kind: 'retail', company_id: 120, active: true },
    owned
  ),
  false
);
assert.equal(
  isWalletVisibleMembership(
    { kind: 'gym', company_id: 110, active: true },
    owned
  ),
  true
);
assert.equal(
  isWalletVisibleMembership(
    { kind: 'physio', company_id: 5745, active: true },
    owned
  ),
  true
);

console.log('company-modules tests ok');
