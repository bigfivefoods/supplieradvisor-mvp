/**
 * HMAC-SHA256 JWT for the staging load-test sign-in.
 * The HMAC function is injected so Node and k6 can share this file.
 * This file does not read the environment and does not log the key.
 */

export const STAGING_PROJECT_REF = 'wpchtkfkaavcjyfgmktn';
export const MAX_TTL_SECONDS = 3600;
/**
 * Subjects the seed writes: company ordinal 1–5000 and user index 1–20.
 * That is the seed cap (5,000 companies, at most 20 users on a company).
 */
export const SEEDED_USER_RE =
  /^loadtest-user-(?:[1-9]|[1-9]\d|[1-9]\d{2}|[1-4]\d{3}|5000)-(?:[1-9]|1\d|20)$/;

/** Trimmed key with at least 32 non-whitespace characters, or ''. */
export function usableSigningKey(key) {
  if (typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.replace(/\s/g, '').length < 32) return '';
  return trimmed;
}

function isSeededSubject(sub) {
  return typeof sub === 'string' && SEEDED_USER_RE.test(sub);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(text) {
  return new TextEncoder().encode(String(text));
}

function bytesToString(bytes) {
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += ALPHABET[(triple >> 18) & 63];
    out += ALPHABET[(triple >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(triple >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[triple & 63];
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bytes = [];
  for (let i = 0; i < b64.length; i += 4) {
    const c0 = ALPHABET.indexOf(b64[i]);
    const c1 = ALPHABET.indexOf(b64[i + 1]);
    const c2 = b64[i + 2] === '=' ? -1 : ALPHABET.indexOf(b64[i + 2]);
    const c3 = b64[i + 3] === '=' ? -1 : ALPHABET.indexOf(b64[i + 3]);
    if (c0 < 0 || c1 < 0 || (b64[i + 2] !== '=' && c2 < 0) || (b64[i + 3] !== '=' && c3 < 0)) return null;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 3) << 6) | c3);
  }
  return new Uint8Array(bytes);
}

function encodeJson(value) {
  return base64UrlEncode(utf8Bytes(JSON.stringify(value)));
}

function decodeJson(segment) {
  const bytes = base64UrlDecode(segment);
  if (!bytes) return null;
  try {
    return JSON.parse(bytesToString(bytes));
  } catch {
    return null;
  }
}

function hexToBase64Url(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return '';
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return base64UrlEncode(bytes);
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function fail(code) {
  return { ok: false, code };
}

function isInt(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function mintLoadtestJwt({ key, sub, ref, nonce, iat, exp, hmacSha256Hex }) {
  if (typeof hmacSha256Hex !== 'function') throw new Error('Refusing to mint: hmac is missing');
  const signingKey = usableSigningKey(key);
  if (!signingKey) throw new Error('Refusing to mint: signing key is too short');
  if (!isSeededSubject(sub)) throw new Error('Refusing to mint: subject is not a seeded user');
  if (ref !== STAGING_PROJECT_REF) throw new Error('Refusing to mint: ref is not the staging project');
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(String(nonce || ''))) throw new Error('Refusing to mint: nonce must be 16 to 128 url-safe characters');
  if (!isInt(iat) || !isInt(exp) || exp <= iat || exp - iat > MAX_TTL_SECONDS) {
    throw new Error('Refusing to mint: exp must be within 1 hour of iat');
  }
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({
    sub,
    ref,
    nonce,
    iat,
    exp,
  });
  const signingInput = `${header}.${payload}`;
  const signature = hexToBase64Url(hmacSha256Hex(signingInput, signingKey));
  if (signature.length !== 43) throw new Error('Refusing to mint: signature was not produced');
  return `${signingInput}.${signature}`;
}

export function verifyLoadtestJwt({ token, key, now, hmacSha256Hex }) {
  if (typeof hmacSha256Hex !== 'function') return fail('NO_HMAC');
  const signingKey = usableSigningKey(key);
  if (!signingKey) return fail('NO_KEY');
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return fail('MALFORMED');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart);
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return fail('BAD_HEADER');
  if (signaturePart.length !== 43) return fail('BAD_SIGNATURE');
  const expected = hexToBase64Url(hmacSha256Hex(`${headerPart}.${payloadPart}`, signingKey));
  if (!expected || !constantTimeEqual(expected, signaturePart)) return fail('BAD_SIGNATURE');
  const payload = decodeJson(payloadPart);
  if (!payload || typeof payload !== 'object') return fail('BAD_PAYLOAD');
  if (!isSeededSubject(payload.sub)) return fail('BAD_SUBJECT');
  if (payload.ref !== STAGING_PROJECT_REF) return fail('WRONG_REF');
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(String(payload.nonce || ''))) return fail('BAD_NONCE');
  if (!isInt(payload.iat) || !isInt(payload.exp)) return fail('BAD_EXP');
  if (payload.exp <= payload.iat || payload.exp - payload.iat > MAX_TTL_SECONDS) return fail('BAD_EXP');
  if (!isInt(now)) return fail('BAD_EXP');
  if (payload.iat > now + 60) return fail('BAD_EXP');
  if (payload.exp > now + MAX_TTL_SECONDS) return fail('BAD_EXP');
  if (payload.exp <= now) return fail('EXPIRED');
  return {
    ok: true,
    sub: payload.sub,
    nonce: payload.nonce,
    exp: payload.exp,
  };
}
