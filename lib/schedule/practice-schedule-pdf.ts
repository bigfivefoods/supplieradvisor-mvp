/**
 * A4 practice schedule PDF (day / week / month) for Fit + clinic Advisors.
 * Pure pdfkit — Vercel serverless safe. Do not import from client components.
 */
import PDFDocument from 'pdfkit';
import {
  isClosedOn,
  openCloseOn,
  type WorkingHours,
} from '@/lib/schedule/working-hours';

export type PracticePdfEvent = {
  date: string;
  start_time: string;
  end_time?: string | null;
  title: string;
  person_name?: string;
  location?: string;
  meta?: string;
  status?: string;
};

export type PracticeSchedulePdfInput = {
  brand: string;
  title: string;
  moduleLabel?: string;
  view: 'day' | 'week' | 'month';
  from: string;
  to: string;
  orientation: 'landscape' | 'portrait';
  workingHours?: WorkingHours | null;
  events: PracticePdfEvent[];
  generatedAt?: Date;
};

const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#cbd5e1';
const SOFT = '#f1f5f9';
const BRAND = '#7c3aed';

function parseIso(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function startOfWeekMon(iso: string): string {
  const d = parseIso(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatLabel(iso: string, withWeekday = true): string {
  return parseIso(iso).toLocaleDateString(undefined, {
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function eventsOn(events: PracticePdfEvent[], date: string): PracticePdfEvent[] {
  return events
    .filter((e) => e.date === date && e.status !== 'cancelled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

function hoursLine(
  hours: WorkingHours | null | undefined,
  dates: string[]
): string {
  if (!hours || !dates.length) return 'Operating hours: not set';
  if (dates.length === 1) {
    const oc = openCloseOn(hours, dates[0]);
    return oc.closed
      ? `Operating hours: closed ${formatLabel(dates[0])}`
      : `Operating hours: ${oc.open}–${oc.close} (${formatLabel(dates[0])})`;
  }
  const parts = dates.map((d) => {
    const oc = openCloseOn(hours, d);
    const wd = parseIso(d).toLocaleDateString(undefined, { weekday: 'short' });
    return oc.closed ? `${wd} closed` : `${wd} ${oc.open}–${oc.close}`;
  });
  return `Operating hours: ${parts.join(' · ')}`;
}

export async function buildPracticeSchedulePdf(
  input: PracticeSchedulePdfInput
): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  const landscape = input.orientation === 'landscape';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      info: {
        Title: input.title,
        Author: 'SupplierAdvisor®',
        Subject: `${input.moduleLabel || 'Practice'} schedule`,
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const mx = 36;
    const contentW = pageW - mx * 2;

    // Header
    doc.rect(0, 0, pageW, 48).fill(BRAND);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(input.brand || 'SupplierAdvisor®', mx, 14, { width: contentW * 0.55 });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#e9d5ff')
      .text(
        `${input.moduleLabel || 'Practice'} · A4 ${input.orientation}`,
        mx + contentW * 0.55,
        16,
        { width: contentW * 0.45, align: 'right' }
      );

    let y = 60;
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(input.title, mx, y, { width: contentW });
    y += 18;

    const rangeText =
      input.from === input.to
        ? formatLabel(input.from)
        : `${formatLabel(input.from)} – ${formatLabel(input.to)}`;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `${input.view.toUpperCase()} view · ${rangeText} · ${input.events.filter((e) => e.status !== 'cancelled').length} events`,
        mx,
        y,
        { width: contentW }
      );
    y += 14;

    // Operating hours note
    let hourDates: string[] = [];
    if (input.view === 'day') hourDates = [input.from];
    else if (input.view === 'week') {
      const ws = startOfWeekMon(input.from);
      hourDates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    } else {
      // sample weekdays in month for summary
      hourDates = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
        const d = parseIso(input.from.slice(0, 8) + '01');
        while (d.getDay() !== wd) d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
      });
    }
    const hLine = hoursLine(
      input.workingHours,
      input.view === 'month' ? hourDates : hourDates
    );
    doc.fontSize(8).fillColor(MUTED).text(hLine, mx, y, { width: contentW });
    y += 16;

    const events = input.events || [];

    if (input.view === 'day') {
      const day = input.from;
      const list = eventsOn(events, day);
      const oc = openCloseOn(input.workingHours, day);
      // table header
      const cols = [70, contentW - 70 - 140, 140];
      doc.rect(mx, y, contentW, 16).fill(SOFT);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8);
      doc.text('Time', mx + 4, y + 4, { width: cols[0] - 8 });
      doc.text('Event', mx + cols[0] + 4, y + 4, { width: cols[1] - 8 });
      doc.text('Detail', mx + cols[0] + cols[1] + 4, y + 4, {
        width: cols[2] - 8,
      });
      y += 18;
      if (oc.closed) {
        doc
          .font('Helvetica')
          .fillColor(MUTED)
          .text('Closed (per operating hours)', mx + 4, y);
      } else if (!list.length) {
        doc.font('Helvetica').fillColor(MUTED).text('Nothing scheduled', mx + 4, y);
      } else {
        for (const ev of list) {
          if (y > pageH - 48) {
            doc.addPage();
            y = 36;
          }
          const time = `${ev.start_time.slice(0, 5)}${
            ev.end_time ? `–${String(ev.end_time).slice(0, 5)}` : ''
          }`;
          const detail = [ev.person_name, ev.location, ev.meta]
            .filter(Boolean)
            .join(' · ');
          doc.font('Helvetica').fontSize(8).fillColor(INK);
          doc.text(time, mx + 4, y, { width: cols[0] - 8 });
          doc.font('Helvetica-Bold').text(ev.title, mx + cols[0] + 4, y, {
            width: cols[1] - 8,
          });
          doc
            .font('Helvetica')
            .fillColor(MUTED)
            .text(detail || '—', mx + cols[0] + cols[1] + 4, y, {
              width: cols[2] - 8,
            });
          y += 16;
          doc
            .strokeColor(LINE)
            .lineWidth(0.5)
            .moveTo(mx, y - 2)
            .lineTo(mx + contentW, y - 2)
            .stroke();
        }
      }
    } else if (input.view === 'week') {
      const ws = startOfWeekMon(input.from);
      const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      const colW = contentW / 7;
      const headerH = 28;
      const bodyH = Math.min(pageH - y - 40, landscape ? 420 : 520);
      // headers
      days.forEach((d, i) => {
        const x = mx + i * colW;
        const closed = isClosedOn(input.workingHours, d);
        doc.rect(x, y, colW, headerH).fill(closed ? '#f8fafc' : SOFT);
        doc
          .strokeColor(LINE)
          .lineWidth(0.6)
          .rect(x, y, colW, headerH)
          .stroke();
        const wd = parseIso(d).toLocaleDateString(undefined, {
          weekday: 'short',
        });
        const oc = openCloseOn(input.workingHours, d);
        doc
          .fillColor(INK)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`${wd} ${parseIso(d).getDate()}`, x + 3, y + 4, {
            width: colW - 6,
          });
        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor(MUTED)
          .text(closed ? 'Closed' : `${oc.open}–${oc.close}`, x + 3, y + 15, {
            width: colW - 6,
          });
      });
      y += headerH;
      days.forEach((d, i) => {
        const x = mx + i * colW;
        const closed = isClosedOn(input.workingHours, d);
        doc.rect(x, y, colW, bodyH).fill(closed ? '#fafafa' : '#ffffff');
        doc.strokeColor(LINE).lineWidth(0.6).rect(x, y, colW, bodyH).stroke();
        let ey = y + 4;
        const list = eventsOn(events, d);
        for (const ev of list.slice(0, 18)) {
          if (ey > y + bodyH - 20) {
            doc
              .font('Helvetica')
              .fontSize(6)
              .fillColor(MUTED)
              .text(`+${list.length - 18} more`, x + 3, ey, {
                width: colW - 6,
              });
            break;
          }
          doc.rect(x + 2, ey, colW - 4, 1).fill(BRAND);
          doc
            .fillColor(INK)
            .font('Helvetica-Bold')
            .fontSize(6.5)
            .text(
              `${ev.start_time.slice(0, 5)} ${ev.title}`,
              x + 3,
              ey + 2,
              { width: colW - 6, height: 18, ellipsis: true }
            );
          ey += 16;
        }
        if (!list.length && !closed) {
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor(MUTED)
            .text('—', x + 3, y + 8, { width: colW - 6 });
        }
      });
      y += bodyH + 8;
    } else {
      // month grid
      const anchor = parseIso(input.from);
      const y0 = anchor.getFullYear();
      const m0 = anchor.getMonth();
      const first = new Date(y0, m0, 1);
      const last = new Date(y0, m0 + 1, 0);
      const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
      const cells: string[] = [];
      for (let i = 0; i < startPad; i++) {
        cells.push(addDays(first.toISOString().slice(0, 10), i - startPad));
      }
      for (let day = 1; day <= last.getDate(); day++) {
        cells.push(
          new Date(y0, m0, day).toISOString().slice(0, 10)
        );
      }
      while (cells.length % 7 !== 0) {
        cells.push(addDays(cells[cells.length - 1], 1));
      }
      const rows = cells.length / 7;
      const colW = contentW / 7;
      const rowH = Math.min(78, (pageH - y - 36) / rows);
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((lab, i) => {
        doc
          .fillColor(MUTED)
          .font('Helvetica-Bold')
          .fontSize(7)
          .text(lab, mx + i * colW, y, { width: colW, align: 'center' });
      });
      y += 12;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 7; c++) {
          const d = cells[r * 7 + c];
          const x = mx + c * colW;
          const inMonth = parseIso(d).getMonth() === m0;
          const closed = isClosedOn(input.workingHours, d);
          doc
            .rect(x, y, colW, rowH)
            .fill(!inMonth ? '#f8fafc' : closed ? '#f1f5f9' : '#ffffff');
          doc
            .strokeColor(LINE)
            .lineWidth(0.5)
            .rect(x, y, colW, rowH)
            .stroke();
          doc
            .fillColor(inMonth ? INK : MUTED)
            .font('Helvetica-Bold')
            .fontSize(7)
            .text(String(parseIso(d).getDate()), x + 3, y + 3, {
              width: colW - 6,
            });
          if (closed && inMonth) {
            doc
              .font('Helvetica')
              .fontSize(6)
              .fillColor(MUTED)
              .text('off', x + 3, y + 12, { width: colW - 6 });
          }
          const list = eventsOn(events, d);
          let ey = y + 14;
          for (const ev of list.slice(0, 4)) {
            if (ey > y + rowH - 10) break;
            doc
              .fillColor(INK)
              .font('Helvetica')
              .fontSize(5.5)
              .text(
                `${ev.start_time.slice(0, 5)} ${ev.title}`,
                x + 2,
                ey,
                { width: colW - 4, height: 9, ellipsis: true }
              );
            ey += 9;
          }
          if (list.length > 4) {
            doc
              .fontSize(5)
              .fillColor(MUTED)
              .text(`+${list.length - 4}`, x + 2, Math.min(ey, y + rowH - 8), {
                width: colW - 4,
              });
          }
        }
        y += rowH;
      }
    }

    // Footer
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `Generated ${generated.toLocaleString()} · SupplierAdvisor®`,
        mx,
        pageH - 28,
        { width: contentW, align: 'left' }
      );

    doc.end();
  });
}

export type PracticeProfilePdfInput = {
  brand: string;
  moduleLabel: string;
  bio?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  workingHours?: WorkingHours | null;
  rooms?: string[];
  people: Array<{ name: string; role?: string; code?: string }>;
  offerings: Array<{ name: string; code?: string; detail?: string }>;
  generatedAt?: Date;
};

export async function buildPracticeProfilePdf(
  input: PracticeProfilePdfInput
): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
      info: {
        Title: `${input.brand} — practice profile`,
        Author: 'SupplierAdvisor®',
        Subject: input.moduleLabel,
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const mx = 48;
    const contentW = doc.page.width - mx * 2;

    doc.rect(0, 0, doc.page.width, 56).fill(BRAND);
    doc
      .fillColor('#fff')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(input.brand || 'Practice', mx, 18, { width: contentW });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#e9d5ff')
      .text(`${input.moduleLabel} · practice profile`, mx, 38);

    let y = 72;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('About', mx, y);
    y += 16;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(input.bio || 'No public bio set.', mx, y, {
        width: contentW,
      });
    y = doc.y + 12;

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Contact', mx, y);
    y += 16;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(`Email: ${input.contactEmail || '—'}`, mx, y);
    y += 12;
    doc.text(`Phone: ${input.contactPhone || '—'}`, mx, y);
    y += 12;
    if (input.websiteUrl) {
      doc.text(`Website: ${input.websiteUrl}`, mx, y);
      y += 12;
    }
    y += 8;

    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Operating hours', mx, y);
    y += 16;
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    // Mon → Sun order
    for (const dayIdx of [1, 2, 3, 4, 5, 6, 0]) {
      const d = new Date(2026, 5, 1);
      while (d.getDay() !== dayIdx) d.setDate(d.getDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      const oc = openCloseOn(input.workingHours, iso);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(INK)
        .text(
          `${dayNames[dayIdx]}: ${oc.closed ? 'Closed' : `${oc.open} – ${oc.close}`}`,
          mx,
          y
        );
      y += 12;
    }
    y += 8;

    if (input.rooms?.length) {
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Rooms / resources', mx, y);
      y += 16;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED)
        .text(input.rooms.join(' · '), mx, y, { width: contentW });
      y = doc.y + 12;
    }

    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Team', mx, y);
    y += 16;
    if (!input.people.length) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('—', mx, y);
      y += 12;
    } else {
      for (const p of input.people) {
        if (y > doc.page.height - 72) {
          doc.addPage();
          y = 48;
        }
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(INK)
          .text(p.name, mx, y, { width: contentW * 0.45, continued: false });
        doc
          .font('Helvetica')
          .fillColor(MUTED)
          .text(
            [p.code, p.role].filter(Boolean).join(' · ') || '—',
            mx + contentW * 0.45,
            y,
            { width: contentW * 0.55 }
          );
        y += 13;
      }
    }
    y += 10;

    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Services / classes', mx, y);
    y += 16;
    if (!input.offerings.length) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('—', mx, y);
    } else {
      for (const o of input.offerings) {
        if (y > doc.page.height - 72) {
          doc.addPage();
          y = 48;
        }
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(INK)
          .text(
            o.code ? `${o.code} · ${o.name}` : o.name,
            mx,
            y,
            { width: contentW }
          );
        y += 12;
        if (o.detail) {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(MUTED)
            .text(o.detail, mx, y, { width: contentW });
          y = doc.y + 6;
        }
      }
    }

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `Generated ${generated.toLocaleString()} · SupplierAdvisor®`,
        mx,
        doc.page.height - 36,
        { width: contentW }
      );

    doc.end();
  });
}
