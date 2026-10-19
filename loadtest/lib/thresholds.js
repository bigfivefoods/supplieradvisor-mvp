/** Pass bar from the scale brief, section 4, S1. Tagged read requests only. */
export function s1Thresholds() {
  return {
    'http_req_duration{kind:read}': ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.005'],
    dropped_iterations: ['count==0'],
  };
}

export function breakpointThresholds() {
  return {
    http_req_failed: [{ threshold: 'rate<0.02', abortOnFail: true }],
    'http_req_duration{kind:read}': [{ threshold: 'p(95)<3000', abortOnFail: true }],
    dropped_iterations: ['count==0'],
  };
}

/**
 * Brief 122 B4. Module-store RPC on one company: p95 under 1s, mean under 300ms,
 * no lock timeouts. Any non-2xx fails http_req_failed and the checks rate.
 */
export function moduleStorePutThresholds() {
  return {
    'http_req_duration{kind:module_store}': ['p(95)<1000', 'avg<300'],
    lock_timeouts: ['count==0'],
    http_req_failed: [{ threshold: 'rate==0', abortOnFail: true }],
    checks: [{ threshold: 'rate==1', abortOnFail: true }],
  };
}
