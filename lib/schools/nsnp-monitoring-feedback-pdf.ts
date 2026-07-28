/**
 * NSNP School Monitoring Feedback Form PDF (KZN 2026-27).
 * Pure pdfkit — works on Vercel serverless.
 */
import PDFDocument from 'pdfkit';
import {
  NSNP_MONITORING_VERSION,
  type MonitoringFormData,
  type MonitoringScores,
} from '@/lib/schools/nsnp-monitoring-tool';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 44;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;

export type MonitoringPdfInput = {
  form: MonitoringFormData;
  scores: MonitoringScores;
  visitDate?: string | null;
  status?: string | null;
  monitorName?: string | null;
  schoolName?: string | null;
  emis?: string | null;
  peuVisitId?: number | null;
  monitoringId?: number | null;
  submittedAt?: string | null;
};

function yn(v: string | boolean | null | undefined): string {
  if (v === true || v === 'yes') return 'Yes';
  if (v === false || v === 'no') return 'No';
  return '—';
}

function lightLabel(t: string): string {
  if (t === 'green') return 'GREEN (81–100)';
  if (t === 'yellow') return 'YELLOW (50–80)';
  if (t === 'red') return 'RED (0–49)';
  return t || '—';
}

export async function buildMonitoringFeedbackPdf(
  input: MonitoringPdfInput
): Promise<Buffer> {
  const form = input.form;
  const scores = input.scores;
  const school =
    input.schoolName || form.a1_school_name || 'School';
  const emis = input.emis || form.a2_emis || '—';
  const visitDate =
    input.visitDate || form.a7_visit_date || '—';
  const monitor =
    input.monitorName || form.a6_monitor_name || '—';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: {
        top: MARGIN_TOP,
        bottom: MARGIN_BOTTOM,
        left: MARGIN_X,
        right: MARGIN_X,
      },
      info: {
        Title: `NSNP Monitoring Feedback — ${school}`,
        Author: 'Supplier Advisor · NSNP',
        Subject: NSNP_MONITORING_VERSION,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = MARGIN_TOP;

    const ensure = (need: number) => {
      if (y + need > CONTENT_BOTTOM) {
        doc.addPage();
        y = MARGIN_TOP;
      }
    };

    const line = (text: string, opts?: { bold?: boolean; size?: number; color?: string }) => {
      const size = opts?.size ?? 10;
      ensure(size + 6);
      doc
        .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(size)
        .fillColor(opts?.color || '#0f172a')
        .text(text, MARGIN_X, y, { width: CONTENT_W });
      y = doc.y + 4;
    };

    const pair = (label: string, value: string) => {
      ensure(16);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text(label, MARGIN_X, y, { continued: false, width: 160 });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f172a')
        .text(value || '—', MARGIN_X + 160, y, { width: CONTENT_W - 160 });
      y += 16;
    };

    const section = (title: string) => {
      ensure(28);
      y += 6;
      doc
        .rect(MARGIN_X, y, CONTENT_W, 18)
        .fill('#e0f2fe');
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0369a1')
        .text(title, MARGIN_X + 8, y + 4, { width: CONTENT_W - 16 });
      y += 24;
    };

    const scoreBox = (
      label: string,
      value: string,
      x: number,
      w: number,
      fill: string
    ) => {
      doc.roundedRect(x, y, w, 44, 6).fill(fill);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#334155')
        .text(label, x + 8, y + 8, { width: w - 16 });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#0f172a')
        .text(value, x + 8, y + 22, { width: w - 16 });
    };

    // Header
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#0c4a6e')
      .text('NSNP SCHOOL MONITORING FEEDBACK FORM', MARGIN_X, y, {
        width: CONTENT_W,
        align: 'center',
      });
    y = doc.y + 2;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(
        `${NSNP_MONITORING_VERSION} · KZN Monitoring Tool`,
        MARGIN_X,
        y,
        { width: CONTENT_W, align: 'center' }
      );
    y = doc.y + 10;

    pair('School name', school);
    pair('EMIS number', emis);
    pair('Visit date', visitDate);
    pair('Monitor (official)', monitor);
    pair('District', form.a4_district || '—');
    pair('Quintile', form.a5_quintile ? `Q${form.a5_quintile}` : '—');
    if (input.monitoringId) pair('Monitoring ref', `#${input.monitoringId}`);
    if (input.peuVisitId) pair('Linked PEU visit', `#${input.peuVisitId}`);
    if (input.status) pair('Status', String(input.status));
    if (input.submittedAt)
      pair('Submitted', new Date(input.submittedAt).toLocaleString());

    // KPI banner
    ensure(70);
    const kpiFill =
      scores.traffic_light === 'green'
        ? '#d1fae5'
        : scores.traffic_light === 'yellow'
          ? '#fef3c7'
          : '#fee2e2';
    doc.roundedRect(MARGIN_X, y, CONTENT_W, 58, 8).fill(kpiFill);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text("SCHOOL'S KEY PERFORMANCE INDICATOR", MARGIN_X + 12, y + 10);
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(`${scores.overall_kpi}`, MARGIN_X + 12, y + 26);
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(`/ 100  ·  ${lightLabel(scores.traffic_light)}`, MARGIN_X + 70, y + 36);
    y += 70;

    section('Feeding & quantity KPI breakdown');
    pair(
      'Feeding of learners today (A15)',
      yn(form.a15_feeding_today) +
        (form.a15_feeding_today === 'no' ? '  → KPI = 0' : '')
    );
    pair('Feeding time points', `${scores.feeding_time_points} / 20`);
    pair(
      'Food groups balance',
      `${scores.food_groups_served} / 3 groups → ${scores.food_groups_kpi} / 20`
    );
    pair('Starch quantity KPI', `${scores.starch_kpi} / 20`);
    pair('Protein quantity KPI', `${scores.protein_kpi} / 20`);
    pair('Veg / Fruit quantity KPI', `${scores.veg_kpi} / 20`);

    ensure(60);
    const boxW = (CONTENT_W - 16) / 3;
    scoreBox('Record keeping (RKMP)', `${scores.rkmp}/20`, MARGIN_X, boxW, '#f1f5f9');
    scoreBox(
      'Health & safety (NEHS)',
      `${scores.nehs}/20`,
      MARGIN_X + boxW + 8,
      boxW,
      '#f1f5f9'
    );
    scoreBox(
      'School food gardens',
      `${scores.gardens}/10`,
      MARGIN_X + (boxW + 8) * 2,
      boxW,
      '#f1f5f9'
    );
    y += 56;

    section('Interview snapshot');
    pair('Learners NSNP approved (A12)', form.a12_nsnp_learners || '—');
    pair('Learners eating today (A13)', form.a13_learners_eating || '—');
    pair('Food handlers engaged (A14)', form.a14_food_handlers || '—');
    pair(
      'Service provider',
      [form.a10_sp_name, form.a10_sp_number].filter(Boolean).join(' · ') || '—'
    );
    pair('SP delivered adequate food (A11)', yn(form.a11_sp_adequate));
    pair(
      'Respondent 1',
      [form.a9_r1_name, form.a9_r1_position, form.a9_r1_contact]
        .filter(Boolean)
        .join(' · ') || '—'
    );

    section('Breakfast');
    pair('Breakfast served (BF1)', yn(form.bf1_served));
    if (form.bf1_served === 'yes') {
      pair(
        'Breakfast completed (BF2)',
        form.bf2_time === 'before_8'
          ? 'Before 8:00am'
          : form.bf2_time === 'after_8'
            ? 'After 8:00am'
            : '—'
      );
    }
    if (form.bf1_served === 'no' && form.bf3_reason) {
      line('BF3 reason: ' + form.bf3_reason, { size: 9 });
    }

    section('Observations / challenges identified');
    line(form.observations?.trim() || '—', { size: 10 });

    section('Recommendations / action required');
    line(form.recommendations?.trim() || '—', { size: 10 });

    if (form.bf_challenges || form.bf_actions || form.bf_comments) {
      section('Breakfast feedback');
      if (form.bf_challenges) line('Challenge: ' + form.bf_challenges, { size: 9 });
      if (form.bf_actions) line('Action: ' + form.bf_actions, { size: 9 });
      if (form.bf_comments) line('Comments: ' + form.bf_comments, { size: 9 });
    }

    section('Acknowledgements');
    pair('Principal acknowledgement', form.principal_ack ? 'Yes' : 'Not recorded');
    pair(
      'NSNP coordinator acknowledgement',
      form.coordinator_ack ? 'Yes' : 'Not recorded'
    );
    line(
      'I have read and understood the report and the actions to be taken and I will ensure these are addressed timeously.',
      { size: 8, color: '#64748b' }
    );

    ensure(80);
    y += 16;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#334155')
      .text('Monitor signature: _______________________', MARGIN_X, y);
    y += 22;
    doc.text('NSNP Coordinator: _______________________', MARGIN_X, y);
    y += 22;
    doc.text('Principal signature: _______________________', MARGIN_X, y);
    y += 22;
    doc.text('School stamp:', MARGIN_X, y);

    // Stamp footers on all buffered pages, then end
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          `NSNP Monitoring Feedback · ${school.slice(0, 40)} · Page ${i + 1} of ${range.count} · ${NSNP_MONITORING_VERSION}`,
          MARGIN_X,
          PAGE_H - 28,
          { width: CONTENT_W, align: 'center' }
        );
    }
    doc.end();
  });
}

export function monitoringPdfFilename(input: {
  schoolName?: string | null;
  visitDate?: string | null;
  monitoringId?: number | null;
}): string {
  const school = String(input.schoolName || 'school')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40);
  const date = String(input.visitDate || '').slice(0, 10) || 'visit';
  const id = input.monitoringId != null ? `-${input.monitoringId}` : '';
  return `NSNP-Monitoring-Feedback-${school}-${date}${id}.pdf`;
}
