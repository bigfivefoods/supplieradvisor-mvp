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

function specifiers(source: string, followDynamic: boolean): string[] {
  const withoutTypeOnly = source
    .replace(/^\s*import\s+type\b[\s\S]*?;/gm, '')
    .replace(/^\s*export\s+type\b[\s\S]*?\bfrom\s+['"][^'"]+['"];?/gm, '');
  const found: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ];
  if (followDynamic) {
    patterns.push(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  }
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

function walk(roots: string[], followDynamic = true): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiers(read(file), followDynamic)) {
      const next = resolveSpec(file, spec);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

const layout = read('app/sales/layout.tsx');
const portalGroup = read('app/sales/(portal)/layout.tsx');
const agreementLayout = read('app/sales/agreement/layout.tsx');
const portal = read('components/sales/SalesPortalLayout.tsx');
const page = read('app/sales/agreement/page.tsx');
const route = read('app/api/sales/agreement/route.ts');
const sidebar = read('components/Sidebar.tsx');
const experience = read('components/sales/AgreementExperience.tsx');
const mount = read('components/sales/AgreementPrivyMount.tsx');

assert.match(portal, /earlyAgreement && \(loading \|\| !role \|\| role === 'sales_contractor'\)/);
assert.match(portal, /\/sales\/agreement/);
assert.match(portal, /import\('@\/components\/chrome\/AppShell'\)/);
assert.doesNotMatch(portal, /from '@\/components\/chrome\/AppShell'/);
assert.match(portal, /from '@\/components\/Providers'/);
assert.match(portal, /AgreementSessionBridge/);
assert.match(portalGroup, /SalesPortalLayout/);
assert.doesNotMatch(portalGroup, /AgreementExperience/);
assert.match(agreementLayout, /AgreementExperience/);
assert.doesNotMatch(agreementLayout, /SalesPortalLayout/);
assert.doesNotMatch(agreementLayout, /@privy-io/);
assert.doesNotMatch(layout, /@privy-io/);
assert.doesNotMatch(layout, /Providers/);
assert.doesNotMatch(layout, /AgreementExperience/);
assert.match(experience, /import\('@\/components\/sales\/AgreementPrivyMount'\)/);
assert.match(experience, /clientShouldLoadPrivyImmediately/);
assert.doesNotMatch(experience, /from '@\/components\/sales\/AgreementPrivyMount'/);
assert.doesNotMatch(experience, /@privy-io/);
assert.match(mount, /from '@\/components\/Providers'/);
assert.match(mount, /useSalesShellSession/);
assert.match(page, /Join the/);
assert.doesNotMatch(
  page,
  /if \(loading\) \{\s*return \(\s*<div className="flex justify-center py-24">/
);
assert.doesNotMatch(page, /from '@\/lib\/sales-contractor\/agreement'/);
assert.doesNotMatch(page, /@privy-io/);
assert.match(page, /useAgreementSession/);
assert.match(page, /from '@\/lib\/sales-contractor\/public-copy'/);
assert.match(route, /import\(\s*'@\/lib\/sales-contractor\/agreement-pdf'/);
assert.doesNotMatch(route, /from '@\/lib\/sales-contractor\/agreement-pdf'/);
assert.match(sidebar, /from '@\/lib\/recovery\/company-cookie'/);
assert.doesNotMatch(sidebar, /member-company/);

const graph = walk([
  'components/sales/SalesPortalLayout.tsx',
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

const publicGraph = walk(
  ['app/sales/layout.tsx', 'app/sales/agreement/layout.tsx', 'app/sales/agreement/page.tsx'],
  false
);
for (const forbidden of [
  'components/Providers.tsx',
  'components/sales/AgreementPrivyMount.tsx',
  'components/sales/SalesPortalLayout.tsx',
  'components/sales/SalesShell.tsx',
  'components/sales/useSalesShellSession.ts',
  'lib/business/useCompanyRole.ts',
  'components/sam/SamMessenger.tsx',
  'components/pwa/EnablePushButton.tsx',
  'lib/supabase/server-client.ts',
]) {
  assert.equal(
    publicGraph.includes(forbidden),
    false,
    `public agreement graph must not include ${forbidden}`
  );
}
for (const file of publicGraph) {
  assert.equal(
    read(file).includes('@privy-io'),
    false,
    `${file} is on the public agreement path and must not mention Privy`
  );
}

const shell = read('components/sales/SalesShell.tsx');
const session = read('components/sales/useSalesShellSession.ts');
assert.match(session, /startsWith\('\/sales\/agreement'\)/);
assert.match(shell, /!session\.onAgreement/);
assert.doesNotMatch(session, /if \(!ready \|\| !authenticated\)/);
assert.match(page, /login\?next=\/sales\/agreement/);
assert.match(read('components/sales/SalesShellFrame.tsx'), /#00b4d8/);
assert.match(
  read('components/sales/SalesShellFrame.tsx'),
  /Independent sales contractor/
);

console.log(`agreement-speed.test.ts ok (${graph.length} client files)`);
