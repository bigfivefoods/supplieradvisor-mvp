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
