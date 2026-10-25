/**
 * Brief 98 — enforced CSP, with nonce/hash script-src and no report-only duplicate.
 * Run: npx --yes tsx lib/security/brief98-csp.test.ts
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { buildContentSecurityPolicy } from './csp-policy';
import { decodeScriptHashMap, scriptHashesForPath } from './csp-hash-map';

const require = createRequire(import.meta.url);
const hashes = require('./inline-script-hashes.js') as {
  executableInlineScripts: (html: string) => string[];
  cspScriptHash: (source: string) => string;
  routeFromAppHtml: (appDir: string, file: string) => string | null;
  routeFromCacheHtml: (file: string) => string | null;
  collectInlineScriptHashes: (appDir: string) => Record<string, string[]>;
  collectNextScriptHashes: (nextDir: string) => Record<string, string[]>;
  patchHashPlaceholder: (
    nextDir: string,
    map: Record<string, string[]>
  ) => { files: number; replacements: number; encoded: string };
};
const nextConfig = require('../../next.config.js') as {
  headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
};

function directiveValue(policy: string, name: string) {
  const match = policy.match(new RegExp(`(?:^|;\\s*)${name} ([^;]+)`));
  return match?.[1] || '';
}

(async () => {
  const nonce = Buffer.from('csp-nonce-sample').toString('base64');
  const scriptHash = hashes.cspScriptHash('var ready = true;');
  const page = buildContentSecurityPolicy({
    nonce,
    embed: false,
    scriptHashes: [scriptHash, 'javascript:alert(1)'],
  });
  const embed = buildContentSecurityPolicy({ nonce, embed: true, dev: true });

  for (const policy of [page, embed]) {
    const scriptSrc = directiveValue(policy, 'script-src');
    assert.equal(scriptSrc.includes('unsafe-inline'), false);
    assert.match(scriptSrc, new RegExp(`'nonce-${nonce}'`));
    assert.match(scriptSrc, /https:\/\/auth\.privy\.io/);
    assert.match(scriptSrc, /https:\/\/\*\.privy\.io/);
    assert.doesNotMatch(scriptSrc, /(^|\s)(https:|\*)(\s|$)/);
    assert.match(policy, /object-src 'none'/);
    assert.match(policy, /base-uri 'self'/);
    assert.match(policy, /report-uri \/api\/csp-report/);
    assert.match(policy, /report-to csp-endpoint/);
    assert.match(policy, /upgrade-insecure-requests/);
    assert.match(directiveValue(policy, 'style-src'), /fonts\.googleapis\.com/);
    assert.match(directiveValue(policy, 'font-src'), /fonts\.gstatic\.com/);
    assert.match(directiveValue(policy, 'font-src'), /fonts\.walletconnect\.com/);
    assert.match(directiveValue(policy, 'font-src'), /fonts\.reown\.com/);
    assert.match(directiveValue(policy, 'font-src'), /applepay\.cdn-apple\.com/);
    const frameTokens = directiveValue(policy, 'frame-src').split(/\s+/);
    assert.equal(frameTokens.includes('https:') || frameTokens.includes('*'), false);
  }

  assert.match(page, /frame-ancestors 'none'/);
  assert.match(directiveValue(page, 'script-src'), new RegExp(scriptHash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(directiveValue(page, 'script-src'), /unsafe-eval/);
  assert.match(embed, /frame-ancestors \*/);
  assert.doesNotMatch(embed, /frame-ancestors 'none'/);
  assert.match(directiveValue(embed, 'script-src'), /unsafe-eval/);

  const rules = await nextConfig.headers();
  const headerKeys = rules.flatMap((rule) => rule.headers.map((header) => header.key.toLowerCase()));
  assert.equal(headerKeys.includes('content-security-policy'), false);
  assert.equal(headerKeys.includes('content-security-policy-report-only'), false);
  const embedRule = rules.find((rule) => rule.source === '/embed/:path*');
  assert.ok(embedRule);
  assert.equal(
    embedRule.headers.some((header) => header.key.toLowerCase() === 'x-frame-options'),
    false
  );
  const homeRule = rules.find((rule) => rule.source === '/');
  assert.equal(
    homeRule?.headers.some((header) => header.key === 'X-Frame-Options' && header.value === 'DENY'),
    true
  );

  const nextSource = readFileSync('next.config.js', 'utf8');
  assert.doesNotMatch(nextSource, /unsafe-inline/);
  assert.doesNotMatch(nextSource, /Content-Security-Policy/);
  const middleware = readFileSync('middleware.ts', 'utf8');
  assert.match(middleware, /contentSecurityPolicyForRequest/);
  assert.match(middleware, /x-nonce/);
  assert.doesNotMatch(middleware, /unsafe-inline/);
  assert.doesNotMatch(middleware, /Content-Security-Policy-Report-Only/);

  const html = `
    <script type="application/ld+json">{"@context":"https://schema.org"}</script>
    <script type="application/json" id="sa-locale-data">{"ok":true}</script>
    <script src="/_next/static/chunk.js"></script>
    <script>var ready = true;</script>
  `;
  assert.deepEqual(hashes.executableInlineScripts(html), ['var ready = true;']);
  assert.equal(
    hashes.routeFromAppHtml('/tmp/app', '/tmp/app/(marketing)/login.html'),
    '/login'
  );
  assert.equal(hashes.routeFromAppHtml('/tmp/app', '/tmp/app/index.html'), '/');
  assert.equal(hashes.routeFromAppHtml('/tmp/app', '/tmp/app/_not-found.html'), '/404');
  assert.equal(hashes.routeFromAppHtml('/tmp/app', '/tmp/app/c/[id].html'), null);
  const cacheHash = 'a'.repeat(64);
  assert.equal(
    hashes.routeFromCacheHtml(
      `/tmp/.next/server/route-cache/APP_PAGE/${cacheHash}/$/index.html`
    ),
    '/'
  );
  assert.equal(
    hashes.routeFromCacheHtml(
      `/tmp/.next/server/route-cache/APP_PAGE/${cacheHash}/$/login.html`
    ),
    '/login'
  );
  assert.equal(
    hashes.routeFromCacheHtml(
      `/tmp/.next/server/route-cache/APP_PAGE/${cacheHash}/$/_not-found.html`
    ),
    '/404'
  );
  assert.equal(
    hashes.routeFromCacheHtml(
      `/tmp/.next/server/route-cache/APP_PAGE/${cacheHash}/$/c/[id].html`
    ),
    null
  );

  const os = await import('node:os');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-hash-'));
  const appDir = path.join(fixture, 'server', 'app');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(
    path.join(appDir, 'index.html'),
    '<script>var ready = true;</script><script type="application/ld+json">{}</script>'
  );
  fs.writeFileSync(path.join(appDir, 'login.html'), '<script>var ready = true;</script>');
  fs.writeFileSync(
    path.join(appDir, '_not-found.html'),
    '<script>var missing = true;</script>'
  );
  const edge = path.join(fixture, 'server', 'edge');
  fs.mkdirSync(edge, { recursive: true });
  fs.writeFileSync(
    path.join(edge, 'middleware.js'),
    'function policy(t="__CSP_HASH_MAP__"){return t}'
  );
  const cacheDir = path.join(
    fixture,
    'server',
    'route-cache',
    'APP_PAGE',
    'b'.repeat(64),
    '$'
  );
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'pricing.html'), '<script>var price = true;</script>');
  const collected = hashes.collectNextScriptHashes(fixture);
  assert.deepEqual(collected['/'], [hashes.cspScriptHash('var ready = true;')]);
  assert.deepEqual(collected['/pricing'], [hashes.cspScriptHash('var price = true;')]);
  assert.deepEqual(collected['/login'], collected['/']);
  assert.ok(collected['/404']);
  const patched = hashes.patchHashPlaceholder(fixture, collected);
  assert.equal(patched.files, 1);
  const bundled = fs.readFileSync(path.join(edge, 'middleware.js'), 'utf8');
  assert.equal(bundled.includes('__CSP_HASH_MAP__'), false);
  assert.match(bundled, new RegExp(patched.encoded));
  assert.deepEqual(decodeScriptHashMap(patched.encoded)['/'], collected['/']);

  const encoded = Buffer.from(
    JSON.stringify({ '/login': [scriptHash], '/404': ["'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa='"] }),
    'utf8'
  ).toString('base64');
  assert.deepEqual(scriptHashesForPath('/login', encoded), [scriptHash]);
  assert.deepEqual(scriptHashesForPath('/missing', encoded), [
    "'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa='",
  ]);
  assert.deepEqual(decodeScriptHashMap('__CSP_HASH_MAP__'), {});
  assert.deepEqual(decodeScriptHashMap('not-base64-but-long-enough-to-pass-length'), {});
  assert.deepEqual(decodeScriptHashMap(encoded)['/login'], [scriptHash]);

  const { THEME_BOOT_SCRIPT } = await import('../theme/theme');
  const { SERVICE_WORKER_BOOT_SCRIPT } = await import('../pwa/register-script');
  const { contentSecurityPolicyForRequest } = await import('./csp-request');
  const themed = await contentSecurityPolicyForRequest('/login', nonce);
  const scriptSrc = directiveValue(themed, 'script-src');
  assert.match(scriptSrc, new RegExp(hashes.cspScriptHash(THEME_BOOT_SCRIPT).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(
    scriptSrc,
    new RegExp(hashes.cspScriptHash(SERVICE_WORKER_BOOT_SCRIPT).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );

  console.log('brief98-csp.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
