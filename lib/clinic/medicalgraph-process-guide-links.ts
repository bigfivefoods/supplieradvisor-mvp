/**
 * Client-safe helpers for MedicalAdvisor process guide PDF links.
 * Keep free of pdfkit so client components can import it.
 */

export type MedicalgraphProcessGuideOrientation = 'landscape' | 'portrait';

export function medicalgraphProcessGuidePdfUrl(
  orientation: MedicalgraphProcessGuideOrientation,
  opts?: { download?: boolean }
): string {
  const q = new URLSearchParams();
  q.set('orientation', orientation);
  if (opts?.download) q.set('download', '1');
  return `/api/clinic/medicalgraph/process-guide/pdf?${q.toString()}`;
}
