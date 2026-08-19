/**
 * Medical-aid claim pack PDF — practice copy for scheme submission.
 */
import PDFDocument from 'pdfkit';
import type { MedicalAidClaim, PatientMedicalRecord } from '@/lib/clinic/patient-medical';
import { medicalAidSummary } from '@/lib/clinic/patient-medical';
import type { PracticeBilling } from '@/lib/clinic/medical-aid-claims';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 48;

export async function buildMedicalAidClaimPdf(opts: {
  practice: PracticeBilling;
  patientName: string;
  patientCode?: string;
  medical?: PatientMedicalRecord | null;
  claim: MedicalAidClaim;
  moduleLabel: string;
}): Promise<Buffer> {
  const { practice, patientName, patientCode, medical, claim, moduleLabel } =
    opts;
  const aid = medical?.medical_aid;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 52, bottom: 48, left: MX, right: MX },
      info: {
        Title: `Medical-aid claim ${claim.claim_number || claim.id}`,
        Author: practice.brand_name || 'SupplierAdvisor®',
        Subject: 'Medical-aid claim pack',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, PAGE_W, 62).fill('#0c4a6e');
    doc.rect(0, 58, PAGE_W, 4).fill('#00b4d8');
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(practice.brand_name || moduleLabel, MX, 18);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#bae6fd')
      .text('Medical-aid claim pack', MX, 38);

    let y = 84;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16);
    doc.text(`Claim ${claim.claim_number || claim.id.slice(0, 10)}`, MX, y);
    y += 22;
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text(`Status: ${String(claim.status).replace(/_/g, ' ')}`, MX, y);
    doc.text(
      `Submitted: ${(claim.submitted_at || '').slice(0, 10) || '—'}`,
      MX + 220,
      y
    );
    y += 22;

    y = section(doc, y, 'Practice');
    y = kv(doc, y, 'Practice number', practice.practice_number);
    y = kv(doc, y, 'BHF number', practice.bhf_number);
    y = kv(doc, y, 'PCNS', practice.pcns_number);
    y = kv(doc, y, 'VAT', practice.vat_number);
    y = kv(doc, y, 'Phone', practice.contact_phone);
    y = kv(doc, y, 'Email', practice.contact_email || practice.billing_email);
    y += 8;

    y = section(doc, y, 'Patient');
    y = kv(doc, y, 'Name', patientName);
    y = kv(doc, y, 'Code', patientCode);
    y = kv(doc, y, 'ID / passport', medical?.id_number);
    y = kv(doc, y, 'Date of birth', medical?.date_of_birth);
    y += 8;

    y = section(doc, y, 'Medical aid');
    y = kv(doc, y, 'Scheme', aid?.scheme_name);
    y = kv(doc, y, 'Plan', aid?.plan_name);
    y = kv(doc, y, 'Membership', aid?.membership_number);
    y = kv(doc, y, 'Dependent', aid?.dependent_code);
    y = kv(
      doc,
      y,
      'Main member',
      aid?.patient_is_main_member === false
        ? `${aid.main_member_name || '—'} · ${aid.main_member_id || ''}`
        : 'Patient is main member'
    );
    y = kv(doc, y, 'Authorisation', aid?.auth_number || claim.auth_number);
    y += 8;

    y = section(doc, y, 'Service');
    y = kv(doc, y, 'Date of service', claim.service_date);
    y = kv(doc, y, 'Treating clinician', claim.treating_name);
    y = kv(doc, y, 'Tariff / procedure', claim.tariff_code);
    y = kv(
      doc,
      y,
      'ICD-10',
      (claim.diagnosis_codes || [claim.diagnosis_code]).filter(Boolean).join(', ')
    );
    y = kv(
      doc,
      y,
      'Amount',
      claim.amount_zar != null
        ? `R${Number(claim.amount_zar).toLocaleString('en-ZA', {
            minimumFractionDigits: 2,
          })}`
        : '—'
    );
    y = kv(
      doc,
      y,
      'Scheme portion',
      claim.scheme_portion != null
        ? `R${Number(claim.scheme_portion).toLocaleString('en-ZA', {
            minimumFractionDigits: 2,
          })}`
        : '—'
    );
    y = kv(
      doc,
      y,
      'Patient co-pay',
      claim.patient_portion != null
        ? `R${Number(claim.patient_portion).toLocaleString('en-ZA', {
            minimumFractionDigits: 2,
          })}`
        : '—'
    );
    y = kv(doc, y, 'Switch tracking', claim.switch_tracking_number);
    y = kv(doc, y, 'Notes', claim.notes);
    y += 16;

    doc.font('Helvetica').fontSize(8).fillColor('#64748b');
    doc.text(
      `${moduleLabel} claim pack generated on SupplierAdvisor®. Attach accounts, referrals and authorisations as required by the scheme.`,
      MX,
      y,
      { width: PAGE_W - MX * 2 }
    );
    doc.text(medicalAidSummary(medical), MX, y + 28, {
      width: PAGE_W - MX * 2,
    });

    doc.end();
  });
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function section(doc: PdfDoc, y: number, title: string) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0077b6').text(title, MX, y);
  return y + 16;
}

function kv(
  doc: PdfDoc,
  y: number,
  label: string,
  value?: string | null
) {
  doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(label, MX, y, {
    width: 130,
  });
  doc
    .fillColor('#0f172a')
    .text(value && String(value).trim() ? String(value) : '—', MX + 134, y, {
      width: PAGE_W - MX * 2 - 134,
    });
  return y + 14;
}
