/**
 * Database items from the 26 Oct 2026 improvement review.
 * Scratch Postgres only. Refuses production (onkklullmgrdqoertngp), staging
 * (wpchtkfkaavcjyfgmktn), and any database whose name is not improve26.
 *
 * Run:
 *   IMPROVE26_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/improve26 \
 *     npx --yes tsx lib/db/improve26-db.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRODUCTION_PROJECT_REF = 'onkklullmgrdqoertngp';
const STAGING_PROJECT_REF = 'wpchtkfkaavcjyfgmktn';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function decodedUrlText(value: string): string {
  const parts = [value.toLowerCase()];
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
      parts.push(next.toLowerCase());
    } catch {
      break;
    }
  }
  return parts.join('\n');
}

function assertScratchDatabaseUrl(candidate: string): void {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Refusing to run: IMPROVE26_DATABASE_URL is not a URL');
  }
  const visible = decodedUrlText(candidate);
  if (visible.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('Refusing to run: production database');
  }
  if (visible.includes(STAGING_PROJECT_REF)) {
    throw new Error('Refusing to run: staging database');
  }
  if (visible.includes('supabase.co') || visible.includes('supabase.com')) {
    throw new Error('Refusing to run: this fixture does not connect to Supabase');
  }
  const endpoints: string[] = [];
  for (const raw of [parsed.hostname, ...parsed.searchParams.getAll('host'), ...parsed.searchParams.getAll('hostaddr')]) {
    for (const part of raw.split(',')) {
      const host = part.trim().replace(/^\[|\]$/g, '');
      if (host) endpoints.push(host);
    }
  }
  if (
    endpoints.length === 0 ||
    endpoints.some((host) => !LOCAL_HOSTS.has(decodedUrlText(host).split('\n')[0].trim()))
  ) {
    throw new Error('Refusing to run: scratch database must be localhost');
  }
}

function expectRefusedUrl(candidate: string, pattern: RegExp) {
  assert.throws(() => assertScratchDatabaseUrl(candidate), pattern);
}

expectRefusedUrl(
  'postgresql://postgres:postgres@127.0.0.1:5432/improve26?host=8.8.8.8',
  /scratch database must be localhost/,
);
expectRefusedUrl(
  `postgresql://postgres:postgres@127.0.0.1:5432/improve26?host=db.${PRODUCTION_PROJECT_REF}.supabase.co`,
  /production database|Supabase/,
);
expectRefusedUrl(
  `postgresql://db.${STAGING_PROJECT_REF}.supabase.co:5432/postgres`,
  /staging database|Supabase/,
);
expectRefusedUrl('postgresql://db.example:5432/improve26', /scratch database must be localhost/);

const url = process.env.IMPROVE26_DATABASE_URL;
if (!url) throw new Error('IMPROVE26_DATABASE_URL is required');
assertScratchDatabaseUrl(url);

const migration40 = resolve('supabase/migrations/20261040_site_insights_pageview_vid_index.sql');
const migration41 = resolve('supabase/migrations/20261041_site_insights_explore_speed.sql');
const migration42 = resolve('supabase/migrations/20261042_module_store_merge_speed.sql');
const migration43 = resolve('supabase/migrations/20261043_definer_helper_lockdown.sql');
const migration44 = resolve('supabase/migrations/20261044_unindexed_fk_indexes.sql');
const oldExplore = resolve('docs/db/2026-10-25-rollback-site-insights-explore.sql');
const concurrentIndexes = resolve('docs/db/2026-10-25-indexes-concurrently.sql');
const rolloutDoc = resolve('docs/db/2026-10-25-database-rollout.md');

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

function psqlFile(path: string, singleTransaction: boolean) {
  const args = [url!, '-X', '-v', 'ON_ERROR_STOP=1'];
  if (singleTransaction) args.push('-1');
  args.push('-f', path);
  try {
    execFileSync('psql', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw commandError(error);
  }
}

function failsFile(path: string, pattern: RegExp) {
  try {
    psqlFile(path, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern);
    return;
  }
  assert.fail(`expected ${path} to fail inside a transaction`);
}

const databaseName = psql('SELECT current_database();');
if (databaseName !== 'improve26') {
  throw new Error(`Refusing to run: database must be named improve26 (got ${databaseName})`);
}

for (const file of [migration40, migration41, migration42, migration43, migration44]) {
  const sql = readFileSync(file, 'utf8');
  assert.equal(sql.includes(PRODUCTION_PROJECT_REF), false, file);
  assert.equal(sql.includes(STAGING_PROJECT_REF), false, file);
  assert.equal(/\bcompany_id\s*=\s*110\b/.test(sql), false, file);
}

function reset() {
  psql(`
    DROP SCHEMA IF EXISTS app_private CASCADE;
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT USAGE, CREATE ON SCHEMA public TO public;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $fn$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $fn$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
  `);
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

function lastLine(statement: string): string {
  const lines = psql(statement)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines[lines.length - 1] ?? '';
}

function exploreMs(): number {
  const raw = psql(`
    SELECT round(extract(milliseconds FROM clock_timestamp() - t0)::numeric, 1)
    FROM (SELECT clock_timestamp() AS t0) s,
    LATERAL (
      SELECT public.site_insights_explore(
        timestamptz '2026-10-01',
        timestamptz '2026-10-26',
        ARRAY['supplieradvisor.com','bigfivegroup.africa','super-cube.me'],
        'Africa/Johannesburg'
      )
    ) x;
  `);
  return Number(raw);
}

reset();

psql(`
  CREATE TABLE public.site_insights_events (
    id bigint PRIMARY KEY,
    ts timestamptz NOT NULL,
    kind text NOT NULL,
    visitor text NOT NULL,
    path text NOT NULL,
    label text,
    country text,
    device text,
    engaged_ms integer,
    scroll_pct smallint,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    ref_domain text,
    portal text,
    vid text,
    site text NOT NULL
  );
  CREATE INDEX site_insights_events_site_ts_idx ON public.site_insights_events (site, ts);
  CREATE INDEX site_insights_events_visitor_ts_idx ON public.site_insights_events (visitor, ts);
  CREATE INDEX site_insights_events_vid_ts_idx ON public.site_insights_events (vid, ts) WHERE vid IS NOT NULL;
  CREATE TABLE public.site_insights_vitals (
    id bigint PRIMARY KEY,
    ts timestamptz NOT NULL,
    site text NOT NULL,
    path text NOT NULL,
    metric text NOT NULL,
    value real NOT NULL,
    device text
  );
  CREATE INDEX site_insights_vitals_site_ts_idx ON public.site_insights_vitals (site, ts);
  CREATE OR REPLACE FUNCTION public.site_insights_channel(p_src text, p_medium text, p_campaign text)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO public, pg_temp AS $$
    SELECT CASE
      WHEN lower(coalesce(p_medium, '')) IN ('social', 'sm') THEN 'social'
      WHEN lower(coalesce(p_medium, '')) IN ('email', 'sms', 'share', 'whatsapp', 'telegram') THEN 'shared'
      WHEN lower(coalesce(p_medium, '')) IN ('organic', 'seo') THEN 'search'
      WHEN coalesce(p_campaign, '') <> '' OR coalesce(p_medium, '') <> '' THEN 'campaign'
      WHEN coalesce(p_src, '') = '' OR p_src = 'direct' THEN 'direct'
      ELSE 'referral'
    END;
  $$;
`);
psqlFile(oldExplore, true);
psql(`
  INSERT INTO public.site_insights_events
    (id, ts, kind, visitor, path, label, country, device, engaged_ms, scroll_pct,
     utm_source, utm_medium, utm_campaign, ref_domain, portal, vid, site)
  SELECT
    i,
    timestamptz '2026-09-20 00:00:00+00' + ((i % 40) || ' days')::interval + ((i % 80000) || ' seconds')::interval,
    (ARRAY['pageview','pageview','engage','click','pdf','enquiry'])[1 + (i % 6)],
    'vis-' || ((i % 4500))::text,
    '/p/' || ((i % 30))::text,
    CASE WHEN i % 6 = 3 THEN 'cta-demo' ELSE NULL END,
    (ARRAY['ZA','KE','GB','US','??'])[1 + (i % 5)],
    (ARRAY['mobile','desktop','tablet'])[1 + (i % 3)],
    (i % 20000),
    (i % 100)::smallint,
    CASE WHEN i % 7 = 0 THEN 'google' WHEN i % 7 = 1 THEN '' ELSE 'newsletter' END,
    CASE WHEN i % 7 = 0 THEN 'organic' WHEN i % 7 = 1 THEN '' ELSE 'email' END,
    CASE WHEN i % 11 = 0 THEN 'spring' ELSE NULL END,
    CASE WHEN i % 5 = 0 THEN 'google.com' ELSE NULL END,
    CASE WHEN i % 17 = 0 THEN 'desk' ELSE NULL END,
    'vid-' || ((i % 3200))::text,
    (ARRAY['supplieradvisor.com','supplieradvisor.com','bigfivegroup.africa','super-cube.me'])[1 + (i % 4)]
  FROM generate_series(1, 12000) AS i;
  INSERT INTO public.site_insights_vitals (id, ts, site, path, metric, value, device)
  SELECT i,
    timestamptz '2026-10-01 00:00:00+00' + ((i % 24) || ' days')::interval,
    (ARRAY['supplieradvisor.com','bigfivegroup.africa','super-cube.me'])[1 + (i % 3)],
    '/p/' || ((i % 30))::text,
    (ARRAY['lcp','inp','cls'])[1 + (i % 3)],
    (i % 4000)::real,
    (ARRAY['mobile','desktop','tablet'])[1 + (i % 3)]
  FROM generate_series(1, 1800) AS i;
  ANALYZE public.site_insights_events;
  ANALYZE public.site_insights_vitals;
`);

const beforeSamples: number[] = [];
for (let i = 0; i < 5; i += 1) beforeSamples.push(exploreMs());
psql(`
  CREATE TABLE public.explore_before AS
  SELECT public.site_insights_explore(
    timestamptz '2026-10-01', timestamptz '2026-10-26',
    ARRAY['supplieradvisor.com','bigfivegroup.africa','super-cube.me'],
    'Africa/Johannesburg'
  ) AS full_doc,
  public.site_insights_explore(
    timestamptz '2026-10-10', timestamptz '2026-10-20',
    ARRAY['supplieradvisor.com'], 'UTC'
  ) AS one_site;
`);

const explainBefore = psql(`
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT e.vid, (min(e.ts) AT TIME ZONE 'Africa/Johannesburg')::date
  FROM public.site_insights_events e
  WHERE e.site = 'supplieradvisor.com' AND e.kind = 'pageview'
    AND e.vid IN (
      SELECT DISTINCT vid FROM public.site_insights_events
      WHERE site = 'supplieradvisor.com' AND vid IS NOT NULL
    )
  GROUP BY e.vid;
`);

psql(`
  CREATE TABLE public.company_module_stores (
    company_id integer NOT NULL,
    module text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    public_token text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, module)
  );
  CREATE OR REPLACE FUNCTION public.sa_module_store_is_tombstone(p_row jsonb)
  RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  BEGIN
    IF p_row IS NULL OR jsonb_typeof(p_row) <> 'object' THEN RETURN false; END IF;
    RETURN COALESCE((p_row ->> '_deleted')::boolean, false)
      OR COALESCE((p_row ->> 'deleted')::boolean, false)
      OR COALESCE((p_row ->> 'is_deleted')::boolean, false)
      OR (p_row ? 'deleted_at' AND NULLIF(trim(COALESCE(p_row ->> 'deleted_at', '')), '') IS NOT NULL);
  EXCEPTION WHEN others THEN RETURN false;
  END $fn$;
  CREATE OR REPLACE FUNCTION public.sa_module_store_array_has_id_object(p_value jsonb)
  RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  DECLARE item jsonb;
  BEGIN
    IF p_value IS NULL OR jsonb_typeof(p_value) <> 'array' THEN RETURN false; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
      IF jsonb_typeof(item) = 'object' AND item ? 'id'
         AND NULLIF(trim(COALESCE(item ->> 'id', '')), '') IS NOT NULL THEN
        RETURN true;
      END IF;
    END LOOP;
    RETURN false;
  END $fn$;
  CREATE OR REPLACE FUNCTION public.sa_assert_advisor_module(p_module text)
  RETURNS void LANGUAGE plpgsql IMMUTABLE AS $fn$
  BEGIN
    IF p_module IS NULL OR p_module <> 'fitgraph' THEN
      RAISE EXCEPTION 'unknown advisor module';
    END IF;
  END $fn$;
  CREATE OR REPLACE FUNCTION public.sa_module_index_patch(p_module text, p_indexes jsonb)
  RETURNS jsonb LANGUAGE sql IMMUTABLE AS $fn$
    SELECT COALESCE(p_indexes, '{}'::jsonb);
  $fn$;
  CREATE TABLE public.profile_meta_log (company_id integer, patch jsonb);
  CREATE OR REPLACE FUNCTION public.sa_merge_profile_metadata(p_company_id integer, p_patch jsonb)
  RETURNS void LANGUAGE plpgsql AS $fn$
  BEGIN
    INSERT INTO public.profile_meta_log VALUES (p_company_id, p_patch);
  END $fn$;
`);
psqlFile(resolve('docs/db/2026-10-25-rollback-module-store.sql'), true);

psql(`
  CREATE TABLE public.merge_cases (name text PRIMARY KEY, old_result jsonb);
  INSERT INTO public.merge_cases
  SELECT 'patch', public.sa_merge_module_store_data(
    '{"bookings":[{"id":"a","n":1},{"id":"b","n":2}],"settings":{"tz":"UTC","keep":1},"removed_ids":{}}'::jsonb,
    '{"bookings":[{"id":"b","n":9},{"id":"c","n":3}],"settings":{"tz":"Africa/Johannesburg"},"updated_at":"t"}'::jsonb
  );
  INSERT INTO public.merge_cases
  SELECT 'tombstone', public.sa_merge_module_store_data(
    '{"bookings":[{"id":"a","_deleted":true},{"id":"b","n":2}]}'::jsonb,
    '{"bookings":[{"id":"a","_deleted":true},{"id":"b","n":2}]}'::jsonb
  );
  INSERT INTO public.merge_cases
  SELECT 'removed', public.sa_merge_module_store_data(
    '{"bookings":[{"id":"a"},{"id":"b"},{"id":" c "}]}'::jsonb,
    '{"bookings":[{"id":"b","n":1}],"removed_ids":{"bookings":["a"]}}'::jsonb
  );
  INSERT INTO public.merge_cases
  SELECT 'weird_bool', to_jsonb(public.sa_module_store_is_tombstone('{"_deleted":"yes"}'::jsonb));
  INSERT INTO public.merge_cases
  SELECT 'garbage_bool', to_jsonb(public.sa_module_store_is_tombstone('{"_deleted":"nope"}'::jsonb));
  INSERT INTO public.merge_cases
  SELECT 'deleted_at', to_jsonb(public.sa_module_store_is_tombstone('{"deleted_at":"2026-01-01"}'::jsonb));
  INSERT INTO public.merge_cases
  SELECT 'scalar_array', public.sa_merge_module_store_data(
    '{"tags":[1,2],"bookings":[{"id":"a"}]}'::jsonb,
    '{"tags":[9],"bookings":[{"id":"a","n":1}]}'::jsonb
  );
`);

const mergeBefore: number[] = [];
psql(`
  DROP TABLE IF EXISTS public.shape;
  CREATE TABLE public.shape AS
  SELECT jsonb_build_object(
    'bookings', (SELECT jsonb_agg(jsonb_build_object('id','bk_'||i,'name','Member '||i,'notes', repeat('n', 200)) ORDER BY i) FROM generate_series(1,2000) i),
    'sessions', (SELECT jsonb_agg(jsonb_build_object('id','ss_'||i,'title','Class '||i,'notes', repeat('s', 120)) ORDER BY i) FROM generate_series(1,800) i),
    'clients', (SELECT jsonb_agg(jsonb_build_object('id','cl_'||i,'name','Client '||i,'notes', repeat('c', 800)) ORDER BY i) FROM generate_series(1,200) i),
    'movements', '[]'::jsonb,
    'goals', '[]'::jsonb,
    'programme_logs', '[]'::jsonb,
    'visit_notes', '[]'::jsonb,
    'treatment_plans', '[]'::jsonb,
    'class_feedback', '[]'::jsonb,
    'check_ins', '[]'::jsonb,
    'pt_packs', '[]'::jsonb,
    'subscriptions', '[]'::jsonb,
    'coaches', '[]'::jsonb,
    'programmes', '[]'::jsonb,
    'membership_plans', '[]'::jsonb,
    'settings', jsonb_build_object('tz','Africa/Johannesburg'),
    'removed_ids', '{}'::jsonb,
    'updated_at', '2026-10-25T10:00:00.000Z'
  ) AS doc;
`);
for (let i = 0; i < 5; i += 1) {
  mergeBefore.push(Number(psql(`
    SELECT round(extract(milliseconds FROM clock_timestamp() - t0)::numeric, 1)
    FROM public.shape,
    LATERAL (SELECT clock_timestamp() AS t0) s,
    LATERAL (SELECT public.sa_merge_module_store_data(doc, doc) AS merged) x
    WHERE octet_length(x.merged::text) > 0;
  `)));
}

psql(`
  CREATE TABLE public.business_users (
    user_id text NOT NULL,
    profile_id bigint NOT NULL
  );
  INSERT INTO public.business_users VALUES ('11111111-1111-1111-1111-111111111111', 7);
  CREATE TABLE public.notes (
    profile_id bigint PRIMARY KEY,
    body text NOT NULL
  );
  INSERT INTO public.notes VALUES (7, 'member'), (8, 'other');
  ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notes FORCE ROW LEVEL SECURITY;
  GRANT SELECT ON public.notes TO authenticated;
  CREATE OR REPLACE FUNCTION public.get_current_user_id()
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $fn$
    SELECT COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_setting('request.jwt.claims', true)::json->>'user_id'
    )::text;
  $fn$;
  CREATE OR REPLACE FUNCTION public.user_has_access_to_profile(p_profile_id bigint)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO public AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM business_users
      WHERE user_id = auth.uid()::text AND profile_id = p_profile_id
    );
  $fn$;
  GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.user_has_access_to_profile(bigint) TO anon, authenticated, service_role;
  CREATE POLICY notes_read ON public.notes
    FOR SELECT TO authenticated
    USING (public.user_has_access_to_profile(profile_id));
  CREATE POLICY notes_owner ON public.notes
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_id() = '11111111-1111-1111-1111-111111111111' OR profile_id = 0);
  CREATE TABLE public.industries (id bigint PRIMARY KEY, parent_id bigint REFERENCES public.industries(id));
  CREATE TABLE public.school_profiles (id bigint PRIMARY KEY);
  CREATE TABLE public.nsnp_isp_sla (id bigint PRIMARY KEY, school_profile_id bigint REFERENCES public.school_profiles(id) ON DELETE SET NULL);
  CREATE TABLE public.nsnp_prize_periods (id bigint PRIMARY KEY);
  CREATE TABLE public.nsnp_prize_awards (id bigint PRIMARY KEY, period_id bigint REFERENCES public.nsnp_prize_periods(id) ON DELETE CASCADE);
  CREATE TABLE public.nsnp_prize_certificates (id bigint PRIMARY KEY, period_id bigint REFERENCES public.nsnp_prize_periods(id) ON DELETE SET NULL);
  CREATE TABLE public.product_categories (id bigint PRIMARY KEY);
  CREATE TABLE public.products (id bigint PRIMARY KEY, category_id bigint REFERENCES public.product_categories(id));
  CREATE TABLE public.onchain_attestations (id bigint PRIMARY KEY, attested_by uuid);
`);

psqlFile(migration40, true);
psqlFile(migration41, true);
psqlFile(migration42, true);
psqlFile(migration43, true);
psqlFile(migration44, true);
psqlFile(migration40, true);
psqlFile(migration41, true);
psqlFile(migration42, true);
psqlFile(migration43, true);
psqlFile(migration44, true);

const afterSamples: number[] = [];
for (let i = 0; i < 7; i += 1) afterSamples.push(exploreMs());
const beforeP95 = p95(beforeSamples);
const afterP95 = p95(afterSamples);
console.log(`TIMING explore before_p95_ms=${beforeP95} samples=${beforeSamples.join(',')} after_p95_ms=${afterP95} samples=${afterSamples.join(',')}`);
assert.ok(afterP95 < 500, `explore p95 ${afterP95} ms is not under 500`);
assert.ok(afterP95 < beforeP95 / 2, `explore p95 ${afterP95} did not halve ${beforeP95}`);
assert.equal(psql(`
  SELECT (
    SELECT full_doc = public.site_insights_explore(
      timestamptz '2026-10-01', timestamptz '2026-10-26',
      ARRAY['supplieradvisor.com','bigfivegroup.africa','super-cube.me'],
      'Africa/Johannesburg'
    ) AND one_site = public.site_insights_explore(
      timestamptz '2026-10-10', timestamptz '2026-10-20',
      ARRAY['supplieradvisor.com'], 'UTC'
    )
    FROM public.explore_before
  )::text;
`), 'true');
try {
  psql(`SELECT public.site_insights_explore(timestamptz '2026-10-02', timestamptz '2026-10-01', ARRAY['supplieradvisor.com'], 'Africa/Johannesburg');`);
  assert.fail('bad range should raise');
} catch (error) {
  assert.match(String(error), /bad range/);
}

assert.equal(
  psql(`SELECT to_regclass('public.site_insights_events_pageview_vid_ts_idx') IS NOT NULL`),
  't',
);

const explainAfter = psql(`
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT e.site, e.vid, min(e.ts)
  FROM public.site_insights_events e
  JOIN (
    SELECT DISTINCT site, vid FROM public.site_insights_events WHERE vid IS NOT NULL
  ) v ON v.site = e.site AND v.vid = e.vid
  WHERE e.kind = 'pageview'
  GROUP BY e.site, e.vid;
`);
console.log('EXPLAIN before newReturning shape:');
console.log(explainBefore);
console.log('EXPLAIN after hash join:');
console.log(explainAfter);

for (const name of ['patch', 'tombstone', 'removed', 'weird_bool', 'garbage_bool', 'deleted_at', 'scalar_array']) {
  const sql =
    name === 'weird_bool'
      ? `SELECT to_jsonb(public.sa_module_store_is_tombstone('{"_deleted":"yes"}'::jsonb))`
      : name === 'garbage_bool'
        ? `SELECT to_jsonb(public.sa_module_store_is_tombstone('{"_deleted":"nope"}'::jsonb))`
        : name === 'deleted_at'
          ? `SELECT to_jsonb(public.sa_module_store_is_tombstone('{"deleted_at":"2026-01-01"}'::jsonb))`
          : name === 'patch'
            ? `SELECT public.sa_merge_module_store_data(
                '{"bookings":[{"id":"a","n":1},{"id":"b","n":2}],"settings":{"tz":"UTC","keep":1},"removed_ids":{}}'::jsonb,
                '{"bookings":[{"id":"b","n":9},{"id":"c","n":3}],"settings":{"tz":"Africa/Johannesburg"},"updated_at":"t"}'::jsonb)`
            : name === 'tombstone'
              ? `SELECT public.sa_merge_module_store_data(
                  '{"bookings":[{"id":"a","_deleted":true},{"id":"b","n":2}]}'::jsonb,
                  '{"bookings":[{"id":"a","_deleted":true},{"id":"b","n":2}]}'::jsonb)`
              : name === 'removed'
                ? `SELECT public.sa_merge_module_store_data(
                    '{"bookings":[{"id":"a"},{"id":"b"},{"id":" c "}]}'::jsonb,
                    '{"bookings":[{"id":"b","n":1}],"removed_ids":{"bookings":["a"]}}'::jsonb)`
                : `SELECT public.sa_merge_module_store_data(
                    '{"tags":[1,2],"bookings":[{"id":"a"}]}'::jsonb,
                    '{"tags":[9],"bookings":[{"id":"a","n":1}]}'::jsonb)`;
  assert.equal(
    psql(`SELECT (${sql}) = (SELECT old_result FROM public.merge_cases WHERE name = '${name}')`),
    't',
    name,
  );
}

const mergeAfter: number[] = [];
for (let i = 0; i < 5; i += 1) {
  mergeAfter.push(Number(psql(`
    SELECT round(extract(milliseconds FROM clock_timestamp() - t0)::numeric, 1)
    FROM public.shape,
    LATERAL (SELECT clock_timestamp() AS t0) s,
    LATERAL (SELECT public.sa_merge_module_store_data(doc, doc) AS merged) x
    WHERE octet_length(x.merged::text) > 0;
  `)));
}
console.log(`TIMING merge_noop before_p95_ms=${p95(mergeBefore)} samples=${mergeBefore.join(',')} after_p95_ms=${p95(mergeAfter)} samples=${mergeAfter.join(',')}`);
assert.ok(p95(mergeAfter) < p95(mergeBefore), 'noop merge did not get faster');
assert.ok(p95(mergeAfter) < 500, `noop merge p95 ${p95(mergeAfter)}`);

const changedMs = Number(psql(`
  SELECT round(extract(milliseconds FROM clock_timestamp() - t0)::numeric, 1)
  FROM public.shape,
  LATERAL (SELECT clock_timestamp() AS t0) s,
  LATERAL (
    SELECT public.sa_merge_module_store_data(doc, jsonb_set(doc, '{bookings,0,notes}', '"patched"')) AS merged
  ) x
  WHERE octet_length(x.merged::text) > 0;
`));
console.log(`TIMING merge_one_booking_ms=${changedMs}`);
assert.ok(changedMs < 500, `changed merge ${changedMs}`);

psql(`SELECT public.sa_put_module_store(7, 'fitgraph', '{"bookings":[{"id":"a","n":1}]}'::jsonb, '{}'::jsonb, NULL, timestamptz '2000-01-01');`);
const firstUpdated = psql(`SELECT updated_at::text FROM public.company_module_stores WHERE company_id = 7 AND module = 'fitgraph';`);
assert.equal(
  psql(`SELECT (data = '{"bookings":[{"id":"a","n":1}]}'::jsonb)::text FROM public.company_module_stores WHERE company_id = 7 AND module = 'fitgraph';`),
  'true',
);
psql(`SELECT pg_sleep(0.02); SELECT public.sa_put_module_store(7, 'fitgraph', '{"bookings":[{"id":"a","n":1}]}'::jsonb, '{}'::jsonb, NULL, NULL);`);
assert.equal(
  psql(`SELECT updated_at::text FROM public.company_module_stores WHERE company_id = 7 AND module = 'fitgraph';`),
  firstUpdated,
);
psql(`SELECT public.sa_put_module_store(7, 'fitgraph', '{"bookings":[{"id":"a","n":2},{"id":"b","n":3}]}'::jsonb, '{"fitgraph_public_token":"tok"}'::jsonb, 'tok', NULL);`);
assert.equal(
  psql(`SELECT (data = '{"bookings":[{"id":"a","n":2},{"id":"b","n":3}]}'::jsonb)::text FROM public.company_module_stores WHERE company_id = 7 AND module = 'fitgraph';`),
  'true',
);
assert.equal(
  psql(`SELECT public_token FROM public.company_module_stores WHERE company_id = 7 AND module = 'fitgraph';`),
  'tok',
);
assert.equal(psql(`SELECT count(*) FROM public.profile_meta_log WHERE company_id = 7`), '1');
assert.equal(psql(`SELECT count(*) FROM public.company_module_stores WHERE company_id = 110`), '0');
try {
  psql(`SELECT public.sa_put_module_store(0, 'fitgraph', '{}'::jsonb, '{}'::jsonb, NULL, NULL);`);
  assert.fail('company 0 should raise');
} catch (error) {
  assert.match(String(error), /company id required/);
}

const memberRows = lastLine(`
  BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  SELECT string_agg(profile_id::text, ',' ORDER BY profile_id) FROM public.notes;
  COMMIT;
`);
assert.equal(memberRows, '7');
const strangerRows = lastLine(`
  BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  SELECT count(*)::text FROM public.notes;
  COMMIT;
`);
assert.equal(strangerRows, '0');
assert.match(
  psql(`SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polname = 'notes_read'`),
  /app_private\.user_has_access_to_profile/,
);
assert.match(
  psql(`SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polname = 'notes_owner'`),
  /app_private\.get_current_user_id/,
);
assert.equal(psql(`SELECT has_function_privilege('authenticated', 'public.get_current_user_id()', 'EXECUTE')`), 'f');
assert.equal(psql(`SELECT has_function_privilege('authenticated', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')`), 'f');
assert.equal(psql(`SELECT has_function_privilege('anon', 'public.get_current_user_id()', 'EXECUTE')`), 'f');
assert.equal(psql(`SELECT has_function_privilege('anon', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')`), 'f');
assert.equal(psql(`SELECT has_function_privilege('service_role', 'public.get_current_user_id()', 'EXECUTE')`), 't');
assert.equal(psql(`SELECT has_function_privilege('authenticated', 'app_private.user_has_access_to_profile(bigint)', 'EXECUTE')`), 't');
try {
  psql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT public.get_current_user_id();
    COMMIT;
  `);
  assert.fail('authenticated should not execute the public helper');
} catch (error) {
  assert.match(String(error), /permission denied/);
}

for (const indexName of [
  'idx_industries_parent_id',
  'idx_nsnp_isp_sla_school_profile_id',
  'idx_nsnp_prize_awards_period_id',
  'idx_nsnp_prize_certificates_period_id',
  'idx_products_category_id',
]) {
  assert.equal(psql(`SELECT to_regclass('public.${indexName}') IS NOT NULL`), 't', indexName);
}
assert.equal(
  psql(`SELECT to_regclass('public.idx_onchain_attestations_attested_by') IS NOT NULL`),
  't',
);

failsFile(concurrentIndexes, /25001|CREATE INDEX CONCURRENTLY cannot run inside a transaction block/);
psqlFile(concurrentIndexes, false);
assert.equal(psql(`SELECT count(*) FROM pg_class WHERE relname = 'idx_products_category_id'`), '1');

const rollout = readFileSync(rolloutDoc, 'utf8');
for (const version of [
  '20261032',
  '20261033',
  '20261034',
  '20261035',
  '20261036',
  '20261037',
  '20261038',
  '20261039',
  '20261040',
  '20261044',
]) {
  assert.match(rollout, new RegExp(`supabase migration repair --status applied ${version}`));
}
assert.match(rollout, /20261019091525/);
assert.match(rollout, /ANALYZE public\.profiles/);
assert.match(rollout, /Craig/);
assert.match(readFileSync(resolve('docs/db/2026-10-25-unused-index-audit.md'), 'utf8'), /Do not drop/);

console.log('improve26 database checks passed');
