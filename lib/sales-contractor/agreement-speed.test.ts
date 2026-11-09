/**
 * Run: npx --yes tsx lib/sales-contractor/agreement-speed.test.ts
 *
 * /sales/agreement must paint its heading without the ERP sidebar graph,
 * and that graph must not pull the Supabase server client into the browser.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve('.');

function read(rel: string) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];

function specifiers(source: string): string[] {
  const withoutTypeOnly = source
    .replace(/^\s*import\s+type\b[\s\S]*?;/gm, '')
    .replace(/^\s*export\s+type\b[\s\S]*?\bfrom\s+['"][^'"]+['"];?/gm, '');
  const found: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of withoutTypeOnly.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  let base = '';
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = join(dirname(join(ROOT, fromFile)), spec);
  else return null;
  const candidates = [base, ...EXTENSIONS.map((ext) => base + ext)];
  for (const ext of EXTENSIONS) candidates.push(join(base, `index${ext}`));
  for (const candidate of candidates) {
    if (!existsSync(candidate) || candidate.endsWith('.d.ts')) continue;
    if (!statSync(candidate).isFile()) continue;
    return candidate.slice(ROOT.length + 1).split('\\').join('/');
  }
  return null;
}

function walk(roots: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiers(read(file))) {
      const next = resolveSpec(file, spec);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

const layout = read('app/sales/layout.tsx');
const page = read('app/sales/agreement/page.tsx');
const route = read('app/api/sales/agreement/route.ts');
const sidebar = read('components/Sidebar.tsx');

assert.match(layout, /\/sales\/agreement/);
assert.match(layout, /import\('@\/components\/chrome\/AppShell'\)/);
assert.doesNotMatch(layout, /from '@\/components\/chrome\/AppShell'/);
assert.match(page, /Join the/);
assert.doesNotMatch(
  page,
  /if \(loading\) \{\s*return \(\s*<div className="flex justify-center py-24">/
);
assert.doesNotMatch(page, /from '@\/lib\/sales-contractor\/agreement'/);
assert.match(page, /from '@\/lib\/sales-contractor\/public-copy'/);
assert.match(route, /import\(\s*'@\/lib\/sales-contractor\/agreement-pdf'/);
assert.doesNotMatch(route, /from '@\/lib\/sales-contractor\/agreement-pdf'/);
assert.match(sidebar, /from '@\/lib\/recovery\/company-cookie'/);
assert.doesNotMatch(sidebar, /member-company/);

const graph = walk([
  'app/sales/layout.tsx',
  'app/sales/agreement/page.tsx',
  'components/sales/SalesShell.tsx',
]);
assert.equal(
  graph.includes('lib/supabase/server-client.ts'),
  false,
  'sales agreement client graph must not include the Supabase server client'
);
assert.equal(graph.includes('lib/sales-contractor/agreement-pdf.ts'), false);
assert.equal(graph.includes('lib/sales-contractor/agreement.ts'), false);

const shell = read('components/sales/SalesShell.tsx');
assert.match(shell, /pathname\?\.startsWith\('\/sales\/agreement'\)/);
assert.doesNotMatch(shell, /if \(!ready \|\| !authenticated\)/);
assert.match(page, /login\?next=\/sales\/agreement/);

console.log(`agreement-speed.test.ts ok (${graph.length} client files)`);
