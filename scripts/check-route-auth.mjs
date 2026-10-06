#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const allowlistPath = join(root, 'scripts', 'route-auth-allowlist.json');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const gatePatterns = [
  'requireCompanyAccess',
  'requireCompanyPermission',
  'requireCompanyRoles',
  'requireVerifiedUser',
  'assertCronSecret',
  'requirePlatformConsoleAccess',
  'requireReferralOps',
  'verifyPrivyAccessToken',
  'requireAdvisor\\w*',
  'requireB2c\\w*',
  'resolvePortal\\w*',
  'verify\\w*Webhook\\w*',
  'verify\\w*Signature\\w*',
];
const gateRegex = new RegExp(gatePatterns.join('|'));

function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  let state = 'normal';
  let quote = '';
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === 'line-comment') {
      if (ch === '\n') {
        state = 'normal';
        out += ch;
      }
      i += 1;
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'normal';
        i += 2;
      } else {
        if (ch === '\n') out += '\n';
        i += 1;
      }
      continue;
    }
    if (state === 'string') {
      if (ch === '\\') {
        out += ' ';
        i += 2;
        continue;
      }
      if (ch === quote) {
        state = 'normal';
        i += 1;
        continue;
      }
      if (ch === '\n') out += '\n';
      else out += ' ';
      i += 1;
      continue;
    }
    if (state === 'normal') {
      if (ch === '/' && next === '/') {
        state = 'line-comment';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block-comment';
        i += 2;
        continue;
      }
      if (ch === '\'' || ch === '"' || ch === '`') {
        state = 'string';
        quote = ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
  }
  return out;
}

function fileToRoute(file) {
  const rel = relative(root, file).replace(/\\/g, '/');
  if (!rel.startsWith('app/api/')) return null;
  const suffix = rel.slice('app/api'.length).replace(/\/route\.(ts|tsx)$/, '');
  return `/api${suffix || ''}`;
}

function globToRegExp(pattern) {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        regex += '.*';
        i += 2;
      } else {
        regex += '[^/]*';
        i += 1;
      }
      continue;
    }
    regex += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp(`^${regex}$`);
}

function matchesAllowlist(route, method) {
  return allowlist.some((entry) => {
    if (!entry.methods.includes(method)) return false;
    const routePattern = String(entry.route || '');
    if (!routePattern) return false;
    const re = globToRegExp(routePattern);
    return re.test(route);
  });
}

function findMatchingBrace(src, openBraceIndex) {
  let depth = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openBraceIndex; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function functionBodyByName(src, name) {
  const rx = new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>)`, 'm');
  const match = rx.exec(src);
  if (!match) return null;
  const start = src.indexOf('{', match.index);
  if (start < 0) return null;
  const end = findMatchingBrace(src, start);
  if (end < 0) return null;
  return src.slice(start + 1, end);
}

function collectHelperBodies(src) {
  const helpers = new Map();
  const helperRx = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
  for (const match of src.matchAll(helperRx)) {
    const name = match[1] || match[2];
    if (!name) continue;
    if (/^(GET|POST|PUT|PATCH|DELETE|export)$/.test(name)) continue;
    const body = functionBodyByName(src, name);
    if (body) helpers.set(name, body);
  }
  return helpers;
}

function findExportedHandlers(src) {
  const out = [];
  const handlerRx = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
  for (const match of src.matchAll(handlerRx)) {
    const method = match[1] || match[2];
    const start = match.index;
    const brace = src.indexOf('{', start);
    if (brace < 0) continue;
    const end = findMatchingBrace(src, brace);
    if (end < 0) continue;
    out.push({ method, block: src.slice(brace + 1, end) });
  }
  return out;
}

function isGuarded(blockText, helperBodies, seen = new Set()) {
  const clean = stripCommentsAndStrings(blockText);
  if (gateRegex.test(clean)) return true;
  const calls = [...clean.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)].map((m) => m[1]);
  for (const name of calls) {
    if (name === 'assertCompanyMember' || name === 'assertCompanyPermission' || name === 'getCompanyMembership' || name === 'assertSalesPortalAccess') continue;
    if (seen.has(name)) continue;
    const body = helperBodies.get(name);
    if (!body) continue;
    if (isGuarded(body, helperBodies, new Set([...seen, name]))) return true;
  }
  return false;
}

function walkDir(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkDir(p));
    } else if (entry.isFile() && /(route\.(ts|tsx))$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walkDir(join(root, 'app', 'api'));
const offenders = [];
for (const file of files) {
  const route = fileToRoute(file);
  if (!route) continue;
  const src = readFileSync(file, 'utf8');
  const handlers = findExportedHandlers(src);
  if (!handlers.length) {
    if (gateRegex.test(stripCommentsAndStrings(src))) continue;
    if (route === '/api/public' || route.startsWith('/api/public/')) continue;
    continue;
  }
  const helperBodies = collectHelperBodies(src);
  for (const handler of handlers) {
    const method = handler.method;
    if (matchesAllowlist(route, method)) continue;
    if (isGuarded(handler.block, helperBodies)) continue;
    offenders.push(`${relative(root, file)}:${method}`);
  }
}

if (offenders.length) {
  console.error('Route auth violations:');
  for (const item of offenders) console.error(item);
  process.exit(1);
}
console.log('OK: all non-allowlisted API route handlers are gated');
