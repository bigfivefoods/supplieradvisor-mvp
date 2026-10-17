/**
 * Run: npx --yes tsx lib/observability/request-timing-client-graph.test.ts
 *
 * The recover desk page reaches the Supabase server client. That graph must
 * not import node:async_hooks, or the production client bundle fails.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOTS = [
  'app/crew/recovergraph/[token]/page.tsx',
  'components/recovery/useRecoverDesk.ts',
  'lib/recovery/member-company.ts',
  'lib/supabase/server-client.ts',
  'lib/supabase/admin.ts',
];

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
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of withoutTypeOnly.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  let base = '';
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = join(dirname(fromFile), spec);
  else return null;
  const candidates = [base, ...EXTENSIONS.map((ext) => base + ext)];
  for (const ext of EXTENSIONS) candidates.push(join(base, `index${ext}`));
  for (const candidate of candidates) {
    if (!existsSync(candidate) || candidate.endsWith('.d.ts')) continue;
    if (!statSync(candidate).isFile()) continue;
    return candidate.split('\\').join('/');
  }
  return null;
}

function walk(roots: string[]): { files: string[]; specs: Array<{ file: string; spec: string }> } {
  const files: string[] = [];
  const specs: Array<{ file: string; spec: string }> = [];
  const seen = new Set<string>();
  const queue = roots.map((file) => resolve(file).split('\\').join('/').replace(`${resolve('.').split('\\').join('/')}/`, ''));
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    files.push(file);
    const source = readFileSync(file, 'utf8');
    for (const spec of specifiers(source)) {
      specs.push({ file, spec });
      const next = resolveSpec(file, spec);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return { files, specs };
}

const graph = walk(ROOTS);
assert.ok(graph.files.includes('lib/supabase/server-client.ts'), 'server client must be in the client-reachable graph');
assert.ok(graph.files.includes('lib/observability/request-timing.ts'));
assert.equal(graph.files.includes('lib/observability/request-timing-server.ts'), false);

const banned = ['node:async_hooks', 'async_hooks'];
for (const edge of graph.specs) {
  assert.equal(banned.includes(edge.spec), false, `${edge.file} imports ${edge.spec}`);
}

const serverOnly = readFileSync('lib/observability/request-timing-server.ts', 'utf8');
assert.match(serverOnly, /node:async_hooks/);
assert.equal(readFileSync('lib/observability/request-timing.ts', 'utf8').includes('node:async_hooks'), false);
assert.equal(readFileSync('lib/supabase/server-client.ts', 'utf8').includes('request-timing-server'), false);
assert.equal(readFileSync('lib/supabase/admin.ts', 'utf8').includes('request-timing-server'), false);

console.log(`request-timing-client-graph.test.ts ok (${graph.files.length} files)`);
