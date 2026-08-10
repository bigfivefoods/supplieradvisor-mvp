/**
 * Client-safe helpers for PsychiatryAdvisor process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type PsychiatrygraphProcessGuideOrientation = 'landscape' | 'portrait';

export function psychiatrygraphProcessGuidePdfUrl(
  orientation: PsychiatrygraphProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/clinic/psychiatrygraph/process-guide/pdf?${q.toString()}`;
}
