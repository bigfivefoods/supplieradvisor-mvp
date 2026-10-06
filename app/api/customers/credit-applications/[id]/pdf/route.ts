import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import {
  legacyPrivyFrom,
  requireCompanyAccess,
  requireCompanyRoles,
  ROLES_FINANCE_CRITICAL,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  loadCreditTimeline,
  mapCreditApplication,
  maskCreditApplication,
  maskPrincipalRow,
  revealCreditApplicationSensitive,
} from '@/lib/credit/application';

async function buildPdf(input: {
  app: ReturnType<typeof maskCreditApplication>;
  principals: Array<Record<string, unknown>>;
  docs: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  reveal?: {
    bankAccountNumber: string | null;
    principalIdNumbers: Array<{ id: number; idNumber: string | null }>;
  } | null;
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Credit application');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#475569').text(`Reference: ${input.app.reference || `CA-${input.app.id}`}`);
    doc.text(`Status: ${input.app.status}`);
    doc.text(`Submitted: ${input.app.submitted_at ? String(input.app.submitted_at).slice(0, 19) : '—'}`);

    doc.moveDown(0.8);
    doc.fontSize(12).fillColor('#0f172a').text('Business');
    const business = input.app.business as Record<string, unknown>;
    doc.fontSize(10).text(`Trading name: ${String(business.trading_name || '—')}`);
    doc.text(`Registered name: ${String(business.registered_name || '—')}`);
    doc.text(`Registration: ${String(business.registration_number || '—')}`);
    doc.text(`VAT: ${String(business.vat_number || '—')}`);

    doc.moveDown(0.6);
    doc.fontSize(12).text('Credit request');
    doc.fontSize(10).text(`Requested limit: ${input.app.currency || 'ZAR'} ${Number(input.app.requested_limit || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
    doc.text(`Requested terms: ${input.app.requested_terms || '—'}`);
    doc.text(`Approved limit: ${input.app.approved_limit != null ? Number(input.app.approved_limit).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}`);
    doc.text(`Approved terms: ${input.app.approved_terms || '—'}`);

    const bank = input.app.bank as Record<string, unknown>;
    doc.moveDown(0.6);
    doc.fontSize(12).text('Bank');
    doc.fontSize(10).text(`Bank name: ${String(bank.bank_name || '—')}`);
    doc.text(`Branch code: ${String(bank.branch_code || '—')}`);
    doc.text(
      `Account: ${
        input.reveal?.bankAccountNumber ||
        String((bank.account_number_masked as string) || '••••')
      }`
    );

    doc.moveDown(0.6);
    doc.fontSize(12).text('Principals');
    input.principals.forEach((p) => {
      if (doc.y > 740) doc.addPage();
      const revealed = input.reveal?.principalIdNumbers.find((x) => x.id === Number(p.id));
      doc.fontSize(10).text(`${String(p.full_name || '—')} · ${String(p.role || '—')}`);
      doc
        .fontSize(9)
        .fillColor('#334155')
        .text(`ID: ${revealed?.idNumber || String(p.id_number_masked || '••••')}`);
    });

    doc.moveDown(0.6);
    doc.fontSize(12).fillColor('#0f172a').text('Documents');
    input.docs.forEach((d) => {
      if (doc.y > 740) doc.addPage();
      doc.fontSize(9).fillColor('#334155').text(`${String(d.doc_type || 'other')} · ${String(d.file_name || 'file')}`);
    });

    doc.moveDown(0.6);
    doc.fontSize(12).fillColor('#0f172a').text('Consent & signature');
    const sig = (input.app.signature || {}) as Record<string, unknown>;
    doc.fontSize(9).fillColor('#334155').text(`POPIA consent: ${input.app.popia_consent_at ? 'Yes' : 'No'}`);
    doc.text(`Credit check consent: ${input.app.credit_check_consent_at ? 'Yes' : 'No'}`);
    doc.text(`Terms accepted: ${input.app.terms_accepted_at ? 'Yes' : 'No'} (${input.app.terms_version || '—'})`);
    doc.text(`Signed by: ${String(sig.typed_name || '—')} (${String(sig.capacity || '—')})`);

    doc.moveDown(0.6);
    doc.fontSize(12).fillColor('#0f172a').text('Audit trail');
    input.events.forEach((e) => {
      if (doc.y > 740) doc.addPage();
      doc
        .fontSize(9)
        .fillColor('#334155')
        .text(`${String(e.created_at || '').slice(0, 19)} · ${String(e.action || '')} · ${String(e.from_status || '')} → ${String(e.to_status || '')}`);
    });

    doc.end();
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const id = Number(p.id);
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));

    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: row } = await supabase
      .from('credit_applications')
      .select('*')
      .eq('id', id)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const app = mapCreditApplication(row as Record<string, unknown>);
    const [{ data: principals }, { data: docs }, events] = await Promise.all([
      supabase
        .from('credit_application_principals')
        .select('*')
        .eq('profile_id', companyId)
        .eq('application_id', id)
        .order('id', { ascending: true }),
      supabase
        .from('credit_application_documents')
        .select('*')
        .eq('profile_id', companyId)
        .eq('application_id', id)
        .order('created_at', { ascending: true }),
      loadCreditTimeline({ profileId: companyId, applicationId: id }),
    ]);

    let reveal: Awaited<ReturnType<typeof revealCreditApplicationSensitive>> | null = null;
    if (request.nextUrl.searchParams.get('reveal') === '1') {
      const roleGate = await requireCompanyRoles(request, companyId, ROLES_FINANCE_CRITICAL, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!roleGate.ok) return roleGate.response;
      reveal = revealCreditApplicationSensitive({
        application: app,
        principals: (principals || []) as Array<Record<string, unknown>>,
      });
    }

    const pdf = await buildPdf({
      app: maskCreditApplication(app),
      principals: ((principals || []) as Array<Record<string, unknown>>).map(maskPrincipalRow),
      docs: (docs || []) as Array<Record<string, unknown>>,
      events,
      reveal,
    });

    const fileName = `${(app.reference || `CA-${id}`).replace(/[^A-Za-z0-9\-_]/g, '_')}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
