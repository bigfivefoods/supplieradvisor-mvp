/**
 * Brief 12 — phone landing header always shows Log in, no Privy on /.
 * Run: npx --yes tsx lib/http/brief12-phone-login.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { en } from '@/lib/i18n/dict';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const nav = src('components/marketing/LandingNav.tsx');
assert.doesNotMatch(nav, /usePrivy/);
assert.doesNotMatch(nav, /@privy-io\/react-auth/);
assert.doesNotMatch(nav, /from 'viem'/);
assert.doesNotMatch(nav, /from 'wagmi'/);
assert.doesNotMatch(nav, /ThemeToggle/);

assert.match(nav, /data-landing-login/);
const loginIdx = nav.indexOf('data-landing-login');
const phoneLogin = nav.slice(Math.max(0, loginIdx - 120), loginIdx + 400);
assert.match(phoneLogin, /href="\/login"/);
assert.match(phoneLogin, /md:hidden/);
assert.doesNotMatch(phoneLogin, /hidden md:flex/);
assert.doesNotMatch(phoneLogin, /lg:flex/);
assert.equal(en['nav.logIn'], 'Log in');
assert.match(phoneLogin, /t\('nav\.logIn'\)/);

assert.equal(en['nav.ariaOpenMenu'], 'Open menu');
assert.match(nav, /t\('nav\.ariaOpenMenu'\)/);
assert.match(nav, /aria-expanded=\{open\}/);
assert.match(nav, /sa-wordmark hidden/);
assert.match(nav, /sm:inline/);
assert.doesNotMatch(nav, /AppearanceToggle className="md:hidden"/);
assert.match(nav, /z-\[310\]/);
assert.match(nav, /z-\[300\]/);
assert.match(nav, /top-nav-offset/);

const page = src('app/page.tsx');
assert.doesNotMatch(page, /^['"]use client['"]/m);
assert.doesNotMatch(page, /usePrivy/);
assert.match(page, /HomeLanding/);

const landing = src('components/marketing/HomeLanding.tsx');
assert.match(landing, /LandingNav/);
assert.match(landing, /HomeBelowFoldLazy/);
assert.doesNotMatch(landing, /usePrivy/);
assert.doesNotMatch(landing, /@privy-io\/react-auth/);

console.log('brief12-phone-login.test.ts ok');
