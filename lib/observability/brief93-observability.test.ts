/**
 * Brief 93 — Observability: Speed Insights RUM, structured error capture, Paystack webhook quiet check.
 * Run: npx --yes tsx lib/observability/brief93-observability.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

// CRITICAL: Speed Insights + Analytics in package.json
const pkgJson = src('package.json');
assert.match(pkgJson, /@vercel\/speed-insights/, 'package.json must list @vercel/speed-insights');
assert.match(pkgJson, /@vercel\/analytics/, 'package.json must list @vercel/analytics');
assert.doesNotMatch(pkgJson, /@sentry\/nextjs/, 'package.json must NOT list @sentry/nextjs');

// CRITICAL: SpeedInsights mounted in app/layout.tsx
const layoutSrc = src('app/layout.tsx');
assert.match(layoutSrc, /import.*SpeedInsights.*from.*@vercel\/speed-insights\/next/, 'app/layout.tsx must import SpeedInsights');
assert.match(layoutSrc, /<SpeedInsights/, 'app/layout.tsx must render <SpeedInsights />');

// CRITICAL: Analytics mounted in app/layout.tsx
assert.match(layoutSrc, /import.*Analytics.*from.*@vercel\/analytics\/next/, 'app/layout.tsx must import Analytics');
assert.match(layoutSrc, /<Analytics/, 'app/layout.tsx must render <Analytics />');

// CRITICAL: No Privy/viem/undici/wagmi in root layout
assert.doesNotMatch(layoutSrc, /@privy-io/, 'app/layout.tsx must not import @privy-io');
assert.doesNotMatch(layoutSrc, /from.*viem/, 'app/layout.tsx must not import from viem');
assert.doesNotMatch(layoutSrc, /from.*wagmi/, 'app/layout.tsx must not import from wagmi');
assert.doesNotMatch(layoutSrc, /from.*undici/, 'app/layout.tsx must not import from undici');

// CRITICAL: Structured error capture in app/global-error.tsx
const globalErrorSrc = src('app/global-error.tsx');
assert.match(globalErrorSrc, /import.*log.*from.*@\/lib\/logging\/logger/, 'app/global-error.tsx must import log');
assert.match(globalErrorSrc, /log\.error\(/, 'app/global-error.tsx must call log.error()');
assert.match(globalErrorSrc, /error\.digest/, 'app/global-error.tsx must pass error.digest to log.error');

// CRITICAL: Structured error capture in components/app-shell/RouteError.tsx
const routeErrorSrc = src('components/app-shell/RouteError.tsx');
assert.match(routeErrorSrc, /import.*log.*from.*@\/lib\/logging\/logger/, 'RouteError.tsx must import log');
assert.match(routeErrorSrc, /log\.error\(/, 'RouteError.tsx must call log.error()');
assert.match(routeErrorSrc, /error\.digest/, 'RouteError.tsx must pass error.digest to log.error');

// HIGH: Paystack webhook env vars documented in .env.example
const envExample = src('.env.example');
assert.match(envExample, /PAYSTACK_WARN_QUIET/, '.env.example must document PAYSTACK_WARN_QUIET');
assert.match(envExample, /PAYSTACK_WEBHOOK_STALE_HOURS/, '.env.example must document PAYSTACK_WEBHOOK_STALE_HOURS');
assert.match(envExample, /OPS_ALERT_EMAIL/, '.env.example must document OPS_ALERT_EMAIL');
assert.match(envExample, /https:\/\/www\.supplieradvisor\.com\/api\/paystack\/webhook/, '.env.example must include canonical webhook URL');

// HIGH: OpsHealthStrip.tsx shows webhook stale status with actionable checklist
const opsHealthStripSrc = src('components/system/OpsHealthStrip.tsx');
assert.match(opsHealthStripSrc, /webhookStale/, 'OpsHealthStrip.tsx must check webhookStale');
assert.match(opsHealthStripSrc, /webhookAgeHours/, 'OpsHealthStrip.tsx must show webhookAgeHours');
assert.match(opsHealthStripSrc, /Paystack Dashboard/, 'OpsHealthStrip.tsx must mention Paystack Dashboard in checklist');
assert.match(opsHealthStripSrc, /Settings.*Webhooks/, 'OpsHealthStrip.tsx must include webhook settings checklist');
assert.match(opsHealthStripSrc, /delivery logs/, 'OpsHealthStrip.tsx must mention delivery logs checklist');

console.log('✓ Brief 93 observability checks passed');
