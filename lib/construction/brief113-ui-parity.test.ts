/**
 * ConstructionAdvisor® uses the same control classes as TradeAdvisor®.
 * Run: npx --yes tsx lib/construction/brief113-ui-parity.test.ts
 */
import assert from 'node:assert/strict';
import { constructionBtn, constructionCard, constructionField } from '@/components/construction/ConstructionUi';
import { tradeBtn, tradeCard, tradeField } from '@/components/trades/TradeUi';

assert.equal(constructionCard, tradeCard);
assert.equal(constructionBtn, tradeBtn);
assert.equal(constructionField, tradeField);

console.log('brief113-ui-parity.test.ts ok');
