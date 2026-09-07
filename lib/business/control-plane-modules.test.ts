/**
 * Run: npx --yes tsx lib/business/control-plane-modules.test.ts
 */
import assert from 'node:assert/strict';
import {
  BIG_FIVE_CONNECT_PROFILE_ID,
  SANDBOX_MODULE_PICKS_META,
  extractEnabledModulesFromMetadata,
  isBigFiveConnectCompany,
  isControlPlaneSandboxCompany,
  isModuleEnabled,
  mergeEnabledModulesIntoMetadata,
  moduleIdForPath,
  normalizeEnabledModules,
  resolveVisibleModules,
} from './company-modules';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import { getIndustryPack } from '@/lib/product/architecture';
import { appModulesUnlockedByPack } from '@/lib/product/architecture';

assert.equal(isBigFiveConnectCompany({ companyId: BIG_FIVE_CONNECT_PROFILE_ID }), true);
assert.equal(
  isBigFiveConnectCompany({ tradingName: 'Big Five Connect' }),
  true
);
assert.equal(
  isBigFiveConnectCompany({ companyId: 102, tradingName: 'Big Five Foods' }),
  false
);
assert.equal(
  isControlPlaneSandboxCompany({
    companyId: BIG_FIVE_CONNECT_PROFILE_ID,
    tradingName: 'Big Five Connect',
  }),
  true
);

const empty = normalizeEnabledModules({});
assert.equal(empty.apparelgraph, false, 'ApparelAdvisor is opt-in');
assert.equal(empty.fitgraph, false);
assert.equal(empty.customers, true, 'core trade hubs still default on');
assert.equal(isModuleEnabled(empty, 'apparelgraph'), false);

const bfcOff = extractEnabledModulesFromMetadata(
  {
    enabled_modules: {
      customers: true,
      suppliers: true,
      fitgraph: true,
      apparelgraph: true,
      platform: true,
    },
  },
  { companyId: BIG_FIVE_CONNECT_PROFILE_ID, companyName: 'Big Five Connect' }
);
assert.equal(bfcOff.home, true);
assert.equal(bfcOff['my-business'], true);
assert.equal(bfcOff.guide, true);
assert.equal(bfcOff.customers, false, 'Connect ignores leftover all-on maps');
assert.equal(bfcOff.fitgraph, false);
assert.equal(bfcOff.apparelgraph, false);
assert.equal(bfcOff.platform, false);
assert.equal(bfcOff.network, false);

const bfcPack = resolveVisibleModules({
  stored: { customers: true },
  packaging: { packIds: ['fitness_gym', 'apparel_fashion'] },
  metadata: { industry_packs: ['fitness_gym'] },
  companyId: BIG_FIVE_CONNECT_PROFILE_ID,
  companyName: 'Big Five Connect',
});
assert.equal(bfcPack.fitgraph, false, 'packs do not force hubs on Connect');
assert.equal(bfcPack.apparelgraph, false);

const picked = extractEnabledModulesFromMetadata(
  {
    [SANDBOX_MODULE_PICKS_META]: true,
    enabled_modules: {
      apparelgraph: true,
      customers: false,
      fitgraph: false,
      platform: true,
    },
  },
  { companyId: BIG_FIVE_CONNECT_PROFILE_ID, companyName: 'Big Five Connect' }
);
assert.equal(picked.apparelgraph, true, 'saved ApparelAdvisor stays on');
assert.equal(picked.platform, true, 'saved platform console stays on');
assert.equal(picked.fitgraph, false);
assert.equal(picked.customers, false, 'companions are not forced on Connect');
assert.equal(picked.home, true);

const saved = mergeEnabledModulesIntoMetadata(
  { slug: 'x' },
  {
    apparelgraph: true,
    customers: false,
    people: false,
    accounting: false,
  },
  { sandboxPicks: true }
);
assert.equal(saved[SANDBOX_MODULE_PICKS_META], true);
const savedMap = saved.enabled_modules as Record<string, boolean>;
assert.equal(savedMap.apparelgraph, true);
assert.equal(savedMap.customers, false, 'sandbox save does not force companions');
assert.equal(savedMap.home, true);

assert.equal(moduleIdForPath('/dashboard/apparelgraph/styles'), 'apparelgraph');
assert.ok(MODULE_NAV.some((m) => m.id === 'apparelgraph'));
assert.equal(
  MODULE_NAV.find((m) => m.id === 'apparelgraph')?.name,
  'ApparelAdvisor'
);

const pack = getIndustryPack('apparel');
assert.ok(pack, 'ApparelAdvisor industry pack exists');
assert.ok(appModulesUnlockedByPack(pack!).includes('apparelgraph'));

const foods = extractEnabledModulesFromMetadata(
  { enabled_modules: { customers: true } },
  { companyId: 102, companyName: 'Big Five Foods' }
);
assert.equal(foods.customers, true);
assert.equal(foods.apparelgraph, false);
assert.equal(foods.network, true, 'other companies keep core defaults');

console.log('control-plane-modules.test.ts ok');
