/**
 * Brief 98 — /api/csp-report endpoint behavior.
 * Run: npx --yes tsx lib/security/brief98-csp-report-route.test.ts
 */
import assert from 'node:assert/strict';
import { POST } from '../../app/api/csp-report/route';

async function post(body: string, contentType = 'application/csp-report') {
  const request = new Request('http://localhost:3000/api/csp-report', {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'content-length': String(Buffer.byteLength(body, 'utf8')),
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'brief98-test',
    },
    body,
  });
  return POST(request as unknown as Parameters<typeof POST>[0]);
}

(async () => {
  const validCspReport = JSON.stringify({
    'csp-report': {
      'document-uri': 'https://www.supplieradvisor.com/login',
      'effective-directive': 'script-src-elem',
      'violated-directive': 'script-src-elem',
      'blocked-uri': 'https://evil.example/x.js',
    },
  });
  const ok = await post(validCspReport);
  assert.equal(ok.status, 204, 'valid application/csp-report must return 204');

  const validReportTo = JSON.stringify([
    {
      type: 'csp-violation',
      body: {
        effectiveDirective: 'script-src-elem',
        blockedURL: 'https://evil.example/x.js',
      },
    },
  ]);
  const okReportTo = await post(validReportTo, 'application/reports+json');
  assert.equal(okReportTo.status, 204, 'valid application/reports+json must return 204');

  const junkMarker = 'brief98-junk-payload';
  const junk = await post(junkMarker);
  assert.equal(junk.status, 400, 'invalid payload must return 400');
  const junkText = await junk.text();
  assert.ok(!junkText.includes(junkMarker), 'endpoint must not reflect junk input');

  const oversizedMarker = 'brief98-oversized';
  const oversizedBody = `${oversizedMarker}${'x'.repeat(17 * 1024)}`;
  const oversized = await post(oversizedBody);
  assert.equal(oversized.status, 413, 'oversized payload must return 413');
  const oversizedText = await oversized.text();
  assert.ok(
    !oversizedText.includes(oversizedMarker),
    'endpoint must not reflect oversized input'
  );

  console.log('brief98-csp-report-route.test.ts ok');
})();
