/**
 * Synthetic users are supplied at run time. This file holds none.
 */

export function pickUser(users, index) {
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('Refusing to run: no synthetic users were provided');
  }
  const n = Number(index);
  const i = (Number.isFinite(n) ? Math.abs(Math.trunc(n)) : 0) % users.length;
  return users[i];
}
