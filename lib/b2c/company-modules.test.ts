/**
 * Run: npx --yes tsx lib/b2c/company-modules.test.ts
 */
import assert from 'node:assert/strict';
import {
  hasPersonalWalletDesk,
  isHiddenPersonalWalletCompany,
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

assert.equal(
  isHiddenPersonalWalletCompany({ company_id: 120 }),
  true
);
assert.equal(
  isHiddenPersonalWalletCompany({ name: 'Big Five Direct' }),
  true
);
assert.equal(
  isHiddenPersonalWalletCompany({ company_id: 110, name: 'VUKA Fitness' }),
  false
);

// Hidden even when operator lookup is empty (CRM email match)
assert.equal(
  isWalletVisibleMembership(
    {
      kind: 'account',
      company_id: 120,
      active: true,
      company_name: 'Big Five Direct',
    },
    []
  ),
  false
);
assert.equal(
  isWalletVisibleMembership(
    {
      kind: 'retail',
      company_id: 9999,
      active: true,
      brand: 'Big Five Direct (Pty)',
    },
    []
  ),
  false
);

console.log('company-modules tests ok');
