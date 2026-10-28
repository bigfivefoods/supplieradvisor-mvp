/**
 * Delivery-note routes stay behind company access, and the public read
 * checks the signed token before opening the database.
 * Run: npx --yes tsx lib/customers/delivery-note-authz.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function handler(src: string, name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, name);
  const brace = src.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(brace, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

const seller = readFileSync(resolve('app/api/customers/delivery-notes/route.ts'), 'utf8');
const render = readFileSync(resolve('app/api/customers/delivery-notes/render/route.ts'), 'utf8');
const pub = readFileSync(resolve('app/api/public/delivery-note/route.ts'), 'utf8');
const store = readFileSync(resolve('lib/customers/delivery-note-store.ts'), 'utf8');

for (const [file, name] of [
  [seller, 'GET'],
  [seller, 'POST'],
  [render, 'GET'],
] as const) {
  const body = handler(file, name);
  assert.ok(body.includes('requireCompanyAccess'), `${name} requireCompanyAccess`);
  const gate = body.indexOf('requireCompanyAccess');
  const work = Math.min(
    ...['getDeliveryNoteDesk', 'createDeliveryNote', 'revokeDeliveryNote', 'loadSellerDeliveryNote']
      .map((fn) => {
        const at = body.indexOf(fn);
        return at < 0 ? Number.POSITIVE_INFINITY : at;
      })
  );
  assert.ok(gate >= 0 && gate < work, `${name} gates before data`);
}

const publicGet = handler(pub, 'GET');
assert.equal(publicGet.includes('requireCompanyAccess'), false);
assert.ok(publicGet.includes('loadPublicDeliveryNote'));

const loadFn = store.slice(store.indexOf('export async function loadPublicDeliveryNote'));
const parseAt = loadFn.indexOf('parseDeliveryNoteToken');
const dbAt = loadFn.indexOf('getSupabaseServer');
assert.ok(parseAt >= 0 && parseAt < dbAt, 'public load checks the token before the database');

assert.match(
  store,
  /INVOICE_PUBLIC_COLS = 'id, profile_id, invoice_number, metadata'/
);
assert.doesNotMatch(
  store.slice(store.indexOf('INVOICE_PUBLIC_COLS'), store.indexOf('INVOICE_PUBLIC_COLS') + 120),
  /total_amount|unit_price|tax_|items|bank/
);

const share = readFileSync(
  resolve('components/customers/DeliveryNoteShareActions.tsx'),
  'utf8'
);
assert.match(share, /sharePdfFileViaNavigator/);
assert.match(share, /mode: 'wa\.me'/);
assert.match(share, /mode: 'whatsapp'/);

console.log('delivery-note-authz.test.ts ok');
