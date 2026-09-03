/**
 * Gym client number = CoA AR 1180-#######.
 * Run: npx --yes tsx lib/fitness/gym-client-number.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { memberArAccountCode } from '../accounting/party-gl-accounts';
import {
  applyAdvisorPersonCodeFromAr,
  applyGymClientNumberFromAr,
  gymClientLookupKeys,
  gymClientNumberFromAr,
  needsAdvisorPersonCodeFromAr,
  needsGymClientNumber,
  recodeGymClientNumbers,
} from './gym-client-number';

assert.equal(memberArAccountCode(77), '1180-0000077');
assert.equal(gymClientNumberFromAr('1180-0000077'), '1180-0000077');
assert.equal(gymClientNumberFromAr('1180-77'), '');
assert.equal(gymClientNumberFromAr('1180.1'), '');
assert.equal(gymClientNumberFromAr('4100-0000077'), '');
assert.equal(gymClientNumberFromAr('4400-0000077'), '');
assert.equal(gymClientNumberFromAr(''), '');

assert.equal(
  needsGymClientNumber({
    code: 'VUKA-001',
    ar_account_code: '1180-0000077',
  }),
  true
);
assert.equal(
  needsGymClientNumber({
    code: '1180-0000077',
    ar_account_code: '1180-0000077',
  }),
  false
);
assert.equal(
  needsAdvisorPersonCodeFromAr({
    code: 'VUKA-001',
    ar_account_code: '1180-0000077',
  }),
  true
);
assert.equal(
  needsGymClientNumber({ code: 'VUKA-001', ar_account_code: null }),
  false
);

const ada = {
  id: 'cli_ada',
  code: 'VUKA-001',
  ar_account_code: '1180-0000077' as string | null,
};
assert.equal(applyGymClientNumberFromAr(ada), true);
assert.equal(ada.code, '1180-0000077');
assert.equal(applyGymClientNumberFromAr(ada), false);
assert.equal(applyAdvisorPersonCodeFromAr(ada), false);

const clash = [
  {
    id: 'a',
    code: 'M-1',
    ar_account_code: '1180-0000009',
  },
  {
    id: 'b',
    code: '1180-0000009',
    ar_account_code: '1180-0000009',
  },
];
assert.equal(applyGymClientNumberFromAr(clash[0], clash), false);
assert.equal(clash[0].code, 'M-1');
assert.equal(needsGymClientNumber(clash[0], clash), false);

const book = [
  { id: '1', code: 'VUKA-001', ar_account_code: '1180-0000101' },
  { id: '2', code: 'M-2', ar_account_code: '1180-0000102' },
  { id: '3', code: '1180-0000103', ar_account_code: '1180-0000103' },
  { id: '4', code: 'VUKA-004', ar_account_code: null as string | null },
];
assert.equal(recodeGymClientNumbers(book), 2);
assert.equal(book[0].code, '1180-0000101');
assert.equal(book[1].code, '1180-0000102');
assert.equal(book[2].code, '1180-0000103');
assert.equal(book[3].code, 'VUKA-004');

const keys = gymClientLookupKeys({
  code: '1180-0000077',
  ar_account_code: '1180-0000077',
  id_number: '8001015009087',
});
assert.ok(keys.includes('1180-0000077'));
assert.ok(keys.includes('0000077'));
assert.ok(keys.includes('8001015009087'));

const gymFit = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
assert.match(gymFit, /recodeGymClientNumbers/);
assert.match(gymFit, /action === 'backfill_client_crm'/);
assert.doesNotMatch(gymFit, /recodeLegacyIntegerPartyLeaves/);
assert.doesNotMatch(gymFit, /4100-0000001/);
assert.doesNotMatch(gymFit, /1180\.1/);

const clientsPage = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
assert.match(clientsPage, /needsGymClientNumber/);
assert.match(clientsPage, /backfill_client_crm/);
assert.match(clientsPage, /numbered/);

const checkIn = readFileSync(resolve('lib/fitness/fitgraph.ts'), 'utf8');
assert.match(checkIn, /gymClientLookupKeys/);

console.log('gym-client-number.test.ts ok');
