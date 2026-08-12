/**
 * Shared chrome for Advisor / SchoolAdvisor end-to-end process design PDFs.
 * Blue → teal gradient heroes (matches management report), print-safe insets,
 * legible section chrome. Pure pdfkit — Vercel serverless safe.
 */
import type PDFDocument from 'pdfkit';

export type ProcessGuidePdfDoc = InstanceType<typeof PDFDocument>;

export type ProcessGuideGeo = {
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

/** ~4.2 mm — keeps brand text out of printer non-printable edge */
export const PROCESS_SAFE_TOP = 12;

export const PROCESS_PDF = {
  brand: '#00b4d8',
  brandDeep: '#0077b6',
  brandMid: '#0891b2',
  brandTeal: '#5eead4',
  brandTealMid: '#2dd4bf',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  soft: '#f8fafc',
  white: '#ffffff',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  violet: '#7c3aed',
} as const;

type Rgb = { r: number; g: number; b: number };

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

/** Horizontal multi-stop gradient via thin vertical strips (pdfkit has no native gradients). */
export function fillHGradient(
  doc: ProcessGuidePdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  stops: Array<{ t: number; color: string }>,
  steps = 96
) {
  const sorted = [...stops].sort((a, b) => a.t - b.t);
  if (sorted.length < 2 || w <= 0 || h <= 0) return;
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
    doc.rect(x + i * stripW, y, stripW + 0.6, h).fill(color);
  }
}

export function withOpenMargins(doc: ProcessGuidePdfDoc, fn: () => void) {
  const page = doc.page;
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
    fn();
  } finally {
    page.margins.top = saved.top;
    page.margins.bottom = saved.bottom;
    page.margins.left = saved.left;
    page.margins.right = saved.right;
  }
}

/** Soft cool wash under content (legibility + polish). */
export function drawProcessPageWash(doc: ProcessGuidePdfDoc, g: ProcessGuideGeo) {
  withOpenMargins(doc, () => {
    fillHGradient(
      doc,
      0,
      0,
      g.pageW,
      g.pageH,
      [
        { t: 0, color: '#f0f9ff' },
        { t: 0.55, color: '#f8fafc' },
        { t: 1, color: '#f0fdfa' },
      ],
      40
    );
  });
}

export type ProcessHeroOpts = {
  /** e.g. SCHOOLADVISOR® · END-TO-END PROCESS */
  eyebrow: string;
  /** Main title line */
  title: string;
  /** Optional subtitle / blurb */
  subtitle?: string;
  /** Landscape packs subtitle to the right of title when set */
  sideNote?: string;
  landscape?: boolean;
};

/**
 * Blue → teal gradient hero. Returns content start Y below the band.
 * Text sits below PROCESS_SAFE_TOP for print safety.
 */
export function drawProcessGuideHero(
  doc: ProcessGuidePdfDoc,
  g: ProcessGuideGeo,
  opts: ProcessHeroOpts
): number {
  const landscape = opts.landscape ?? g.isLandscape;
  const innerH = landscape ? 38 : 52;
  const heroH = PROCESS_SAFE_TOP + innerH;

  withOpenMargins(doc, () => {
    fillHGradient(
      doc,
      0,
      0,
      g.pageW,
      heroH,
      [
        { t: 0, color: '#005f8a' },
        { t: 0.22, color: PROCESS_PDF.brandDeep },
        { t: 0.48, color: PROCESS_PDF.brandMid },
        { t: 0.72, color: PROCESS_PDF.brand },
        { t: 0.9, color: PROCESS_PDF.brandTealMid },
        { t: 1, color: PROCESS_PDF.brandTeal },
      ],
      110
    );
    // top sheen
    doc
      .rect(0, 0, g.pageW, PROCESS_SAFE_TOP + 3)
      .fillOpacity(0.1)
      .fill('#ffffff')
      .fillOpacity(1);
    // bottom edge glow
    fillHGradient(
      doc,
      0,
      heroH - 3,
      g.pageW,
      3,
      [
        { t: 0, color: '#67e8f9' },
        { t: 0.5, color: '#5eead4' },
        { t: 1, color: '#99f6e4' },
      ],
      48
    );
    // soft orbs
    doc
      .circle(g.pageW - 52, PROCESS_SAFE_TOP + 10, 20)
      .fillOpacity(0.12)
      .fill('#ffffff')
      .fillOpacity(1);
    doc
      .circle(g.pageW - 20, PROCESS_SAFE_TOP + 24, 12)
      .fillOpacity(0.1)
      .fill('#ffffff')
      .fillOpacity(1);

    const ty = PROCESS_SAFE_TOP + 3;
    // accent chip
    doc.roundedRect(g.mx, ty + 2, 3.2, landscape ? 26 : 36, 1.5).fill('#ffffff');

    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#ecfeff');
    doc.text(opts.eyebrow.toUpperCase(), g.mx + 10, ty, {
      width: g.contentW - 12,
      lineBreak: false,
      ellipsis: true,
    });

    doc
      .font('Helvetica-Bold')
      .fontSize(landscape ? 12.5 : 12)
      .fillColor('#ffffff');
    if (landscape && opts.sideNote) {
      doc.text(opts.title, g.mx + 10, ty + 12, {
        width: g.contentW * 0.62,
        height: 22,
        lineBreak: true,
        ellipsis: true,
      });
      doc.font('Helvetica').fontSize(7).fillColor('#f0fdfa');
      doc.text(opts.sideNote, g.mx + g.contentW * 0.64, ty + 12, {
        width: g.contentW * 0.34,
        height: 24,
        lineBreak: true,
        ellipsis: true,
      });
    } else {
      doc.text(opts.title, g.mx + 10, ty + 12, {
        width: g.contentW - 12,
        height: 18,
        lineBreak: true,
        ellipsis: true,
      });
      if (opts.subtitle) {
        doc.font('Helvetica').fontSize(7.5).fillColor('#ecfeff');
        doc.text(opts.subtitle, g.mx + 10, ty + 32, {
          width: g.contentW - 12,
          height: 16,
          lineBreak: true,
          ellipsis: true,
        });
      }
    }
  });

  return heroH + 8;
}

/**
 * Page 2+ header band — same blue→teal language, shorter.
 * Returns Y below header for content.
 */
export function drawProcessGuidePageHeader(
  doc: ProcessGuidePdfDoc,
  g: ProcessGuideGeo,
  opts: { eyebrow: string; title: string; landscape?: boolean }
): number {
  const landscape = opts.landscape ?? g.isLandscape;
  const innerH = landscape ? 24 : 32;
  const headH = PROCESS_SAFE_TOP + innerH;

  withOpenMargins(doc, () => {
    fillHGradient(
      doc,
      0,
      0,
      g.pageW,
      headH,
      [
        { t: 0, color: '#005f8a' },
        { t: 0.35, color: PROCESS_PDF.brandDeep },
        { t: 0.7, color: PROCESS_PDF.brand },
        { t: 1, color: PROCESS_PDF.brandTealMid },
      ],
      90
    );
    fillHGradient(
      doc,
      0,
      headH - 2.5,
      g.pageW,
      2.5,
      [
        { t: 0, color: '#67e8f9' },
        { t: 1, color: '#5eead4' },
      ],
      32
    );

    const ty = PROCESS_SAFE_TOP + 2;
    doc.roundedRect(g.mx, ty + 1, 3, landscape ? 16 : 22, 1).fill('#ffffff');
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#ecfeff');
    doc.text(opts.eyebrow.toUpperCase(), g.mx + 10, ty, {
      width: g.contentW - 12,
      lineBreak: false,
      ellipsis: true,
    });
    doc
      .font('Helvetica-Bold')
      .fontSize(landscape ? 10 : 11)
      .fillColor('#ffffff');
    doc.text(opts.title, g.mx + 10, ty + 10, {
      width: g.contentW - 12,
      height: 16,
      lineBreak: true,
      ellipsis: true,
    });
  });

  return headH + 8;
}

/** Soft elevated card (shadow underlay + white body). */
export function drawSoftCard(
  doc: ProcessGuidePdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { fill?: string; stroke?: string; accent?: string; radius?: number }
) {
  const r = opts?.radius ?? 5;
  const fill = opts?.fill ?? PROCESS_PDF.white;
  const stroke = opts?.stroke ?? PROCESS_PDF.line;
  doc.roundedRect(x + 0.7, y + 1, w, h, r).fill(PROCESS_PDF.line);
  doc.roundedRect(x, y, w, h, r).fillAndStroke(fill, stroke);
  if (opts?.accent) {
    doc.roundedRect(x, y, 3, h, r).fill(opts.accent);
    doc.rect(x + 2.2, y, 1.2, h).fill(opts.accent);
  }
}

/** Section label with accent bar */
export function drawSectionLabel(
  doc: ProcessGuidePdfDoc,
  label: string,
  x: number,
  y: number,
  w: number,
  accent = PROCESS_PDF.brandDeep
): number {
  doc.roundedRect(x, y + 1, 3, 7, 1).fill(accent);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(PROCESS_PDF.muted);
  doc.text(label.toUpperCase(), x + 8, y, {
    width: w - 10,
    lineBreak: false,
    ellipsis: true,
  });
  return y + 11;
}

export function drawProcessFooter(
  doc: ProcessGuidePdfDoc,
  g: ProcessGuideGeo,
  opts: {
    productLine: string;
    pageNum: number;
    total: number;
  }
) {
  withOpenMargins(doc, () => {
    const y = g.footerY - 5;
    doc
      .moveTo(g.mx, y)
      .lineTo(g.pageW - g.mx, y)
      .strokeColor(PROCESS_PDF.line)
      .lineWidth(0.5)
      .stroke();
    const orientLabel = g.isLandscape ? 'A4 landscape' : 'A4 portrait';
    doc.font('Helvetica').fontSize(6).fillColor(PROCESS_PDF.muted);
    doc.text(
      `${opts.productLine} · ${orientLabel} · end-to-end process design`,
      g.mx,
      y + 3,
      { width: g.contentW * 0.72, lineBreak: false, ellipsis: true }
    );
    doc.text(`Page ${opts.pageNum} of ${opts.total}`, g.mx, y + 3, {
      width: g.contentW,
      align: 'right',
    });
  });
}
