/**
 * Printable PEU circuit day pack PDF for DBE field teams.
 */
import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_BAND = 36;
const CONTENT_BOTTOM = PAGE_H - FOOTER_BAND;
const FOOTER_Y = PAGE_H - 20;

export type DayPackStop = {
  order: number;
  visit_id?: number;
  status?: string;
  visitor_name?: string | null;
  school_name: string;
  emis?: string | null;
  district?: string | null;
  circuit?: string | null;
  municipality?: string | null;
  principal?: string | null;
  phone?: string | null;
  learners?: number | null;
  phase?: string | null;
  quintile?: number | string | null;
  notes?: string | null;
};

export type DayPackInput = {
  date: string;
  agency_name: string;
  province?: string | null;
  stop_count: number;
  visitors: string[];
  stops: DayPackStop[];
  generated_at?: string;
};

function startPdf(title: string, subject: string): {
  pdf: PdfDoc;
  done: Promise<Buffer>;
} {
  const pdf = new PDFDocument({
    size: 'A4',
    margins: {
      top: MARGIN,
      left: MARGIN,
      right: MARGIN,
      bottom: FOOTER_BAND,
    },
    bufferPages: true,
    info: {
      Title: title,
      Author: 'Supplier Advisor · NSNP',
      Subject: subject,
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  return { pdf, done };
}

function ensureSpace(pdf: PdfDoc, yRef: { y: number }, need: number) {
  if (yRef.y + need > CONTENT_BOTTOM - 8) {
    pdf.addPage();
    pdf.rect(0, 0, PAGE_W, 8).fill('#0077b6');
    yRef.y = MARGIN + 8;
  }
}

function footer(pdf: PdfDoc, generated: string) {
  const range = pdf.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    pdf.switchToPage(range.start + i);
    const saved = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#94a3b8')
      .text(
        `Supplier Advisor · NSNP PEU day pack · ${generated} · page ${i + 1}/${total}`,
        MARGIN,
        FOOTER_Y,
        { width: CONTENT_W, align: 'center', lineBreak: false }
      );
    pdf.page.margins.bottom = saved;
  }
}

export function visitDayPackFilename(date: string): string {
  return `NSNP_PEU_DayPack_${date}.pdf`;
}

export async function buildVisitDayPackPdf(
  pack: DayPackInput
): Promise<Buffer> {
  const generated =
    pack.generated_at?.replace('T', ' ').slice(0, 19) ||
    new Date().toISOString().replace('T', ' ').slice(0, 19);
  const { pdf, done } = startPdf(
    `PEU day pack · ${pack.date}`,
    pack.agency_name
  );
  const yRef = { y: MARGIN };

  pdf.rect(0, 0, PAGE_W, 8).fill('#0077b6');
  yRef.y = MARGIN + 4;

  pdf
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#0f172a')
    .text('PEU monitoring day pack', MARGIN, yRef.y, { width: CONTENT_W });
  yRef.y = pdf.y + 4;
  pdf
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#0369a1')
    .text(String(pack.agency_name), MARGIN, yRef.y);
  yRef.y = pdf.y + 10;

  const meta = [
    `Date: ${pack.date}`,
    pack.province ? `Province: ${pack.province}` : null,
    `Stops: ${pack.stop_count}`,
    pack.visitors.length
      ? `Officer(s): ${pack.visitors.join(', ')}`
      : 'Officer(s): unassigned',
  ]
    .filter(Boolean)
    .join('  ·  ');
  pdf.font('Helvetica').fontSize(9).fillColor('#475569').text(meta, MARGIN, yRef.y, {
    width: CONTENT_W,
  });
  yRef.y = pdf.y + 12;

  pdf
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(
      'Checklist at each school: sign-in · NSNP Monitoring Tool (full form) · kitchen walk · stock vs menu · photos · findings / RIAD if needed.',
      MARGIN,
      yRef.y,
      { width: CONTENT_W }
    );
  yRef.y = pdf.y + 14;

  if (!pack.stops.length) {
    pdf
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('#94a3b8')
      .text('No planned or completed stops on this date.', MARGIN, yRef.y);
  }

  for (const stop of pack.stops) {
    ensureSpace(pdf, yRef, 88);
    const boxTop = yRef.y;
    const boxH = 78;
    pdf
      .roundedRect(MARGIN, boxTop, CONTENT_W, boxH, 6)
      .fillAndStroke('#f8fafc', '#e2e8f0');

    pdf
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text(
        `${stop.order}. ${stop.school_name}`,
        MARGIN + 10,
        boxTop + 8,
        { width: CONTENT_W - 20 }
      );

    const line2 = [
      stop.emis ? `EMIS ${stop.emis}` : null,
      stop.district,
      stop.circuit ? `Circuit ${stop.circuit}` : null,
      stop.municipality,
      stop.phase,
      stop.quintile != null ? `Q${stop.quintile}` : null,
      stop.learners != null
        ? `${Number(stop.learners).toLocaleString('en-ZA')} learners`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#475569')
      .text(line2 || '—', MARGIN + 10, boxTop + 24, {
        width: CONTENT_W - 20,
      });

    const contact = [
      stop.principal ? `Principal: ${stop.principal}` : null,
      stop.phone ? `Tel: ${stop.phone}` : null,
      stop.visitor_name ? `Officer: ${stop.visitor_name}` : 'Officer: ________',
      stop.status ? `Status: ${stop.status}` : null,
    ]
      .filter(Boolean)
      .join('  ·  ');
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#0f172a')
      .text(contact, MARGIN + 10, boxTop + 38, { width: CONTENT_W - 20 });

    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text(
        `Notes / findings: ${stop.notes || '_______________________________________________'}`,
        MARGIN + 10,
        boxTop + 54,
        { width: CONTENT_W - 20 }
      );

    yRef.y = boxTop + boxH + 8;
  }

  ensureSpace(pdf, yRef, 50);
  yRef.y += 8;
  pdf
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0f172a')
    .text('Day close-out', MARGIN, yRef.y);
  yRef.y = pdf.y + 6;
  pdf
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#475569')
    .text(
      'Schools visited ____ / ____   ·   Forms submitted ____   ·   RIADs raised ____   ·   Signature ________________  Date ______',
      MARGIN,
      yRef.y,
      { width: CONTENT_W }
    );

  footer(pdf, generated);
  pdf.end();
  return done;
}
