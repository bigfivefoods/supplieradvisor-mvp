/**
 * Run: npx --yes tsx lib/system/env-guard.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertDeploymentEnv,
  evaluateDeploymentEnv,
  PRODUCTION_SUPABASE_PROJECT_REF,
  resetDeploymentEnvForTests,
} from './env-guard';

const prodUrl = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
const stagingUrl = 'https://stagingexample.supabase.co';
const liveKey = 'sk_live_sample';
const testKey = 'sk_test_sample';

type Row = {
  name: string;
  vercelEnv: string;
  url: string;
  enforce?: string;
  payment?: string;
  action: 'ok' | 'warn' | 'throw';
};

const rows: Row[] = [
  { name: 'production with prod url and enforce', vercelEnv: 'production', url: prodUrl, enforce: '1', payment: liveKey, action: 'ok' },
  { name: 'production with prod url warn mode', vercelEnv: 'production', url: prodUrl, enforce: '0', action: 'ok' },
  { name: 'production never throws on a live key', vercelEnv: 'production', url: stagingUrl, enforce: '1', payment: liveKey, action: 'ok' },
  { name: 'preview prod url enforce unset', vercelEnv: 'preview', url: prodUrl, action: 'warn' },
  { name: 'preview prod url enforce empty', vercelEnv: 'preview', url: prodUrl, enforce: '', action: 'warn' },
  { name: 'preview prod url enforce zero', vercelEnv: 'preview', url: prodUrl, enforce: '0', action: 'warn' },
  { name: 'preview prod url enforce', vercelEnv: 'preview', url: prodUrl, enforce: '1', action: 'throw' },
  { name: 'preview staging url enforce', vercelEnv: 'preview', url: stagingUrl, enforce: '1', action: 'ok' },
  { name: 'preview live key warn', vercelEnv: 'preview', url: stagingUrl, enforce: '0', payment: liveKey, action: 'warn' },
  { name: 'preview live key enforce', vercelEnv: 'preview', url: stagingUrl, enforce: '1', payment: liveKey, action: 'throw' },
  { name: 'preview test key', vercelEnv: 'preview', url: stagingUrl, enforce: '1', payment: testKey, action: 'ok' },
  { name: 'development prod url is not the preview rule', vercelEnv: 'development', url: prodUrl, enforce: '1', action: 'ok' },
  { name: 'development live key enforce', vercelEnv: 'development', url: stagingUrl, enforce: '1', payment: liveKey, action: 'throw' },
  { name: 'unset env does not throw', vercelEnv: '', url: prodUrl, enforce: '1', payment: liveKey, action: 'ok' },
];

for (const row of rows) {
  const decision = evaluateDeploymentEnv({
    vercelEnv: row.vercelEnv,
    enforce: row.enforce,
    supabaseUrl: row.url,
    paymentKeys: { PAYSTACK_SECRET_KEY: row.payment },
  });
  assert.equal(decision.action, row.action, row.name);
  if (decision.action === 'throw' || decision.action === 'warn') {
    assert.equal(decision.message.includes(liveKey), false, row.name);
    assert.equal(decision.message.includes(testKey), false, row.name);
  }
  if (row.name === 'preview prod url enforce') {
    assert.equal(decision.message.includes(PRODUCTION_SUPABASE_PROJECT_REF), true);
    assert.equal(decision.reasons.includes('preview-production-database'), true);
  }
  if (row.name === 'preview live key enforce') {
    assert.deepEqual(decision.paymentKeyNames, ['PAYSTACK_SECRET_KEY']);
    assert.equal(decision.message.includes('PAYSTACK_SECRET_KEY'), true);
    assert.equal(decision.message.includes('sk_live_'), false);
  }
}

const padded = evaluateDeploymentEnv({
  vercelEnv: 'preview',
  enforce: '1',
  supabaseUrl: stagingUrl,
  paymentKeys: { STRIPE_SECRET_KEY: `  ${liveKey}  ` },
});
assert.equal(padded.action, 'throw');
assert.equal(padded.message.includes(liveKey), false);

resetDeploymentEnvForTests();
const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (msg?: unknown) => {
  warnings.push(String(msg));
};
try {
  const env = {
    VERCEL_ENV: 'preview',
    ENV_GUARD_ENFORCE: '0',
    PAYSTACK_SECRET_KEY: liveKey,
  };
  assertDeploymentEnv({ supabaseUrl: prodUrl, env });
  assertDeploymentEnv({ supabaseUrl: prodUrl, env });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].includes(liveKey), false);
  assert.equal(warnings[0].includes('[env-guard]'), true);
  assert.throws(
    () =>
      assertDeploymentEnv({
        supabaseUrl: prodUrl,
        env: { ...env, ENV_GUARD_ENFORCE: '1' },
      }),
    /will not start/
  );
  assert.doesNotThrow(() =>
    assertDeploymentEnv({
      supabaseUrl: prodUrl,
      env: { VERCEL_ENV: 'production', ENV_GUARD_ENFORCE: '1', PAYSTACK_SECRET_KEY: liveKey },
    })
  );
  warnings.length = 0;
  resetDeploymentEnvForTests();
  assert.doesNotThrow(() =>
    assertDeploymentEnv({
      supabaseUrl: prodUrl,
      env: { VERCEL_ENV: 'preview', PAYSTACK_SECRET_KEY: liveKey },
    })
  );
  assert.equal(warnings.length, 1, 'missing ENV_GUARD_ENFORCE stays warn-only');
  assert.doesNotThrow(() =>
    assertDeploymentEnv({
      supabaseUrl: prodUrl,
      env: { VERCEL_ENV: 'preview', ENV_GUARD_ENFORCE: '', PAYSTACK_SECRET_KEY: liveKey },
    })
  );
} finally {
  console.warn = originalWarn;
  resetDeploymentEnvForTests();
}

for (const file of ['lib/supabase/server-client.ts', 'lib/supabase/admin.ts']) {
  const text = readFileSync(file, 'utf8');
  assert.equal(text.includes('assertDeploymentEnv('), true, file);
}

console.log('env-guard.test.ts ok');
