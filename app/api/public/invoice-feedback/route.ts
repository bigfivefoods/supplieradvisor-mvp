import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  normalizeFeedbackToken,
  parseInvoiceFeedbackToken,
} from '@/lib/customers/invoice-feedback-token';
import { docNumber } from '@/lib/customers/documents';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Public invoice feedback — rate (OTIFEF) or claim/RIAD without login.
 * GET ?token=  ·  POST { token, action: rate|claim, ... }
 */
export async function GET(request: NextRequest) {
  try {
    const token = normalizeFeedbackToken(
      request.nextUrl.searchParams.get('token')
    );
    const parsed = parseInvoiceFeedbackToken(token);
    if (!parsed) {
      return NextResponse.json(
        {
          error: 'Invalid link',
          detail: 'This feedback link is incomplete or corrupted. Open the link from the invoice PDF or QR again.',
          code: 'TOKEN_INVALID',
        },
        { status: 400 }
      );
    }

    const inv = await resolveInvoice(parsed);
    if (!inv) {
      return NextResponse.json(
        {
          error: 'Invoice not found',
          detail:
            'We could not match this invoice. It may have been deleted, or the link was generated for a different workspace.',
          code: 'INVOICE_NOT_FOUND',
          parsed: {
            companyId: parsed.companyId,
            invoiceId: parsed.invoiceId,
          },
        },
        { status: 404 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, logo_url, verification_status, is_verified, city, country'
      )
      .eq('id', inv.profile_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      invoice: {
        id: inv.id,
        number: inv.invoice_number,
        total: inv.total_amount,
        currency: inv.currency || 'ZAR',
        customer_name: inv.customer_name,
        status: inv.status,
      },
      seller: {
        name:
          profile?.trading_name ||
          profile?.legal_name ||
          'Seller',
        logo_url: profile?.logo_url ?? null,
        verified:
          profile?.is_verified === true ||
          String(profile?.verification_status || '').toLowerCase() ===
            'verified',
        city: profile?.city ?? null,
        country: profile?.country ?? null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = normalizeFeedbackToken(body.token);
    const parsed = parseInvoiceFeedbackToken(token);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid link', code: 'TOKEN_INVALID' },
        { status: 400 }
      );
    }

    const rl = checkRateLimit({
      key: `inv-fb:${parsed.companyId}:${request.headers.get('x-forwarded-for') || 'ip'}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const action = String(body.action || 'rate').toLowerCase();
    const inv = await resolveInvoice(parsed);
    if (!inv) {
      return NextResponse.json(
        { error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const companyId = Number(inv.profile_id);
    const supabase = getSupabaseServer();

    const contactName = body.contact_name
      ? String(body.contact_name).trim()
      : null;
    const contactEmail = body.contact_email
      ? String(body.contact_email).toLowerCase().trim()
      : null;
    const notes = body.notes || body.description || body.body || null;

    if (action === 'claim' || action === 'riad') {
      const title = String(body.title || '').trim();
      if (!title) {
        return NextResponse.json(
          { error: 'Title required for a claim' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('customer_claims')
        .insert({
          profile_id: companyId,
          customer_id: inv.customer_id || null,
          invoice_id: inv.id,
          claim_number: docNumber('CLM'),
          claim_type:
            body.claim_type || (action === 'riad' ? 'service' : 'quality'),
          status: 'open',
          priority: body.priority || 'medium',
          title,
          description: [
            notes,
            contactName ? `Contact: ${contactName}` : null,
            contactEmail ? `Email: ${contactEmail}` : null,
            `Source: public invoice feedback · INV ${inv.invoice_number}`,
          ]
            .filter(Boolean)
            .join('\n'),
          amount_claimed: Number(body.amount_claimed || 0),
          currency: body.currency || 'ZAR',
          owner_name: contactName,
          opened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id, claim_number')
        .single();

      if (error) {
        await supabase.from('activity_log').insert({
          profile_id: companyId,
          action: 'invoice.public_claim',
          entity_type: 'customer_invoice',
          entity_id: String(inv.id),
          summary: title,
          metadata: {
            notes,
            contactName,
            contactEmail,
            invoice: inv.invoice_number,
          },
        });
        return NextResponse.json({
          success: true,
          stored: 'activity',
          message: 'Claim logged for the seller to review.',
        });
      }
      return NextResponse.json({
        success: true,
        claim: data,
        message: 'Claim submitted. The seller will follow up.',
      });
    }

    // rate / otifef
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 0));
    const otif =
      body.otifef != null
        ? Math.min(100, Math.max(0, Number(body.otifef)))
        : rating
          ? rating * 20
          : null;
    if (!rating && otif == null) {
      return NextResponse.json(
        { error: 'Provide a star rating (1–5) or OTIFEF score (0–100)' },
        { status: 400 }
      );
    }

    const meta = {
      rating: rating || null,
      otifef: otif,
      on_time: body.on_time,
      in_full: body.in_full,
      quality: body.quality,
      communication: body.communication,
      notes,
      contactName,
      contactEmail,
      invoice_number: inv.invoice_number,
      source: 'public_invoice_qr',
    };

    const { error: fbErr } = await supabase.from('invoice_feedback').insert({
      profile_id: companyId,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      feedback_type: 'rate',
      rating: rating || null,
      otifef_score: otif,
      title: body.title || 'Invoice rating',
      body: notes,
      contact_email: contactEmail,
      contact_name: contactName,
      metadata: meta,
      created_at: new Date().toISOString(),
    });

    if (fbErr) {
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        action: 'invoice.public_rating',
        entity_type: 'customer_invoice',
        entity_id: String(inv.id),
        summary: `Public rating ${rating || '—'}/5 · OTIFEF ${otif ?? '—'}% on ${inv.invoice_number}`,
        metadata: meta,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you — your rating helps OTIFEF and network trust.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

type InvoiceRow = {
  id: number;
  invoice_number: string | null;
  total_amount?: number | null;
  currency?: string | null;
  customer_name?: string | null;
  status?: string | null;
  profile_id: number;
  customer_id?: number | null;
};

/**
 * Resolve invoice flexibly: id+company, then id only, then number+company.
 * Handles workspace id mismatches and legacy tokens.
 */
async function resolveInvoice(parsed: {
  companyId: number;
  invoiceId: number;
  invoiceNumber: string;
}): Promise<InvoiceRow | null> {
  const supabase = getSupabaseServer();
  const select =
    'id, invoice_number, total_amount, currency, customer_name, status, profile_id, customer_id';

  // 1) Exact match (preferred)
  {
    const { data } = await supabase
      .from('customer_invoices')
      .select(select)
      .eq('id', parsed.invoiceId)
      .eq('profile_id', parsed.companyId)
      .maybeSingle();
    if (data) return data as InvoiceRow;
  }

  // 2) By invoice id alone (company id may have drifted / wrong selected company at print time)
  {
    const { data } = await supabase
      .from('customer_invoices')
      .select(select)
      .eq('id', parsed.invoiceId)
      .maybeSingle();
    if (data) return data as InvoiceRow;
  }

  // 3) By invoice number + company (when id was wrong but number was in token)
  const num = String(parsed.invoiceNumber || '').trim();
  if (num && parsed.companyId) {
    const { data } = await supabase
      .from('customer_invoices')
      .select(select)
      .eq('profile_id', parsed.companyId)
      .eq('invoice_number', num)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as InvoiceRow;
  }

  // 4) By invoice number alone
  if (num) {
    const { data } = await supabase
      .from('customer_invoices')
      .select(select)
      .eq('invoice_number', num)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as InvoiceRow;
  }

  return null;
}
