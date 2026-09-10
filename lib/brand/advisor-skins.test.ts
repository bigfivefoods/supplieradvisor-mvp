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

assert.equal(
  advisorLandingPath({
    packIds: ['medical_practice'],
    enabledModules: { medicalgraph: true, dentalgraph: true },
  }),
  '/dashboard/medicalgraph'
);

assert.equal(
  advisorLandingPath({
    packIds: ['psychiatry'],
    enabledModules: { psychiatrygraph: true, medicalgraph: true },
  }),
  '/dashboard/psychiatrygraph'
);

assert.equal(
  landingAdvisorSkins({
    enabledModules: { vetgraph: true },
  })[0]?.id,
  'vet'
);

assert.equal(
  advisorLandingPath({
    packIds: ['veterinary'],
    enabledModules: { vetgraph: true, medicalgraph: true },
  }),
  '/dashboard/vetgraph'
);

assert.equal(
  advisorLandingPath({
    packIds: ['apparel'],
    enabledModules: { apparelgraph: true, quarrygraph: true },
  }),
  '/dashboard/apparelgraph'
);

assert.equal(
  landingAdvisorSkins({
    enabledModules: { apparelgraph: true },
  })[0]?.id,
  'apparel'
);

assert.equal(
  advisorLandingPath({
    packIds: ['construction_building'],
    enabledModules: { constructiongraph: true, apparelgraph: true },
  }),
  '/dashboard/constructiongraph'
);

assert.equal(
  landingAdvisorSkins({
    enabledModules: { constructiongraph: true },
  })[0]?.id,
  'construction'
);

console.log('advisor-skins.test.ts ok');
