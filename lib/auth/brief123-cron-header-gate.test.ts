/**
 * Brief 123 — cron header bypass and secret verification.
 * Run: npx --yes tsx lib/auth/brief123-cron-header-gate.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { assertCronSecret } from './api-auth';
import { isPublicApiPath } from './public-paths';

async function main() {
  const source = readFileSync(resolve('middleware.ts'), 'utf8');
  assert.doesNotMatch(
    source,
    /request\.headers\.get\(['"]x-cron-secret['"]\)\s*\)/,
    'middleware must not use x-cron-secret presence as a bare bypass'
  );

  assert.equal(isPublicApiPath('/api/health'), true);
  assert.equal(isPublicApiPath('/api/system/health'), true);
  assert.equal(isPublicApiPath('/api/accounting/invoices'), false);

  const previousSecret = process.env.CRON_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.CRON_SECRET = 'brief123-secret';
  process.env.NODE_ENV = 'production';
  process.env.VERCEL_ENV = 'production';
  const secret = process.env.CRON_SECRET;

  function parseBody(text: string) {
    return JSON.parse(text) as { code?: string; error?: string };
  }

  try {
    const wrongHeader = middleware(
      new NextRequest('http://localhost/api/accounting/invoices', {
        headers: { 'x-cron-secret': 'not-real' },
      })
    );
    assert.equal(wrongHeader.status, 401);

    const wrongBearer = middleware(
      new NextRequest('http://localhost/api/system/email-samples', {
        headers: { authorization: '******' },
      })
    );
    assert.equal(wrongBearer.status, 401);

    const goodHeader = middleware(
      new NextRequest('http://localhost/api/system/email-samples', {
        headers: { 'x-cron-secret': secret },
      })
    );
    assert.equal(goodHeader.status, 200);

    const goodBearer = middleware(
      new NextRequest('http://localhost/api/banking/cron-sync', {
        headers: { authorization: 'Bearer ' + secret },
      })
    );
    assert.equal(goodBearer.status, 200);

    const unauth = middleware(new NextRequest('http://localhost/api/accounting/invoices'));
    assert.equal(unauth.status, 401);
    const unauthText = await unauth.text();
    assert.equal(parseBody(unauthText).code, 'UNAUTHORIZED');

    const wrongHeaderText = await wrongHeader.text();
    assert.equal(wrongHeaderText, unauthText);
    assert.equal(parseBody(wrongHeaderText).code, 'UNAUTHORIZED');

    const wrongBearerText = await wrongBearer.text();
    assert.equal(wrongBearerText, unauthText);
    assert.equal(parseBody(wrongBearerText).code, 'UNAUTHORIZED');

    const health = middleware(new NextRequest('http://localhost/api/health'));
    assert.equal(health.status, 200);

    const systemHealth = middleware(new NextRequest('http://localhost/api/system/health'));
    assert.equal(systemHealth.status, 200);

    const directWrong = assertCronSecret(
      new NextRequest('http://localhost/api/system/email-samples', {
        headers: { authorization: '******' },
      })
    );
    assert.equal(directWrong.ok, false);
    assert.equal(directWrong.response.status, 401);
    const directWrongText = await directWrong.response.text();
    assert.equal(directWrongText, unauthText);
    assert.equal(parseBody(directWrongText).code, 'UNAUTHORIZED');

    const directGood = assertCronSecret(
      new NextRequest('http://localhost/api/system/email-samples', {
        headers: { 'x-cron-secret': secret },
      })
    );
    assert.equal(directGood.ok, true);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }

  console.log('brief123 cron-header gate tests ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
