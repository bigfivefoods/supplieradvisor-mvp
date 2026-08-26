/**
 * Client-safe helpers for VetAdvisor process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type VetgraphProcessGuideOrientation = 'landscape' | 'portrait';

export function vetgraphProcessGuidePdfUrl(
  orientation: VetgraphProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/clinic/vetgraph/process-guide/pdf?${q.toString()}`;
}
