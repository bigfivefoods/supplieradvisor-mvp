/**
 * Run: npx --yes tsx lib/customers/credit-application.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  creditInputErrors,
  creditStatusLabel,
  maskAccountNumber,
  normalizePaymentTerms,
  parseApprovedLimit,
  portalSavePlan,
  prefillCreditFromBook,
  sellerDecisionPlan,
} from './credit-application';

const valid = {
  legal_name: 'Palm Footwear (Pty) Ltd',
  trading_name: 'Palm Footwear',
  billing_address: '12 Main Road, Cape Town',
  contact_name: 'Amina Khan',
  contact_email: 'amina@palm.example',
  contact_phone: '021 555 0100',
  requested_limit: '50000',
  payment_terms: 'Net 30',
  bank_name: 'First National Bank',
  bank_account_name: 'Palm Footwear',
  bank_account_number: '12 34 56 7890',
  trade_references: [
    { company: 'Harbour Stores', contact: 'Sam', phone: '011 555 0199', email: '' },
  ],
  signatory_name: 'Amina Khan',
  signatory_title: 'Director',
  declaration_accepted: true,
};

const submitted = creditInputErrors(valid, 'submit');
assert.deepEqual(submitted.errors, []);
assert.equal(submitted.input.payment_terms, '30 days');
assert.equal(submitted.input.bank_account_number, '1234567890');
assert.equal(submitted.input.contact_phone, '0215550100');
assert.equal(submitted.input.currency, 'ZAR');

const draft = creditInputErrors({ trading_name: 'Palm' }, 'draft');
assert.deepEqual(draft.errors, []);

const badDraft = creditInputErrors(
  { contact_email: 'not-an-email', requested_limit: 0, years_trading: 201 },
  'draft'
);
assert.ok(badDraft.errors.some((e) => e.includes('email')));
assert.ok(badDraft.errors.some((e) => e.includes('above 0')));
assert.ok(badDraft.errors.some((e) => e.includes('Years trading')));

const missing = creditInputErrors({ trading_name: 'Palm' }, 'submit');
assert.ok(missing.errors.length >= 8);

const partialRef = creditInputErrors(
  { ...valid, trade_references: [{ company: 'Harbour', phone: '' }] },
  'submit'
);
assert.ok(partialRef.errors.some((e) => e.includes('trade reference')));

assert.equal(normalizePaymentTerms('cod'), 'COD');
assert.equal(normalizePaymentTerms('45 days'), '45 days');
assert.equal(normalizePaymentTerms('whenever'), '');

assert.equal(maskAccountNumber('1234567890'), '•••• 7890');
assert.equal(maskAccountNumber('123'), '••••');
assert.equal(maskAccountNumber(''), '');

assert.equal(portalSavePlan(null), 'insert');
assert.equal(portalSavePlan('draft'), 'update');
assert.equal(portalSavePlan('submitted'), 'blocked');
assert.equal(portalSavePlan('in_review'), 'blocked');
assert.equal(portalSavePlan('approved'), 'insert');
assert.equal(portalSavePlan('declined'), 'insert');

assert.equal(sellerDecisionPlan('draft'), 'draft');
assert.equal(sellerDecisionPlan('submitted'), 'allow');
assert.equal(sellerDecisionPlan('in_review'), 'allow');
assert.equal(sellerDecisionPlan('approved'), 'closed');

assert.equal(parseApprovedLimit('12500.5'), 12500.5);
assert.equal(parseApprovedLimit(0), null);
assert.equal(parseApprovedLimit(''), null);

const prefilled = prefillCreditFromBook({
  trading_name: 'Palm Footwear',
  email: 'Amina@Palm.example',
  phone: '082 000 1111',
  payment_terms: 'Net 14',
  address: '12 Main Road',
});
assert.equal(prefilled.trading_name, 'Palm Footwear');
assert.equal(prefilled.contact_email, 'amina@palm.example');
assert.equal(prefilled.payment_terms, '14 days');
assert.equal(prefilled.billing_address, '12 Main Road');

assert.equal(creditStatusLabel('in_review'), 'In review');

const three = creditInputErrors(
  {
    trade_references: [
      { company: 'A', phone: '111111' },
      { company: 'B', phone: '222222' },
      { company: 'C', phone: '333333' },
      { company: 'D', phone: '444444' },
    ],
  },
  'draft'
);
assert.equal(three.input.trade_references.length, 3);
assert.equal(three.input.trade_references[2].company, 'C');

const guest = readFileSync(resolve('lib/portals/guest-portal-tabs.ts'), 'utf8');
assert.match(guest, /id: 'credit', label: 'Credit'/);
const workspace = readFileSync(
  resolve('components/portals/GuestTradeWorkspace.tsx'),
  'utf8'
);
assert.match(workspace, /hidden=\{tab !== 'credit'\}/);
assert.match(workspace, /credit_application/);
const act = readFileSync(
  resolve('app/api/public/portals/trade/act/route.ts'),
  'utf8'
);
assert.match(act, /action === 'credit_application'/);
const nav = readFileSync(resolve('lib/chrome/module-nav.ts'), 'utf8');
assert.match(nav, /\/dashboard\/customers\/credit/);
const sql = readFileSync(resolve('RUN_THIS_FOR_CREDIT_APPLICATIONS.sql'), 'utf8');
assert.match(sql, /customer_credit_applications/);
assert.match(sql, /REVOKE ALL/);
assert.doesNotMatch(sql, /GRANT ALL ON TABLE public.customer_credit_applications TO anon/);

console.log('credit-application.test.ts ok');
