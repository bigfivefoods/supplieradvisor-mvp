import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
const routeBlock = route.split("action === 'backfill_client_crm'")[1] || '';
const routeActionBody = routeBlock.split("action === 'update_settings'")[0] || '';

assert.match(routeActionBody, /Number\(body\.limit\)/);
assert.match(routeActionBody, /Math\.min\(80,\s*Math\.max\(1,\s*Math\.trunc\(requestedLimit\)\)\)/);
assert.match(routeActionBody, /remaining/);
assert.match(routeActionBody, /needsGymCrmStamp\(person\)/);
assert.match(routeActionBody, /if \(processed >= limit\) break/);
assert.match(routeActionBody, /await saveStore\(companyId,\s*meta,\s*store\)/);
assert.match(routeActionBody, /return NextResponse\.json/);
assert.ok(
  routeActionBody.indexOf('await saveStore(companyId, meta, store)') <
    routeActionBody.indexOf('return NextResponse.json')
);

const clientsPage = readFileSync(
  resolve('app/dashboard/fitgraph/clients/page.tsx'),
  'utf8'
);
assert.match(clientsPage, /while \(remaining > 0\)/);
assert.match(clientsPage, /action: 'backfill_client_crm', limit: 40/);
assert.match(clientsPage, /Number\(data\?\.remaining\)/);
const addDoneIndex = clientsPage.indexOf(
  'gymCrmBackfillCompanyOnce.add(companyId)'
);
const loopIndex = clientsPage.indexOf('while (remaining > 0)');
assert.ok(addDoneIndex > loopIndex);
assert.match(clientsPage, /gymCrmBackfillCompanyOnce\.delete\(companyId\)/);

assert.doesNotMatch(route, /ClinicRoomsDesk/);
assert.doesNotMatch(clientsPage, /ClinicRoomsDesk/);
assert.doesNotMatch(route, /sell_price/);
assert.doesNotMatch(clientsPage, /sell_price/);
assert.doesNotMatch(route, /ChevronDown/);
assert.doesNotMatch(route, /homepage/i);
assert.doesNotMatch(clientsPage, /homepage/i);

console.log('brief42-crm-stamp-batch.test.ts ok');
