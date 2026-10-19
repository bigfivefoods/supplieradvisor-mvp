import { SEEDED_USER_RE } from '../../lib/loadtest/jwt.js';

/**
 * The k6 scenarios use these seeded business_users ids.
 * profile_id is not a token claim and is not read here.
 * The signing key is never read here.
 */

export const SEEDED_USER_SLOTS = [
  { sub: 'loadtest-user-1-1', role: 'owner', companyOrdinal: 1 },
  { sub: 'loadtest-user-1-2', role: 'admin', companyOrdinal: 1 },
  { sub: 'loadtest-user-2-1', role: 'owner', companyOrdinal: 2 },
  { sub: 'loadtest-user-3-1', role: 'owner', companyOrdinal: 3 },
];

const USER_RE = SEEDED_USER_RE;

export function parseLoadtestUsers(raw) {
  if (raw == null || String(raw).trim() === '') {
    throw new Error('Refusing to run: LOADTEST_USERS is not set');
  }
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    throw new Error('Refusing to run: LOADTEST_USERS is not JSON');
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > SEEDED_USER_SLOTS.length) {
    throw new Error('Refusing to run: LOADTEST_USERS must list the mapped seeded users');
  }
  return parsed.map((row, index) => {
    const sub = row && typeof row.sub === 'string' ? row.sub : '';
    if (!USER_RE.test(sub)) {
      throw new Error(`Refusing to run: LOADTEST_USERS[${index}] subject is not a seeded user`);
    }
    const slot = SEEDED_USER_SLOTS.find((item) => item.sub === sub);
    if (!slot) {
      throw new Error(`Refusing to run: LOADTEST_USERS[${index}] is not one of the mapped seeded users`);
    }
    return { sub, role: slot.role, companyOrdinal: slot.companyOrdinal };
  });
}

export function userForVu(users, vu) {
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('Refusing to run: no seeded users were provided');
  }
  const n = Number(vu);
  const i = (Number.isFinite(n) ? Math.abs(Math.trunc(n)) : 0) % users.length;
  return users[i];
}
