/**
 * Brief 122 B4. Scratch Postgres only.
 * Applies supabase/migrations/20261023_brief122_merge_metadata_noop.sql twice.
 * Refuses any non-localhost URL and the production project ref.
 * Does not connect to Supabase and does not touch production data.
 *
 * Run:
 *   PROFILE_METADATA_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/profilemeta \
 *     npx --yes tsx lib/business/brief122-merge-metadata-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.PROFILE_METADATA_DATABASE_URL;
if (!url) throw new Error('PROFILE_METADATA_DATABASE_URL is required');

const PRODUCTION_PROJECT_REF = 'onkklullmgrdqoertngp';
const lowerUrl = url.toLowerCase();
if (lowerUrl.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error('Refusing to run: production database');
}
if (lowerUrl.includes('supabase.co') || lowerUrl.includes('supabase.com')) {
  throw new Error('Refusing to run: this fixture does not connect to Supabase');
}
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  throw new Error('Refusing to run: PROFILE_METADATA_DATABASE_URL is not a URL');
}
if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
  throw new Error('Refusing to run: scratch database must be localhost');
}

const migrationPath = resolve('supabase/migrations/20261023_brief122_merge_metadata_noop.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /IS NOT DISTINCT FROM/);
assert.match(migrationSql, /updated_at = now\(\)/);
assert.equal(migrationSql.includes('token_only'), false);
assert.match(migrationSql, /REVOKE ALL ON FUNCTION public\.sa_merge_profile_metadata\(integer, jsonb\) FROM PUBLIC, anon, authenticated/);
assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.sa_merge_profile_metadata\(integer, jsonb\) TO service_role/);
assert.equal(/GRANT\s+EXECUTE[\s\S]*TO\s+(anon|authenticated|PUBLIC)/i.test(migrationSql), false);
assert.match(migrationSql, /COALESCE\(metadata, '\{\}'::jsonb\) \|\| COALESCE\(p_patch, '\{\}'::jsonb\)/);
assert.match(migrationSql, /Rollback/);

function commandError(error: unknown): Error {
  const stderr =
    error && typeof error === 'object' && 'stderr' in error
      ? String((error as { stderr?: unknown }).stderr || '')
      : '';
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${message}\n${stderr}`);
}

function psql(statement: string): string {
  try {
    return execFileSync('psql', [url!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
      encoding: 'utf8',
      input: statement,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw commandError(error);
  }
}

function psqlFile(path: string) {
  try {
    execFileSync('psql', [url!, '-X', '-v', 'ON_ERROR_STOP=1', '-f', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw commandError(error);
  }
}

function fails(statement: string, pattern: RegExp) {
  try {
    psql(statement);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern);
    return;
  }
  assert.fail(`expected Postgres to reject: ${statement.slice(0, 160)}`);
}

function xminOf(): string {
  return psql(`SELECT xmin::text FROM public.profiles WHERE id = 1;`);
}

function updatedAtUnchanged(stamp: string): boolean {
  return psql(`SELECT (updated_at = timestamptz '${stamp}') FROM public.profiles WHERE id = 1;`) === 't';
}

function updatedAtText(): string {
  return psql(`SELECT updated_at::text FROM public.profiles WHERE id = 1;`);
}

/** ConstructionAdvisor® routes compare-and-set with WHERE updated_at = the value they read. */
function casMatchCount(stamp: string): string {
  return psql(`
    BEGIN;
    WITH upd AS (
      UPDATE public.profiles
      SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"constructiongraph_cas":"probe"}'::jsonb,
          updated_at = clock_timestamp()
      WHERE id = 1 AND updated_at = timestamptz '${stamp}'
      RETURNING id
    )
    SELECT count(*)::text FROM upd;
    ROLLBACK;
  `);
}

function nTupUpd(): string {
  return psql(`
    SELECT n_tup_upd::text
    FROM pg_stat_user_tables
    WHERE schemaname = 'public' AND relname = 'profiles';
  `);
}

const STAMP = '2020-01-01 00:00:00+00';

psql(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT USAGE, CREATE ON SCHEMA public TO public;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE TABLE public.profiles (
    id integer PRIMARY KEY,
    metadata jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  -- Same trigger as 20260709_world_class_schema.sql: trg_profiles_updated_at
  -- calls set_updated_at(), which sets NEW.updated_at = NOW() on every UPDATE.
  CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;
  CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  INSERT INTO public.profiles (id, metadata, updated_at)
  VALUES (
    1,
    '{"trading_name":"Keep","fitgraph_client_tokens":{"a":"1","b":"2"}}'::jsonb,
    timestamptz '${STAMP}'
  );
`);

psqlFile(migrationPath);
psqlFile(migrationPath);

const identity = psql(`
  SELECT pg_get_function_identity_arguments(p.oid)
       || '|' || p.prosecdef::text
       || '|' || COALESCE(array_to_string(p.proconfig, ','), '')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sa_merge_profile_metadata';
`);
assert.equal(identity, 'p_company_id integer, p_patch jsonb|true|search_path=public');

const fn = `public.sa_merge_profile_metadata(integer, jsonb)`;
for (const role of ['anon', 'authenticated', 'public']) {
  assert.equal(psql(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE');`), 'f', role);
}
assert.equal(psql(`SELECT has_function_privilege('service_role', '${fn}', 'EXECUTE');`), 't');
const body = psql(`SELECT prosrc FROM pg_proc WHERE oid = '${fn}'::regprocedure;`);
assert.match(body, /IS NOT DISTINCT FROM/);
assert.equal(body.includes('@>'), false);
assert.equal(body.includes('token_only'), false);
assert.match(body, /updated_at = now\(\)/);
assert.match(body, /RETURN;/);
const triggerDef = psql(`
  SELECT pg_get_triggerdef(t.oid)
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles' AND t.tgname = 'trg_profiles_updated_at' AND NOT t.tgisinternal;
`);
assert.match(triggerDef, /BEFORE UPDATE ON public\.profiles/);
assert.match(triggerDef, /EXECUTE FUNCTION set_updated_at\(\)/);
assert.match(triggerDef, /FOR EACH ROW/);
assert.equal(
  psql(`
    SELECT n.nspname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgname = 'trg_profiles_updated_at' AND NOT t.tgisinternal;
  `),
  'public'
);
assert.equal(
  psql(`
    BEGIN;
    UPDATE public.profiles SET metadata = metadata WHERE id = 1;
    SELECT (updated_at <> timestamptz '${STAMP}') FROM public.profiles WHERE id = 1;
    ROLLBACK;
  `),
  't',
  'trg_profiles_updated_at bumps updated_at on any UPDATE'
);
assert.equal(updatedAtUnchanged(STAMP), true);

fails(
  `SET ROLE anon; SELECT public.sa_merge_profile_metadata(1, '{}'::jsonb);`,
  /permission denied/i
);

const beforeNoopXmin = xminOf();
const beforeNoopStat = nTupUpd();
const xactNoop = psql(`
  BEGIN;
  SELECT pg_stat_get_xact_tuples_updated('public.profiles'::regclass)::text;
  DO $$ BEGIN
    PERFORM public.sa_merge_profile_metadata(
      1,
      '{"fitgraph_client_tokens":{"b":"2","a":"1"},"trading_name":"Keep"}'::jsonb
    );
    PERFORM public.sa_merge_profile_metadata(1, NULL);
    PERFORM public.sa_merge_profile_metadata(1, 'null'::jsonb);
    PERFORM public.sa_merge_profile_metadata(1, '{}'::jsonb);
  END $$;
  SELECT pg_stat_get_xact_tuples_updated('public.profiles'::regclass)::text;
  COMMIT;
`);
assert.equal(xactNoop, '0\n0');
assert.equal(xminOf(), beforeNoopXmin, 'unchanged patch must not write a new row version');
assert.equal(nTupUpd(), beforeNoopStat, 'unchanged patch must not increment n_tup_upd');
assert.equal(updatedAtUnchanged(STAMP), true, 'no-op patch must leave profiles.updated_at unchanged');
assert.equal(
  psql(`SELECT (metadata = '{"trading_name":"Keep","fitgraph_client_tokens":{"a":"1","b":"2"}}'::jsonb) FROM public.profiles WHERE id = 1;`),
  't'
);
assert.equal(
  casMatchCount(STAMP),
  '1',
  'ConstructionAdvisor® compare-and-set still matches after a no-op because the version did not move'
);
assert.equal(updatedAtUnchanged(STAMP), true);

const beforeTokenXmin = xminOf();
const beforeTokenStat = nTupUpd();
const xactToken = psql(`
  BEGIN;
  SELECT pg_stat_get_xact_tuples_updated('public.profiles'::regclass)::text;
  DO $$ BEGIN
    PERFORM public.sa_merge_profile_metadata(1, '{"fitgraph_public_token":"gym_tok"}'::jsonb);
  END $$;
  SELECT pg_stat_get_xact_tuples_updated('public.profiles'::regclass)::text;
  COMMIT;
`);
assert.equal(xactToken, '0\n1');
assert.notEqual(xminOf(), beforeTokenXmin, 'a changed token key must write a new row version');
assert.equal(String(Number(nTupUpd()) - Number(beforeTokenStat)), '1');
assert.equal(updatedAtUnchanged(STAMP), false, 'a real token write changes profiles.updated_at');
assert.equal(casMatchCount(STAMP), '0', 'a stale ConstructionAdvisor® version loses after a real token write');
const afterTokenAt = updatedAtText();
const afterToken = psql(`SELECT (metadata->>'trading_name') || '|' || (metadata->>'fitgraph_public_token') FROM public.profiles WHERE id = 1;`);
assert.equal(afterToken, 'Keep|gym_tok');
assert.equal(
  psql(`SELECT metadata->'fitgraph_client_tokens' FROM public.profiles WHERE id = 1;`),
  '{"a": "1", "b": "2"}'
);

const beforeRemovalXmin = xminOf();
psql(`SELECT public.sa_merge_profile_metadata(1, '{"fitgraph_client_tokens":{"a":"1"}}'::jsonb);`);
assert.notEqual(xminOf(), beforeRemovalXmin, 'removing a token inside a map must write');
assert.equal(
  psql(`SELECT metadata->'fitgraph_client_tokens' FROM public.profiles WHERE id = 1;`),
  '{"a": "1"}'
);
assert.equal(psql(`SELECT metadata->>'trading_name' FROM public.profiles WHERE id = 1;`), 'Keep');
assert.equal(psql(`SELECT metadata->>'fitgraph_public_token' FROM public.profiles WHERE id = 1;`), 'gym_tok');
const afterRemoval = updatedAtText();
assert.notEqual(afterRemoval, afterTokenAt, 'removing a token bumps profiles.updated_at');

const beforeNewKey = xminOf();
psql(`SELECT public.sa_merge_profile_metadata(1, '{"fitgraph_coach_tokens":{"c":"3"}}'::jsonb);`);
assert.notEqual(xminOf(), beforeNewKey, 'a new key must write');
assert.equal(psql(`SELECT metadata->'fitgraph_coach_tokens' FROM public.profiles WHERE id = 1;`), '{"c": "3"}');
assert.equal(psql(`SELECT metadata->>'trading_name' FROM public.profiles WHERE id = 1;`), 'Keep');
assert.equal(psql(`SELECT metadata->>'fitgraph_public_token' FROM public.profiles WHERE id = 1;`), 'gym_tok');
assert.equal(
  psql(`SELECT metadata->'fitgraph_client_tokens' FROM public.profiles WHERE id = 1;`),
  '{"a": "1"}'
);
const afterNewKey = updatedAtText();
assert.notEqual(afterNewKey, afterRemoval, 'a new key bumps profiles.updated_at');

const sameAgain = xminOf();
psql(`SELECT public.sa_merge_profile_metadata(1, '{"fitgraph_public_token":"gym_tok","fitgraph_coach_tokens":{"c":"3"}}'::jsonb);`);
assert.equal(xminOf(), sameAgain);
assert.equal(updatedAtText(), afterNewKey, 'a repeated token patch leaves profiles.updated_at unchanged');

const beforeChrome = xminOf();
psql(`SELECT public.sa_merge_profile_metadata(1, '{"setup_status":"ready"}'::jsonb);`);
assert.notEqual(xminOf(), beforeChrome);
assert.equal(psql(`SELECT metadata->>'setup_status' FROM public.profiles WHERE id = 1;`), 'ready');
assert.equal(psql(`SELECT metadata->>'trading_name' FROM public.profiles WHERE id = 1;`), 'Keep');
assert.notEqual(updatedAtText(), afterNewKey, 'a non-token key bumps profiles.updated_at');

const bumped = psql(`SELECT updated_at::text FROM public.profiles WHERE id = 1;`);
const beforeMixed = xminOf();
psql(`
  SELECT public.sa_merge_profile_metadata(
    1,
    '{"fitgraph_public_token":"gym_tok_2","setup_status":"ready"}'::jsonb
  );
`);
assert.notEqual(xminOf(), beforeMixed);
assert.equal(psql(`SELECT metadata->>'fitgraph_public_token' FROM public.profiles WHERE id = 1;`), 'gym_tok_2');
assert.equal(psql(`SELECT metadata->>'trading_name' FROM public.profiles WHERE id = 1;`), 'Keep');
assert.notEqual(psql(`SELECT updated_at::text FROM public.profiles WHERE id = 1;`), bumped);

fails(`SELECT public.sa_merge_profile_metadata(1, '[]'::jsonb);`, /metadata patch must be a json object/);
fails(`SELECT public.sa_merge_profile_metadata(NULL, '{}'::jsonb);`, /company id required/);
fails(`SELECT public.sa_merge_profile_metadata(0, '{}'::jsonb);`, /company id required/);
fails(`SELECT public.sa_merge_profile_metadata(-1, '{"fitgraph_public_token":"x"}'::jsonb);`, /company id required/);
assert.equal(psql(`SELECT count(*) FROM public.profiles WHERE id = 1;`), '1');
psql(`SELECT public.sa_merge_profile_metadata(999, '{"fitgraph_public_token":"missing"}'::jsonb);`);
assert.equal(psql(`SELECT count(*) FROM public.profiles;`), '1');

psql(`SET ROLE service_role; SELECT public.sa_merge_profile_metadata(1, '{}'::jsonb); RESET ROLE;`);

console.log('brief122-merge-metadata-db.test.ts ok');
