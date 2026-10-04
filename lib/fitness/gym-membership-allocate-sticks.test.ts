/**
 * Membership allocate sticks — verify the four root-cause fixes:
 * 1. route.ts: savePatchForKeys runs BEFORE CRM attach in allocate_member
 * 2. clients/page.tsx: CRM backfill useEffect does NOT list `store` in deps
 * 3. MemberAllocateTable.tsx: plan <select> auto-saves (calls void save)
 * 4. gym-class-ticks-stick.test.ts still passes
 *
 * Run: npx --yes tsx lib/fitness/gym-membership-allocate-sticks.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// ── 1. route.ts: savePatchForKeys before CRM attach ──────────────────────────
const route = readFileSync(
  resolve('app/api/fitness/fitgraph/route.ts'),
  'utf8'
);
const allocateBlock = route.slice(
  route.indexOf("if (action === 'allocate_member')"),
  route.indexOf("if (action === 'set_class_members')")
);
const savePatchPos = allocateBlock.indexOf('savePatchForKeys');
const crmAttachPos = allocateBlock.indexOf('attachCrmToAdvisorPerson');
assert.ok(savePatchPos !== -1, 'savePatchForKeys not found in allocate_member');
assert.ok(crmAttachPos !== -1, 'attachCrmToAdvisorPerson not found in allocate_member');
assert.ok(
  savePatchPos < crmAttachPos,
  `savePatchForKeys (pos ${savePatchPos}) must come before attachCrmToAdvisorPerson (pos ${crmAttachPos}) in allocate_member`
);

// ── 2. clients/page.tsx: store not in backfill useEffect deps ─────────────────
const clientsPage = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
// Find the backfill useEffect's dep array line
assert.doesNotMatch(
  clientsPage,
  /\}, \[loading, store, post, companyId, load\]\)/,
  'store must not appear in CRM backfill useEffect dependency array'
);
assert.match(
  clientsPage,
  /\}, \[loading, post, companyId, load\]\)/,
  'backfill useEffect dep array should be [loading, post, companyId, load]'
);

// ── 3. MemberAllocateTable: plan select auto-saves ────────────────────────────
const table = readFileSync(
  resolve('components/fitness/MemberAllocateTable.tsx'),
  'utf8'
);
// The non-class-subscribe plan select onChange must call void save
const planSelectOnChange = table.slice(
  table.indexOf('value={d.planId}'),
  table.indexOf('</select>', table.indexOf('value={d.planId}'))
);
assert.match(
  planSelectOnChange,
  /void save\(c, merged\)/,
  'Plan select onChange must call void save(c, merged) for auto-save'
);
// Status select onChange must also auto-save
const statusSelectOnChange = table.slice(
  table.indexOf('value={d.status}'),
  table.indexOf('</select>', table.indexOf('value={d.status}'))
);
assert.match(
  statusSelectOnChange,
  /void save\(c, merged\)/,
  'Status select onChange must call void save(c, merged) for auto-save'
);
// toggleMember must call void save
assert.match(table, /toggleMember[\s\S]*?void save\(c, merged\)[\s\S]*?togglePrivate/);
// togglePrivate must call void save
assert.match(table, /togglePrivate[\s\S]*?void save\(c, merged\)[\s\S]*?toggleInactive/);
// Draft is only cleared when store matches (storeMatchesSent guard)
assert.match(table, /storeMatchesSent/);

// ── 4. Existing ticks test still passes ──────────────────────────────────────
try {
  execSync('npx --yes tsx lib/fitness/gym-class-ticks-stick.test.ts', {
    stdio: 'inherit',
  });
} catch {
  assert.fail('gym-class-ticks-stick.test.ts failed');
}

console.log('gym-membership-allocate-sticks.test.ts ok');
