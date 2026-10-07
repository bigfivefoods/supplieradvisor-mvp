/**
 * Brief 96 — public-page contrast guardrails.
 * Run: npx --yes tsx lib/marketing/brief96-contrast.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const files = [
  'components/marketing/ComparePlatforms.tsx',
  'components/marketing/HomeBelowFold.tsx',
  'components/marketing/HomePricing.tsx',
  'app/industries/page.tsx',
  'app/login/page.tsx',
  'app/page.tsx',
  'app/marketplace/page.tsx',
  'components/pwa/InstallAppBanner.tsx',
  'components/auth/AuthLoginActions.tsx',
  'components/auth/LoginAuthShell.tsx',
] as const;

for (const file of files) {
  const src = read(file);
  assert.doesNotMatch(
    src,
    /className[\s\S]{0,260}bg-\[#00b4d8\][\s\S]{0,260}text-white/,
    `${file}: do not pair bg-[#00b4d8] with text-white`
  );
  assert.doesNotMatch(src, /text-\[9px\]/, `${file}: text-[9px] is disallowed`);
  assert.doesNotMatch(
    src,
    /text-amber-700\/80/,
    `${file}: text-amber-700/80 is disallowed`
  );

  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const hasUnprefixedBrandCyan = /(?<!dark:)(?<!group-hover:)\btext-\[#00b4d8\]/.test(
      line
    );
    if (!hasUnprefixedBrandCyan) continue;
    const isIconLine =
      /className/.test(line) && /text-\[#00b4d8\]/.test(line) && /\b(?:h-\d|w-\d)/.test(line);
    assert.ok(
      isIconLine,
      `${file}:${i + 1} unprefixed text-[#00b4d8] only allowed on icon-sized class lines`
    );
  }
}

const compare = read('components/marketing/ComparePlatforms.tsx');
const compareLines = compare.split('\n');
for (let i = 0; i < compareLines.length; i += 1) {
  const line = compareLines[i];
  if (!line.includes('text-slate-400')) continue;
  const isCellMarkNoIcon = line.includes('bg-slate-100 text-slate-400');
  assert.ok(
    isCellMarkNoIcon,
    `ComparePlatforms.tsx:${i + 1} text-slate-400 only allowed for CellMark "no" icon spans`
  );
}

console.log('brief96-contrast.test.ts ok');
