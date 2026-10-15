/**
 * FleetAdvisor® root layout stays static.
 * Run: npx --yes tsx lib/fleet/brief115-root-layout.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync('app/layout.tsx', 'utf8');
assert.equal(layout.includes('headers('), false);
assert.equal(layout.includes('cookies('), false);
assert.equal(layout.includes('connection('), false);

const page = readFileSync('app/page.tsx', 'utf8');
assert.equal(page.includes("dynamic = 'force-dynamic'"), false);
assert.equal(page.includes('dynamic = "force-dynamic"'), false);

console.log('brief115-root-layout.test.ts ok');
