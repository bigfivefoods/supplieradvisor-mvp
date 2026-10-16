/**
 * Catalogue download counts via the Vercel Web Analytics server SDK
 * already mounted in the app. The event carries the catalogue id only.
 * The visitor address, session, and user-agent are not forwarded.
 */
import { track } from '@vercel/analytics/server';
import { catalogueById } from '@/lib/catalogues';
import { isBotUa } from '@/lib/insights/visitor';

export const CATALOGUE_DOWNLOAD_EVENT = 'catalogue_download';

/**
 * Headers passed into `track`. A fixed label so the SDK does not fall
 * through to the request context (which would attach the visitor address
 * and session). This is not an event property.
 */
export const CATALOGUE_DOWNLOAD_TRACK_HEADERS: Record<string, string> = {
  'user-agent': 'catalogue-download',
};

/** Bound so a hung analytics request cannot hold the PDF redirect. */
export const CATALOGUE_DOWNLOAD_TRACK_TIMEOUT_MS = 500;

type TrackFn = typeof track;

/** Count a real browser GET. HEAD, missing, short, and known bot agents are skipped. */
export function shouldRecordCatalogueDownload(input: {
  method: string;
  userAgent: string | null;
}): boolean {
  if (input.method !== 'GET') return false;
  return !isBotUa(input.userAgent);
}

export async function recordCatalogueDownload(id: string, send: TrackFn = track): Promise<void> {
  const entry = catalogueById(id);
  if (!entry || entry.status !== 'available' || !entry.file) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, CATALOGUE_DOWNLOAD_TRACK_TIMEOUT_MS);
    });
    await Promise.race([
      send(CATALOGUE_DOWNLOAD_EVENT, { id: entry.id }, { headers: CATALOGUE_DOWNLOAD_TRACK_HEADERS }),
      timeout,
    ]);
  } catch {
    // A tracking failure must not change the download response.
  } finally {
    if (timer) clearTimeout(timer);
  }
}
