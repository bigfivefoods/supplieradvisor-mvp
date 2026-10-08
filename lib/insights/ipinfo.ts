import { factsFromIpinfo, isPublicIp, type InsightEvent } from './visitor';

function companyObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  if (row.company && typeof row.company === 'object') return row.company as Record<string, unknown>;
  if (typeof row.name === 'string' || typeof row.type === 'string') return row;
  return null;
}

export type NetworkFacts = Pick<
  InsightEvent,
  'country' | 'region' | 'city' | 'timezone' | 'organisation' | 'industry' | 'size' | 'network'
>;

/**
 * Server-side IPinfo lookup. The address is used only as the request key and
 * is not returned, logged, or written onto the event.
 * Without IPINFO_TOKEN this returns an empty object.
 */
export async function lookupNetwork(
  ip: string | null | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<NetworkFacts> {
  const token = String(process.env.IPINFO_TOKEN || '').trim();
  if (!token || !ip || !isPublicIp(ip)) return {};

  const headers = { Accept: 'application/json' };
  const encoded = encodeURIComponent(ip);
  const tokenQuery = `token=${encodeURIComponent(token)}`;
  try {
    const [geoRes, companyRes] = await Promise.all([
      fetchImpl(`https://ipinfo.io/${encoded}/json?${tokenQuery}`, { headers, cache: 'no-store' }),
      fetchImpl(`https://ipinfo.io/${encoded}/company?${tokenQuery}`, { headers, cache: 'no-store' }),
    ]);
    const geo = geoRes.ok ? await geoRes.json() : null;
    const companyPayload = companyRes.ok ? await companyRes.json() : null;
    const company = companyObject(companyPayload);
    const merged =
      geo && typeof geo === 'object'
        ? { ...(geo as Record<string, unknown>), ...(company ? { company } : {}) }
        : company
          ? { company }
          : null;
    return factsFromIpinfo(merged);
  } catch {
    return {};
  }
}
