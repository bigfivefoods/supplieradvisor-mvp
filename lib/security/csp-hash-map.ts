/**
 * Build-time map of inline script hashes, keyed by pathname.
 * The placeholder is replaced in the built middleware bundle.
 * Until that replacement, every lookup is empty and dynamic renders
 * rely on the per-request nonce.
 */

/**
 * This string literal is rewritten after `next build`.
 * It must stay a single token: the patch replaces every copy, so the
 * empty-map check cannot compare against the same token.
 */
export const CSP_HASH_MAP_B64 = '__CSP_HASH_MAP__';

const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]+=*'$/;

export function normalizeCspPath(pathname: string): string {
  const raw = String(pathname || '/')
    .split('?')[0]
    .split('#')[0];
  if (!raw.startsWith('/')) return '/';
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1);
  return raw || '/';
}

function decodeBase64Utf8(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeScriptHashMap(encoded: string): Record<string, string[]> {
  // The placeholder is 16 characters. A real map is much longer. Do not
  // compare against the placeholder text: the build patch replaces every copy.
  if (!encoded || encoded.length < 32) return {};
  try {
    const parsed = JSON.parse(decodeBase64Utf8(encoded)) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const hashes = value.filter(
        (item): item is string => typeof item === 'string' && HASH_SOURCE.test(item)
      );
      if (!hashes.length) continue;
      out[normalizeCspPath(key)] = hashes;
    }
    return out;
  } catch {
    return {};
  }
}

export function scriptHashesForPath(pathname: string, encoded = CSP_HASH_MAP_B64): string[] {
  const map = decodeScriptHashMap(encoded);
  const path = normalizeCspPath(pathname);
  const specific = map[path];
  if (specific?.length) return specific;
  return map['/404'] || [];
}
