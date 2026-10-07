/**
 * Run: npx --yes tsx components/marketing/site-footer.render.test.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SiteFooter from '@/components/marketing/SiteFooter';

const html = renderToStaticMarkup(createElement(SiteFooter));
const year = String(new Date().getFullYear());

assert.equal((html.match(/<footer\b/g) ?? []).length, 1, 'should render exactly one footer landmark');
assert.match(html, /bg-\[#f3f4f6\]/);
assert.match(html, /rounded-\[28px\]/);
assert.match(html, /lg:grid-cols-12/);
assert.match(html, /lg:col-span-4/);
assert.match(html, /lg:col-span-8/);
assert.match(html, /sm:grid-cols-3/);
assert.match(html, /aria-label="Explore"/);
assert.match(html, /aria-label="Legal"/);
assert.match(html, /aria-label="Social media"/);
assert.match(html, new RegExp(`© <span>${year}</span> SupplierAdvisor®\\. All rights reserved\\.`));
assert.match(html, /href="https:\/\/bigfivegroup\.africa"/);
assert.match(html, /hello@supplieradvisor\.com/);
assert.match(html, /href="tel:\+27825814215"/);
assert.match(html, /href="https:\/\/x\.com\/supplieradvisa"/);
assert.match(html, /<label[^>]*class="sr-only"[^>]*>Email address<\/label>/);

assert.doesNotMatch(html, /text-\[9px\]/);
assert.doesNotMatch(html, /text-\[10px\]/);
assert.doesNotMatch(html, /text-\[11px\]/);
assert.doesNotMatch(html, /text-\[#00b4d8\]/);
assert.doesNotMatch(html, /bigfivegroup\.africa\//);
assert.doesNotMatch(html, /privy/i);
assert.doesNotMatch(html, /viem/i);
assert.doesNotMatch(html, /undici/i);

console.log('site-footer.render.test.ts ok');
