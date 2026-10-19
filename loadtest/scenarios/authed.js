import { watchResponse } from '../lib/guard.js';
import { tokenForVu } from '../lib/k6-auth.js';

/**
 * Authenticated probe. Uses a few seeded users from LOADTEST_USERS.
 * The signing key stays in the environment. This scenario does not log it.
 */
export function authedSession({ http, baseUrl, env, vu, nowSeconds, abort }) {
  const { token } = tokenForVu(env, vu, nowSeconds);
  const res = http.get(`${String(baseUrl || '').replace(/\/$/, '')}/api/loadtest/session`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { kind: 'authed' },
  });
  watchResponse(res, abort);
  return res;
}
