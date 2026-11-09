import { NextRequest, NextResponse } from 'next/server';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { buildVat201Pdf } from '@/lib/accounting/vat201-pdf';
import { vat201ToCsv } from '@/lib/accounting/vat201-model';
import { composeVat201 } from '@/lib/accounting/vat201-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const gate = await requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!gate.ok) return gate.response;
  const view = await assertAccountingAccess(gate.userId, companyId, 'view');
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: view.status });

  const format = request.nextUrl.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
  const packed = await composeVat201(companyId, request.nextUrl.searchParams.get('periodEnd'));
  if (!packed.report) return NextResponse.json({ error: 'No VAT201 for this period.' }, { status: 404 });
  const stamp = packed.report.period.end;
  if (format === 'pdf') {
    const pdf = await buildVat201Pdf(packed.report);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="VAT201-${stamp}.pdf"`,
      },
    });
  }
  return new NextResponse(vat201ToCsv(packed.report), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="VAT201-${stamp}.csv"`,
    },
  });
}
