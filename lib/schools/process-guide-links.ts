/**
 * Client-safe helpers for NSNP process guide PDF links.
 * Keep this free of pdfkit so client components can import it.
 */

export type ProcessGuideOrientation = 'landscape' | 'portrait';

export function processGuidePdfUrl(
  orientation: ProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/schools/process-guide/pdf?${q.toString()}`;
}
