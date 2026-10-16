/**
 * Run: npx --yes tsx lib/recovery/brief117-accounts-state-link.test.ts
 */
import assert from 'node:assert/strict';
import { ACCOUNT_STATE_FILTERS, accountStateFromQuery, mapRecoverHref } from './href';

for (const state of ACCOUNT_STATE_FILTERS) {
  assert.equal(accountStateFromQuery(state), state);
}
assert.equal(accountStateFromQuery(null), '');
assert.equal(accountStateFromQuery(''), '');
assert.equal(accountStateFromQuery('deleted'), '');
assert.equal(accountStateFromQuery('ARRANGEMENT'), '');

const mapped = mapRecoverHref(
  '/dashboard/recovergraph/accounts?state=arrangement',
  '/preview/recovergraph?role=owner&book=harbour'
);
assert.equal(mapped, '/preview/recovergraph/accounts?state=arrangement&role=owner&book=harbour');

assert.equal(
  mapRecoverHref('/dashboard/recovergraph/imports', '/preview/recovergraph?role=agent&book=harbour'),
  '/preview/recovergraph/imports?role=agent&book=harbour'
);
assert.equal(
  mapRecoverHref('/dashboard/recovergraph', '/preview/recovergraph?role=owner&book=sample'),
  '/preview/recovergraph?role=owner&book=sample'
);
assert.equal(mapRecoverHref('/dashboard/schools', '/preview/recovergraph?role=owner'), '/dashboard/schools');
assert.equal(
  mapRecoverHref('/dashboard/recovergraph/accounts?state=paid&role=keep', '/preview/recovergraph?role=owner&book=harbour'),
  '/preview/recovergraph/accounts?state=paid&role=keep&book=harbour'
);

console.log('brief117-accounts-state-link.test.ts ok');
