import http from 'k6/http';
import exec from 'k6/execution';
import { assertHostAllowed, runPreflight } from '../lib/guard.js';
import { s1Thresholds } from '../lib/thresholds.js';
import { ping } from '../scenarios/ping.js';

assertHostAllowed({ baseUrl: __ENV.BASE_URL, allowedHosts: __ENV.LOADTEST_ALLOWED_HOSTS });

export const options = {
  scenarios: {
    step: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 3000,
      stages: [
        { target: 50, duration: '2m' },
        { target: 50, duration: '10m' },
        { target: 100, duration: '2m' },
        { target: 100, duration: '10m' },
        { target: 160, duration: '2m' },
        { target: 160, duration: '10m' },
        { target: 250, duration: '2m' },
        { target: 250, duration: '10m' },
        { target: 400, duration: '2m' },
        { target: 400, duration: '10m' },
        { target: 600, duration: '2m' },
        { target: 600, duration: '10m' },
        { target: 1000, duration: '2m' },
        { target: 1000, duration: '10m' },
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
