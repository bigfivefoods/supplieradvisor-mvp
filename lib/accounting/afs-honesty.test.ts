/**
 * Run: npx --yes tsx lib/accounting/afs-honesty.test.ts
 */
import assert from 'node:assert/strict';
import {
  GAAP_DISCLAIMER_LONG,
  GAAP_DISCLAIMER_SHORT,
} from './gaap-disclaimer';
import {
  AFS_IAS10,
  AFS_MANUAL_STANDARDS,
  AFS_NOTE2_REVENUE,
  AFS_NOTE3_COGS,
  AFS_NOTE6_RECEIVABLES,
  AFS_NOTE8_PAYABLES,
  AFS_NOT_CONSOLIDATED,
  AFS_POLICY_IAS2,
  AFS_POLICY_IFRS15,
  AFS_POLICY_IFRS9,
} from './afs-honesty';

assert.match(AFS_NOT_CONSOLIDATED, /not consolidated/i);
assert.match(AFS_NOT_CONSOLIDATED, /IFRS 10/);
assert.match(AFS_NOT_CONSOLIDATED, /not eliminated/i);

assert.match(AFS_NOTE2_REVENUE, /2140/);
assert.match(AFS_NOTE2_REVENUE, /invoice is issued/);
assert.match(AFS_POLICY_IFRS15, /2140/);
assert.match(AFS_POLICY_IFRS15, /single performance obligation/i);

assert.match(AFS_NOTE3_COGS, /known unit cost/);
assert.match(AFS_POLICY_IAS2, /5100/);
assert.match(AFS_POLICY_IAS2, /unknown/);

assert.match(AFS_NOTE6_RECEIVABLES, /1135/);
assert.match(AFS_NOTE6_RECEIVABLES, /6820/);
assert.doesNotMatch(AFS_NOTE6_RECEIVABLES, /not computed automatically/i);
assert.match(AFS_POLICY_IFRS9, /ECL worksheet/);
assert.doesNotMatch(AFS_POLICY_IFRS9, /not computed automatically/i);

assert.match(AFS_NOTE8_PAYABLES, /2140/);
assert.match(AFS_NOTE8_PAYABLES, /contract liability/i);
assert.match(AFS_NOTE8_PAYABLES, /not mixed into AP/i);

assert.match(GAAP_DISCLAIMER_SHORT, /not consolidated/i);
assert.match(GAAP_DISCLAIMER_SHORT, /unaudited/i);
assert.match(GAAP_DISCLAIMER_LONG, /not consolidated/i);
assert.match(GAAP_DISCLAIMER_LONG, /ECL worksheet/);
assert.doesNotMatch(GAAP_DISCLAIMER_LONG, /expected credit losses are not computed/i);

assert.match(AFS_MANUAL_STANDARDS, /IFRS 16/);
assert.match(AFS_MANUAL_STANDARDS, /IAS 12/);
assert.match(AFS_MANUAL_STANDARDS, /IAS 21/);
assert.match(AFS_MANUAL_STANDARDS, /IFRS 10/);
assert.match(AFS_IAS10, /not automatically identify/);

console.log('afs-honesty tests ok');
