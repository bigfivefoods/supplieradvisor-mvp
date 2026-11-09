/**
 * Applies supabase/migrations/20261109_vat201_returns.sql to a local or CI
 * Postgres only. Refuses to run without VAT201_MIGRATION_DATABASE_URL so it
 * cannot touch the production Supabase project.
 *
 *   VAT201_MIGRATION_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/vat201 \
 *     npx --yes tsx lib/accounting/vat201-migration.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const url = process.env.VAT201_MIGRATION_DATABASE_URL || '';
if (!url) {
  throw new Error('VAT201_MIGRATION_DATABASE_URL is required. Do not point this at production.');
}
if (/onkklullmgrdqoertngp|supabase\.co/i.test(url)) {
  throw new Error('Refusing to run the VAT201 migration against a Supabase host.');
}

const migration = resolve('supabase/migrations/20261109_vat201_returns.sql');

function psql(statement: string): string {
  return execFileSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    encoding: 'utf8',
    input: statement,
  }).trim();
}

function psqlFile(path: string) {
  execFileSync('psql', [url, '-X', '-v', 'ON_ERROR_STOP=1', '-f', path], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

psql(`
  CREATE TABLE IF NOT EXISTS public.profiles (
    id bigserial PRIMARY KEY,
    vat_number text,
    trading_name text
  );
`);
psqlFile(migration);

const security = psql(`
  SELECT relname || ':' || relrowsecurity::text
  FROM pg_class
  WHERE relname IN ('vat_vendor_settings', 'vat_returns')
  ORDER BY relname;
`);
assert.match(security, /vat_returns:true/);
assert.match(security, /vat_vendor_settings:true/);

const policies = psql(`
  SELECT pol.polname
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname IN ('vat_vendor_settings', 'vat_returns')
  ORDER BY pol.polname;
`);
assert.match(policies, /vat_returns_select_all/);
assert.match(policies, /vat_returns_write_all/);
assert.match(policies, /vat_vendor_settings_select_all/);
assert.match(policies, /vat_vendor_settings_write_all/);

const profileId = psql(`INSERT INTO public.profiles (trading_name, vat_number) VALUES ('Fixture', '4280321847') RETURNING id;`);
psql(`
  INSERT INTO public.vat_vendor_settings (profile_id, vat_basis, period_category, effective_from, first_period_end, filing_channel)
  VALUES (${profileId}, 'payment', 'B', '2025-05-29', '2025-06-30', 'efiling');
`);
const flag = psql(`SELECT isv_submit_enabled::text FROM public.vat_vendor_settings WHERE profile_id = ${profileId};`);
assert.equal(flag, 'false');
psql(`
  INSERT INTO public.vat_returns (profile_id, period_start, period_end, status)
  VALUES (${profileId}, '2025-07-01', '2025-08-31', 'draft');
`);
const status = psql(`SELECT status FROM public.vat_returns WHERE profile_id = ${profileId};`);
assert.equal(status, 'draft');

console.log('vat201 migration ok');
