/**
 * Client-safe helpers for Fieldgraph process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type FieldgraphProcessGuideOrientation = 'landscape' | 'portrait';

export function fieldgraphProcessGuidePdfUrl(
  orientation: FieldgraphProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/agri/fieldgraph/process-guide/pdf?${q.toString()}`;
}
