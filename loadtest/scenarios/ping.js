import { watchResponse, WHOAMI_PATH } from '../lib/guard.js';

/**
 * One request to the inert whoami route. Weighted application mixes are a later PR.
 * Every response is checked for the production project ref.
 */
export function ping({ http, baseUrl, abort }) {
  const res = http.get(`${String(baseUrl || '').replace(/\/$/, '')}${WHOAMI_PATH}`, {
    tags: { kind: 'public' },
  });
  watchResponse(res, abort);
  return res;
}
