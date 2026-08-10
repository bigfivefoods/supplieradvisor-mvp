/**
 * Client-safe helpers for PhysioAdvisor process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type PhysiographProcessGuideOrientation = 'landscape' | 'portrait';

export function physiographProcessGuidePdfUrl(
  orientation: PhysiographProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/clinic/physiograph/process-guide/pdf?${q.toString()}`;
}
