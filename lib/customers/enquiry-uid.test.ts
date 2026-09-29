/**
 * Run: npx --yes tsx lib/customers/enquiry-uid.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeTradeThread } from './trade-thread';
import {
  enquiryUidFromNumber,
  isEnquiryInboxRow,
  isIssuedQuoteRow,
  quoteUidFromNumber,
  quoteUidWhenIssuing,
  resolveEnquiryUid,
} from './enquiry-uid';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

assert.equal(enquiryUidFromNumber('QT-20260909-QVE1'), 'ENQ-20260909-QVE1');
assert.equal(quoteUidFromNumber('ENQ-20260909-QVE1'), 'QT-20260909-QVE1');
assert.equal(quoteUidWhenIssuing('ENQ-20260909-QVE1'), 'QT-20260909-QVE1');
assert.equal(enquiryUidFromNumber('INV-1'), null);

assert.equal(
  resolveEnquiryUid({ quote_number: 'QT-20260909-QVE1', status: 'sent' }),
  'ENQ-20260909-QVE1'
);
assert.equal(
  resolveEnquiryUid({
    quote_number: 'QT-20260909-QVE1',
    status: 'sent',
    metadata: writeTradeThread({}, {
      stage: 'quoted',
      enquiry_number: 'ENQ-20260909-QVE1',
    }),
  }),
  'ENQ-20260909-QVE1'
);

const qve1 = {
  quote_number: 'QT-20260909-QVE1',
  status: 'sent',
  customer_name: 'Critical point holdings',
};
assert.equal(isEnquiryInboxRow(qve1), true);
assert.equal(isIssuedQuoteRow(qve1), true);

assert.equal(
  isEnquiryInboxRow({ quote_number: 'ENQ-20260909-AAAA', status: 'enquiry' }),
  true
);
assert.equal(
  isIssuedQuoteRow({ quote_number: 'ENQ-20260909-AAAA', status: 'enquiry' }),
  false
);
assert.equal(
  isEnquiryInboxRow({ quote_number: 'QT-20260909-DRAFT', status: 'draft' }),
  false
);
assert.equal(
  isIssuedQuoteRow({ quote_number: 'QT-20260909-DRAFT', status: 'draft' }),
  true
);

const issue = src('app/api/customers/docs/route.ts');
assert.match(issue, /quoteUidWhenIssuing|enquiryUidFromNumber/);
assert.match(issue, /resolveEnquiryUid/);

const desk = src('components/customers/DocumentWorkspace.tsx');
assert.match(desk, /isEnquiryInboxRow/);
assert.match(desk, /resolveEnquiryUid/);
assert.match(desk, /stable ENQ UID/);

console.log('enquiry-uid.test.ts ok');
