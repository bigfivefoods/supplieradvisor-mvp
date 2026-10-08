/**
 * One-off: load a gym member seed into Supabase from a gitignored local file.
 *
 * Default file: data/private/vuka-member-seed.json
 * Override: VUKA_MEMBER_SEED_PATH
 * Company: VUKA_SEED_COMPANY_ID (default 110)
 *
 * The file may be a legacy export (`import_version` + `submissions`) plus
 * optional `roster`, `name_folds`, and `coaches`. Shape:
 * scripts/fixtures/vuka-member-seed.example.json
 *
 * Copy your private export into data/private/ (gitignored). Do not print it.
 *
 *   npx tsx scripts/import-vuka-member-seed.ts
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * from .env.local. Prints counts only.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseVukaMemberSeed } from '../lib/fitness/vuka-member-seed';

config({ path: '.env.local' });

const DEFAULT_PATH = 'data/private/vuka-member-seed.json';

function assertGitignored(filePath: string) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', filePath], {
      stdio: 'ignore',
    });
  } catch {
    throw new Error(
      `Refusing to read ${filePath}: path is not gitignored. Use data/private/.`
    );
  }
}

async function main() {
  const rawPath = process.env.VUKA_MEMBER_SEED_PATH || DEFAULT_PATH;
  const filePath = isAbsolute(rawPath) ? rawPath : resolve(rawPath);
  assertGitignored(filePath);

  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(
      `Missing ${rawPath}. Copy your private export there. See scripts/fixtures/vuka-member-seed.example.json for the shape.`
    );
  }

  const parsed = JSON.parse(text) as unknown;
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    (parsed as { example?: boolean }).example === true
  ) {
    throw new Error('Refusing to import the example file.');
  }
  const seed = parseVukaMemberSeed(parsed);
  if (!seed.submissions.length && !seed.roster.length && !seed.coaches.length) {
    throw new Error('Seed file has no submissions, roster rows, or coaches.');
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const companyId = Number(process.env.VUKA_SEED_COMPANY_ID || 110);
  if (!Number.isFinite(companyId)) throw new Error('Invalid VUKA_SEED_COMPANY_ID');

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from('gym_member_seeds').upsert(
    {
      company_id: companyId,
      import_version: seed.importVersion,
      submissions: seed.submissions,
      roster: seed.roster,
      name_folds: seed.nameFolds,
      coaches: seed.coaches,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' }
  );
  if (error) {
    console.error('import failed', error.code || 'unknown');
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      ok: true,
      company_id: companyId,
      import_version: seed.importVersion,
      submissions: seed.submissions.length,
      roster: seed.roster.length,
      name_folds: seed.nameFolds.length,
      coaches: seed.coaches.length,
    })
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : 'import failed';
  console.error(message);
  process.exit(1);
});
