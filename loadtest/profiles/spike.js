import http from 'k6/http';
import exec from 'k6/execution';
import { assertHostAllowed, runPreflight } from '../lib/guard.js';
import { s1Thresholds } from '../lib/thresholds.js';
import { ping } from '../scenarios/ping.js';

assertHostAllowed({ baseUrl: __ENV.BASE_URL, allowedHosts: __ENV.LOADTEST_ALLOWED_HOSTS });

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 3000,
      stages: [
        { target: 160, duration: '60s' },
        { target: 160, duration: '2m' },
        { target: 0, duration: '30s' },
        { target: 320, duration: '60s' },
        { target: 320, duration: '2m' },
      ],
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
