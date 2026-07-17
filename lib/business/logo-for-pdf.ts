/**
 * Ensure logos are PDF-embeddable (PNG/JPEG).
 * Client: convert WebP/SVG via canvas before upload.
 * Server: detect non-embeddable formats (conversion needs sharp — not required).
 */

/** True if URL/filename/mime suggests WebP or SVG (pdfkit cannot embed). */
export function isNonPdfLogoFormat(opts: {
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}): boolean {
  const blob = `${opts.url || ''} ${opts.fileName || ''} ${opts.mimeType || ''}`.toLowerCase();
  return (
    blob.includes('webp') ||
    blob.includes('svg') ||
    blob.includes('image/webp') ||
    blob.includes('image/svg')
  );
}

/**
 * Browser-only: draw image to canvas and export PNG File.
 * Returns null if conversion not possible (SSR / canvas failure).
 */
export async function convertImageFileToPng(
  file: File,
  opts?: { maxEdge?: number; quality?: number }
): Promise<File | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  const maxEdge = opts?.maxEdge ?? 1024;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return null;
    const base = file.name.replace(/\.[^.]+$/, '') || 'logo';
    return new File([blob], `${base}.png`, { type: 'image/png' });
  } catch {
    return null;
  }
}

/**
 * If file is WebP/SVG, convert to PNG for quote/invoice PDFs.
 * Passes through PNG/JPEG unchanged.
 */
export async function ensurePdfFriendlyLogoFile(file: File): Promise<{
  file: File;
  converted: boolean;
  warning?: string;
}> {
  const mime = file.type || '';
  const name = file.name || '';
  if (!isNonPdfLogoFormat({ fileName: name, mimeType: mime })) {
    return { file, converted: false };
  }
  const png = await convertImageFileToPng(file);
  if (!png) {
    return {
      file,
      converted: false,
      warning:
        'Could not convert logo to PNG. Quotes/invoices may show a monogram instead of the logo.',
    };
  }
  return {
    file: png,
    converted: true,
    warning: undefined,
  };
}
