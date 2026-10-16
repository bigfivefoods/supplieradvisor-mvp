/**
 * Run: npx --yes tsx lib/recovery/brief116-ui-parity.test.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tradeBtn, tradeCard, tradeField } from '@/components/trades/TradeUi';
import { AccountView, AccountsView, CreditorBookView, ImportView } from '@/components/recovery/book-views';
import { recoverBtn, recoverCard, recoverField } from '@/components/recovery/RecoverUi';
import { emptyMemory, harbourMemory } from './preview-memory';
import { capabilitiesFor } from './roles';

assert.equal(recoverBtn, tradeBtn);
assert.equal(recoverCard, tradeCard);
assert.equal(recoverField, tradeField);
assert.match(recoverBtn, /min-h-11/);

const owner = capabilitiesFor('owner');
const empty = emptyMemory();
const full = harbourMemory();

function html(node: ReturnType<typeof createElement>) {
  const markup = renderToStaticMarkup(node);
  assert.equal(markup.includes('undefined'), false);
  assert.equal(markup.includes('NaN'), false);
  assert.equal(markup.includes('[object Object]'), false);
  return markup;
}

const emptyAccounts = html(createElement(AccountsView, { phase: 'ready', book: empty, role: 'owner', caps: owner }));
assert.match(emptyAccounts, /No accounts yet/);
assert.match(emptyAccounts, /Open imports/);
html(createElement(AccountsView, { phase: 'loading', book: empty, role: 'owner', caps: owner }));
html(createElement(AccountsView, { phase: 'error', book: empty, role: 'owner', caps: owner }));
const populated = html(createElement(AccountsView, { phase: 'ready', book: full, role: 'owner', caps: owner }));
assert.match(populated, /RC-/);
html(createElement(AccountView, { phase: 'ready', account: null, role: 'owner', caps: owner }));
html(createElement(AccountView, { phase: 'ready', account: full.accounts[0], role: 'owner', caps: owner }));
html(createElement(ImportView, { phase: 'ready', book: empty, caps: owner }));
html(createElement(ImportView, { phase: 'error', book: empty, caps: owner }));
html(createElement(CreditorBookView, { phase: 'ready', creditors: [], mandates: [] }));
const emptyCreditors = html(createElement(CreditorBookView, { phase: 'ready', creditors: [], mandates: [] }));
assert.match(emptyCreditors, /Add your first creditor/);

console.log('brief116-ui-parity.test.ts ok');
