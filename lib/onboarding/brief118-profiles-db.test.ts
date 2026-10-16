/**
 * Brief 118: real Postgres contract for the six profiles columns.
 * Applies supabase/migrations/20261022_profiles_registration_columns.sql twice.
 * No network. Scratch database only.
 *
 * Run:
 *   PROFILES_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/profiles118 \
 *     npx --yes tsx lib/onboarding/brief118-profiles-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const url = process.env.PROFILES_DATABASE_URL;
if (!url) throw new Error('PROFILES_DATABASE_URL is required');

const migrationPath = 'supabase/migrations/20261022_profiles_registration_columns.sql';
const SIX = ['region', 'sub_industries', 'latitude', 'longitude', 'lat', 'lng'];

function readStringArray(source: string, constName: string): string[] {
  const marker = `export const ${constName} = [`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`missing ${constName}`);
  const open = source.indexOf('[', start);
  let depth = 0;
  let quote: string | null = null;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(open + 1, end);
  const columns: string[] = [];
  for (const part of body.split(',')) {
    const spread = part.match(/\.\.\.([A-Za-z0-9_]+)/);
    if (spread) {
      columns.push(...readStringArray(source, spread[1]));
      continue;
    }
    const literal = part.match(/'([^']+)'/);
    if (literal) columns.push(literal[1]);
  }
  return columns;
}

const profileWrites = readFileSync('lib/onboarding/profile-writes.ts', 'utf8');
const subscriptionColumns = new Set(readStringArray(profileWrites, 'PROFILE_SUBSCRIPTION_COLUMNS'));
const detailColumns = readStringArray(profileWrites, 'PROFILE_REGISTRATION_WRITE_COLUMNS').filter(
  (column) => !subscriptionColumns.has(column)
);
assert.ok(detailColumns.includes('region'));
assert.ok(detailColumns.includes('sub_industries'));
assert.equal(detailColumns.includes('subscription_status'), false);

function psql(statement: string): string {
  return execFileSync('psql', [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    encoding: 'utf8',
    input: statement,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function fails42703(statement: string) {
  try {
    psql(statement);
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr || '')
        : '';
    const message = `${error instanceof Error ? error.message : String(error)}\n${stderr}`;
    assert.match(message, /42703|does not exist/);
    return;
  }
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 140)}`);
}

function sqlType(column: string): string {
  if (column === 'industries') return "jsonb default '[]'::jsonb";
  if (column === 'settings') return "jsonb default '{}'::jsonb";
  if (column === 'is_discoverable') return 'boolean';
  if (column === 'referred_by_profile_id') return 'bigint';
  if (column === 'subscription_status') return "text default 'none'";
  if (column === 'subscription_plan') return "text default 'company_monthly'";
  if (column === 'subscription_amount_zar') return 'numeric';
  if (column.startsWith('subscription_') && column.endsWith('_at')) return 'timestamptz';
  if (column.endsWith('_at')) return 'timestamptz';
  return 'text';
}

function sqlLiteral(column: string): string {
  if (column === 'industries') return `'["Packaged foods"]'::jsonb`;
  if (column === 'settings') return `'{"timezone":"Africa/Johannesburg"}'::jsonb`;
  if (column === 'sub_industries') return `ARRAY['Bakery','Dairy']::text[]`;
  if (column === 'is_discoverable') return 'true';
  if (column === 'referred_by_profile_id') return '1';
  if (column.endsWith('_at')) return `timestamptz '2026-10-16 00:00:00+00'`;
  if (column === 'region') return `'Western Cape'`;
  return `'${column}_value'`;
}

const six = new Set(SIX);
const present = [
  ...detailColumns.filter((column) => !six.has(column)),
  ...subscriptionColumns,
];
const columnSql = present.map((column) => `${column} ${sqlType(column)}`).join(',\n  ');

function applyMigration() {
  const sql = readFileSync(migrationPath, 'utf8');
  assert.doesNotMatch(sql, /\bDROP\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\b/);
  assert.doesNotMatch(sql, /\bDELETE\b/);
  psql(`BEGIN;\nSET LOCAL client_min_messages TO warning;\n${sql}\nCOMMIT;`);
}

function columnSnapshot(): string {
  return psql(`
    SELECT column_name || '|' || data_type || '|' || coalesce(column_default, '') || '|' || is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    ORDER BY column_name;
  `);
}

psql(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT USAGE, CREATE ON SCHEMA public TO public;
`);

try {
  psql(`
    CREATE TABLE public.profiles (
      id bigint PRIMARY KEY,
      ${columnSql}
    );
    CREATE TABLE public.business_users (
      id bigint PRIMARY KEY,
      user_id text,
      profile_id bigint,
      role text,
      status text
    );
    INSERT INTO public.profiles (id, trading_name, email, province)
    VALUES (1, 'Example Co', 'owner@example.com', 'Gauteng');
    INSERT INTO public.business_users (id, user_id, profile_id, role, status)
    VALUES (1, 'user_1', 1, 'owner', 'active');
  `);

  fails42703(`UPDATE public.profiles SET region = 'x' WHERE id = 1`);
  fails42703(`UPDATE public.profiles SET sub_industries = ARRAY['a'] WHERE id = 1`);

  const beforeColumns = columnSnapshot();
  const beforeCount = psql(`SELECT count(*) FROM public.profiles`);
  const beforeChecksum = psql(`
    SELECT md5(concat_ws('|',
      id::text,
      coalesce(trading_name, ''),
      coalesce(email, ''),
      coalesce(province, ''),
      coalesce(subscription_status, ''),
      coalesce(subscription_plan, ''),
      industries::text,
      settings::text
    ))
    FROM public.profiles
    WHERE id = 1;
  `);
  assert.equal(psql(`SELECT subscription_status FROM public.profiles WHERE id = 1`), 'none');
  assert.equal(psql(`SELECT subscription_plan FROM public.profiles WHERE id = 1`), 'company_monthly');

  applyMigration();
  applyMigration();

  assert.equal(psql(`SELECT count(*) FROM public.profiles`), beforeCount);
  assert.equal(psql(`SELECT count(*) FROM public.business_users`), '1');
  const afterChecksum = psql(`
    SELECT md5(concat_ws('|',
      id::text,
      coalesce(trading_name, ''),
      coalesce(email, ''),
      coalesce(province, ''),
      coalesce(subscription_status, ''),
      coalesce(subscription_plan, ''),
      industries::text,
      settings::text
    ))
    FROM public.profiles
    WHERE id = 1;
  `);
  assert.equal(afterChecksum, beforeChecksum);
  assert.equal(psql(`SELECT subscription_status FROM public.profiles WHERE id = 1`), 'none');

  const afterColumns = columnSnapshot();
  for (const line of beforeColumns.split('\n').filter(Boolean)) {
    assert.ok(afterColumns.split('\n').includes(line), `pre-existing column changed: ${line}`);
  }
  const added = afterColumns
    .split('\n')
    .filter((line) => line && !beforeColumns.split('\n').includes(line))
    .map((line) => line.split('|')[0])
    .sort();
  assert.deepEqual(added, [...SIX].sort());

  const types = psql(`
    SELECT column_name || '|' || data_type || '|' || udt_name || '|' || is_nullable || '|' || (column_default IS NULL)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('region','sub_industries','latitude','longitude','lat','lng')
    ORDER BY column_name;
  `);
  const typeRows = Object.fromEntries(
    types.split('\n').filter(Boolean).map((line) => {
      const [name, dataType, udt, nullable, noDefault] = line.split('|');
      return [name, { dataType, udt, nullable, noDefault }];
    })
  );
  assert.equal(typeRows.region.dataType, 'text');
  assert.equal(typeRows.region.udt, 'text');
  assert.equal(typeRows.sub_industries.dataType, 'ARRAY');
  assert.equal(typeRows.sub_industries.udt, '_text');
  for (const column of ['latitude', 'longitude', 'lat', 'lng']) {
    assert.equal(typeRows[column].dataType, 'double precision');
    assert.equal(typeRows[column].udt, 'float8');
  }
  for (const column of SIX) {
    assert.equal(typeRows[column].nullable, 'YES');
    assert.ok(
      typeRows[column].noDefault === 't' || typeRows[column].noDefault === 'true',
      `${column} default ${typeRows[column].noDefault}`
    );
  }

  const assignments = detailColumns
    .map((column) => `${column} = ${sqlLiteral(column)}`)
    .join(', ');
  psql(`UPDATE public.profiles SET ${assignments} WHERE id = 1`);
  assert.equal(
    psql(`SELECT pg_typeof(sub_industries)::text FROM public.profiles WHERE id = 1`),
    'text[]'
  );
  assert.equal(
    psql(`SELECT sub_industries::text FROM public.profiles WHERE id = 1`),
    '{Bakery,Dairy}'
  );
  assert.equal(psql(`SELECT region FROM public.profiles WHERE id = 1`), 'Western Cape');
  assert.equal(psql(`SELECT count(*) FROM public.profiles`), '1');
} finally {
  psql(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
}

console.log('onboarding/brief118-profiles-db.test.ts ok');
