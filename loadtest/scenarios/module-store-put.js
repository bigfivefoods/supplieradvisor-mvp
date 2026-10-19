import http from 'k6/http';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { assertHostAllowed, assertSupabaseRestUrl, runPreflight, watchResponse } from '../lib/guard.js';
import { moduleStorePutThresholds } from '../lib/thresholds.js';

/**
 * Brief 122 B4. Staging only. Twenty VUs call rpc/sa_put_module_store for one
 * company and one module, with token index keys.
 * The harness guard refuses production before any request. This file is not run in CI.
 */
const lockTimeouts = new Counter('lock_timeouts');

assertHostAllowed({ baseUrl: __ENV.BASE_URL, allowedHosts: __ENV.LOADTEST_ALLOWED_HOSTS });
const supabaseRef = assertSupabaseRestUrl({
  supabaseUrl: __ENV.LOADTEST_SUPABASE_URL,
  expectProjectRef: __ENV.LOADTEST_EXPECT_PROJECT_REF,
});

const companyId = String(__ENV.LOADTEST_COMPANY_ID || '');
if (!/^[1-9][0-9]*$/.test(companyId)) {
  throw new Error('Refusing to run: LOADTEST_COMPANY_ID must be a positive integer');
}
const moduleKey = String(__ENV.LOADTEST_MODULE || '');
if (!/^[a-z][a-z0-9_]*$/.test(moduleKey)) {
  throw new Error('Refusing to run: LOADTEST_MODULE must be a module key');
}
const serviceKey = __ENV.LOADTEST_SERVICE_ROLE_KEY;
if (!serviceKey) {
  throw new Error('Refusing to run: LOADTEST_SERVICE_ROLE_KEY is empty');
}

const token = 'loadtest-public-token';
const body = JSON.stringify({
  p_company_id: Number(companyId),
  p_module: moduleKey,
  p_data: { source: 'loadtest', updated_at: '2026-10-19T00:00:00.000Z' },
  p_indexes: {
    [`${moduleKey}_public_token`]: token,
    [`${moduleKey}_client_tokens`]: { loadtest: 'loadtest-client-token' },
  },
  p_public_token: token,
  p_if_updated_at: null,
});

export const options = {
  scenarios: {
    module_store_put: {
      executor: 'constant-vus',
      vus: 20,
      duration: '1m',
    },
  },
  thresholds: moduleStorePutThresholds(),
};

export function setup() {
  runPreflight({
    get: (url) => http.get(url, { tags: { kind: 'public' } }),
    baseUrl: __ENV.BASE_URL,
    expectProjectRef: supabaseRef,
  });
}

function noteLockTimeout(res) {
  const text = res && res.body != null ? String(res.body) : '';
  if (/55P03|lock timeout/i.test(text)) lockTimeouts.add(1);
}

export default function () {
  const base = String(__ENV.LOADTEST_SUPABASE_URL || '').replace(/\/$/, '');
  const res = http.post(`${base}/rest/v1/rpc/sa_put_module_store`, body, {
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    tags: { kind: 'module_store' },
  });
  watchResponse(res, (message) => exec.test.abort(message));
  noteLockTimeout(res);
  return res;
}
