/**
 * Run: npx --yes tsx lib/accounting/journal-status.test.ts
 */
import assert from 'node:assert/strict';
import {
  asJournalMeta,
  journalEligibleForReview,
  journalIsLivePosted,
  journalIsReversed,
} from './journal-status';

assert.equal(journalIsReversed({ metadata: {} }), false);
assert.equal(
  journalIsReversed({ metadata: { reversed_by_journal_id: 88 } }),
  true
);
assert.equal(
  journalIsReversed({ metadata: { reversed_by_journal_id: '91' } }),
  true
);
assert.equal(journalIsLivePosted({ status: 'posted', metadata: {} }), true);
assert.equal(
  journalIsLivePosted({
    status: 'posted',
    metadata: { reversed_by_journal_id: 3 },
  }),
  false
);
assert.equal(asJournalMeta(null).foo, undefined);

assert.equal(
  journalEligibleForReview({
    status: 'posted',
    source: 'bank',
    memo: 'Uber',
    metadata: {},
  }),
  true
);
assert.equal(
  journalEligibleForReview({
    status: 'posted',
    source: 'bank',
    memo: 'Uber',
    metadata: { reversed_by_journal_id: 12 },
  }),
  false,
  'reversed originals must not be reviewed again'
);
assert.equal(
  journalEligibleForReview({
    status: 'posted',
    source: 'reversal',
    memo: 'Reversal of JE-00434',
    metadata: {},
  }),
  false
);
assert.equal(
  journalEligibleForReview({
    status: 'posted',
    source: 'correction',
    memo: 'Correction of JE-00434',
    metadata: {},
  }),
  true,
  'live correction is the journal to review'
);

console.log('journal-status tests ok');
