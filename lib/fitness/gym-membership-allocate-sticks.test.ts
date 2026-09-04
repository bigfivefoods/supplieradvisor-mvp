/**
 * GymAdvisor membership allocate does not snap back.
 * Run: npx --yes tsx lib/fitness/gym-membership-allocate-sticks.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A. allocate_member saves patch BEFORE CRM attach (route source order)
const route = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
const allocateStart = route.indexOf("if (action === 'allocate_member')");
assert(allocateStart >= 0, 'allocate_member block not found');
const allocateBlock = route.slice(allocateStart, allocateStart + 6000);

const saveIdx = allocateBlock.indexOf('savePatchForKeys(');
const crmIdx = allocateBlock.indexOf('attachCrmToAdvisorPerson(');
assert(saveIdx >= 0, 'savePatchForKeys not found in allocate_member block');
assert(crmIdx >= 0, 'attachCrmToAdvisorPerson not found in allocate_member block');
assert(
  saveIdx < crmIdx,
  `allocate_member must call savePatchForKeys BEFORE attachCrmToAdvisorPerson (saveIdx=${saveIdx}, crmIdx=${crmIdx})`
);

// CRM must be fire-and-forget (void IIFE)
assert.match(
  allocateBlock,
  /void \(async \(\) =>/,
  'CRM stamp must be fire-and-forget (void async IIFE)'
);

// B. Clients CRM backfill effect does NOT list `store` in its dependency array
const clientsPage = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
const backfillIdx = clientsPage.indexOf('backfill_client_crm');
assert(backfillIdx >= 0, 'backfill_client_crm not found in clients page');
const effectEnd = clientsPage.indexOf('\n  }, [', backfillIdx);
assert(effectEnd >= 0, 'dep array not found after backfill effect');
const depLine = clientsPage.slice(effectEnd, effectEnd + 120);
assert.doesNotMatch(
  depLine,
  /\bstore\b/,
  `CRM backfill effect dep array must not include 'store': ${depLine}`
);

// C. MemberAllocateTable auto-saves plan select (plan onChange calls void save)
const table = readFileSync(
  resolve('components/fitness/MemberAllocateTable.tsx'),
  'utf8'
);
const planSelectIdx = table.indexOf('Select plan\u2026');
assert(planSelectIdx >= 0, 'Plan select not found');
const planOnChange = table.slice(Math.max(0, planSelectIdx - 800), planSelectIdx);
assert.match(
  planOnChange,
  /void save\(c, merged\)/,
  'Plan select onChange must call void save(c, merged)'
);

// Status select onChange should call void save
const statusIdx = table.indexOf('status: e.target');
assert(statusIdx >= 0, 'Status onChange not found');
const statusBlock = table.slice(statusIdx, statusIdx + 300);
assert.match(
  statusBlock,
  /void save\(c,/,
  'Status select onChange must call void save(c, ...)'
);

// toggleMember and togglePrivate both call void save
assert.match(
  table,
  /toggleMember[\s\S]{0,400}void save\(c, merged\)/,
  'toggleMember must call void save(c, merged)'
);
assert.match(
  table,
  /togglePrivate[\s\S]{0,400}void save\(c, merged\)/,
  'togglePrivate must call void save(c, merged)'
);

// Existing stick behaviors still present
assert.match(table, /void save\(c, merged\)/);
assert.match(table, /const onClass = planIds.length > 0;/);
assert.doesNotMatch(
  table,
  /planIds.length > 0\s*\n\s*\? planIds\s*\n\s*: c\.membership_plan_id/
);
assert.match(table, /d\.member && !planIds.length && !classSubscribe/);

console.log('gym-membership-allocate-sticks.test.ts ok');
