/** Staging-only. A production ref or host never gets a connection. */

export const PRODUCTION_PROJECT_REF = 'onkklullmgrdqoertngp';

export function productionDenyHosts() {
  const apex = ['supplier', 'advisor.com'].join('');
  const alias = ['supplier', 'advisor-mvp.', 'vercel.app'].join('');
  return [apex, ['www.', apex].join(''), alias];
}

export function normaliseHost(hostname) {
  return String(hostname || '').trim().toLowerCase().replace(/\.+$/, '');
}

export function cleanRef(value) {
  return String(value || '').trim().toLowerCase();
}

function decodePart(value) {
  try {
    return decodeURIComponent(String(value || '')).trim().toLowerCase();
  } catch {
    return String(value || '').trim().toLowerCase();
  }
}

export function hostnameOf(value) {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/.exec(withScheme);
  if (!match) return '';
  let hostport = match[1];
  if (!hostport || /\s/.test(hostport)) return '';
  const at = hostport.lastIndexOf('@');
  if (at >= 0) hostport = hostport.slice(at + 1);
  if (!hostport || /\s/.test(hostport)) return '';
  if (hostport.startsWith('[')) {
    const end = hostport.indexOf(']');
    return normaliseHost(end > 1 ? hostport.slice(1, end) : '');
  }
  return normaliseHost(hostport.split(':')[0]);
}

export function isDeniedHost(hostname) {
  const host = normaliseHost(hostname);
  if (!host) return false;
  const denied = productionDenyHosts();
  if (denied.includes(host)) return true;
  if (host.endsWith(`.${denied[0]}`)) return true;
  if (host.includes(PRODUCTION_PROJECT_REF)) return true;
  return false;
}

export function parseAllowList(allowedHosts) {
  return String(allowedHosts || '')
    .split(',')
    .map((item) => hostnameOf(item))
    .filter(Boolean);
}

export function assertBatchId(batch) {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(String(batch || ''))) {
    throw new Error('Refusing to seed: batch id must be a short lowercase token');
  }
  if (String(batch).includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('Refusing to seed: batch id contains the production project ref');
  }
  return String(batch);
}

/**
 * Parse first, then decode. The project ref comes from postgres.<ref> or from
 * db.<ref>.supabase.co / <ref>.supabase.co. It must equal the expected staging
 * ref and must not be the production ref.
 */
export function parseDatabaseTarget(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(String(databaseUrl || '').trim());
  } catch {
    return { ok: false, reason: 'Refusing to seed: SEED_DATABASE_URL is not a URL' };
  }
  const host = normaliseHost(parsed.hostname);
  const user = decodePart(parsed.username);
  const database = decodePart(parsed.pathname.replace(/^\//, ''));
  const search = decodePart(parsed.search);
  const password = decodePart(parsed.password);
  const fromUser = user.startsWith('postgres.') ? user.slice('postgres.'.length) : '';
  const labels = host.split('.').filter(Boolean);
  const supabaseHost =
    labels.length >= 3 && labels[labels.length - 2] === 'supabase' && labels[labels.length - 1] === 'co';
  let fromHost = '';
  if (supabaseHost && !host.includes('pooler')) {
    fromHost = labels[0] === 'db' && labels.length >= 4 ? labels[1] : labels[0];
  }
  const decoded = [user, host, database, search, password, fromUser, fromHost].join('\n');
  if (decoded.includes(PRODUCTION_PROJECT_REF)) {
    return { ok: false, reason: 'Refusing to seed: database URL contains the production project ref' };
  }
  if (fromUser && fromHost && fromUser !== fromHost) {
    return { ok: false, reason: 'Refusing to seed: database URL project refs disagree' };
  }
  const projectRef = fromUser || fromHost;
  if (!host || !projectRef) {
    return { ok: false, reason: 'Refusing to seed: database URL has no project ref' };
  }
  return { ok: true, host, projectRef };
}

/**
 * SEED_TARGET_PROJECT_REF must equal LOADTEST_EXPECT_PROJECT_REF,
 * must not be the production ref, and the database host must be allow-listed.
 * The ref is taken from the decoded URL, not from the raw string.
 */
export function evaluateSeedTarget({
  targetProjectRef,
  expectProjectRef,
  databaseUrl,
  allowedHosts,
  cliExpectRef,
}) {
  const target = cleanRef(targetProjectRef);
  const expected = cleanRef(expectProjectRef);
  if (!target || !expected) {
    return {
      ok: false,
      reason: 'Refusing to seed: SEED_TARGET_PROJECT_REF and LOADTEST_EXPECT_PROJECT_REF are required',
    };
  }
  if (target === PRODUCTION_PROJECT_REF || expected === PRODUCTION_PROJECT_REF) {
    return { ok: false, reason: 'Refusing to seed: target is the production project' };
  }
  if (target !== expected) {
    return {
      ok: false,
      reason: 'Refusing to seed: SEED_TARGET_PROJECT_REF does not match LOADTEST_EXPECT_PROJECT_REF',
    };
  }
  if (cliExpectRef != null) {
    const cli = cleanRef(cliExpectRef);
    if (!cli || cli !== expected) {
      return { ok: false, reason: 'Refusing to seed: --expect-ref does not match LOADTEST_EXPECT_PROJECT_REF' };
    }
  }
  const parsed = parseDatabaseTarget(databaseUrl);
  if (!parsed.ok) return parsed;
  if (parsed.projectRef !== expected) {
    return {
      ok: false,
      reason: 'Refusing to seed: database project ref does not match LOADTEST_EXPECT_PROJECT_REF',
    };
  }
  if (isDeniedHost(parsed.host)) {
    return { ok: false, reason: 'Refusing to seed: database host is on the production deny list' };
  }
  const allow = parseAllowList(allowedHosts);
  if (allow.length === 0) {
    return { ok: false, reason: 'Refusing to seed: LOADTEST_ALLOWED_HOSTS is empty' };
  }
  if (!allow.includes(parsed.host)) {
    return { ok: false, reason: 'Refusing to seed: database host is not on LOADTEST_ALLOWED_HOSTS' };
  }
  return { ok: true, host: parsed.host, projectRef: parsed.projectRef };
}

export function automationRefusal(env) {
  if (env && env.CI) return 'Refusing to seed: CI is set';
  if (env && env.VERCEL) return 'Refusing to seed: VERCEL is set';
  return '';
}

export function readSeedEnv(env) {
  return {
    targetProjectRef: env.SEED_TARGET_PROJECT_REF || '',
    expectProjectRef: env.LOADTEST_EXPECT_PROJECT_REF || '',
    databaseUrl: env.SEED_DATABASE_URL || '',
    allowedHosts: env.LOADTEST_ALLOWED_HOSTS || '',
  };
}

export function libpqEnv(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing to seed: SEED_DATABASE_URL is not a URL');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres';
  const env = {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username || ''),
    PGPASSWORD: decodeURIComponent(parsed.password || ''),
    PGDATABASE: database,
  };
  const sslmode = parsed.searchParams.get('sslmode');
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

export function targetIsSet(target) {
  return Boolean(
    target.targetProjectRef || target.expectProjectRef || target.databaseUrl || target.allowedHosts
  );
}
