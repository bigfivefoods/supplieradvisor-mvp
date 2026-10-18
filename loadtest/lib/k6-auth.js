/**
 * k6 wrapper. The signing key is read from __ENV and passed to the minter.
 * Do not print the key or the token.
 */
import crypto from 'k6/crypto';
import { mintLoadtestJwt, STAGING_PROJECT_REF } from '../../lib/loadtest/jwt.js';
import { parseLoadtestUsers, userForVu } from './seed-users.js';

function hmacSha256Hex(data, key) {
  return crypto.hmac('sha256', key, data, 'hex');
}

export function mintLoadtestToken(env, { sub, profileId, nonce, nowSeconds, ttlSeconds }) {
  const key = env && env.LOADTEST_SIGNING_KEY;
  if (typeof key !== 'string' || key.length < 32) {
    throw new Error('Refusing to mint: LOADTEST_SIGNING_KEY is not set');
  }
  const iat = nowSeconds;
  const exp = nowSeconds + ttlSeconds;
  return mintLoadtestJwt({
    key,
    sub,
    profileId,
    ref: STAGING_PROJECT_REF,
    nonce,
    iat,
    exp,
    hmacSha256Hex,
  });
}

export function tokenForVu(env, vu, nowSeconds) {
  const users = parseLoadtestUsers(env && env.LOADTEST_USERS);
  const user = userForVu(users, vu);
  const nonce = `k6-${String(vu)}-${String(nowSeconds)}-loadtest-nonce`.slice(0, 128);
  const token = mintLoadtestToken(env, {
    sub: user.sub,
    profileId: user.profileId,
    nonce,
    nowSeconds,
    ttlSeconds: 15 * 60,
  });
  return { user, token };
}
