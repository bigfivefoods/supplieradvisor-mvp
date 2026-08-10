/**
 * Client-safe helpers for Dentalgraph process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type DentalgraphProcessGuideOrientation = 'landscape' | 'portrait';

export function dentalgraphProcessGuidePdfUrl(
  orientation: DentalgraphProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/dental/dentalgraph/process-guide/pdf?${q.toString()}`;
}
