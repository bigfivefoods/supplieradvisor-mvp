/**
 * FleetAdvisor® reminder cron route shape.
 * Run: npx --yes tsx lib/fleet/brief115-cron-route.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const route = readFileSync('app/api/fleet/fleetgraph/cron/reminders/route.ts', 'utf8');
const getBody = route.slice(route.indexOf('export async function GET'));
const postBody = route.slice(route.indexOf('export async function POST'));
assert.equal(getBody.trimStart().startsWith('export async function GET'), true);
assert.match(getBody.slice(0, 280), /const gate = assertCronSecret\(request\);/);
assert.match(postBody.slice(0, 280), /const gate = assertCronSecret\(request\);/);
assert.ok(route.indexOf('fg_claim_reminder') < route.indexOf('emails.send'));
assert.ok(route.includes('real_data_enabled'));
assert.ok(route.includes('reminders.skipped_demo'));
assert.match(route, /\.range\(from, from \+ 99\)/);
assert.match(route, /plan\.due\.length === 0/);
assert.ok(route.indexOf('plan.due.length === 0') < route.indexOf('reminders.skipped_demo'));
assert.equal(route.includes('.limit(100)'), false);
assert.ok(route.includes('loadReminderKeys'));
assert.match(route, /try \{[\s\S]*catch/);
assert.match(route, /Cache-Control': 'no-store'/);
assert.equal(route.includes('company_id:'), true);
assert.equal(/NextResponse\.json\([\s\S]*companyId/.test(route.slice(route.lastIndexOf('return NextResponse.json'))), false);

const vercel = readFileSync('vercel.json', 'utf8');
assert.match(vercel, /\/api\/fleet\/fleetgraph\/cron\/reminders/);
assert.match(vercel, /"schedule": "0 4 \* \* \*"/);

const allow = readFileSync('scripts/route-auth-allowlist.json', 'utf8');
assert.match(allow, /\/api\/fleet\/fleetgraph\/cron\/reminders/);

assert.equal(existsSync('app/api/public/fleetgraph'), false);
assert.equal(existsSync('app/api/fleet/fleetgraph/storage'), false);
assert.equal(existsSync('app/api/cron/fleetgraph'), false);

console.log('brief115-cron-route.test.ts ok');
