/**
 * Run: npx --yes tsx lib/brief119-catalogues.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADVISOR_OS_MODULE_IDS } from '@/lib/chrome/functional-nav';
import { industrySlugs } from '@/lib/marketing/industries';
import {
  CATALOGUE_FILE_BASE_URL,
  CATALOGUES,
  availableCatalogues,
  catalogueFileUrl,
  catalogueForIndustry,
  catalogueForModule,
} from '@/lib/catalogues';

const root = process.cwd();
const idPattern = /^[a-z0-9-]+$/;
const advisorBare = /Advisor(?!®)/;

const expectedAvailableModuleIds = [
  'tradegraph',
  'constructiongraph',
  'fleetgraph',
  'fieldgraph',
  'quarrygraph',
  'apparelgraph',
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'vetgraph',
  'retailgraph',
  'hiregraph',
  'schools',
] as const;

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

const ids = CATALOGUES.map((entry) => entry.id);
assert.equal(new Set(ids).size, ids.length, 'ids should be unique');

const fileNames = CATALOGUES.flatMap((entry) => (entry.file ? [entry.file.name] : []));
assert.equal(new Set(fileNames).size, fileNames.length, 'file names should be unique');

const coverSrcs = CATALOGUES.flatMap((entry) => (entry.cover ? [entry.cover.src] : []));
assert.equal(new Set(coverSrcs).size, coverSrcs.length, 'cover srcs should be unique');

for (const entry of CATALOGUES) {
  assert.match(entry.id, idPattern, `${entry.id} id`);
  assert.doesNotMatch(entry.id, /®/);
  assert.match(entry.name, /®/, `${entry.id} name`);
  assert.match(entry.title, /®/, `${entry.id} title`);
  for (const text of [entry.name, entry.title, entry.blurb, `${entry.name} catalogue cover page`]) {
    assert.doesNotMatch(text, advisorBare, `${entry.id} prose`);
  }
  if (entry.file) {
    assert.match(entry.file.name.replace(/\.pdf$/, ''), idPattern, entry.file.name);
    assert.match(entry.file.name, /^[a-z0-9-]+\.pdf$/, entry.file.name);
    assert.doesNotMatch(entry.file.name, /®/);
    assert.equal(entry.file.name, `${entry.id}-advisor-catalogue.pdf`);
  }
  if (entry.moduleId) {
    assert.ok(
      (ADVISOR_OS_MODULE_IDS as readonly string[]).includes(entry.moduleId),
      `${entry.moduleId} missing from ADVISOR_OS_MODULE_IDS`
    );
    assert.equal(catalogueForModule(entry.moduleId)?.id, entry.id);
  }
  if (entry.industrySlug) {
    assert.ok(industrySlugs().includes(entry.industrySlug), entry.industrySlug);
    assert.equal(catalogueForIndustry(entry.industrySlug)?.id, entry.id);
  }
  if (entry.inAppHref) {
    assert.match(entry.inAppHref, /^\/dashboard/);
  }
}

const available = availableCatalogues();
assert.ok(available.every((entry) => entry.status === 'available'));
assert.ok(!available.some((entry) => entry.id === 'system' || entry.id === 'recover'));

const system = CATALOGUES.find((entry) => entry.id === 'system');
const recover = CATALOGUES.find((entry) => entry.id === 'recover');
assert.equal(system?.status, 'coming-soon');
assert.equal(system?.kind, 'system');
assert.equal(system?.name, 'SupplierAdvisor®');
assert.equal(system?.inAppHref, '/dashboard');
assert.equal(system?.moduleId, undefined);
assert.equal(system?.file, undefined);
assert.equal(system?.cover, undefined);
assert.equal(recover?.status, 'coming-soon');
assert.equal(recover?.name, 'RecoverAdvisor®');
assert.equal(recover?.moduleId, 'recovergraph');
assert.equal(recover?.inAppHref, '/dashboard/recovergraph');
assert.equal(recover?.group, 'credit-recovery');
assert.equal(recover?.file, undefined);
assert.equal(recover?.cover, undefined);
assert.equal(CATALOGUES[0]?.id, 'system', 'system stays first in the registry');

if (system?.status === 'available') {
  assert.equal(available[0]?.id, 'system');
}

assert.equal(available.length, 15);
assert.deepEqual(
  available.map((entry) => entry.moduleId),
  [...expectedAvailableModuleIds]
);

for (const entry of available) {
  assert.ok(entry.file, `${entry.id} file`);
  assert.ok(entry.cover, `${entry.id} cover`);
  assert.ok(entry.file.bytes >= 1048576 && entry.file.bytes <= 15 * 1048576, `${entry.id} bytes`);
  assert.ok(isRealDate(entry.file.updated), entry.file.updated);
  assert.equal(entry.file.version, entry.file.updated.replace(/-/g, ''));
  const coverPath = resolve(root, 'public', entry.cover.src.replace(/^\//, ''));
  const bytes = statSync(coverPath).size;
  assert.ok(bytes < 60 * 1024, `${entry.cover.src} is ${bytes} bytes`);
  const header = readFileSync(coverPath).subarray(0, 12);
  assert.equal(header.subarray(0, 4).toString('latin1'), 'RIFF');
  assert.equal(header.subarray(8, 12).toString('latin1'), 'WEBP');
  const fileUrl = catalogueFileUrl(entry);
  const downloadUrl = catalogueFileUrl(entry, { download: true });
  assert.doesNotMatch(fileUrl, /®| /);
  assert.doesNotMatch(downloadUrl, /®| /);
  assert.equal(downloadUrl, `${fileUrl}?download=1&v=${entry.file.version}`);
}

for (const entry of CATALOGUES.filter((item) => item.status === 'coming-soon')) {
  assert.equal(entry.file, undefined);
  assert.equal(entry.cover, undefined);
}

assert.equal(
  CATALOGUE_FILE_BASE_URL,
  'https://fmsczg6npzkpslsh.public.blob.vercel-storage.com/catalogues'
);

const hygieneRoots = [
  resolve(root, 'lib/catalogues.ts'),
  resolve(root, 'lib/catalogues/download-count.ts'),
  resolve(root, 'components/marketing/HomeCatalogues.tsx'),
];
function walk(dir: string, into: string[]) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, name.name);
    if (name.isDirectory()) walk(full, into);
    else if (/\.(ts|tsx)$/.test(name.name) && !name.name.endsWith('.test.ts')) into.push(full);
  }
}
walk(resolve(root, 'components/catalogues'), hygieneRoots);
walk(resolve(root, 'app/catalogues'), hygieneRoots);

const cyanFills = /bg-\[#(?:22d3ee|0099b8|0ea5e9|06b6d4|14b8a6|2dd4bf|0891b2|0e7490|38bdf8|0284c7)\]/;

for (const file of hygieneRoots) {
  const src = readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /kwaden/i, file);
  assert.doesNotMatch(src, /next\/script|<script|dangerouslySetInnerHTML/, file);
  assert.doesNotMatch(src, /from\s+['"][^'"]*(privy|viem|wagmi|undici)/i, file);
  assert.doesNotMatch(src, cyanFills, file);
  for (const match of src.matchAll(/'([^'\\]*)'|"([^"\\]*)"|`([^`$]*)`/g)) {
    const className = match[1] ?? match[2] ?? match[3] ?? '';
    if (!className.includes('bg-[#00b4d8]')) continue;
    assert.ok(
      className.includes('text-[#0f172a]') || className.includes('sa-btn-brand'),
      `${file} cyan fill needs navy text: ${className}`
    );
    assert.doesNotMatch(className, /text-white/, `${file} white text on cyan: ${className}`);
  }
}

const tradeCommand = readFileSync(resolve(root, 'components/trades/TradeScreens.tsx'), 'utf8');
const fleetCommand = readFileSync(resolve(root, 'components/fleet/FleetViews.tsx'), 'utf8');
assert.match(tradeCommand, /CatalogueDownloadButton[^/]*variant="quiet" tone="cyan"/);
assert.doesNotMatch(tradeCommand, /CatalogueDownloadButton[^/]*variant="secondary"/);
assert.match(fleetCommand, /CatalogueDownloadButton[^/]*variant="quiet" tone="inverse"/);
assert.match(fleetCommand, /CatalogueDownloadButton[^/]*variant="quiet" \/>/);
assert.doesNotMatch(fleetCommand, /CatalogueDownloadButton[^/]*variant="secondary"/);

console.log('brief119-catalogues.test.ts ok');
