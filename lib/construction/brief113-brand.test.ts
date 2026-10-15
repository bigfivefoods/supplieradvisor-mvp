/**
 * Cyan fills keep navy text. No stone or amber utilities on the new screens.
 * Run: npx --yes tsx lib/construction/brief113-brand.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { constructionBtn, constructionCard, constructionField } from '@/components/construction/ConstructionUi';
import { CommandView } from '@/components/construction/views/CommandView';
import { capabilitiesFor } from './roles';
import { emptyConstructiongraphStore } from './constructiongraph';
import { storeForRole } from './roles';
import { sampleConstructionStore } from './sample-book';

const roots = [
  'components/construction',
  'app/dashboard/constructiongraph',
  'app/construction',
  'app/work/constructiongraph',
  'app/preview/constructiongraph',
  'public/construction-offline.html',
];

function filesIn(path: string): string[] {
  const full = resolve(path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((name) => filesIn(resolve(full, name)));
}

const files = roots.flatMap((root) => filesIn(root)).filter((file) => /\.(tsx|ts|html|css)$/.test(file));
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  assert.equal(/\bstone-\d/.test(src), false, file);
  assert.equal(/\bamber-\d/.test(src), false, file);
  assert.equal(src.includes('text-white'), false, file);
  assert.equal(src.includes('#00b4d9') || src.includes('#06b6d4'), false, file);
  let from = 0;
  while (true) {
    const at = src.indexOf('bg-[#00b4d8]', from);
    if (at < 0) break;
    const start = Math.max(src.lastIndexOf("'", at), src.lastIndexOf('"', at), src.lastIndexOf('`', at));
    const quote = src[start];
    const end = src.indexOf(quote, at);
    const span = src.slice(start, end < 0 ? src.length : end);
    assert.ok(span.includes('text-[#0f172a]'), `${file} cyan fill needs navy text`);
    from = at + 12;
  }
}

const install = readFileSync(resolve('components/construction/ConstructionInstall.tsx'), 'utf8');
assert.match(install, /product="ConstructionAdvisor"/);
assert.match(install, /ConstructionAdvisor®/);
assert.doesNotMatch(install, /product="ConstructionAdvisor®"/);

const html = renderToStaticMarkup(
  createElement(CommandView, {
    store: emptyConstructiongraphStore(),
    role: 'owner',
    caps: capabilitiesFor('owner'),
    state: 'ready',
    handlers: { retry() {}, async merge() {}, async run() { return undefined; } },
  })
);
assert.match(html, /ConstructionAdvisor®/);
assert.match(html, /No projects yet/);
assert.doesNotMatch(html, /<aside/);

const siteHtml = renderToStaticMarkup(
  createElement(CommandView, {
    store: storeForRole(sampleConstructionStore('2026-10-15'), 'site_manager'),
    role: 'site_manager',
    caps: capabilitiesFor('site_manager'),
    state: 'ready',
    badge: 'Sample',
    handlers: { retry() {}, async merge() {}, async run() { return undefined; } },
  })
);
assert.match(siteHtml, /site-action-bar/);
assert.doesNotMatch(siteHtml, /R\s/);
assert.equal(constructionCard.includes('rounded-3xl'), true);
assert.equal(constructionBtn.includes('min-h-11'), true);
assert.equal(constructionField.includes('min-h-11'), true);

console.log('brief113-brand.test.ts ok');
