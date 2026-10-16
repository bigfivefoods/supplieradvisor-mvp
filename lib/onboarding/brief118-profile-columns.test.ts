/**
 * Brief 118: registration writes only columns that exist in the snapshot or a migration.
 * Run: npx --yes tsx lib/onboarding/brief118-profile-columns.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { registrationProfileFacts } from './register-profile';
import {
  PROFILE_REGISTRATION_WRITE_COLUMNS,
  PROFILE_SUBSCRIPTION_COLUMNS,
  buildSubscriptionPatch,
} from './profile-writes';
import {
  PROFILE_COLUMNS_ADDED_BY_BRIEF_118,
  PROFILES_KNOWN_COLUMNS,
} from './profiles-known-columns';

const SIX = ['region', 'sub_industries', 'latitude', 'longitude', 'lat', 'lng'];

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(path);
  }
}

function columnsAddedToProfiles(sql: string): string[] {
  const found = new Set<string>();
  const sa =
    /sa_add_column\(\s*'profiles'\s*,\s*'([a-zA-Z_][a-zA-Z0-9_]*)'/g;
  for (const match of sql.matchAll(sa)) found.add(match[1]);
  for (const part of sql.split(';')) {
    if (!/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?(?:public\.)?profiles\b/i.test(part)) {
      continue;
    }
    const add =
      /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi;
    for (const match of part.matchAll(add)) found.add(match[1] || match[2]);
  }
  return [...found];
}

function readBrace(source: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
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
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error('unbalanced brace');
}

function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let i = 1;
  const n = body.length;
  const skipNoise = () => {
    for (;;) {
      while (i < n && /\s/.test(body[i])) i += 1;
      if (body.startsWith('//', i)) {
        const next = body.indexOf('\n', i);
        i = next < 0 ? n : next + 1;
        continue;
      }
      if (body.startsWith('/*', i)) {
        const next = body.indexOf('*/', i + 2);
        i = next < 0 ? n : next + 2;
        continue;
      }
      break;
    }
  };
  const skipValue = () => {
    let depth = 0;
    let quote: string | null = null;
    while (i < n) {
      const char = body[i];
      if (quote) {
        if (char === '\\') {
          i += 2;
          continue;
        }
        if (char === quote) quote = null;
        i += 1;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        i += 1;
        continue;
      }
      if (char === '{' || char === '(' || char === '[') {
        depth += 1;
        i += 1;
        continue;
      }
      if (char === '}' || char === ')' || char === ']') {
        if (depth === 0 && char === '}') return;
        depth -= 1;
        i += 1;
        continue;
      }
      if (char === ',' && depth === 0) {
        i += 1;
        return;
      }
      i += 1;
    }
  };

  while (i < n - 1) {
    skipNoise();
    if (i >= n - 1 || body[i] === '}') break;
    if (body.startsWith('...', i)) {
      i += 3;
      skipValue();
      continue;
    }
    let key = '';
    if (body[i] === '"' || body[i] === "'") {
      const quote = body[i];
      i += 1;
      while (i < n && body[i] !== quote) {
        if (body[i] === '\\') i += 1;
        key += body[i] || '';
        i += 1;
      }
      i += 1;
    } else if (/[A-Za-z_$]/.test(body[i])) {
      const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(body.slice(i));
      key = match?.[0] || '';
      i += key.length;
    } else {
      i += 1;
      continue;
    }
    skipNoise();
    if (body[i] !== ':') continue;
    if (key) keys.push(key);
    i += 1;
    skipValue();
  }
  return keys;
}

type WriteSite = { keys: string[]; ident: string | null };

function literalProfileWrites(source: string): WriteSite[] {
  const sites: WriteSite[] = [];
  const re = /\.from\(\s*['"]profiles['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const rest = source.slice(match.index + match[0].length);
    const call = /^\s*\.(insert|update|upsert)\s*\(/.exec(rest);
    if (!call) continue;
    let i = call[0].length;
    while (i < rest.length && /\s/.test(rest[i])) i += 1;
    if (rest[i] === '{') {
      sites.push({ keys: topLevelKeys(readBrace(rest, i)), ident: null });
    } else {
      const ident = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest.slice(i));
      sites.push({ keys: [], ident: ident?.[0] || null });
    }
  }
  return sites;
}

/**
 * Known literal that writes a column which does not exist.
 * Brief 118 leaves this alone: the loyalty page shows the error in a toast.
 */
const LITERAL_KEY_ALLOWLIST: { file: string; key: string }[] = [
  { file: 'app/dashboard/loyalty/page.tsx', key: 'loyalty_enabled' },
];

const migrationDir = 'supabase/migrations';
const migrationColumns = new Set<string>();
for (const name of readdirSync(migrationDir)) {
  if (!name.endsWith('.sql')) continue;
  for (const column of columnsAddedToProfiles(readFileSync(join(migrationDir, name), 'utf8'))) {
    migrationColumns.add(column);
  }
}

const known = new Set<string>([...PROFILES_KNOWN_COLUMNS, ...migrationColumns]);

for (const column of PROFILE_REGISTRATION_WRITE_COLUMNS) {
  assert.ok(known.has(column), `registration write column is not a known profiles column: ${column}`);
}
for (const column of PROFILE_SUBSCRIPTION_COLUMNS) {
  assert.ok(PROFILE_REGISTRATION_WRITE_COLUMNS.includes(column), column);
}

const briefMigration = readFileSync(
  'supabase/migrations/20261022_profiles_registration_columns.sql',
  'utf8'
);
for (const column of SIX) {
  assert.match(briefMigration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`));
  assert.ok(
    migrationColumns.has(column),
    `${column} is not declared by any file in supabase/migrations`
  );
}
assert.deepEqual([...PROFILE_COLUMNS_ADDED_BY_BRIEF_118], SIX);
assert.doesNotMatch(briefMigration, /\bDROP\b/i);
assert.doesNotMatch(briefMigration, /\bUPDATE\b/);
assert.doesNotMatch(briefMigration, /\bDELETE\b/);
assert.doesNotMatch(briefMigration, /CREATE\s+OR\s+REPLACE/i);
assert.doesNotMatch(briefMigration, /ROW LEVEL SECURITY/i);
assert.doesNotMatch(briefMigration, /CREATE\s+POLICY/i);
assert.doesNotMatch(briefMigration, /\b5751\b/);

const files: string[] = [];
walk('app', files);
walk('lib', files);
const violations: string[] = [];
for (const file of files) {
  const rel = relative('.', file);
  let sites: WriteSite[];
  try {
    sites = literalProfileWrites(readFileSync(file, 'utf8'));
  } catch (error) {
    violations.push(`${rel}: ${error instanceof Error ? error.message : 'parse failed'}`);
    continue;
  }
  for (const site of sites) {
    if (site.ident) continue;
    for (const key of site.keys) {
      if (known.has(key)) continue;
      const allowed = LITERAL_KEY_ALLOWLIST.some(
        (entry) => entry.file === rel && entry.key === key
      );
      if (!allowed) violations.push(`${rel}: ${key}`);
    }
  }
}
assert.deepEqual(violations, []);

const loyalty = readFileSync('app/dashboard/loyalty/page.tsx', 'utf8');
assert.ok(loyalty.includes('loyalty_enabled'));
assert.ok(
  literalProfileWrites(loyalty).some((site) => site.keys.includes('loyalty_enabled')),
  'scanner missed loyalty_enabled'
);
const claimRoute = readFileSync('app/api/invites/claim/route.ts', 'utf8');
assert.ok(
  literalProfileWrites(claimRoute).some((site) => site.keys.includes('region')),
  'scanner missed customer-invite region write'
);
let literalSites = 0;
for (const file of files) {
  for (const site of literalProfileWrites(readFileSync(file, 'utf8'))) {
    if (!site.ident && site.keys.length) literalSites += 1;
  }
}
assert.ok(literalSites >= 20, `scanner saw only ${literalSites} literal profile writes`);

const facts = registrationProfileFacts({});
for (const key of Object.keys(facts)) {
  assert.ok(
    (PROFILE_REGISTRATION_WRITE_COLUMNS as readonly string[]).includes(key),
    `registration fact ${key} is not in PROFILE_REGISTRATION_WRITE_COLUMNS`
  );
}
const now = '2026-10-16T00:00:00.000Z';
for (const patch of [
  buildSubscriptionPatch({ lifetimePlan: null, now, trialEnds: now }),
  buildSubscriptionPatch({ lifetimePlan: 'founder_lifetime', now, trialEnds: now }),
]) {
  for (const key of Object.keys(patch)) {
    assert.ok((PROFILE_REGISTRATION_WRITE_COLUMNS as readonly string[]).includes(key), key);
  }
}

console.log('onboarding/brief118-profile-columns.test.ts ok');
