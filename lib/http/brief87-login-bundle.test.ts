/**
 * Brief 87 — keep /login initial entry free of eager Privy wallet/onchain code.
 * Run: npx --yes tsx lib/http/brief87-login-bundle.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const loginLayout = read('app/login/layout.tsx');
const loginPage = read('app/login/page.tsx');
const loginAuthShell = read('components/auth/LoginAuthShell.tsx');
const providers = read('components/Providers.tsx');

assert.ok(!loginLayout.includes('Providers'), '/login layout must not wrap with Providers');
assert.ok(
  !loginPage.includes('@privy-io/react-auth'),
  '/login page must not eagerly import @privy-io/react-auth'
);
assert.ok(
  !loginPage.includes("@/components/Providers"),
  '/login page must not eagerly import Providers'
);

for (const blocked of ['wagmi', 'viem', '@walletconnect']) {
  assert.ok(
    !loginPage.includes(blocked) && !loginAuthShell.includes(blocked),
    `/login entry shell must not include eager ${blocked} imports`
  );
}

assert.ok(
  loginAuthShell.includes("dynamic(\n  () => import('@/components/Providers').then((mod) => mod.Providers),") &&
    loginAuthShell.includes('ssr: false'),
  'Login auth shell must lazy-load Providers with ssr:false'
);

assert.ok(
  providers.includes('hasRealWalletConnect') && providers.includes('embeddedWallets'),
  'Providers must gate wallet config behind hasRealWalletConnect'
);

console.log('brief87-login-bundle.test.ts ok');
