/**
 * Run: npx --yes tsx lib/brand/advisor-skins.test.ts
 */
import assert from 'node:assert/strict';
import { advisorLandingPath, landingAdvisorSkins } from './advisor-skins';

assert.equal(
  advisorLandingPath({
    enabledModules: { psychiatrygraph: true },
  }),
  '/dashboard/psychiatrygraph'
);

assert.equal(
  advisorLandingPath({
    enabledModules: { fitgraph: true, psychiatrygraph: true },
    sidebarOrder: ['psychiatrygraph', 'fitgraph'],
  }),
  '/dashboard/psychiatrygraph'
);

assert.equal(
  advisorLandingPath({
    packIds: ['fitness_gym'],
    enabledModules: { fitgraph: true, hiregraph: true },
  }),
  '/dashboard/fitgraph'
);

assert.equal(
  advisorLandingPath({
    enabledModules: { customers: true, suppliers: true },
  }),
  null
);

assert.equal(
  landingAdvisorSkins({
    enabledModules: { medicalgraph: true },
  })[0]?.id,
  'medical'
);

console.log('advisor-skins.test.ts ok');
