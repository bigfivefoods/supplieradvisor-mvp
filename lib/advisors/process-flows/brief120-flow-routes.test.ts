/**
 * Run: npx --yes tsx lib/advisors/process-flows/brief120-flow-routes.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ADVISOR_FLOWS } from './index';
import type { AdvisorFlowDef, FlowTarget } from './types';

type PageRoute = { route: string; file: string };

function walkPages(dir: string, acc: PageRoute[] = []): PageRoute[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkPages(full, acc);
    else if (/^page\.(tsx|ts|jsx|js)$/.test(name)) {
      const rel = relative('app', full).replace(/\\/g, '/');
      const withoutPage = rel.replace(/\/?page\.(tsx|ts|jsx|js)$/, '');
      const parts = withoutPage
        .split('/')
        .filter((seg) => seg.length > 0 && !(seg.startsWith('(') && seg.endsWith(')')));
      acc.push({ route: `/${parts.join('/')}`.replace(/\/$/, '') || '/', file: full });
    }
  }
  return acc;
}

export function routeToRegExp(route: string): RegExp {
  const parts = route.split('/').filter(Boolean);
  let body = '';
  for (const part of parts) {
    if (part.startsWith('[[...') && part.endsWith(']]')) body += '(?:/.*)?';
    else if (part.startsWith('[...') && part.endsWith(']')) body += '/.+';
    else if (part.startsWith('[') && part.endsWith(']')) body += '/[^/]+';
    else body += `/${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  }
  if (!body) body = '/';
  return new RegExp(`^${body}/?$`);
}

function specificity(route: string): number {
  return route
    .split('/')
    .filter(Boolean)
    .reduce((score, part) => {
      if (part.startsWith('[[...')) return score + 1;
      if (part.startsWith('[...')) return score + 2;
      if (part.startsWith('[')) return score + 3;
      return score + 4;
    }, 0);
}

export function normaliseHref(href: string): string {
  const noHash = href.split('#')[0] || '/';
  const path = noHash.split('?')[0] || '/';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

function bestPage(href: string, pages: PageRoute[]): PageRoute | null {
  const path = normaliseHref(href);
  const hits = pages.filter((page) => routeToRegExp(page.route).test(path));
  hits.sort((a, b) => specificity(b.route) - specificity(a.route));
  return hits[0] || null;
}

function isRedirectStub(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = code.split('\n').length;
  const callsRedirect = /\bredirect\s*\(/.test(code);
  const callsReplace = /\brouter\.replace\s*\(/.test(code);
  if (!callsRedirect && !callsReplace) return false;
  if (callsRedirect && !/return\s*\(/.test(code) && lines < 80) return true;
  if (/function\s+\w*Redirect\w*/.test(code) && lines < 80) return true;
  if (callsReplace && /Loader2/.test(code) && lines < 80 && !/<(input|textarea|table|form)\b/.test(code)) return true;
  return false;
}

assert.equal(routeToRegExp('/dashboard/foo/[id]').test('/dashboard/foo/abc'), true);
assert.equal(routeToRegExp('/dashboard/foo/[id]').test('/dashboard/foo/abc/extra'), false);
assert.equal(routeToRegExp('/docs/[...slug]').test('/docs/a/b'), true);
assert.equal(routeToRegExp('/docs/[...slug]').test('/docs'), false);
assert.equal(routeToRegExp('/docs/[[...slug]]').test('/docs'), true);
assert.equal(routeToRegExp('/docs/[[...slug]]').test('/docs/a'), true);
assert.equal(normaliseHref('/dashboard/health/report?x=1#management-report'), '/dashboard/health/report');

const pages = walkPages('app');
assert.equal(bestPage('/attorney/recovergraph/sample-token', pages)?.route, '/attorney/recovergraph/[token]');
assert.equal(isRedirectStub(readFileSync('app/dashboard/health/facilities/page.tsx', 'utf8')), true);
assert.equal(isRedirectStub(readFileSync('app/dashboard/health/map/page.tsx', 'utf8')), true);
assert.equal(isRedirectStub(readFileSync('app/dashboard/health/management/page.tsx', 'utf8')), true);
assert.equal(isRedirectStub(readFileSync('app/dashboard/tradegraph/customers/page.tsx', 'utf8')), false);

function tradeViews(): string[] {
  const src = readFileSync('components/trades/TradeDeskApp.tsx', 'utf8');
  return [...src.matchAll(/view === '([^']+)'/g)].map((match) => match[1]);
}

function objectKeys(file: string, marker: string): string[] {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf(marker);
  assert.ok(start >= 0, marker);
  const brace = src.indexOf('{', start);
  const end = src.indexOf('\n};', brace);
  const body = src.slice(brace + 1, end);
  const keys: string[] = [];
  for (const match of body.matchAll(/^\s{2}(?:'([^']*)'|([A-Za-z0-9_]+))\s*:/gm)) {
    keys.push(match[1] ?? match[2] ?? '');
  }
  return keys.filter((key) => key.length > 0);
}

const views = tradeViews();
assert.ok(views.includes('board'));
assert.ok(views.includes('customers'));
const constructionViews = objectKeys('components/construction/PreviewApp.tsx', 'const VIEWS');
assert.ok(constructionViews.includes('clients'));
assert.equal(constructionViews.includes('work'), false);

function targetsOf(flow: AdvisorFlowDef): FlowTarget[] {
  const list: FlowTarget[] = [];
  for (const step of flow.steps) {
    if (step.to) list.push(step.to);
    for (const extra of step.secondary || []) list.push(extra);
  }
  for (const link of flow.around?.links || []) list.push(link);
  return list;
}

function moduleHref(flow: AdvisorFlowDef, target: FlowTarget): string {
  if (target.scope === 'app') return target.path;
  const [path, query] = target.path.split('?');
  const href = path ? `${flow.hrefRoot}/${path}` : flow.hrefRoot;
  return query ? `${href}?${query}` : href;
}

for (const flow of Object.values(ADVISOR_FLOWS)) {
  if (!flow) continue;
  for (const target of targetsOf(flow)) {
    const href = moduleHref(flow, target);
    const page = bestPage(href, pages);
    assert.ok(page, `${flow.module} ${href}`);
    const source = readFileSync(page.file, 'utf8');
    assert.equal(isRedirectStub(source), false, page.file);
    if (target.scope === 'module' && flow.module === 'tradegraph') {
      const segment = target.path.split('?')[0].split('/')[0];
      assert.equal(views.includes(segment), true, segment);
    }
    if (target.previewHref) {
      const previewPage = bestPage(target.previewHref, pages);
      assert.ok(previewPage, target.previewHref);
      assert.equal(isRedirectStub(readFileSync(previewPage.file, 'utf8')), false, target.previewHref);
    }
  }
  if (flow.module === 'tradegraph') {
    for (const path of flow.previewPaths) assert.equal(views.includes(path), true, path);
  }
  if (flow.module === 'constructiongraph') {
    for (const path of flow.previewPaths) {
      const inViews = constructionViews.includes(path);
      const workPage = path === 'work' && existsSync('app/preview/constructiongraph/work/page.tsx');
      assert.equal(inViews || workPage, true, path);
    }
  }
  if (flow.module === 'fleetgraph') {
    const screens = objectKeys('components/fleet/PreviewShell.tsx', 'const SCREENS');
    for (const path of flow.previewPaths) assert.equal(screens.includes(path), true, path);
  }
}

console.log('brief120-flow-routes.test.ts ok');
