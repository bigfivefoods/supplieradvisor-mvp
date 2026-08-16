/**
 * Run: npx --yes tsx lib/fitness/movement-catalog.test.ts
 */
import assert from 'node:assert/strict';
import {
  SYSTEM_MOVEMENT_CATALOG,
  catalogIdForCode,
  ensureSystemMovements,
  isSystemMovement,
} from './movement-catalog';

const codes = SYSTEM_MOVEMENT_CATALOG.map((m) => m.code);
assert.equal(new Set(codes).size, codes.length, 'catalog codes must be unique');
assert.ok(codes.length >= 250, 'catalog should be an exhaustive gym library');

for (const m of SYSTEM_MOVEMENT_CATALOG) {
  assert.ok(m.name.trim(), m.code);
  assert.ok(m.overview.trim().length > 20, m.code);
  assert.ok(m.details.trim().length > 40, m.code);
  assert.ok(m.category, m.code);
}

const store = { movements: [] as import('./movements').FitMovement[] };
const added = ensureSystemMovements(store);
assert.equal(added, SYSTEM_MOVEMENT_CATALOG.length);
assert.equal(ensureSystemMovements(store), 0);
assert.equal(store.movements.length, SYSTEM_MOVEMENT_CATALOG.length);
assert.ok(isSystemMovement(store.movements[0]));
assert.equal(
  catalogIdForCode('SYS_MOV_BACK_SQUAT'),
  'mov_sys_back_squat'
);

console.log(`movement-catalog ok (${codes.length} movements)`);
