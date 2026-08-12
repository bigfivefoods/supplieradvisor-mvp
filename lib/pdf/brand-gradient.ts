/**
 * Shared blue → teal brand gradient for PDF headers.
 * Single source of truth for management reports and e2e process guide PDFs.
 * Strip-based horizontal gradient (pdfkit has no native multi-stop gradients).
 */
import type PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;
type Rgb = { r: number; g: number; b: number };

/** Management report hero stops (left → right). */
export const BRAND_HERO_STOPS: Array<{ t: number; color: string }> = [
  { t: 0, color: '#005f8a' }, // deep ocean blue
  { t: 0.22, color: '#0077b6' },
  { t: 0.48, color: '#0891b2' },
  { t: 0.72, color: '#00b4d8' },
  { t: 0.9, color: '#2dd4bf' },
  { t: 1, color: '#5eead4' }, // light teal
];

export const BRAND_EDGE_STOPS: Array<{ t: number; color: string }> = [
  { t: 0, color: '#67e8f9' },
  { t: 0.5, color: '#5eead4' },
  { t: 1, color: '#99f6e4' },
];

/** ~4.2 mm — brand text below typical printer non-printable edge */
export const BRAND_SAFE_TOP = 12;

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixRgb(a: Rgb, b: Rgb, t: number): string {
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const bl = Math.round(a.b + (b.b - a.b) * u);
  return (
    '#' +
    [r, g, bl]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Horizontal multi-stop gradient via overlapping vertical strips.
 * Identical algorithm for management + process PDFs.
 */
export function fillBrandHGradient(
  pdf: PdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  stops: Array<{ t: number; color: string }> = BRAND_HERO_STOPS,
  steps = 120
) {
  const sorted = [...stops].sort((a, b) => a.t - b.t);
  if (sorted.length < 2 || w <= 0 || h <= 0) return;

  // Ensure prior fillOpacity never mutes solid strip fills
  try {
    pdf.fillOpacity(1);
  } catch {
    /* soft */
  }

  const stripW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    let c0 = sorted[0];
    let c1 = sorted[sorted.length - 1];
    for (let s = 0; s < sorted.length - 1; s++) {
      if (t >= sorted[s].t && t <= sorted[s + 1].t) {
        c0 = sorted[s];
        c1 = sorted[s + 1];
        break;
      }
    }
    const span = Math.max(1e-6, c1.t - c0.t);
    const local = (t - c0.t) / span;
    const color = mixRgb(hexToRgb(c0.color), hexToRgb(c1.color), local);
    // slight overlap avoids hairline gaps between strips
    pdf.rect(x + i * stripW, y, stripW + 0.6, h).fill(color);
  }
}

export type BrandHeroBandOpts = {
  /** Content band height below SAFE_TOP (management landscape = 40) */
  innerH?: number;
  /** Left inset for brand chip */
  mx?: number;
  /** Decorative glass orbs + top sheen (management report style) */
  glass?: boolean;
};

/**
 * Full-bleed management-report hero band.
 * Uses page.width so landscape A4 always spans the full sheet.
 * Returns total hero height (SAFE_TOP + innerH).
 */
export function paintBrandHeroBand(
  pdf: PdfDoc,
  opts?: BrandHeroBandOpts
): number {
  const SAFE = BRAND_SAFE_TOP;
  const innerH = opts?.innerH ?? 40;
  const mx = opts?.mx ?? 20;
  const glass = opts?.glass !== false;
  const pageW = pdf.page.width;
  const heroH = SAFE + innerH;

  // Full-bleed: zero margins while painting (management report does this permanently)
  const page = pdf.page;
  const saved = {
    top: page.margins.top,
    bottom: page.margins.bottom,
    left: page.margins.left,
    right: page.margins.right,
  };
  page.margins.top = 0;
  page.margins.bottom = 0;
  page.margins.left = 0;
  page.margins.right = 0;

  try {
    // Main blue → teal (left → right) — full page width
    fillBrandHGradient(pdf, 0, 0, pageW, heroH, BRAND_HERO_STOPS, 120);

    if (glass) {
      // Subtle top sheen (same as management report)
      pdf
        .rect(0, 0, pageW, SAFE + 4)
        .fillOpacity(0.1)
        .fill('#ffffff')
        .fillOpacity(1);
    }

    // Soft bottom edge blend into page
    fillBrandHGradient(pdf, 0, heroH - 3.5, pageW, 3.5, BRAND_EDGE_STOPS, 64);

    if (glass) {
      // Decorative glass orbs (right side — over lighter teal)
      pdf
        .circle(pageW - 56, SAFE + 10, 22)
        .fillOpacity(0.14)
        .fill('#ffffff')
        .fillOpacity(1);
      pdf
        .circle(pageW - 22, SAFE + 22, 14)
        .fillOpacity(0.12)
        .fill('#ffffff')
        .fillOpacity(1);
      pdf
        .circle(pageW - 90, SAFE + 24, 8)
        .fillOpacity(0.1)
        .fill('#ffffff')
        .fillOpacity(1);
    } else {
      // Solid teal accents when glass would wash out on some printers
      pdf.circle(pageW - 56, SAFE + 12, 18).fill('#5eead4');
      pdf.circle(pageW - 56, SAFE + 12, 14).fill('#2dd4bf');
      pdf.circle(pageW - 24, SAFE + 26, 11).fill('#99f6e4');
      pdf.circle(pageW - 24, SAFE + 26, 7).fill('#5eead4');
      pdf.circle(pageW - 88, SAFE + 28, 6).fill('#67e8f9');
    }

    // Brand mark chip
    pdf
      .roundedRect(mx, SAFE + 6, 3.5, Math.min(24, innerH - 6), 1.5)
      .fillOpacity(0.95)
      .fill('#ffffff')
      .fillOpacity(1);
  } finally {
    page.margins.top = saved.top;
    page.margins.bottom = saved.bottom;
    page.margins.left = saved.left;
    page.margins.right = saved.right;
  }

  return heroH;
}
