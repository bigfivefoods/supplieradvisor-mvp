import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadSellerMoneyHub } from '@/lib/customers/money-hub';

/**
 * GET ?companyId= — seller Money hub snapshot
 * GET ?companyId=&format=csv — AR open invoices CSV export
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const hub = await loadSellerMoneyHub(companyId);
    const format = String(
      request.nextUrl.searchParams.get('format') || ''
    ).toLowerCase();

    if (format === 'csv') {
      const lines = [
        'invoice_id,invoice_number,customer_name,status,due_date,balance,currency',
      ];
      for (const inv of hub.topOpenInvoices) {
        lines.push(
          [
            inv.id,
            csvEsc(inv.invoice_number),
            csvEsc(inv.customer_name),
            inv.status,
            inv.due_date || '',
            inv.balance,
            inv.currency,
          ].join(',')
        );
      }
      const body = lines.join('\n');
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ar-open-${companyId}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, hub });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function csvEsc(v: string | null | undefined): string {
  const s = v != null ? String(v) : '';
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
