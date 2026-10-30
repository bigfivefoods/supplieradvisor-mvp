/**
 * Netcash Debit Order credentials: seal, mask, and owner/admin only.
 * Run: npx tsx lib/fitness/netcash/credentials.test.ts
 * Company 901 only. No database. No network.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CredentialsCard } from '../../../components/fitness/netcash/CredentialsCard';
import { createNetcashClient } from './client';
import { encryptionKey, keyFromHex, openSecret, sealSecret, serviceKeyAad } from './crypto';
import { toPublicSettings } from './defaults';
import { companyAllowed } from './guard';
import { credentialUpdatedLine, redactSecret, savedKeyLabel } from './mask';
import { memoryRepo } from './memory';
import { createTestModeNiwsCaller, probeDebitOrderServiceKey, type NiwsFetch } from './niws-http';
import { canManageNetcash, NETCASH_ADMIN_ROLES } from './permissions';
import { removeServiceKey, testDebitOrderConnection, updateSettings, type ServiceDeps } from './service';

const KEY = keyFromHex('ab'.repeat(32));
const OTHER = keyFromHex('cd'.repeat(32));
assert.ok(KEY);
assert.ok(OTHER);
assert.equal(keyFromHex('short'), null);
assert.equal(keyFromHex('zz'.repeat(32)), null);

const plain = 'sandbox-key-1234';
const sealed = sealSecret(plain, KEY, serviceKeyAad(901));
assert.equal(openSecret(sealed, KEY, serviceKeyAad(901)), plain);
assert.equal(openSecret(sealed, OTHER, serviceKeyAad(901)), null);
assert.equal(openSecret(sealed, KEY, serviceKeyAad(902)), null);
assert.equal(sealed.startsWith('gnc1.'), true);
assert.equal(sealed.includes(plain), false);
const tampered = sealed.split('.');
const body = tampered[3];
const flipAt = Math.min(2, body.length - 1);
tampered[3] = `${body.slice(0, flipAt)}${body[flipAt] === 'A' ? 'B' : 'A'}${body.slice(flipAt + 1)}`;
assert.equal(openSecret(tampered.join('.'), KEY, serviceKeyAad(901)), null);
assert.match(readFileSync(new URL('./crypto.ts', import.meta.url), 'utf8'), /aes-256-gcm/);
assert.match(readFileSync(new URL('./crypto.ts', import.meta.url), 'utf8'), /GYM_NETCASH_ENC_KEY/);
if (!process.env.GYM_NETCASH_ENC_KEY) assert.equal(encryptionKey(), null);

assert.equal(savedKeyLabel('1234'), 'Saved, ending in ••••1234');
assert.equal(savedKeyLabel('7K2Q'), 'Saved, ending in ••••7K2Q');
assert.equal(savedKeyLabel(''), '');
assert.equal(savedKeyLabel('12'), '');
assert.equal(credentialUpdatedLine('2026-10-29T08:00:00.000Z', 'owner'), 'Last updated 29 Oct 2026, 10:00 SAST by owner.');
assert.equal(redactSecret(`rejected ${plain}`, plain).includes(plain), false);

for (const role of NETCASH_ADMIN_ROLES) assert.equal(canManageNetcash(role), true);
for (const role of ['member', 'coach', 'finance', 'staff', 'viewer', 'sales', 'operations', '', null]) {
  assert.equal(canManageNetcash(role), false, String(role));
}

const runtime = readFileSync('lib/fitness/netcash/server/runtime.ts', 'utf8');
assert.match(runtime, /NETCASH_ADMIN_ROLES/);
assert.match(runtime, /createTestModeNiwsCaller/);
assert.equal(runtime.includes("mode: 'live'"), false);
for (const file of [
  'app/api/fitness/netcash/settings/route.ts',
  'app/api/fitness/netcash/settings/test/route.ts',
  'components/fitness/netcash/CredentialsCard.tsx',
  'app/preview/fitgraph/netcash/page.tsx',
  'app/dashboard/fitgraph/netcash/page.tsx',
]) {
  const source = readFileSync(file, 'utf8');
  assert.equal(source.includes('GYM_NETCASH_ENC_KEY'), false, file);
  assert.equal(source.includes('serviceKeyEnc'), file === 'app/api/fitness/netcash/settings/route.ts');
}
assert.match(readFileSync('app/api/fitness/netcash/settings/route.ts', 'utf8'), /requireNetcashAdmin/);
assert.match(readFileSync('app/api/fitness/netcash/settings/test/route.ts', 'utf8'), /requireNetcashAdmin/);
assert.equal(readFileSync('app/api/fitness/netcash/settings/test/route.ts', 'utf8').includes('serviceKey'), false);
assert.equal(companyAllowed(901).ok, true);

const migration = readFileSync('supabase/migrations/20261047_gym_netcash_debit_orders.sql', 'utf8');
const grantStart = migration.indexOf('GRANT SELECT (');
const grantEnd = migration.indexOf(') ON public.gym_netcash_settings');
const grant = migration.slice(grantStart, grantEnd);
assert.equal(grant.includes('service_key_enc'), false);
assert.equal(grant.includes('account_key_enc'), false);
assert.match(grant, /service_key_updated_at/);
assert.match(migration, /gym_netcash_settings_service_key_sealed/);
assert.match(migration, /service_role only/);
assert.match(migration, /lower\(bu\.role\) IN \('owner', 'admin'\)/);
assert.match(migration, /DO NOT apply this file to production/);
assert.doesNotMatch(migration, /INSERT INTO public\.gym_netcash_settings/);

function deps(): ServiceDeps & { repo: ReturnType<typeof memoryRepo> } {
  let n = 0;
  const repo = memoryRepo();
  return {
    repo,
    now: () => new Date('2026-10-29T08:00:00.000Z'),
    id: () => `cred_${++n}`,
    sealServiceKey: (companyId, value) => sealSecret(value, KEY, serviceKeyAad(companyId)),
    openServiceKey: (companyId, settings) =>
      settings.serviceKeyEnc ? openSecret(settings.serviceKeyEnc, KEY, serviceKeyAad(companyId)) : null,
  };
}

async function main() {
  const book = deps();
  await updateSettings(book, 901, { merchantAccount: 'NC-HA-1001', serviceKey: plain }, 'owner', '127.0.0.1');
  const saved = await book.repo.getSettings(901);
  assert.equal(saved?.serviceKeyLast4, '1234');
  assert.equal(saved?.serviceKeyConfigured, true);
  assert.equal(saved?.serviceKeyUpdatedBy, 'owner');
  assert.equal(String(saved?.serviceKeyEnc || '').includes(plain), false);
  assert.equal(book.openServiceKey?.(901, saved!), plain);
  const pub = toPublicSettings(saved!);
  assert.equal('serviceKeyEnc' in pub, false);
  assert.equal('accountKeyEnc' in pub, false);
  assert.equal(JSON.stringify(pub).includes('gnc1.'), false);
  assert.equal(JSON.stringify(pub).includes(plain), false);

  await updateSettings(book, 901, { serviceKey: 'replacement-key-9876' }, 'admin', '127.0.0.1');
  const replaced = await book.repo.getSettings(901);
  assert.equal(replaced?.serviceKeyLast4, '9876');
  assert.equal(book.openServiceKey?.(901, replaced!), 'replacement-key-9876');

  const tested = await testDebitOrderConnection(book, 901, 'owner', '127.0.0.1');
  assert.equal(tested.ok, false);
  assert.match(tested.message, /network calls are off/);
  assert.equal(tested.message.includes('replacement-key'), false);

  book.probeDebitOrderKey = async (_companyId, serviceKey) => ({ ok: false, error: `bad ${serviceKey}` });
  const leaked = await testDebitOrderConnection(book, 901, 'owner');
  assert.equal(leaked.ok, false);
  assert.equal(leaked.message.includes('replacement-key-9876'), false);

  book.probeDebitOrderKey = async () => ({
    ok: true,
    message: 'Connection passed. Netcash accepted the Debit Order service key in test mode.',
  });
  const passed = await testDebitOrderConnection(book, 901, 'owner');
  assert.equal(passed.ok, true);
  assert.match(passed.message, /Connection passed/);
  assert.equal(passed.message.includes('9876'), false);

  await removeServiceKey(book, 901, 'owner', '127.0.0.1');
  const removed = await book.repo.getSettings(901);
  assert.equal(removed?.serviceKeyEnc, null);
  assert.equal(removed?.serviceKeyConfigured, false);
  assert.equal(removed?.serviceKeyLast4, '');
  assert.equal(removed?.merchantAccount, 'NC-HA-1001');
  const again = await removeServiceKey(book, 901, 'owner');
  assert.equal(again.serviceKeyConfigured, false);

  const actions = (await book.repo.listAudit(901, 20)).map((event) => event.action);
  assert.equal(actions.includes('credentials.save'), true);
  assert.equal(actions.includes('credentials.replace'), true);
  assert.equal(actions.includes('credentials.remove'), true);
  assert.equal(actions.includes('credentials.test'), true);
  const blob = JSON.stringify(await book.repo.listAudit(901, 20));
  assert.equal(blob.includes(plain), false);
  assert.equal(blob.includes('replacement-key-9876'), false);
  assert.equal(blob.includes('gnc1.'), false);

  const emptyHtml = renderToStaticMarkup(createElement(CredentialsCard, {
    view: {
      merchantAccount: '',
      configured: false,
      last4: '',
      updatedAt: '',
      updatedBy: '',
      testResult: null,
    },
    legend: 'Empty',
    readOnly: true,
  }));
  assert.match(emptyHtml, /No Debit Order service key is stored/);
  assert.equal(emptyHtml.includes('Saved, ending in'), false);

  const savedHtml = renderToStaticMarkup(createElement(CredentialsCard, {
    view: {
      merchantAccount: 'NC-HA-1001',
      configured: true,
      last4: '1234',
      updatedAt: '2026-10-29T08:00:00.000Z',
      updatedBy: 'owner',
      testResult: null,
    },
    legend: 'Saved',
    readOnly: true,
  }));
  assert.match(savedHtml, /Saved, ending in ••••1234/);
  assert.match(savedHtml, /Last updated 29 Oct 2026, 10:00 SAST by owner\./);
  assert.match(savedHtml, /type="password"/);
  assert.equal(savedHtml.includes(plain), false);
  assert.match(savedHtml, /GymAdvisor®/);
  assert.match(savedHtml, /SupplierAdvisor®/);

  const passHtml = renderToStaticMarkup(createElement(CredentialsCard, {
    view: {
      merchantAccount: 'NC-HA-1001',
      configured: true,
      last4: '1234',
      updatedAt: '2026-10-29T08:00:00.000Z',
      updatedBy: 'owner',
      testResult: { ok: true, message: 'Connection passed. Netcash accepted the Debit Order service key in test mode.' },
    },
    legend: 'Test passed',
    readOnly: true,
  }));
  assert.match(passHtml, /Connection passed/);
  const failHtml = renderToStaticMarkup(createElement(CredentialsCard, {
    view: {
      merchantAccount: 'NC-HA-1001',
      configured: true,
      last4: '1234',
      updatedAt: '2026-10-29T08:00:00.000Z',
      updatedBy: 'owner',
      testResult: { ok: false, message: 'Connection failed. Netcash rejected the service key.' },
    },
    legend: 'Test failed',
    readOnly: true,
  }));
  assert.match(failHtml, /Connection failed\. Netcash rejected the service key\./);

  const preview = readFileSync('app/preview/fitgraph/netcash/page.tsx', 'utf8');
  assert.match(preview, /legend="Empty"/);
  assert.match(preview, /legend="Saved"/);
  assert.match(preview, /legend="Test passed"/);
  assert.match(preview, /legend="Test failed"/);

  let called = false;
  const blocked: NiwsFetch = async () => {
    called = true;
    return { status: 200, body: '<RequestDebitBatchUnauthorisedResult>ok</RequestDebitBatchUnauthorisedResult>' };
  };
  const off = await probeDebitOrderServiceKey(
    createTestModeNiwsCaller({
      companyId: 901,
      fetchImpl: blocked,
      flags: {
        allowNetwork: () => false,
        allowLive: () => true,
        allowCompany110: () => false,
      },
    }),
    plain,
    '2026-10-30'
  );
  assert.equal(called, false);
  assert.equal(off.ok, false);
  if (!off.ok) {
    assert.match(off.error, /network calls are off/);
    assert.equal(off.error.includes(plain), false);
  }

  const liveCaller = createNetcashClient('live');
  const live = await liveCaller.submitDebitBatch({ sha256: 'x', actionDate: '2026-11-02', rows: [] });
  assert.equal(live.ok, false);

  let sawKey = false;
  const allowed: NiwsFetch = async (_url, init) => {
    sawKey = init.body.includes(plain);
    assert.equal(init.headers.SOAPAction.includes('RequestDebitBatchUnauthorised'), true);
    return { status: 200, body: '<RequestDebitBatchUnauthorisedResult>NO DATA</RequestDebitBatchUnauthorisedResult>' };
  };
  const on = await probeDebitOrderServiceKey(
    createTestModeNiwsCaller({
      companyId: 901,
      fetchImpl: allowed,
      flags: {
        allowNetwork: () => true,
        allowLive: () => false,
        allowCompany110: () => false,
      },
    }),
    plain,
    '2026-10-30'
  );
  assert.equal(sawKey, true);
  assert.equal(on.ok, true);
  if (on.ok) assert.equal(on.message.includes(plain), false);

  const rejected = await probeDebitOrderServiceKey(
    createTestModeNiwsCaller({
      companyId: 901,
      fetchImpl: async () => ({ status: 200, body: '<RequestDebitBatchUnauthorisedResult>100</RequestDebitBatchUnauthorisedResult>' }),
      flags: {
        allowNetwork: () => true,
        allowLive: () => false,
        allowCompany110: () => false,
      },
    }),
    plain,
    '2026-10-30'
  );
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.error, 'Connection failed. Netcash rejected the service key.');
    assert.equal(rejected.error.includes(plain), false);
  }

  console.log('credentials.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
