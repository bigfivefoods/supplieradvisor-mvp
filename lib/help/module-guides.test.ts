/**
 * Every sidebar module has a how-to, and the copy stays free of sample companies.
 * Run: npx --yes tsx lib/help/module-guides.test.ts
 */
import assert from 'node:assert/strict';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import { guideIdForPath } from './guide-path';
import { MODULE_GUIDES, getModuleGuide } from './module-guides';

assert.equal(MODULE_GUIDES.length, MODULE_NAV.length);

for (const mod of MODULE_NAV) {
  const guide = getModuleGuide(mod.id);
  assert.ok(guide, mod.id);
  assert.equal(guide.href, mod.href);
  assert.ok(guide.purpose.length > 20, mod.id);
  assert.ok(guide.roles.length > 0, mod.id);
  assert.ok(guide.features.length > 0, mod.id);
  assert.ok(guide.flow.length > 0, mod.id);
  assert.ok(guide.faqs.length > 0, mod.id);
  for (const feature of guide.features) {
    assert.ok(feature.steps.length > 0, `${mod.id}:${feature.id}`);
    assert.ok(feature.prerequisites.length > 0, `${mod.id}:${feature.id} prerequisites`);
    assert.ok(feature.behind.length > 0, `${mod.id}:${feature.id} behind`);
    assert.ok(feature.errors.length > 0, `${mod.id}:${feature.id} errors`);
    assert.ok(feature.faqs.length > 0, `${mod.id}:${feature.id} faqs`);
    for (const step of feature.steps) {
      assert.ok(step.trim().length > 0, `${mod.id}:${feature.id} empty step`);
      const same =
        step.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '') ===
        feature.summary.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '');
      assert.equal(same, false, `${mod.id}:${feature.id} step repeats summary: ${step}`);
    }
  }
  const blob = JSON.stringify(guide);
  assert.equal(blob.includes('Kwaden'), false, mod.id);
  assert.equal(/Acme|Harbour Grocers|Big Five/i.test(blob), false, mod.id);
  assert.equal(blob.includes('4280321847'), false, mod.id);
}

const accounting = getModuleGuide('accounting');
assert.ok(accounting);
const vat = accounting.features.find((feature) => feature.id === 'vat201');
assert.ok(vat);
const vatText = vat.steps.join(' ');
assert.match(vatText, /payment basis/i);
assert.match(vatText, /eFiling/);
assert.match(vatText, /does not submit/i);
assert.match(vatText, /Independent Software Vendor/);
assert.match(vatText, /settlement journal/);
assert.match(accounting.purpose, /SupplierAdvisor®/);

for (const guide of MODULE_GUIDES) {
  if (/Advisor/.test(guide.name)) assert.match(guide.name, /®/, guide.id);
}

assert.equal(guideIdForPath('/dashboard/accounting/vat201'), 'accounting');
assert.equal(guideIdForPath('/dashboard'), 'home');
assert.equal(guideIdForPath('/dashboard/help/accounting'), null);
assert.equal(guideIdForPath('/sales/invoices'), 'sales-portal');
assert.equal(getModuleGuide('fitgraph')?.name, 'GymAdvisor®');
assert.equal(getModuleGuide('tradegraph')?.name, 'TradeAdvisor®');
assert.equal(getModuleGuide('hiregraph')?.name, 'HireAdvisor®');
assert.equal(getModuleGuide('schools')?.name, 'SchoolAdvisor®');
assert.match(JSON.stringify(getModuleGuide('intelligence')), /Super-Cube®/);

console.log(`module-guides.test.ts ok (${MODULE_GUIDES.length} modules)`);
