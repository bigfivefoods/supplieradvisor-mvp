import http from 'k6/http';
import exec from 'k6/execution';
import { assertHostAllowed, runPreflight } from '../lib/guard.js';
import { breakpointThresholds } from '../lib/thresholds.js';
import { ping } from '../scenarios/ping.js';

assertHostAllowed({ baseUrl: __ENV.BASE_URL, allowedHosts: __ENV.LOADTEST_ALLOWED_HOSTS });

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 3000,
      stages: [
        { target: 50, duration: '2m' },
        { target: 160, duration: '5m' },
        { target: 400, duration: '5m' },
        { target: 1000, duration: '5m' },
        { target: 1500, duration: '5m' },
      ],
    },
  },
  thresholds: breakpointThresholds(),
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
