/**
 * Brief 118: subscription access and banner state. No network.
 * Run: npx --yes tsx lib/billing/brief118-access.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeCompanySubscription } from './company-subscription';
import { bannerState } from './access-banner-state';

const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const none = computeCompanySubscription({ subscription_status: 'none' });
assert.equal(none.status, 'none');
assert.equal(none.hasAccess, false);
assert.equal(bannerState(none, { startAttempted: false }), 'resolving');
assert.equal(bannerState(none, { startAttempted: true }), 'start_trial');
assert.notEqual(bannerState(none, { startAttempted: false }), 'locked');
assert.notEqual(bannerState(none, { startAttempted: true }), 'locked');

const noneWithTrial = computeCompanySubscription({
  subscription_status: 'none',
  subscription_trial_ends_at: future,
});
assert.equal(noneWithTrial.status, 'trial');
assert.equal(noneWithTrial.hasAccess, true);

const trialPast = computeCompanySubscription({
  subscription_status: 'trial',
  subscription_trial_ends_at: past,
});
assert.equal(trialPast.status, 'expired');
assert.equal(trialPast.hasAccess, false);
assert.equal(bannerState(trialPast, { startAttempted: true }), 'locked');

const active = computeCompanySubscription({
  subscription_status: 'active',
  subscription_ends_at: future,
});
assert.equal(active.status, 'active');
assert.equal(active.hasAccess, true);
assert.equal(bannerState(active, { startAttempted: true }), 'hidden');

const ending = computeCompanySubscription({
  subscription_status: 'trial',
  subscription_trial_ends_at: soon,
});
assert.equal(ending.status, 'trial');
assert.equal(ending.hasAccess, true);
assert.ok(ending.daysRemaining != null && ending.daysRemaining <= 7);
assert.equal(bannerState(ending, { startAttempted: true }), 'ending_soon');

const cancelledOpen = computeCompanySubscription({
  subscription_status: 'cancelled',
  subscription_ends_at: future,
});
assert.equal(cancelledOpen.status, 'cancelled');
assert.equal(cancelledOpen.hasAccess, true);

const cancelledLapsed = computeCompanySubscription({
  subscription_status: 'cancelled',
  subscription_ends_at: past,
});
assert.equal(cancelledLapsed.hasAccess, false);
assert.equal(bannerState(cancelledLapsed, { startAttempted: true }), 'locked');

const pastDue = computeCompanySubscription({ subscription_status: 'past_due' });
assert.equal(pastDue.status, 'past_due');
assert.equal(pastDue.hasAccess, false);
assert.equal(bannerState(pastDue, { startAttempted: true }), 'locked');

const lifetimeStatus = computeCompanySubscription({ subscription_status: 'lifetime' });
assert.equal(lifetimeStatus.status, 'lifetime');
assert.equal(lifetimeStatus.isLifetime, true);
assert.equal(lifetimeStatus.hasAccess, true);
assert.equal(bannerState(lifetimeStatus, { startAttempted: true }), 'hidden');

const lifetimePlan = computeCompanySubscription({
  subscription_status: 'none',
  subscription_plan: 'founder_lifetime',
});
assert.equal(lifetimePlan.status, 'lifetime');
assert.equal(lifetimePlan.isLifetime, true);
assert.equal(lifetimePlan.hasAccess, true);
assert.equal(bannerState(lifetimePlan, { startAttempted: false }), 'hidden');

const banner = readFileSync('components/billing/SubscriptionAccessBanner.tsx', 'utf8');
assert.ok(banner.includes('data-testid="trial-start-banner"'));
assert.ok(banner.includes('Setting up your free trial'));
assert.ok(banner.includes('Start free trial'));
assert.ok(banner.includes('Ask your company owner to start the trial'));
assert.ok(banner.includes("action: 'start_trial'"));
assert.ok(banner.includes('bg-[#00b4d8]'));
assert.ok(banner.includes('text-[#0f172a]'));
assert.ok(banner.includes('/api/business/subscription?companyId=${companyId}&autoTrial=0'));
assert.equal(banner.split('autoTrial=0').length - 1, 1);
assert.ok(banner.includes("next.status === 'none'"));
assert.equal(/status === 'none'[\s\S]{0,160}Access expired/.test(banner), false);
assert.ok(banner.includes('modules is omitted on purpose'));
const allowStart = banner.indexOf('const ALWAYS_ALLOW');
const allowEnd = banner.indexOf('];', allowStart);
const allowBlock = banner.slice(allowStart, allowEnd);
assert.equal(allowBlock.includes('/dashboard/my-business/modules'), false);
assert.ok(allowBlock.includes('/dashboard/my-business/billing'));

const subscriptionRoute = readFileSync('app/api/business/subscription/route.ts', 'utf8');
assert.ok(subscriptionRoute.includes('[subscription] TRIAL_START_FAILED'));
assert.ok(subscriptionRoute.includes('trialError'));
assert.ok(
  subscriptionRoute.includes("error: 'Could not start your trial. Please try again.'")
);
const trialStart = subscriptionRoute.slice(
  subscriptionRoute.indexOf('async function ensureTrialStarted'),
  subscriptionRoute.indexOf('export async function GET')
);
assert.ok(trialStart.includes('ensureTrialForClaimedProfile('));
assert.ok(trialStart.includes('[subscription] TRIAL_START_FAILED'));
assert.equal(trialStart.includes('.update('), false);
assert.equal(trialStart.includes('.single()'), false);

console.log('billing/brief118-access.test.ts ok');
