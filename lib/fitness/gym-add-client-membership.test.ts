/**
 * Add-client form can choose class member and/or private client.
 * Run: npx --yes tsx lib/fitness/gym-add-client-membership.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
assert.match(page, /Member of a class/);
assert.match(page, /Private client/);
assert.match(page, /member: !f\.member/);
assert.match(page, /privateClient: !f\.privateClient/);
assert.match(page, /if \(wasNew && \(form\.member \|\| form\.privateClient\)\)/);
assert.match(page, /action: 'allocate_member'/);
assert.match(page, /Select a class/);
assert.match(page, /Select the coach for this private client/);
assert.match(page, /omitClientRosterFields/);

console.log('gym-add-client-membership.test.ts ok');
