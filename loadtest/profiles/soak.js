import http from 'k6/http';
import exec from 'k6/execution';
import { assertHostAllowed, runPreflight } from '../lib/guard.js';
import { s1Thresholds } from '../lib/thresholds.js';
import { ping } from '../scenarios/ping.js';

assertHostAllowed({ baseUrl: __ENV.BASE_URL, allowedHosts: __ENV.LOADTEST_ALLOWED_HOSTS });

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-arrival-rate',
      rate: 160,
      timeUnit: '1s',
      duration: '4h',
      preAllocatedVUs: 200,
      maxVUs: 3000,
    },
  },
  thresholds: s1Thresholds(),
};

export function setup() {
  runPreflight({
    get: (url) => http.get(url, { tags: { kind: 'public' } }),
    baseUrl: __ENV.BASE_URL,
    expectProjectRef: __ENV.LOADTEST_EXPECT_PROJECT_REF,
  });
}

export default function () {
  ping({
    http,
    baseUrl: __ENV.BASE_URL,
    abort: (message) => exec.test.abort(message),
  });
}
