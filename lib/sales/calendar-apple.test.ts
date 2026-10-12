import assert from 'node:assert/strict';
import { appleConnectError, normalizeApplePassword } from './calendar-apple';

assert.equal(normalizeApplePassword('abcd-efgh-ijkl-mnop'), 'abcdefghijklmnop');
assert.equal(normalizeApplePassword('ABCD EFGH IJKL MNOP'), 'abcdefghijklmnop');
assert.equal(normalizeApplePassword('abcd–efgh–ijkl–mnop'), 'abcdefghijklmnop');
assert.equal(normalizeApplePassword('Your code is abcd-efgh-ijkl-mnop.'), 'abcdefghijklmnop');
assert.equal(normalizeApplePassword('secret'), 'secret');

assert.equal(appleConnectError('craig@bigfivefoods.com', 'abcdefghijklmnop'), null);
assert.match(appleConnectError('craig', 'abcdefghijklmnop') || '', /email address/);
assert.match(appleConnectError('craig@bigfivefoods.com', 'secret') || '', /16-character/);
assert.match(appleConnectError('craig@bigfivefoods.com', '') || '', /16-character/);

console.log('calendar-apple tests ok');
