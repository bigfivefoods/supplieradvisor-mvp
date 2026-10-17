/**
 * Brief 121A — next/link must not prefetch static files in public/.
 * Run: npx --yes tsx lib/marketing/brief121a-no-link-to-static-html.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function publicUrlPaths(): Set<string> {
  const paths = new Set<string>();
  for (const file of walk(join(root, 'public'))) {
    const rel = relative(join(root, 'public'), file).split('\\').join('/');
    paths.add(`/${rel}`);
  }
  return paths;
}

function pathnameOf(href: string): string {
  if (/^https?:\/\//i.test(href)) {
    try {
      return new URL(href).pathname;
    } catch {
      return href;
    }
  }
  const noHash = href.split('#')[0] ?? href;
  return noHash.split('?')[0] ?? noHash;
}

/** String-literal href on an opening tag, including href={"/path"}. */
function literalHref(attrs: string): string | null {
  const match = attrs.match(/href\s*=\s*(?:\{\s*)?(['"`])([^'"`]+)\1/);
  return match ? match[2]! : null;
}

function openingTags(src: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b([^>]*?)>`, 'g');
  return [...src.matchAll(re)].map((match) => match[1] ?? '');
}

function importsNextLink(src: string): boolean {
  return /from\s+['"]next\/link['"]/.test(src) || /require\(\s*['"]next\/link['"]\s*\)/.test(src);
}

const publicPaths = publicUrlPaths();
assert.ok(publicPaths.has('/add-to-home.html'), 'public/add-to-home.html should exist');

const roots = ['app', 'components', 'lib'];
const tsxFiles = roots
  .flatMap((dir) => walk(join(root, dir)))
  .filter((file) => file.endsWith('.tsx'));

const offenders: string[] = [];
let scanned = 0;
for (const file of tsxFiles) {
  const src = readFileSync(file, 'utf8');
  if (!importsNextLink(src)) continue;
  scanned += 1;
  for (const attrs of openingTags(src, 'Link')) {
    const href = literalHref(attrs);
    if (!href) continue;
    const path = pathnameOf(href);
    if (path.endsWith('.html') || publicPaths.has(path)) {
      offenders.push(`${relative(root, file)} <Link href="${href}">`);
    }
  }
}

assert.deepEqual(
  offenders,
  [],
  `next/link must not target a static public file:\n${offenders.join('\n')}`
);
assert.ok(scanned > 0, 'expected to scan tsx files that import next/link');

const banner = readFileSync(join(root, 'components/pwa/InstallAppBanner.tsx'), 'utf8');
const anchorHrefs = openingTags(banner, 'a')
  .map(literalHref)
  .filter((href): href is string => href === '/add-to-home.html');
const linkHrefs = openingTags(banner, 'Link')
  .map(literalHref)
  .filter((href): href is string => href === '/add-to-home.html');
assert.deepEqual(anchorHrefs, ['/add-to-home.html']);
assert.deepEqual(linkHrefs, []);
assert.doesNotMatch(banner, /from\s+['"]next\/link['"]/);

console.log(`brief121a-no-link-to-static-html.test.ts ok (${scanned} next/link files)`);
