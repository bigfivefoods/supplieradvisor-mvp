/**
 * Apply world-class schema migration to Supabase.
 * Tries multiple execution paths; never prints secrets.
 *
 * Usage: node scripts/apply-schema.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvLocal() {
  const p = path.join(root, '.env.local');
  const text = fs.readFileSync(p, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const migrationPath = path.join(root, 'supabase/migrations/20260709_world_class_schema.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const projectRef = new URL(url).hostname.split('.')[0];
console.log('Project:', projectRef);
console.log('Migration bytes:', sql.length);

async function tryPgMeta(query) {
  const endpoints = [
    `${url}/pg/query`,
    `https://${projectRef}.supabase.co/pg/query`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      console.log('pg-meta', endpoint, res.status, text.slice(0, 200));
      if (res.ok) return { ok: true, text };
    } catch (e) {
      console.log('pg-meta fail', endpoint, e.message);
    }
  }
  return { ok: false };
}

async function trySqlViaRpcBootstrap() {
  // Create an exec_sql helper using service role if possible via REST — cannot do DDL without SQL endpoint.
  // Fallback: run statement-by-statement only if we have a working SQL runner.
  return { ok: false };
}

async function verifySchema() {
  const sb = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const checks = [
    ['profiles', 'onboarding_complete'],
    ['purchase_orders', 'buyer_profile_id'],
    ['purchase_orders', 'items'],
    ['containers', 'profile_id'],
    ['containers', 'assigned_contractor'],
    ['business_connections', 'responded_at'],
    ['warehouses', 'id'],
    ['customers', 'id'],
    ['sales_orders', 'id'],
    ['invoices', 'id'],
    ['employees', 'id'],
    ['activity_log', 'id'],
    ['requisitions', 'id'],
    ['supplier_scorecards', 'id'],
    ['stock_levels', 'id'],
    ['shipments', 'id'],
  ];

  const results = [];
  for (const [table, col] of checks) {
    const { error } = await sb.from(table).select(col).limit(1);
    results.push({
      table,
      col,
      ok: !error,
      error: error?.message || null,
    });
  }
  return results;
}

async function main() {
  // Split into statements carefully (rough split on semicolons outside $$ blocks)
  const statements = [];
  let buf = '';
  let inDollar = false;
  for (const line of sql.split('\n')) {
    if (line.includes('$$')) {
      // toggle for each $$ occurrence count
      const count = (line.match(/\$\$/g) || []).length;
      if (count % 2 === 1) inDollar = !inDollar;
    }
    buf += line + '\n';
    if (!inDollar && line.trim().endsWith(';')) {
      const stmt = buf.trim();
      if (stmt && !stmt.startsWith('--')) statements.push(stmt);
      buf = '';
    }
  }
  if (buf.trim()) statements.push(buf.trim());

  console.log('Statements parsed:', statements.length);

  // Try running whole migration first
  let applied = false;
  const whole = await tryPgMeta(sql);
  if (whole.ok) {
    applied = true;
    console.log('Applied full migration via pg-meta');
  } else {
    console.log('Full migration via pg-meta failed; trying statement batch...');
    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length < 5) continue;
      const r = await tryPgMeta(stmt);
      if (r.ok) okCount++;
      else {
        failCount++;
        if (failCount <= 5) console.log('stmt fail sample', i, stmt.slice(0, 80).replace(/\n/g, ' '));
      }
    }
    console.log({ okCount, failCount });
    applied = okCount > 0 && failCount === 0;
  }

  console.log('\n=== Schema verification (service role) ===');
  const results = await verifySchema();
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.table}.${r.col}${r.error ? ' — ' + r.error : ''}`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nVerified ${passed}/${results.length} checks`);

  if (!applied && passed < results.length) {
    console.log('\nNOTE: Direct SQL endpoint may be unavailable from this environment.');
    console.log('Run the migration in Supabase SQL Editor:');
    console.log('  supabase/migrations/20260709_world_class_schema.sql');
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
