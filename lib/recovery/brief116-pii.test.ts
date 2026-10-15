/**
 * Run: npx --yes tsx lib/recovery/brief116-pii.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { auditPayload, maskDebtor, serialiseAccount } from './scope';
import { capabilitiesFor } from './roles';

async function main() {
  const enc = 'aa'.repeat(32);
  const mac = 'bb'.repeat(32);
  process.env.RECOVER_PII_ENC_KEY = enc;
  process.env.RECOVER_PII_HMAC_KEY = mac;
  const { encryptId, decryptId, blindIndex, maskId, piiConfigured } = await import('./pii-crypto');

  assert.equal(piiConfigured(), true);
  const sealed = encryptId('DEMO-KEY');
  assert.equal(sealed.ok, true);
  if (sealed.ok) {
    assert.match(sealed.enc, /^v1:/);
    assert.equal(sealed.version, 1);
    const opened = decryptId(sealed.enc);
    assert.equal(opened.ok && opened.value, 'DEMO-KEY');
    const tampered = decryptId(`${sealed.enc.slice(0, -2)}aa`);
    assert.equal(tampered.ok, false);
    const index = blindIndex('DEMO-KEY');
    assert.equal(index.ok && index.hash, sealed.hash);
    process.env.RECOVER_PII_HMAC_KEY = 'cc'.repeat(32);
    const other = blindIndex('DEMO-KEY');
    assert.equal(other.ok, true);
    if (other.ok) assert.notEqual(other.hash, sealed.hash);
    process.env.RECOVER_PII_HMAC_KEY = mac;
  }
  assert.equal(maskId('5083'), '•••••• 5083');
  assert.equal(maskId('12'), '••••••');

  process.env.RECOVER_PII_ENC_KEY = 'short';
  const refused = encryptId('DEMO-KEY');
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.code, 'pii_not_configured');
  process.env.RECOVER_PII_ENC_KEY = enc;

  const caps = capabilitiesFor('owner');
  const masked = maskDebtor(
    {
      id: 'd',
      display_name: 'Demo',
      id_last4: '5083',
      id_number_enc: 'v1:secret',
      id_hash: 'hash',
      id_number: 'DEMO-KEY',
      contacts: [{ value: '0100000001' }],
    },
    caps
  );
  const json = JSON.stringify(masked);
  assert.equal(json.includes('DEMO-KEY'), false);
  assert.equal(json.includes('v1:secret'), false);
  assert.equal(json.includes('"hash"'), false);

  const account = serialiseAccount(
    {
      id: 'a',
      ref: 'RC-000001',
      id_number_enc: 'v1:secret',
      id_hash: 'hash',
      id_last4: '5083',
      display_name: 'Demo',
    },
    'finance',
    capabilitiesFor('finance')
  );
  assert.equal(JSON.stringify(account).includes('v1:secret'), false);
  assert.equal(JSON.stringify(auditPayload({ account_id: 'a', note_text: 'secret note', id_number: '1' })).includes('secret'), false);

  function walk(dir: string): string[] {
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  }

  const clientFiles = ['components', 'app']
    .flatMap((dir) => walk(resolve(dir)))
    .filter((path) => path.endsWith('.tsx') || path.endsWith('.ts'));
  for (const path of clientFiles) {
    const text = readFileSync(path, 'utf8');
    if (!text.includes("'use client'") && !text.includes('"use client"')) continue;
    assert.equal(text.includes('pii-crypto'), false, path);
    assert.equal(text.includes('RECOVER_PII_'), false, path);
  }
  const reachable = walk(resolve('lib/recovery')).filter(
    (path) => !path.endsWith('pii-crypto.ts') && !path.includes('brief116-pii')
  );
  for (const path of reachable) {
    const text = readFileSync(path, 'utf8');
    if (text.includes('pii-crypto') && !path.endsWith('book-db.ts') && !path.endsWith('agent-read.ts')) {
      assert.equal(text.includes("'use client'"), false, relative(resolve('.'), path));
    }
    if (!path.endsWith('pii-crypto.ts') && !path.endsWith('book-db.ts')) {
      assert.equal(text.includes('RECOVER_PII_'), false, relative(resolve('.'), path));
    }
  }
  console.log('brief116-pii.test.ts ok');
}

void main();
