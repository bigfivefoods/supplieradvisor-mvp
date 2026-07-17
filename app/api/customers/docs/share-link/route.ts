import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  buildDocShareToken,
  commercialDocPdfUrl,
} from '@/lib/customers/doc-share-token';

const TABLES = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
} as const;

/**
 * POST { companyId, type, id }
 * Returns a signed public PDF URL for WhatsApp / external share.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const type = String(body.type || 'quote').toLowerCase() as keyof typeof TABLES;

    if (!Number.isFinite(companyId) || !Number.isFinite(id) || !TABLES[type]) {
      return NextResponse.json(
        { error: 'companyId, type, id required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: doc, error } = await supabase
      .from(TABLES[type])
      .select('id, status')
      .eq('id', id)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const token = buildDocShareToken({
      companyId,
      type,
      id,
      ttlSeconds: type === 'quote' ? 60 * 60 * 24 * 45 : 60 * 60 * 24 * 30,
    });
    const pdfUrl = commercialDocPdfUrl(token);

    // Soft activity
    void supabase.from('activity_log').insert({
      profile_id: companyId,
      actor_user_id: gate.userId,
      action: `${type}.share_pdf_link`,
      entity_type: TABLES[type],
      entity_id: String(id),
      summary: `Created PDF share link for ${type} #${id}`,
      metadata: { expiresDays: type === 'quote' ? 45 : 30 },
    });

    return NextResponse.json({
      success: true,
      pdfUrl,
      expiresInDays: type === 'quote' ? 45 : 30,
      format: 'pdf',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
