/**
 * Last login / invited timestamps for portal people and company groups.
 */

export function portalTimeAgo(
  iso?: string | null,
  nowMs = Date.now()
): string | null {
  if (!iso) return null;
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  if (ms < 45_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso.slice(0, 10);
  }
}

export function portalWhen(iso?: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return new Date(t).toLocaleString();
  } catch {
    return iso;
  }
}

export function latestPortalLogin(
  viewers: Array<{ last_seen_at?: string | null; name?: string | null }>
): { at: string; name: string } | null {
  let best: { at: string; name: string; ms: number } | null = null;
  for (const v of viewers) {
    if (!v.last_seen_at) continue;
    const ms = Date.parse(v.last_seen_at);
    if (!Number.isFinite(ms)) continue;
    if (!best || ms > best.ms) {
      best = { at: v.last_seen_at, name: String(v.name || 'Someone'), ms };
    }
  }
  return best ? { at: best.at, name: best.name } : null;
}

export function firstPortalInvite(
  viewers: Array<{ invited_at?: string | null }>
): string | null {
  let best: { at: string; ms: number } | null = null;
  for (const v of viewers) {
    if (!v.invited_at) continue;
    const ms = Date.parse(v.invited_at);
    if (!Number.isFinite(ms)) continue;
    if (!best || ms < best.ms) best = { at: v.invited_at, ms };
  }
  return best?.at || null;
}
