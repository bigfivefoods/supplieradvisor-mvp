/**
 * Run: npx --yes tsx lib/auth/safe-next.test.ts
 */
import assert from 'node:assert/strict';
import { safeNextPath } from './safe-next';

// Allowed: same-site relative paths (query kept)
assert.equal(safeNextPath('/dashboard/select-company?company=102'), '/dashboard/select-company?company=102');
assert.equal(safeNextPath('/contractor/invite?token=abc'), '/contractor/invite?token=abc');
assert.equal(safeNextPath('/me'), '/me');
assert.equal(safeNextPath('  /me  '), '/me');

// Rejected: off-site and tricks
for (const bad of [
  'https://evil.example/x',
  'http://evil.example',
  '//evil.example/x',
  '/\\evil.example',
  '/\\/evil.example',
  'javascript:alert(1)',
  'data:text/html,hi',
  'dashboard',
  '/dash\nboard',
  '/dash\tboard',
  '',
  null,
  undefined,
]) {
  assert.equal(safeNextPath(bad as string), '', `should reject ${JSON.stringify(bad)}`);
}

console.log('safe-next tests passed');
