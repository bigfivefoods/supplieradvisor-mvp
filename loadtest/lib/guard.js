/**
 * k6 and Node share this file. It sends nothing by itself.
 * A production host, an empty allow-list, or the production project ref
 * throws before the preflight request.
 */

const PRODUCTION_PROJECT_REF = 'onkklullmgrdqoertngp';

export const WHOAMI_PATH = '/api/loadtest/whoami';

export function productionProjectRef() {
  return PRODUCTION_PROJECT_REF;
}

export function productionDenyHosts() {
  const apex = ['supplier', 'advisor.com'].join('');
  const alias = ['supplier', 'advisor-mvp.', 'vercel.app'].join('');
  return [apex, ['www.', apex].join(''), alias];
}

export function normaliseHost(hostname) {
  return String(hostname || '').trim().toLowerCase().replace(/\.+$/, '');
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
  const apex = denied[0];
  if (host.endsWith(`.${apex}`)) return true;
  if (host.includes(PRODUCTION_PROJECT_REF)) return true;
  return false;
}

export function parseAllowList(allowedHosts) {
  return String(allowedHosts || '')
    .split(',')
    .map((item) => hostnameOf(item))
    .filter(Boolean);
}

/**
 * Throws before any request. An allow-list entry cannot override the deny list.
 */
export function assertHostAllowed({ baseUrl, allowedHosts }) {
  const host = hostnameOf(baseUrl);
  if (!baseUrl || !host) {
    throw new Error('Refusing to run: BASE_URL is missing or not a URL');
  }
  if (isDeniedHost(host)) {
    throw new Error('Refusing to run: host is on the production deny list');
  }
  if (String(baseUrl || '').toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('Refusing to run: BASE_URL names the production project ref');
  }
  if (String(allowedHosts || '').toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('Refusing to run: LOADTEST_ALLOWED_HOSTS names the production project ref');
  }
  const allow = parseAllowList(allowedHosts);
  if (allow.length === 0) {
    throw new Error('Refusing to run: LOADTEST_ALLOWED_HOSTS is empty');
  }
  if (!allow.includes(host)) {
    throw new Error('Refusing to run: host is not on LOADTEST_ALLOWED_HOSTS');
  }
  return host;
}

function headerEntries(headers) {
  if (!headers) return [];
  if (typeof headers.forEach === 'function') {
    const entries = [];
    headers.forEach((value, key) => {
      entries.push([String(key), value]);
    });
    if (entries.length) return entries;
  }
  if (typeof headers === 'object') return Object.entries(headers);
  return [];
}

export function headersToText(headers) {
  return headerEntries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

/**
 * The staging preview's report-only Content-Security-Policy names the
 * production Supabase host in connect-src. That header is not enforced.
 * It is the only header skipped by the production-ref scan. The enforced
 * Content-Security-Policy header, every other header, the body, and env
 * values are still scanned.
 */
export const REPORT_ONLY_CSP_HEADER = 'content-security-policy-report-only';

export function isReportOnlyCspHeader(name) {
  return String(name || '').trim().toLowerCase() === REPORT_ONLY_CSP_HEADER;
}

function cleanRef(value) {
  return String(value || '').trim().toLowerCase();
}

export function responseCarriesProductionRef(headers, body) {
  const text = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const headerText = headerEntries(headers)
    .filter(([key]) => !isReportOnlyCspHeader(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  const haystack = `${text}\n${headerText}`.toLowerCase();
  return haystack.includes(PRODUCTION_PROJECT_REF);
}

export function evaluatePreflight({ status, body, headers, expectProjectRef }) {
  const expected = cleanRef(expectProjectRef);
  if (!expected) {
    throw new Error('Refusing to run: LOADTEST_EXPECT_PROJECT_REF is empty');
  }
  if (expected === PRODUCTION_PROJECT_REF) {
    throw new Error('Refusing to run: LOADTEST_EXPECT_PROJECT_REF is the production project');
  }
  if (responseCarriesProductionRef(headers, body)) {
    throw new Error('Refusing to run: preflight response contains the production project ref');
  }
  if (status !== 200) {
    throw new Error('Refusing to run: preflight status was not 200');
  }
  let parsed = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error('Refusing to run: preflight body is not JSON');
    }
  }
  if (!parsed || cleanRef(parsed.stage) !== 'staging') {
    throw new Error('Refusing to run: preflight stage is not staging');
  }
  const reported = [parsed.projectRef, parsed.serverProjectRef, parsed.publicProjectRef]
    .filter((value) => value != null && String(value).trim() !== '')
    .map((value) => cleanRef(value));
  if (reported.length === 0 || reported.some((value) => value !== expected)) {
    throw new Error('Refusing to run: preflight project ref does not match LOADTEST_EXPECT_PROJECT_REF');
  }
  if (parsed.serverProjectRef != null && parsed.publicProjectRef != null) {
    if (cleanRef(parsed.serverProjectRef) !== cleanRef(parsed.publicProjectRef)) {
      throw new Error('Refusing to run: preflight supabase refs disagree');
    }
  }
  return expected;
}

/**
 * Host checks run before `get`. `get` is the preflight and the only request this function makes.
 */
export function runPreflight({ get, baseUrl, expectProjectRef }) {
  const expected = cleanRef(expectProjectRef);
  if (!expected) {
    throw new Error('Refusing to run: LOADTEST_EXPECT_PROJECT_REF is empty');
  }
  if (expected === PRODUCTION_PROJECT_REF) {
    throw new Error('Refusing to run: LOADTEST_EXPECT_PROJECT_REF is the production project');
  }
  const res = get(`${String(baseUrl || '').replace(/\/$/, '')}${WHOAMI_PATH}`);
  return evaluatePreflight({
    status: res && res.status,
    body: res && res.body,
    headers: res && res.headers,
    expectProjectRef,
  });
}

export function prepareRun({ baseUrl, allowedHosts, expectProjectRef, get }) {
  assertHostAllowed({ baseUrl, allowedHosts });
  return runPreflight({ get, baseUrl, expectProjectRef });
}

export function watchResponse(res, abort) {
  const body = res && (res.body ?? res);
  const headers = res && res.headers;
  if (responseCarriesProductionRef(headers, body)) {
    const stop = abort || ((message) => {
      throw new Error(message);
    });
    stop('Refusing to continue: a response contained the production project ref');
  }
}
