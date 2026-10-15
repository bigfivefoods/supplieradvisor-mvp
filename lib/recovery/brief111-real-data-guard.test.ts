/**
 * Run: npx --yes tsx lib/recovery/brief111-real-data-guard.test.ts
 */
import assert from 'node:assert/strict';
import { RECOVER_DEMO_BANNER } from './brand';
import { RealDataBlockedError, assertRealDataAllowed } from './real-data-guard';
import { validateSetRealData, ENABLE_REAL_DATA_PHRASE } from './validate';

assert.throws(
  () => assertRealDataAllowed({ real_data_enabled: false }),
  (error: unknown) => {
    assert.ok(error instanceof RealDataBlockedError);
    assert.equal(error.message, RECOVER_DEMO_BANNER);
    return true;
  }
);
assert.throws(() => assertRealDataAllowed(null), RealDataBlockedError);
assert.doesNotThrow(() => assertRealDataAllowed({ real_data_enabled: true }));

assert.equal(
  validateSetRealData({ companyRole: 'admin', enabled: true, confirm: ENABLE_REAL_DATA_PHRASE }).ok,
  false
);
assert.equal(
  validateSetRealData({ companyRole: 'owner', enabled: true, confirm: 'yes' }).ok,
  false
);
assert.equal(
  validateSetRealData({
    companyRole: 'owner',
    enabled: true,
    confirm: ENABLE_REAL_DATA_PHRASE,
  }).ok,
  true
);
assert.equal(validateSetRealData({ companyRole: 'owner', enabled: false }).ok, true);

console.log('brief111-real-data-guard.test.ts ok');
