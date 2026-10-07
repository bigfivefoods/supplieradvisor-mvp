/**
 * Brief 98 — enforce CSP (not report-only), with explicit script/frame hosts.
 * Run: npx --yes tsx lib/security/brief98-csp.test.ts
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

const require = createRequire(import.meta.url);
const nextConfig = require('../../next.config.js') as {
  headers: () => Promise<HeaderRule[]>;
};

function matches(source: string, pathname: string) {
  if (source === '/:path*') return pathname.startsWith('/');
  if (source === '/') return pathname === '/';
  if (source === '/((?!embed(?:/|$)).+)') {
    return (
      pathname.startsWith('/') &&
      pathname !== '/' &&
      pathname !== '/embed' &&
      !pathname.startsWith('/embed/')
    );
  }
  if (source === '/embed/:path*') {
    return pathname.startsWith('/embed/');
  }
  return false;
}

function matchedHeaders(rules: HeaderRule[], pathname: string) {
  return rules
    .filter((rule) => matches(rule.source, pathname))
    .flatMap((rule) => rule.headers)
    .reduce<Record<string, string[]>>((acc, header) => {
      const key = header.key.toLowerCase();
      acc[key] ||= [];
      acc[key].push(header.value);
      return acc;
    }, {});
}

function directiveValue(policy: string, name: string) {
  const m = policy.match(new RegExp(`${name} ([^;]+)`));
  return m?.[1] || '';
}

(async () => {
  const rules = await nextConfig.headers();

  for (const path of ['/', '/login', '/pricing', '/marketplace']) {
    const headers = matchedHeaders(rules, path);
    const csp = headers['content-security-policy']?.[0] || '';
    const cspRo = headers['content-security-policy-report-only']?.[0] || '';
    const reportTo = headers['report-to']?.[0] || '';
    const reportingEndpoints = headers['reporting-endpoints']?.[0] || '';

    assert.ok(csp, `${path} must include enforced CSP`);
    assert.ok(cspRo, `${path} must include CSP report-only`);
    assert.match(csp, /object-src 'none'/, `${path} must include object-src none`);
    assert.match(csp, /base-uri 'self'/, `${path} must include base-uri self`);
    assert.match(csp, /frame-ancestors 'none'/, `${path} must include frame-ancestors none`);
    assert.match(csp, /report-uri \/api\/csp-report/, `${path} must include report-uri`);
    assert.match(csp, /report-to csp-endpoint/, `${path} must include report-to`);
    assert.match(
      reportTo,
      /https:\/\/www\.supplieradvisor\.com\/api\/csp-report/,
      `${path} Report-To must use absolute URL`
    );
    assert.match(
      reportingEndpoints,
      /https:\/\/www\.supplieradvisor\.com\/api\/csp-report/,
      `${path} Reporting-Endpoints must use absolute URL`
    );
    assert.match(csp, /upgrade-insecure-requests/, `${path} enforced CSP must include upgrade`);
    assert.doesNotMatch(
      cspRo,
      /upgrade-insecure-requests/,
      `${path} report-only CSP must not include upgrade-insecure-requests`
    );

    const scriptTokens = directiveValue(csp, 'script-src').split(/\s+/).filter(Boolean);
    const frameTokens = directiveValue(csp, 'frame-src').split(/\s+/).filter(Boolean);
    assert.ok(
      !scriptTokens.includes('https:') && !scriptTokens.includes('*'),
      `${path} script-src must not allow bare https: or *`
    );
    assert.ok(
      !frameTokens.includes('https:') && !frameTokens.includes('*'),
      `${path} frame-src must not allow bare https: or *`
    );
    const fontSrc = directiveValue(csp, 'font-src');
    assert.match(fontSrc, /https:\/\/fonts\.gstatic\.com/, `${path} font-src must allow gstatic`);
    assert.match(
      fontSrc,
      /https:\/\/fonts\.walletconnect\.com/,
      `${path} font-src must allow walletconnect font host`
    );

    assert.doesNotMatch(
      directiveValue(cspRo, 'connect-src'),
      /\bhttps:\b|\bwss:\b/,
      `${path} report-only connect-src must be host-inventoried`
    );
  }

  const embedHeaders = matchedHeaders(rules, '/embed/containers/abc');
  const embedCsp = embedHeaders['content-security-policy']?.[0] || '';
  assert.ok(!embedHeaders['x-frame-options'], 'embed routes must not include X-Frame-Options');
  assert.ok(embedCsp, 'embed routes must include CSP');
  assert.match(embedCsp, /frame-ancestors \*/, 'embed routes must remain framable');
  assert.doesNotMatch(
    embedCsp,
    /frame-ancestors 'none'/,
    'embed routes must not include frame-ancestors none'
  );

  console.log('brief98-csp.test.ts ok');
})();
