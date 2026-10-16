/**
 * Run: npx --yes tsx lib/recovery/brief116-sa-id.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fictionalInvalidSaId, validateSaId, withChecksum } from './sa-id';

const valid = withChecksum('900101500008');
assert.equal(validateSaId(valid).ok, true);
assert.equal(validateSaId(`${valid.slice(0, 12)}${(Number(valid[12]) + 1) % 10}`).ok, false);
assert.equal(validateSaId('9002305000087').ok, false);
const badDate = validateSaId('9002305000087');
assert.equal(badDate.ok, false);
if (!badDate.ok) assert.equal(badDate.reason, 'date');
const citizen = withChecksum('900101500018');
assert.equal(validateSaId(citizen).ok, true);
const alien = withChecksum('900101500028');
const alienResult = validateSaId(alien);
assert.equal(alienResult.ok, false);
if (!alienResult.ok) assert.equal(alienResult.reason, 'citizenship');
assert.equal(validateSaId('123').ok, false);
const invalid = fictionalInvalidSaId(4);
assert.equal(invalid.length, 13);
const invalidResult = validateSaId(invalid);
assert.equal(invalidResult.ok, false);
if (!invalidResult.ok) assert.equal(invalidResult.reason, 'checksum');

function walk(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === '.git') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const roots = ['lib/recovery', 'components/recovery', 'supabase/migrations', 'docs'].flatMap((dir) => walk(resolve(dir)));
for (const path of roots) {
  if (!/\.(ts|tsx|sql|md)$/.test(path)) continue;
  const text = readFileSync(path, 'utf8');
  const found = text.match(/\d{13}/g) || [];
  for (const literal of found) {
    assert.equal(validateSaId(literal).ok, false, `${path} has a checksum-valid 13-digit literal`);
  }
}

console.log('brief116-sa-id.test.ts ok');
