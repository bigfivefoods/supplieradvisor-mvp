import {
  DEFAULT_INGEST_URL,
  batchContainsEmail,
  batchContainsRawIp,
  type InsightsBatch,
} from './visitor';

/**
 * The Big Five Group collector on main. Hardcoded so production does not need a URL env var.
 */
export function insightsIngestUrl(): string {
  return DEFAULT_INGEST_URL;
}

/**
 * Send one batch to https://bigfivegroup.africa/api/insights/collect.
 * The header is `x-insights-key` from `INSIGHTS_INGEST_KEY` (already on the
 * supplieradvisor-mvp Vercel project). A missing key, an unsafe batch, or a
 * network error drops the batch and never throws.
 */
export async function forwardInsights(
  batch: InsightsBatch,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const key = String(process.env.INSIGHTS_INGEST_KEY || '').trim();
  if (!key) return;
  if (batchContainsRawIp(batch) || batchContainsEmail(batch)) return;
  try {
    await fetchImpl(insightsIngestUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'x-insights-key': key,
      },
      body: JSON.stringify(batch),
      cache: 'no-store',
    });
  } catch {
    // Drop. Never log the key, the payload, or an address.
  }
}
