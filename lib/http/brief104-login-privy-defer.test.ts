/**
 * Brief 104 — /login loads the Privy SDK only after sign-in is requested,
 * unless an existing session or OAuth return must keep the same redirect.
 * Run: npx --yes tsx lib/http/brief104-login-privy-defer.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  clientShouldLoadPrivyImmediately,
  cookieHeaderIndicatesPrivySession,
  searchIndicatesPrivyOauth,
  storageKeyIndicatesPrivySession,
} from '../auth/login-privy-resume';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const loginPage = read('app/login/page.tsx');
const loginAuthShell = read('components/auth/LoginAuthShell.tsx');
const resume = read('lib/auth/login-privy-resume.ts');
const themeView = read('components/theme/ThemeToggleView.tsx');

assert.ok(
  !loginPage.includes('@privy-io/react-auth'),
  '/login page must not import @privy-io/react-auth'
);
assert.ok(
  !loginPage.includes("from '@/lib/business/useCompanyRole'"),
  '/login page must not import the Privy-backed company role hook'
);
assert.ok(
  !loginPage.includes("from '@/components/theme/ThemeToggle'"),
  '/login must not import the Privy-backed ThemeToggle'
);
assert.ok(
  loginPage.includes("from '@/components/theme/ThemeToggleView'"),
  '/login keeps the theme control via the Privy-free view'
);
assert.ok(
  loginPage.includes('normalizeEnabledModules(null)'),
  '/login theme map must match the signed-out company-role default'
);
assert.ok(
  !loginAuthShell.includes('@privy-io/react-auth'),
  'login shell must not statically import @privy-io/react-auth'
);
assert.ok(
  !resume.includes('@privy-io'),
  'session hint helper must not import the Privy SDK'
);
assert.ok(!themeView.includes('@privy-io'), 'theme view must not import Privy');
assert.ok(!themeView.includes('usePrivy'), 'theme view must not call usePrivy');
assert.ok(
  !themeView.includes("from '@/lib/business/useCompanyRole'"),
  'theme view must not import useCompanyRole'
);

assert.ok(
  loginAuthShell.includes('if (!loadPrivy'),
  'Privy import() must wait until loadPrivy is set'
);
assert.ok(
  loginAuthShell.includes('setLoadPrivy(true)'),
  'sign-in clicks must set loadPrivy so the dynamic import runs'
);
assert.ok(
  loginAuthShell.includes('clientShouldLoadPrivyImmediately()'),
  'existing sessions and OAuth returns must still mount Privy without a click'
);
assert.ok(
  loginAuthShell.includes("import('@/components/Providers')"),
  'Providers stays a dynamic import'
);
assert.ok(
  loginPage.includes('href="/me"') && loginPage.includes('prefetch={false}'),
  '/login must not prefetch /me, which ships the Privy client chunks'
);

assert.equal(clientShouldLoadPrivyImmediately(), false);

assert.equal(cookieHeaderIndicatesPrivySession(''), false);
assert.equal(cookieHeaderIndicatesPrivySession('theme=dark'), false);
assert.equal(cookieHeaderIndicatesPrivySession('privy-token='), false);
assert.equal(cookieHeaderIndicatesPrivySession('privy-token=abc'), true);
assert.equal(cookieHeaderIndicatesPrivySession('sa_authed=1'), true);
assert.equal(cookieHeaderIndicatesPrivySession('sa_authed=0'), false);
assert.equal(cookieHeaderIndicatesPrivySession('other=privy-token'), false);
assert.equal(
  cookieHeaderIndicatesPrivySession('theme=dark; privy-session=xyz'),
  true
);
assert.equal(cookieHeaderIndicatesPrivySession('privy-refresh-token=abc'), true);
assert.equal(cookieHeaderIndicatesPrivySession('privy-id-token=abc'), true);
assert.equal(cookieHeaderIndicatesPrivySession('privy-clabc-token=abc'), true);

assert.equal(searchIndicatesPrivyOauth(''), false);
assert.equal(searchIndicatesPrivyOauth('?next=/dashboard'), false);
assert.equal(
  searchIndicatesPrivyOauth('?privy_oauth_code=1&privy_oauth_state=2'),
  true
);
assert.equal(searchIndicatesPrivyOauth('privy_oauth_state=2'), true);

assert.equal(storageKeyIndicatesPrivySession('privy:token'), true);
assert.equal(storageKeyIndicatesPrivySession('privy:did:privy:abc:token'), true);
assert.equal(storageKeyIndicatesPrivySession('privy:refresh_token'), true);
assert.equal(storageKeyIndicatesPrivySession('privy:id-token'), true);
assert.equal(storageKeyIndicatesPrivySession('privy:pat'), true);
assert.equal(storageKeyIndicatesPrivySession('privy:active-user'), true);
assert.equal(storageKeyIndicatesPrivySession('privy:saved-users'), false);
assert.equal(storageKeyIndicatesPrivySession('privy:guest:app'), false);
assert.equal(storageKeyIndicatesPrivySession('sa_login_role'), false);

console.log('brief104-login-privy-defer.test.ts ok');
