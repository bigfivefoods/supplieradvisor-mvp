/**
 * Brief 94 — public marketplace product images via next/image + sizes guardrails.
 * Run: npx --yes tsx lib/marketing/brief94-marketplace-images.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const marketplacePage = read('app/marketplace/page.tsx');
const nextConfig = read('next.config.js');

assert.match(marketplacePage, /import\s+Image\s+from\s+['"]next\/image['"]/);
assert.match(marketplacePage, /sizes\s*=/);
assert.doesNotMatch(marketplacePage, /eslint-disable-next-line\s+@next\/next\/no-img-element/);
assert.doesNotMatch(marketplacePage, /<img\s+[^>]*src=\{l\.primary_image_url\}/);
assert.doesNotMatch(marketplacePage, /<img\s+[^>]*className=\{?['\"]?[^\n]*sa-product-photo/);
assert.doesNotMatch(marketplacePage, /@privy-io/);
assert.doesNotMatch(marketplacePage, /\bviem\b/);
assert.doesNotMatch(marketplacePage, /\bwagmi\b/);
assert.doesNotMatch(marketplacePage, /\bundici\b/);
assert.match(nextConfig, /onkklullmgrdqoertngp\.supabase\.co/);

console.log('brief94-marketplace-images.test.ts ok');
