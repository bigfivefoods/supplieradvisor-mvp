/**
 * Content hash for NSNP audit packs (W5).
 * Uses Web Crypto when available; falls back to simple DJB2-style hex.
 */

export async function hashPayload(payload: unknown): Promise<string> {
  const text = JSON.stringify(payload);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const data = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      /* fall through */
    }
  }
  // Deterministic fallback hash
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 33) ^ text.charCodeAt(i);
  }
  return `djb2_${(h >>> 0).toString(16)}_${text.length}`;
}

export function publicToken(): string {
  const a = Math.random().toString(36).slice(2, 10);
  const b = Math.random().toString(36).slice(2, 10);
  return `nsnp_${a}${b}`;
}
