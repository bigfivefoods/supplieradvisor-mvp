/** Staging-only. A production ref or host never gets a connection. */

export const PRODUCTION_PROJECT_REF = 'onkklullmgrdqoertngp';

export function productionDenyHosts() {
  const apex = ['supplier', 'advisor.com'].join('');
  const alias = ['supplier', 'advisor-mvp.', 'vercel.app'].join('');
  return [apex, ['www.', apex].join(''), alias];
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
    return end > 1 ? hostport.slice(1, end) : '';
  }
  return hostport.split(':')[0];
}

export function isDeniedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
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
 * SEED_TARGET_PROJECT_REF must equal LOADTEST_EXPECT_PROJECT_REF,
 * must not be the production ref, and the database host must be allow-listed.
 */
export function evaluateSeedTarget({
  targetProjectRef,
  expectProjectRef,
  databaseUrl,
  allowedHosts,
}) {
  if (!targetProjectRef || !expectProjectRef) {
    return {
      ok: false,
      reason: 'Refusing to seed: SEED_TARGET_PROJECT_REF and LOADTEST_EXPECT_PROJECT_REF are required',
    };
  }
  if (targetProjectRef === PRODUCTION_PROJECT_REF || expectProjectRef === PRODUCTION_PROJECT_REF) {
    return { ok: false, reason: 'Refusing to seed: target is the production project' };
  }
  if (targetProjectRef !== expectProjectRef) {
    return {
      ok: false,
      reason: 'Refusing to seed: SEED_TARGET_PROJECT_REF does not match LOADTEST_EXPECT_PROJECT_REF',
    };
  }
  if (String(databaseUrl || '').includes(PRODUCTION_PROJECT_REF)) {
    return { ok: false, reason: 'Refusing to seed: database URL contains the production project ref' };
  }
  const host = hostnameOf(databaseUrl);
  if (!databaseUrl || !host) {
    return { ok: false, reason: 'Refusing to seed: SEED_DATABASE_URL is missing or has no host' };
  }
  if (isDeniedHost(host)) {
    return { ok: false, reason: 'Refusing to seed: database host is on the production deny list' };
  }
  const allow = parseAllowList(allowedHosts);
  if (allow.length === 0) {
    return { ok: false, reason: 'Refusing to seed: LOADTEST_ALLOWED_HOSTS is empty' };
  }
  if (!allow.includes(host)) {
    return { ok: false, reason: 'Refusing to seed: database host is not on LOADTEST_ALLOWED_HOSTS' };
  }
  return { ok: true, host };
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
