/**
 * Client-safe HireAdvisor process guide links (no pdfkit).
 */

export type HiregraphProcessGuideOrientation = 'landscape' | 'portrait';

export function hiregraphProcessGuidePdfHref(
  orientation: HiregraphProcessGuideOrientation = 'landscape'
): string {
  return `/api/hire/hiregraph/process-guide/pdf?orientation=${orientation}`;
}

export const HIREGRAPH_PROCESS_GUIDE_LANDSCAPE_HREF =
  hiregraphProcessGuidePdfHref('landscape');
export const HIREGRAPH_PROCESS_GUIDE_PORTRAIT_HREF =
  hiregraphProcessGuidePdfHref('portrait');
