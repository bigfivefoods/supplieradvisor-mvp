/**
 * Brief 70 — site-wide security headers with embed framing exception.
 * Run: npx --yes tsx lib/security/brief70-security-headers.test.ts
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
    return pathname === '/embed' || pathname.startsWith('/embed/');
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

(async () => {
  const rules = await nextConfig.headers();

  for (const path of ['/', '/login', '/pricing', '/onboarding', '/c/x']) {
    const headers = matchedHeaders(rules, path);
    assert.ok(
      headers['x-content-type-options']?.includes('nosniff'),
      `${path} must include nosniff`
    );
    assert.ok(
      headers['referrer-policy']?.includes('strict-origin-when-cross-origin'),
      `${path} must include strict referrer policy`
    );
    assert.ok(
      headers['x-frame-options']?.includes('DENY'),
      `${path} must include X-Frame-Options DENY`
    );
    assert.ok(
      headers['content-security-policy']?.some((v) => v.includes("frame-ancestors 'none'")),
      `${path} must include frame-ancestors none`
    );
  }

  const embedHeaders = matchedHeaders(rules, '/embed/containers/abc');
  assert.ok(
    !embedHeaders['x-frame-options'],
    'embed routes must not include X-Frame-Options'
  );
  assert.ok(
    !embedHeaders['content-security-policy']?.some((v) =>
      v.includes("frame-ancestors 'none'")
    ),
    'embed routes must not include frame-ancestors none'
  );

  console.log('brief70-security-headers.test.ts ok');
})();
