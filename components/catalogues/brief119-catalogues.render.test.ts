/**
 * Run: npx --yes tsx components/catalogues/brief119-catalogues.render.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { availableCatalogues } from '@/lib/catalogues';
import { CatalogueDownloadButton } from '@/components/catalogues/CatalogueDownloadButton';
import { CatalogueGrid } from '@/components/catalogues/CatalogueGrid';

const html = renderToStaticMarkup(createElement(CatalogueGrid));
const available = availableCatalogues();

assert.equal(available.length, 15);
for (const entry of available) {
  assert.match(html, new RegExp(`href="/catalogues/${entry.id}/download"`));
  assert.match(html, new RegExp(`alt="${entry.name.replace('®', '®')} catalogue cover page"`));
}
assert.equal((html.match(/<h3\b/g) ?? []).length, available.length);
assert.equal((html.match(/Download PDF/g) ?? []).length, available.length);
assert.match(html, /PDF · 44 pages · 11\.3 MB · Updated Oct 2026/);
assert.match(html, /<ul[^>]*role="list"/);

const unknown = renderToStaticMarkup(createElement(CatalogueDownloadButton, { id: 'missing' }));
assert.equal(unknown, '');
const soon = renderToStaticMarkup(createElement(CatalogueDownloadButton, { id: 'system' }));
assert.equal(soon, '');
const recover = renderToStaticMarkup(createElement(CatalogueDownloadButton, { id: 'recover' }));
assert.equal(recover, '');

assert.doesNotMatch(html, /Advisor(?!®)/);
assert.doesNotMatch(html, /next\/link/);

const dir = resolve(process.cwd(), 'components/catalogues');
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.tsx')) continue;
  const src = readFileSync(resolve(dir, name), 'utf8');
  assert.doesNotMatch(src, /next\/link/, name);
}

console.log('brief119-catalogues.render.test.ts ok');
