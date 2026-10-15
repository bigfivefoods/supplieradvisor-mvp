/**
 * The signed-out sample does not call the API or the database.
 * Run: npx --yes tsx lib/construction/brief113-preview.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicApiPath, isPublicPagePath } from '../auth/public-paths';

function filesIn(path: string): string[] {
  const full = resolve(path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((name) => filesIn(resolve(full, name)));
}

const files = [
  ...filesIn('app/preview/constructiongraph'),
  resolve('components/construction/PreviewApp.tsx'),
].filter((file) => file.endsWith('.tsx') || file.endsWith('.ts'));

const src = files.map((file) => readFileSync(file, 'utf8')).join('\n');
assert.equal(src.includes('getSupabase'), false);
assert.equal(src.includes('/api/'), false);
assert.match(src, /data-book-ready/);
assert.match(src, /Sample/);
assert.doesNotMatch(src, /<aside/);
assert.equal(isPublicPagePath('/preview/constructiongraph'), true);
assert.equal(isPublicPagePath('/preview/constructiongraph/diary'), true);
assert.equal(isPublicPagePath('/api/preview/constructiongraph'), false);
assert.equal(isPublicApiPath('/api/construction/constructiongraph'), false);
assert.equal(isPublicApiPath('/preview/constructiongraph'), false);

console.log('brief113-preview.test.ts ok');
