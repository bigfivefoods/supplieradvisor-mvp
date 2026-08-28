/**
 * Brief 10 — homepage module graph must stay marketing-only.
 * Run: npx --yes tsx lib/http/brief10-home-graph.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve('.');
const FORBIDDEN = [
  '@privy-io/react-auth',
  'viem',
  'wagmi',
  'undici',
  '@/lib/supabase/server-client',
];

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith('@/')) {
    const base = join(ROOT, spec.slice(2));
    return withExt(base);
  }
  if (spec.startsWith('.')) {
    const base = resolve(dirname(fromFile), spec);
    return withExt(base);
  }
  return null;
}

function withExt(base: string): string | null {
  const tries = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const t of tries) {
    if (existsSync(t)) return t;
  }
  return null;
}

function walk(file: string, seen: Set<string>) {
  const abs = resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);
  const text = src(abs);
  const stripped = text.replace(
    /dynamic\(\s*\(\)\s*=>\s*import\((?:'[^']+'|"[^"]+")\)[\s\S]*?\)/g,
    ''
  );
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    const spec = m[1];
    for (const bad of FORBIDDEN) {
      if (spec === bad || spec.startsWith(`${bad}/`)) {
        assert.fail(`${abs} imports forbidden ${spec}`);
      }
    }
    const next = resolveImport(abs, spec);
    if (next) walk(next, seen);
  }
}

const page = src('app/page.tsx');
assert.doesNotMatch(page, /ProductMocks/);
assert.doesNotMatch(page, /supply-chain-referral/);
assert.doesNotMatch(page, /lib\/product\/architecture/);
assert.doesNotMatch(page, /next\/dynamic/);
assert.match(page, /HomeBelowFoldLazy/);

const lazy = src('components/marketing/HomeBelowFoldLazy.tsx');
assert.match(lazy, /ssr:\s*false/);
assert.match(lazy, /HomeBelowFold/);

const seen = new Set<string>();
walk('app/page.tsx', seen);
assert.ok(seen.size > 3, 'expected to walk homepage imports');

const dash = src('app/dashboard/page.tsx');
const loadFn = dash.split('const load = useCallback')[1] || '';
const loadBody = loadFn.split('}, [companyId]')[0] || '';
assert.match(loadBody, /\/api\/dashboard\/home/);
assert.doesNotMatch(loadBody, /\/api\/operations\/summary/);
assert.doesNotMatch(loadBody, /\/api\/manufacturing\/summary/);
assert.doesNotMatch(loadBody, /\/api\/accounting\/summary/);
assert.doesNotMatch(loadBody, /\/api\/intelligence\/summary/);
assert.doesNotMatch(dash, /useIntelligence/);
assert.doesNotMatch(dash, /@privy-io\/react-auth/);

const partiesGet = src('app/api/accounting/parties/route.ts').split(
  'export async function POST'
)[0];
assert.match(partiesGet, /parseListLimit/);
assert.doesNotMatch(partiesGet, /5000/);

const connGetFn = (src('app/api/connections/route.ts').split(
  'export async function GET'
)[1] || '').split('export async function POST')[0];
assert.doesNotMatch(connGetFn, /syncBooksOnInvite\(/);
assert.doesNotMatch(connGetFn, /seedRequester/);

const rates = src('lib/billing/referral-rates.ts');
assert.doesNotMatch(rates, /getSupabaseServer/);
assert.doesNotMatch(rates, /supabase/);

const pack = src('lib/product/packaging-constants.ts');
assert.doesNotMatch(pack, /getSupabaseServer/);
assert.doesNotMatch(pack, /advisor-core-unlocks/);

console.log('brief10-home-graph.test.ts ok');
