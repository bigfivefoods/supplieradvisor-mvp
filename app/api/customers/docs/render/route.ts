import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';

/**
 * GET ?companyId=&type=invoice&id=
 * Print-ready HTML (browser Print → Save as PDF).
 * Uses company logo, VAT, reg, bank + customer contact from CRM profile.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    const type = String(sp.get('type') || 'invoice').toLowerCase() as
      | 'quote'
      | 'order'
      | 'invoice';
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId, type, id required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const loaded = await loadCommercialDocument({ companyId, type, id });
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    return new NextResponse(loaded.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
