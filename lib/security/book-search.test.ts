/**
 * Run: npx --yes tsx lib/security/book-search.test.ts
 */
import assert from 'node:assert/strict';
import { bookIlikeOr } from './book-search';

assert.equal(bookIlikeOr('', ['trading_name']), null);
assert.equal(bookIlikeOr('a', ['trading_name']), null);
assert.equal(
  bookIlikeOr('kelpac', ['trading_name', 'email']),
  'trading_name.ilike.%kelpac%,email.ilike.%kelpac%'
);
assert.equal(
  bookIlikeOr('foo,bar%(x)', ['trading_name']),
  'trading_name.ilike.%foo bar x%'
);

console.log('book-search.test.ts ok');
