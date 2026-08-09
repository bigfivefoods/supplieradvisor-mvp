/**
 * Client-safe helpers for Quarrygraph process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type QuarrygraphProcessGuideOrientation = 'landscape' | 'portrait';

export function quarrygraphProcessGuidePdfUrl(
  orientation: QuarrygraphProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/quarry/quarrygraph/process-guide/pdf?${q.toString()}`;
}
