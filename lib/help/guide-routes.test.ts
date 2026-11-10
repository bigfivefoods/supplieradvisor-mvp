/**
 * How-to guides live at /dashboard/guide. Old /dashboard/help links redirect.
 * Run: npx --yes tsx lib/help/guide-routes.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GUIDE_SECTIONS, buildGuideNavSteps } from '@/lib/guide/curriculum';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import { stepVisibleForRole } from '@/lib/schools/programme-role';
import { healthStepVisibleForRole } from '@/lib/health/programme-role';
import { MODULE_GUIDES, getModuleGuide } from './module-guides';
import {
  GUIDE_SLUG_ALIASES,
  HOW_TO_GUIDE_NAME,
  helpToGuideLocation,
  moduleGuidePath,
  resolveGuideRoute,
  withHowToFirst,
} from './guide-route';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

assert.equal(helpToGuideLocation('/dashboard/help'), '/dashboard/guide');
assert.equal(helpToGuideLocation('/dashboard/help/'), '/dashboard/guide');
assert.equal(
  helpToGuideLocation('/dashboard/help/accounting#guide-vat201'),
  '/dashboard/guide/accounting#guide-vat201'
);
assert.equal(
  helpToGuideLocation('/dashboard/help/fitgraph?from=sidebar#guide-floor'),
  '/dashboard/guide/fitgraph?from=sidebar#guide-floor'
);
assert.equal(helpToGuideLocation('/dashboard/accounting'), null);

const nextConfig = read('next.config.js');
assert.match(nextConfig, /source:\s*'\/dashboard\/help'/);
assert.match(nextConfig, /destination:\s*'\/dashboard\/guide'/);
assert.match(nextConfig, /source:\s*'\/dashboard\/help\/:module'/);
assert.match(nextConfig, /destination:\s*'\/dashboard\/guide\/:module'/);
assert.match(nextConfig, /permanent:\s*true/);

const helpIndex = read('app/dashboard/help/page.tsx');
const helpModule = read('app/dashboard/help/[module]/page.tsx');
assert.match(helpIndex, /permanentRedirect\('\/dashboard\/guide'\)/);
assert.match(helpModule, /permanentRedirect\(`\/dashboard\/guide\/\$\{moduleId\}`\)/);
assert.doesNotMatch(helpIndex, /MODULE_GUIDES/);
assert.doesNotMatch(helpModule, /HelpGuide/);

assert.match(read('components/help/HelpGuide.tsx'), /href="\/dashboard\/guide"/);
assert.match(read('components/help/HelpGuide.tsx'), /guideHref=\{`\/dashboard\/guide\/\$\{guide\.id\}`\}/);
assert.doesNotMatch(read('components/help/HelpGuide.tsx'), /\/dashboard\/help/);
assert.match(read('components/help/HowThisWorks.tsx'), /\/dashboard\/guide\/\$\{id\}/);
assert.doesNotMatch(read('components/help/HowThisWorks.tsx'), /\/dashboard\/help/);
assert.match(read('components/guide/ProcessDiagram.tsx'), /Open this part of the guide/);
assert.match(read('components/guide/ProcessDiagram.tsx'), /guideHref/);
assert.match(read('components/Sidebar.tsx'), /withHowToFirst/);
assert.match(read('components/Sidebar.tsx'), /BookOpen/);

for (const mod of MODULE_NAV) {
  const guide = getModuleGuide(mod.id);
  assert.ok(guide, `${mod.id} has a guide`);
  const steps = withHowToFirst(mod.id, mod.steps);
  assert.equal(steps[0]?.name, HOW_TO_GUIDE_NAME, mod.id);
  assert.equal(steps[0]?.href, moduleGuidePath(mod.id), mod.id);
  assert.equal(steps[1]?.name, mod.steps[0]?.name, `${mod.id} keeps its first process step`);
  const resolved = resolveGuideRoute(mod.id);
  assert.equal(resolved?.guide?.id, mod.id, mod.id);
  const featureIds = new Set<string>();
  for (const feature of guide.features) {
    assert.equal(featureIds.has(feature.id), false, `${mod.id}:${feature.id} duplicate`);
    featureIds.add(feature.id);
    assert.match(feature.id, /^[a-z0-9-]+$/, `${mod.id}:${feature.id}`);
  }
  for (const node of guide.flow) {
    if (!node.anchor) continue;
    assert.equal(featureIds.has(node.anchor), true, `${mod.id} anchor ${node.anchor}`);
  }
}

assert.equal(withHowToFirst('multi_entity', [{ name: 'Group structure', href: '/dashboard/my-business/group' }])[0]?.name, 'Group structure');

const schools = MODULE_NAV.find((mod) => mod.id === 'schools');
assert.ok(schools);
const schoolSteps = withHowToFirst(
  'schools',
  schools.steps.filter((step) => stepVisibleForRole(step.group, 'school'))
);
assert.equal(schoolSteps[0]?.name, HOW_TO_GUIDE_NAME);
assert.equal(schoolSteps[0]?.href, '/dashboard/guide/schools');

const health = MODULE_NAV.find((mod) => mod.id === 'health');
assert.ok(health);
const healthSteps = withHowToFirst(
  'health',
  health.steps.filter((step) => healthStepVisibleForRole(step.group, 'facility'))
);
assert.equal(healthSteps[0]?.name, HOW_TO_GUIDE_NAME);

const guideNav = withHowToFirst('guide', buildGuideNavSteps(() => true));
assert.equal(guideNav[0]?.name, HOW_TO_GUIDE_NAME);
assert.equal(guideNav[0]?.href, '/dashboard/guide/guide');
assert.equal(guideNav[1]?.name, 'Start');
assert.equal(guideNav[1]?.href, '/dashboard/guide');

for (const [slug, moduleId] of Object.entries(GUIDE_SLUG_ALIASES)) {
  const resolved = resolveGuideRoute(slug);
  assert.equal(resolved?.guide?.id, moduleId, slug);
  assert.equal(resolved?.section?.slug, slug, slug);
  assert.equal(resolveGuideRoute(moduleId)?.guide?.id, moduleId);
}

for (const section of GUIDE_SECTIONS) {
  const resolved = resolveGuideRoute(section.slug);
  assert.ok(resolved, section.slug);
  assert.ok(resolved.guide || resolved.section, section.slug);
}

assert.equal(resolveGuideRoute('golden-path')?.guide, null);
assert.equal(resolveGuideRoute('golden-path')?.section?.slug, 'golden-path');
assert.equal(resolveGuideRoute('not-a-module'), null);
assert.equal(MODULE_GUIDES.length, MODULE_NAV.length);

const helpGuide = read('components/help/HelpGuide.tsx');
assert.match(helpGuide, /id=\{`guide-\$\{feature\.id\}`\}/);

console.log(`guide-routes.test.ts ok (${MODULE_NAV.length} modules)`);
