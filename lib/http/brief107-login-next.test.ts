/**
 * Brief 107 — /login honours ?next=, ?email= and ?claimed= on the client.
 * Run: npx --yes tsx lib/http/brief107-login-next.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeNextPath } from '../auth/safe-next';
import { replaceAfterEmailCodeLogin } from '../auth/login-return';
import { peekOauthReturnParams, stashOauthReturnParams } from '../auth/oauth-return';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const loginPage = read('app/login/page.tsx');
const reader = read('components/auth/LoginReturnQuery.tsx');
const panel = read('components/auth/LoginPrivyPanel.tsx');
const shell = read('components/auth/LoginAuthShell.tsx');
const stash = read('lib/auth/oauth-return.ts');
const loginReturn = read('lib/auth/login-return.ts');

assert.doesNotMatch(
  loginPage,
  /searchParams\?/,
  'app/login/page.tsx must not read searchParams synchronously'
);
assert.doesNotMatch(
  loginPage,
  /searchParams/,
  'the server page must not touch searchParams; the client reader owns the query'
);
assert.match(loginPage, /LoginReturnQuery/, 'the login page mounts the query reader');
assert.doesNotMatch(loginPage, /@privy-io/);
assert.doesNotMatch(loginPage, /from 'viem'/);
assert.doesNotMatch(loginPage, /undici/);

assert.match(
  reader,
  /useSearchParams|window\.location\.search/,
  'the query reader must read next, email, and claimed on the client'
);
assert.match(reader, /<Suspense/, 'useSearchParams stays inside Suspense so /login can stay static');
assert.match(reader, /SA Member/);
assert.match(reader, /Account ready/);
assert.match(reader, /Operator invite/);
assert.match(reader, /LoginAuthShell/);
assert.match(reader, /prefillEmail/);
assert.match(reader, /nextFromQuery/);
assert.doesNotMatch(reader, /@privy-io/, 'query reader must not import @privy-io');
assert.doesNotMatch(reader, /viem/, 'query reader must not import viem');
assert.doesNotMatch(reader, /undici/, 'query reader must not import undici');

assert.match(
  panel,
  /router\.replace\(\s*safeNextPath\(next\)\)/,
  'LoginPrivyPanel email-code success calls router.replace(safeNextPath(next))'
);
assert.match(panel, /replaceAfterEmailCodeLogin\(router,\s*next/);
assert.match(loginReturn, /router\.replace\(\s*safeNextPath\(next\)\)/);

const business = { isContractor: false, isBusinessUser: true };
const emailCodePaths = [
  '/dashboard/suppliers/x',
  '/contractor/invite?token=t',
  '/dashboard/select-company?company=12',
  '/me',
];

for (const next of emailCodePaths) {
  const calls: string[] = [];
  replaceAfterEmailCodeLogin({ replace: (href) => calls.push(href) }, next, business);
  assert.deepEqual(calls, [safeNextPath(next)], `email code should return to ${next}`);
  assert.equal(calls[0], next);
}

assert.equal(safeNextPath('//evil.com'), '');
assert.equal(safeNextPath('https://evil.com'), '');
assert.equal(safeNextPath('/\\evil'), '');

for (const evil of ['//evil.com', 'https://evil.com', '/\\evil']) {
  const calls: string[] = [];
  replaceAfterEmailCodeLogin({ replace: (href) => calls.push(href) }, evil, business);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], '/dashboard/select-company');
  assert.notEqual(calls[0], evil);
}

const contractorOnly = { isContractor: true, isBusinessUser: false };
{
  const calls: string[] = [];
  replaceAfterEmailCodeLogin(
    { replace: (href) => calls.push(href) },
    '/dashboard/suppliers/x',
    contractorOnly
  );
  assert.deepEqual(calls, ['/contractor']);
}
{
  const calls: string[] = [];
  replaceAfterEmailCodeLogin(
    { replace: (href) => calls.push(href) },
    '/contractor/invite?token=t',
    contractorOnly
  );
  assert.deepEqual(calls, ['/contractor/invite?token=t']);
}

const memory = new Map<string, string>();
const sessionStorage = {
  setItem: (key: string, value: string) => memory.set(key, value),
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  removeItem: (key: string) => memory.delete(key),
};
Object.assign(globalThis, {
  sessionStorage,
  window: {
    location: { search: '?next=/dashboard/suppliers/x&email=a@b.co&company=12' },
    sessionStorage,
  },
});
const saved = stashOauthReturnParams();
assert.equal(saved.next, '/dashboard/suppliers/x');
assert.equal(saved.email, 'a@b.co');
assert.equal(saved.company, '12');
const peeked = peekOauthReturnParams();
assert.equal(peeked.next, '/dashboard/suppliers/x');
assert.equal(peeked.email, 'a@b.co');
assert.equal(peeked.company, '12');

const queue = shell.slice(shell.indexOf('const queueIntent'));
const stashAt = queue.indexOf('stashOauthReturnParams()');
const loadAt = queue.indexOf('setLoadPrivy(true)');
assert.ok(stashAt >= 0 && loadAt > stashAt, 'stash next/email/company before Privy loads on click');
assert.match(stash, /'email'/);
assert.match(stash, /'company'/);
assert.match(stash, /'next'/);

console.log('brief107-login-next.test.ts ok');
