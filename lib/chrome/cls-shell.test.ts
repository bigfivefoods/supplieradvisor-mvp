/**
 * Desktop CLS: sidebar width is known before paint, and the subscription
 * bar cannot push a main column that already painted.
 * Run: npx --yes tsx lib/chrome/cls-shell.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SIDEBAR_BOOT_SCRIPT, SIDEBAR_COLLAPSED_KEY } from './sidebar-boot';

assert.match(SIDEBAR_BOOT_SCRIPT, new RegExp(SIDEBAR_COLLAPSED_KEY));
assert.match(SIDEBAR_BOOT_SCRIPT, /dataset\.sidebar = 'collapsed'/);

const layout = readFileSync('app/layout.tsx', 'utf8');
assert.match(layout, /SIDEBAR_BOOT_SCRIPT/);

const css = readFileSync('app/globals.css', 'utf8');
assert.match(css, /html\[data-sidebar='collapsed'\] \.sa-app-aside/);
assert.match(css, /width: 4\.5rem/);
assert.match(css, /width: 18rem/);
assert.match(css, /data-sidebar-motion/);

const shell = readFileSync('components/chrome/AppShell.tsx', 'utf8');
assert.match(shell, /sa-app-aside/);
assert.equal(shell.includes('md:w-64'), false);
assert.equal(shell.includes('transition-[width]'), false);
assert.match(shell, /onReady=\{markMainReady\}/);
assert.match(shell, /mainReady \?/);

const banner = readFileSync('components/billing/SubscriptionAccessBanner.tsx', 'utf8');
assert.match(banner, /signalReady\(\)/);
assert.match(banner, /finally/);

const invite = readFileSync('components/onboarding/InviteClaimFlow.tsx', 'utf8');
assert.match(invite, /key="invite-loading"/);
assert.match(invite, /key="invite-error"/);
assert.match(invite, /key="invite-form"/);

const product = readFileSync(
  'app/store/[companySlug]/products/[productKey]/page.tsx',
  'utf8'
);
assert.match(product, /h-\[280px\]/);
assert.match(product, /lg:h-\[360px\]/);
assert.equal(product.includes('max-h-[420px]'), false);

console.log('cls-shell.test.ts ok');
