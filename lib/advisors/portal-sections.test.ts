/**
 * Run: npx --yes tsx lib/advisors/portal-sections.test.ts
 */
import assert from 'node:assert/strict';
import {
  advisorPublicEmbedPath,
  isPortalSectionOn,
  portalSectionsToLegacyFlags,
  readPortalSectionMap,
} from './portal-sections';

assert.equal(isPortalSectionOn({}, 'team'), true);
assert.equal(isPortalSectionOn({ show_coaches: false }, 'team'), false);
assert.equal(
  isPortalSectionOn({ portal_sections: { team: true }, show_coaches: false }, 'team'),
  true
);
assert.equal(
  isPortalSectionOn({ portal_sections: { join: false } }, 'join'),
  false
);

const map = readPortalSectionMap('fitgraph', {
  show_pricing: false,
  show_coaches: true,
});
assert.equal(map.team, true);
assert.equal(map.join, false);
assert.equal(map.timetable, true);

const flags = portalSectionsToLegacyFlags('fitgraph', {
  team: false,
  join: true,
  policies: false,
});
assert.equal(flags.show_coaches, false);
assert.equal(flags.show_pricing, true);
assert.equal(flags.show_contracts, false);

assert.equal(
  advisorPublicEmbedPath('fitgraph', 'abc'),
  '/embed/fitgraph/abc'
);
assert.equal(
  advisorPublicEmbedPath('physiograph', 'tok'),
  '/embed/advisor/physiograph/tok'
);

console.log('portal-sections.test.ts ok');
