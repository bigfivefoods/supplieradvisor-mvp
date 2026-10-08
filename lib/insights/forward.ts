import { DEFAULT_INGEST_URL, batchContainsRawIp, type InsightsBatch } from './visitor';

/** Production forwards unless explicitly disabled. Tests and local dev do not. */
export function shouldForwardInsights(): boolean {
  const flag = String(process.env.WEBSITE_INSIGHTS_FORWARD || '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  return process.env.VERCEL_ENV === 'production';
}

export function insightsIngestUrl(): string {
  const configured = String(process.env.WEBSITE_INSIGHTS_INGEST_URL || '').trim();
  if (configured) return configured;
  return DEFAULT_INGEST_URL;
}

/**
 * Send one batch to the existing Website Insights collector.
 * Throws if the batch still contains an address field, so a bug cannot store one.
 */
export async function forwardInsights(
  batch: InsightsBatch,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (!shouldForwardInsights()) return;
  if (batchContainsRawIp(batch)) {
    throw new Error('Refusing to forward a Website Insights batch that contains an address');
  }
  const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
  const key = String(process.env.WEBSITE_INSIGHTS_INGEST_KEY || '').trim();
  if (key) headers['x-insights-key'] = key;
  await fetchImpl(insightsIngestUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(batch),
    cache: 'no-store',
  });
}
