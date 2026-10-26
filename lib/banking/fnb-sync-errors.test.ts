/**
 * FNB sync error handling: masked accounts, redacted logs, real cron pull.
 * Run: npx --yes tsx lib/banking/fnb-sync-errors.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.FNB_CLIENT_ID = 'test-client-id-123';
process.env.FNB_CLIENT_SECRET = 'super-secret-value-xyz';

async function main() {
  const fnb = await import('./providers/fnb');

  assert.equal(fnb.maskAccountNumber('62912345983'), '****5983');
  assert.equal(fnb.maskAccountNumber(''), null);

  const path = fnb.maskedStatementPath(
    '/apigateway/transaction-history/retrieve/v2/{accountNumber}',
    '62912345983'
  );
  assert.equal(path, '/apigateway/transaction-history/retrieve/v2/****5983');
  assert.ok(!path.includes('{accountNumber}'));

  const red = fnb.redactFnbText(
    '{"message":"Error for 62912345983","access_token":"abc.def","client":"test-client-id-123","s":"super-secret-value-xyz","auth":"Bearer eyJhbGciOi.x.y","other":"1234567890"}',
    '62912345983'
  );
  assert.ok(!red.includes('62912345983'));
  assert.ok(red.includes('****5983'));
  assert.ok(!red.includes('abc.def'));
  assert.ok(!red.includes('super-secret-value-xyz'));
  assert.ok(!red.includes('test-client-id-123'));
  assert.ok(!red.includes('eyJhbGciOi'));
  assert.ok(!red.includes('1234567890'));

  // Simulate FNB: token ok, statement 400.
  const calls: string[] = [];
  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (m: unknown) => void warns.push(String(m));
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    if (String(url).includes('oauth2')) {
      return new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ message: 'Error calling transaction history service', acct: '62912345983' }),
      { status: 400 }
    );
  }) as typeof fetch;
  const out = await fnb.fetchFnbTransactions({ accountNumber: '62912345983' });
  console.warn = origWarn;

  assert.equal(out.txns.length, 0);
  assert.ok(out.error);
  assert.ok(out.error!.includes('****5983'), out.error);
  assert.ok(!out.error!.includes('{accountNumber}'), out.error);
  assert.ok(!out.error!.includes('62912345983'));
  assert.ok(out.error!.includes('400'));
  assert.ok(out.error!.includes('Error calling transaction history service'));
  assert.ok((out.tried || []).every((t) => !t.includes('{accountNumber}')));
  assert.ok(calls.some((c) => c.includes('/v2/62912345983?')), 'real account used in URL');

  assert.equal(warns.length, 1);
  const logged = JSON.parse(warns[0]);
  assert.equal(logged.kind, 'fnb_statement_error');
  assert.equal(logged.status, 400);
  assert.ok(logged.body.includes('Error calling transaction history service'));
  assert.ok(!warns[0].includes('62912345983'));
  assert.ok(!warns[0].includes('tok-1'));

  // Cron route: real FNB provider for fnb connections, errors recorded.
  const cron = readFileSync(resolve('app/api/banking/cron-sync/route.ts'), 'utf8');
  assert.match(cron, /fetchFnbTransactions\(/);
  assert.match(cron, /conn\.provider === 'fnb'/);
  assert.match(cron, /cfg\.mode === 'sandbox' && conn\.provider !== 'fnb'/);
  assert.match(cron, /status: 'error'/);
  assert.match(cron, /last_error: fnbError/);

  const sync = readFileSync(resolve('app/api/banking/sync/route.ts'), 'utf8');
  assert.match(sync, /last_error: pulled\.error/);

  console.log('fnb-sync-errors.test.ts ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
