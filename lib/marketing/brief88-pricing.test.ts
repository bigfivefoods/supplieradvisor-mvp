/**
 * Brief 88 — pricing SSR + dashboard signed-out redirect guardrails
 * Run: npx --yes tsx lib/marketing/brief88-pricing.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const pricingPage = read('app/pricing/page.tsx');
const homePricing = read('components/marketing/HomePricing.tsx');
const robots = read('app/robots.ts');
const middleware = read('middleware.ts');

assert.ok(!pricingPage.includes("'use client'"), '/pricing page must remain a server component');
assert.ok(!pricingPage.includes('window.location'), '/pricing page must not use client redirect logic');
assert.ok(
  pricingPage.includes("@/lib/marketing/pricing-plans"),
  '/pricing page must use shared pricing module'
);
assert.ok(
  homePricing.includes("@/lib/marketing/pricing-plans"),
  'home pricing must use shared pricing module'
);

assert.ok(
  robots.includes("'/dashboard'") && robots.includes("'/dashboard/'"),
  'robots.ts must disallow exact /dashboard and /dashboard/'
);

assert.ok(
  middleware.includes("pathname === '/dashboard' || pathname.startsWith('/dashboard/')"),
  'middleware must detect dashboard routes'
);
assert.ok(
  middleware.includes("request.cookies.get('privy-token')") &&
    middleware.includes("request.cookies.get('privy-session')") &&
    middleware.includes("request.cookies.get('sa_authed')"),
  'middleware must check privy-token, privy-session, and sa_authed cookies'
);
assert.ok(
  /if \(!hasPrivyToken && !hasPrivySession && !hasAuthHint\)[\s\S]*NextResponse\.redirect\(loginUrl, 307\)/.test(
    middleware
  ),
  'middleware must 307 redirect unauthenticated dashboard requests to login'
);
assert.ok(
  middleware.includes("if (pathname.startsWith('/api/'))") && middleware.includes('isPublicApiPath'),
  'middleware must keep API path handling and public API bypass'
);

console.log('brief88-pricing.test.ts ok');
