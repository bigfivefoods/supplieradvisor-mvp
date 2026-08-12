/**
 * Client-safe helpers for GymAdvisor process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type FitgraphProcessGuideOrientation = 'landscape' | 'portrait';

export function fitgraphProcessGuidePdfUrl(
  orientation: FitgraphProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/fitness/fitgraph/process-guide/pdf?${q.toString()}`;
}
