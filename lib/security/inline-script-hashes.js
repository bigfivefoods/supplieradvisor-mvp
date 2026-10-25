/**
 * Collect sha256 CSP hashes for executable inline scripts in prerendered HTML.
 * JSON-LD and application/json blocks are not scripts, so they are skipped.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function decodeHtml(text) {
  return String(text)
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function executableInlineScripts(html) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const attrs = match[1] || '';
    const rawBody = match[2] || '';
    if (!rawBody.trim()) continue;
    const typeMatch = /(?:^|\s)type\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    if (type === 'application/ld+json' || type === 'application/json') continue;
    if (
      type &&
      type !== 'module' &&
      type !== 'text/javascript' &&
      type !== 'application/javascript' &&
      !type.includes('javascript')
    ) {
      continue;
    }
    scripts.push(decodeHtml(rawBody));
  }
  return scripts;
}

function cspScriptHash(source) {
  const digest = crypto.createHash('sha256').update(source, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

function normalizeCollectedRoute(route) {
  let value = String(route || '').replace(/\\/g, '/');
  if (!value.startsWith('/')) value = `/${value}`;
  if (value.split('/').some((part) => part.includes('[') || part.includes(']'))) return null;
  if (value === '/index') return '/';
  if (value.endsWith('/index')) value = value.slice(0, -'/index'.length) || '/';
  if (value === '/_not-found' || value === '/not-found' || value === '/404') return '/404';
  return value || '/';
}

function routeFromAppHtml(appDir, file) {
  const rel = path.relative(appDir, file).split(path.sep).join('/');
  if (!rel.endsWith('.html')) return null;
  const parts = rel
    .slice(0, -'.html'.length)
    .split('/')
    .filter((part) => {
      if (!part) return false;
      if (part.startsWith('(') && part.endsWith(')')) return false;
      if (part.startsWith('@')) return false;
      return true;
    });
  let route = parts.join('/');
  if (route === 'index') route = '';
  else if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
  if (route === '_not-found' || route === 'not-found') route = '404';
  return normalizeCollectedRoute(route ? `/${route}` : '/');
}

/**
 * Vercel sets an adapter, so Next writes prerendered HTML under
 * `.next/server/route-cache/APP_PAGE/<hash>/$$/<path>.html`
 * instead of `.next/server/app`.
 */
function routeFromCacheHtml(file) {
  const rel = String(file).split(path.sep).join('/');
  const match = rel.match(/\/route-cache\/APP_PAGE\/[a-f0-9]+\/\$\$(\/.*)\.html$/i);
  if (!match) return null;
  return normalizeCollectedRoute(match[1]);
}

function walkHtmlFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtmlFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
}

function collectNextScriptHashes(nextDir) {
  const map = {};
  for (const root of [
    path.join(nextDir, 'server', 'app'),
    path.join(nextDir, 'server', 'route-cache'),
  ]) {
    const partial = collectInlineScriptHashes(root);
    for (const [route, routeHashes] of Object.entries(partial)) {
      map[route] = Array.from(new Set([...(map[route] || []), ...routeHashes]));
    }
  }
  return map;
}

function collectInlineScriptHashes(appDir) {
  const files = [];
  walkHtmlFiles(appDir, files);
  const map = {};
  for (const file of files) {
    const route = routeFromCacheHtml(file) || routeFromAppHtml(appDir, file);
    if (!route) continue;
    const hashes = executableInlineScripts(fs.readFileSync(file, 'utf8')).map(cspScriptHash);
    if (!hashes.length) continue;
    map[route] = Array.from(new Set([...(map[route] || []), ...hashes]));
  }
  return map;
}

const HASH_PLACEHOLDER = '__CSP_HASH_MAP__';

function encodeHashMap(map) {
  const encoded = Buffer.from(JSON.stringify(map), 'utf8').toString('base64');
  if (encoded.includes(HASH_PLACEHOLDER)) {
    throw new Error('CSP hash map collided with the placeholder');
  }
  return encoded;
}

function patchHashPlaceholder(nextDir, map) {
  const encoded = encodeHashMap(map);
  let files = 0;
  let replacements = 0;
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'cache') continue;
        visit(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const source = fs.readFileSync(full, 'utf8');
        if (!source.includes(HASH_PLACEHOLDER)) continue;
        fs.writeFileSync(full, source.split(HASH_PLACEHOLDER).join(encoded));
        files += 1;
        replacements += source.split(HASH_PLACEHOLDER).length - 1;
      }
    }
  };
  visit(nextDir);
  return { files, replacements, encoded };
}

module.exports = {
  decodeHtml,
  executableInlineScripts,
  cspScriptHash,
  routeFromAppHtml,
  routeFromCacheHtml,
  collectInlineScriptHashes,
  collectNextScriptHashes,
  encodeHashMap,
  patchHashPlaceholder,
  HASH_PLACEHOLDER,
};
