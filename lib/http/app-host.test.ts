/**
 * app.supplieradvisor.com must 308 to the same path on www.
 * Run: npx --yes tsx lib/http/app-host.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { productQrPayload } from '../inventory/types';
import { canonicalRedirectForAppHost, hostnameFromHostHeader } from './app-host';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

assert.equal(hostnameFromHostHeader('app.supplieradvisor.com'), 'app.supplieradvisor.com');
assert.equal(hostnameFromHostHeader('APP.supplieradvisor.com:443'), 'app.supplieradvisor.com');
assert.equal(hostnameFromHostHeader('app.supplieradvisor.com.'), 'app.supplieradvisor.com');
assert.equal(
  hostnameFromHostHeader('app.supplieradvisor.com, www.supplieradvisor.com'),
  'app.supplieradvisor.com'
);

assert.equal(
  canonicalRedirectForAppHost('app.supplieradvisor.com', '/dashboard/suppliers', '?tab=open'),
  'https://www.supplieradvisor.com/dashboard/suppliers?tab=open'
);
assert.equal(
  canonicalRedirectForAppHost('app.supplieradvisor.com', '/p/abc123', ''),
  'https://www.supplieradvisor.com/p/abc123'
);
assert.equal(
  canonicalRedirectForAppHost(
    'app.supplieradvisor.com',
    '/login',
    '?next=https://www.supplieradvisor.com/dashboard'
  ),
  'https://www.supplieradvisor.com/login?next=https://www.supplieradvisor.com/dashboard'
);
assert.equal(
  canonicalRedirectForAppHost('app.supplieradvisor.com', '/', ''),
  'https://www.supplieradvisor.com/'
);
assert.equal(
  canonicalRedirectForAppHost('app.supplieradvisor.com', '//evil.example', ''),
  'https://www.supplieradvisor.com/'
);

for (const host of [
  'www.supplieradvisor.com',
  'supplieradvisor.com',
  'localhost:3000',
  'supplieradvisor-mvp.vercel.app',
  'app.supplieradvisor.com.evil.example',
  'preview.app.supplieradvisor.com',
  '',
]) {
  assert.equal(canonicalRedirectForAppHost(host, '/dashboard', ''), null, host);
}

const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
delete process.env.NEXT_PUBLIC_APP_URL;
assert.equal(productQrPayload('abc123'), 'https://www.supplieradvisor.com/p/abc123');
assert.equal(
  productQrPayload('abc123', 'https://www.supplieradvisor.com'),
  'https://www.supplieradvisor.com/p/abc123'
);
if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;

const middleware = read('middleware.ts');
const redirectAt = middleware.indexOf('canonicalRedirectForAppHost');
const dashboardAt = middleware.indexOf("request.cookies.get('privy-token')");
assert.ok(redirectAt > 0 && dashboardAt > redirectAt, 'app host redirect must run before the dashboard cookie gate');
assert.ok(middleware.includes('NextResponse.redirect(appHostTarget, 308)'));
assert.ok(
  middleware.includes("'/((?!_next/static|_next/image).*)'"),
  'middleware matcher must see every path except Next internals'
);
assert.ok(!read('lib/inventory/types.ts').includes('https://app.supplieradvisor.com'));

console.log('app-host.test.ts ok');
