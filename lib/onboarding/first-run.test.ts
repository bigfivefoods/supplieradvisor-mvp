/**
 * First-run checklist derives from existing counts. No schema, no writes.
 * Run: npx --yes tsx lib/onboarding/first-run.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FIRST_RUN_PROFILE_PCT,
  deriveFirstRun,
  firstRunDismissStorageKey,
  purchaseOrdersRaised,
} from './first-run';
import { osFirstRunSignals } from '@/lib/preview/os-fixtures';

const empty = deriveFirstRun({});
assert.equal(empty.complete, false);
assert.equal(empty.doneRequired, 0);
assert.equal(empty.requiredTotal, 5);
assert.equal(empty.percent, 0);
assert.equal(empty.next?.id, 'profile');
assert.equal(empty.steps.find((s) => s.id === 'verification')?.optional, true);
assert.equal(empty.steps.find((s) => s.id === 'verification')?.done, false);

const almost = deriveFirstRun({ profileCompleteness: FIRST_RUN_PROFILE_PCT - 1 });
assert.equal(almost.steps.find((s) => s.id === 'profile')?.done, false);

const profile = deriveFirstRun({ profileCompleteness: FIRST_RUN_PROFILE_PCT });
assert.equal(profile.steps.find((s) => s.id === 'profile')?.done, true);
assert.equal(profile.next?.id, 'supplier');

const withBooks = deriveFirstRun({
  profileCompleteness: 80,
  suppliers: 1,
  customers: 2,
  purchaseOrders: 0,
  openPurchaseOrders: 4,
  teamActive: 1,
  teamInvited: 0,
  verified: false,
});
assert.equal(withBooks.steps.find((s) => s.id === 'purchase_order')?.done, false);
assert.equal(purchaseOrdersRaised({ purchaseOrders: 0, openPurchaseOrders: 4 }), 0);

const fromOpen = deriveFirstRun({
  openPurchaseOrders: 1,
  onchainPurchaseOrders: 0,
});
assert.equal(fromOpen.steps.find((s) => s.id === 'purchase_order')?.done, true);

const received = deriveFirstRun({ purchaseOrders: 3, openPurchaseOrders: 0 });
assert.equal(received.steps.find((s) => s.id === 'purchase_order')?.done, true);

const invited = deriveFirstRun({ teamActive: 1, teamInvited: 1 });
assert.equal(invited.steps.find((s) => s.id === 'team')?.done, true);
const solo = deriveFirstRun({ teamActive: 1, teamInvited: 0 });
assert.equal(solo.steps.find((s) => s.id === 'team')?.done, false);
const two = deriveFirstRun({ teamActive: 2, teamInvited: 0 });
assert.equal(two.steps.find((s) => s.id === 'team')?.done, true);

const ready = deriveFirstRun({
  profileCompleteness: 90,
  suppliers: 1,
  customers: 1,
  purchaseOrders: 1,
  teamActive: 2,
  verified: false,
});
assert.equal(ready.complete, true);
assert.equal(ready.percent, 100);
assert.equal(ready.next, null);
assert.equal(ready.steps.find((s) => s.id === 'verification')?.done, false);

const verified = deriveFirstRun({
  profileCompleteness: 90,
  suppliers: 1,
  customers: 1,
  purchaseOrders: 1,
  teamActive: 2,
  verified: true,
});
assert.equal(verified.steps.find((s) => s.id === 'verification')?.done, true);
assert.equal(verified.percent, 100);

assert.equal(firstRunDismissStorageKey(42), 'sa_first_run_dismissed_42');

const sample = deriveFirstRun(osFirstRunSignals());
assert.equal(sample.doneRequired, 2);
assert.equal(sample.percent, 40);
assert.equal(sample.next?.id, 'customer');
assert.equal(sample.next?.href, '/dashboard/customers/onboard');
assert.equal(sample.steps.find((s) => s.id === 'supplier')?.done, true);
assert.equal(sample.steps.find((s) => s.id === 'purchase_order')?.href, '/dashboard/suppliers/po');
assert.equal(sample.steps.find((s) => s.id === 'team')?.href, '/dashboard/my-business/team');
assert.equal(
  sample.steps.find((s) => s.id === 'verification')?.href,
  '/dashboard/my-business/verifications'
);

const ui = readFileSync(resolve('components/onboarding/FirstRunChecklist.tsx'), 'utf8');
assert.match(ui, /SupplierAdvisor®/);
assert.match(ui, /#00b4d8/);
assert.doesNotMatch(ui, /Kwaden/i);
assert.doesNotMatch(ui, /supabase/i);
assert.doesNotMatch(ui, /\.insert\(/);

const preview = readFileSync(resolve('app/preview/onboarding/preview-client.tsx'), 'utf8');
assert.match(preview, /not saved/);
assert.match(preview, /SupplierAdvisor®/);
assert.doesNotMatch(preview, /supabase/i);
assert.doesNotMatch(preview, /getSupabaseServer/);

const fixtures = readFileSync(resolve('lib/preview/os-fixtures.ts'), 'utf8');
assert.match(fixtures, /osFirstRunSignals/);
assert.doesNotMatch(fixtures, /\.insert\(/);

console.log('onboarding/first-run.test.ts ok');
