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

const SHALLOW =
  /The screen reads and saves this company’s own records|Saving writes this company’s record for|This step is live on/;

for (const guide of MODULE_GUIDES) {
  assert.equal(SHALLOW.test(JSON.stringify(guide)), false, `${guide.id} still uses the generated shell`);
  for (const feature of guide.features) {
    const depth = feature.steps.length > 0 && feature.behind.length > 0 && feature.errors.length > 0;
    assert.equal(depth, true, `${guide.id}:${feature.id} needs steps, behind-the-scenes notes, and errors`);
  }
}

const construction = getModuleGuide('constructiongraph');
assert.ok(construction);
assert.match(JSON.stringify(construction), /no Issue/i);
assert.match(JSON.stringify(construction), /does not post/);
const diaryGuide = construction.features.find((feature) => feature.href === '/dashboard/constructiongraph/diary');
assert.ok(diaryGuide);
const diaryText = JSON.stringify(diaryGuide);
assert.match(diaryText, /Add addendum/);
assert.match(diaryText, /Progress stays locked after sign-off/);
assert.match(diaryText, /does not change/);
assert.match(diaryText, /Owner, Admin, Member, and Operations/);
assert.equal(/no addendum field/i.test(diaryText), false);

const fleet = getModuleGuide('fleetgraph');
assert.ok(fleet);
assert.match(JSON.stringify(fleet), /nothing is tracked/i);
assert.match(JSON.stringify(fleet), /not switched on/i);
const cpkGuide = fleet.features.find((feature) => feature.href === '/dashboard/fleetgraph/cpk');
assert.ok(cpkGuide);
const cpkText = JSON.stringify(cpkGuide);
assert.match(cpkText, /completed trip readings/);
assert.match(cpkText, /odometer pairs/);
assert.equal(/GPS-derived/.test(cpkText), false);
assert.match(cpkText, /Owner, Admin, and Finance/);
assert.match(cpkText, /does not receive a position/);

const recover = getModuleGuide('recovergraph');
assert.match(JSON.stringify(recover), /draft/);
assert.match(JSON.stringify(recover), /no legal advice/i);
assert.equal(JSON.stringify(recover).includes('Harbour'), false);

const schools = getModuleGuide('schools');
assert.match(JSON.stringify(schools), /does not post the ledger|does not insert an accounting journal|does not post a journal/i);

console.log(`module-guides.test.ts ok (${MODULE_GUIDES.length} modules)`);
