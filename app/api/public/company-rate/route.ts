import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Public company rating from quote QR / share links (no login).
 * GET  ?companyId=  — seller card
 * POST { companyId, rating, notes?, contact_name?, contact_email?, source? }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json(
        { error: 'companyId required', code: 'BAD_ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        // profiles has verification_status — not is_verified (column does not exist)
        'id, trading_name, legal_name, logo_url, verification_status, city, country, industry, short_description, deleted_at'
      )
      .eq('id', companyId)
      .maybeSingle();

    if (error) {
      // Retry without optional columns if schema is sparse
      if (/column|schema cache|does not exist/i.test(error.message)) {
        const retry = await supabase
          .from('profiles')
          .select(
            'id, trading_name, legal_name, logo_url, verification_status, city, country, industry, short_description'
          )
          .eq('id', companyId)
          .maybeSingle();
        if (retry.error) {
          return NextResponse.json(
            { error: retry.error.message },
            { status: 500 }
          );
        }
        if (!retry.data) {
          return NextResponse.json(
            {
              error: 'Company not found',
              detail:
                'This rate link does not match a company on SupplierAdvisor.',
              code: 'NOT_FOUND',
            },
            { status: 404 }
          );
        }
        const p = retry.data;
        return NextResponse.json({
          success: true,
          company: {
            id: Number(p.id),
            name: p.trading_name || p.legal_name || `Company #${companyId}`,
            logo_url: p.logo_url ?? null,
            verified:
              String(p.verification_status || '').toLowerCase() === 'verified',
            city: p.city ?? null,
            country: p.country ?? null,
            industry: p.industry ?? null,
            blurb: p.short_description ?? null,
          },
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json(
        {
          error: 'Company not found',
          detail: 'This rate link does not match a company on SupplierAdvisor.',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }
    if ((profile as { deleted_at?: string | null }).deleted_at) {
      return NextResponse.json(
        { error: 'Company unavailable', code: 'DELETED' },
        { status: 404 }
      );
    }

    const name =
      profile.trading_name || profile.legal_name || `Company #${companyId}`;

    return NextResponse.json({
      success: true,
      company: {
        id: Number(profile.id),
        name,
        logo_url: profile.logo_url ?? null,
        verified:
          String(profile.verification_status || '').toLowerCase() ===
          'verified',
        city: profile.city ?? null,
        country: profile.country ?? null,
        industry: profile.industry ?? null,
        blurb: profile.short_description ?? null,
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
    const companyId = Number(body.companyId || body.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json(
        { error: 'companyId required', code: 'BAD_ID' },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'ip';
    const rl = checkRateLimit({
      key: `co-rate:${companyId}:${ip}`,
      limit: 15,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const rating = Math.min(5, Math.max(1, Number(body.rating) || 0));
    if (!rating) {
      return NextResponse.json(
        { error: 'Star rating 1–5 is required' },
        { status: 400 }
      );
    }

    const contactName = body.contact_name
      ? String(body.contact_name).trim().slice(0, 120)
      : null;
    const contactEmail = body.contact_email
      ? String(body.contact_email).toLowerCase().trim().slice(0, 160)
      : null;
    const notes = body.notes
      ? String(body.notes).trim().slice(0, 2000)
      : null;
    const source = String(body.source || 'quote_qr').slice(0, 40);
    const quality = body.quality != null ? Boolean(body.quality) : null;
    const communication =
      body.communication != null ? Boolean(body.communication) : null;
    const value = body.value != null ? Boolean(body.value) : null;

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, trading_name, deleted_at')
      .eq('id', companyId)
      .maybeSingle();

    if (!profile || (profile as { deleted_at?: string | null }).deleted_at) {
      return NextResponse.json(
        { error: 'Company not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const meta = {
      rating,
      notes,
      contactName,
      contactEmail,
      quality,
      communication,
      value,
      source,
      ip: ip.slice(0, 64),
    };

    // Prefer invoice_feedback-style row when table accepts null invoice
    let stored: 'feedback' | 'activity' = 'activity';
    const { error: fbErr } = await supabase.from('invoice_feedback').insert({
      profile_id: companyId,
      invoice_id: null,
      invoice_number: null,
      feedback_type: 'public_company_rate',
      rating,
      otifef_score: rating * 20,
      title: `Public rating from ${source}`,
      body: notes,
      contact_email: contactEmail,
      contact_name: contactName,
      metadata: meta,
      created_at: new Date().toISOString(),
    });

    if (!fbErr) {
      stored = 'feedback';
    } else {
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        action: 'company.public_rating',
        entity_type: 'profile',
        entity_id: String(companyId),
        summary: `Public rating ${rating}/5${contactName ? ` from ${contactName}` : ''}${source ? ` · ${source}` : ''}`,
        metadata: meta,
      });
    }

    // In-app notification for the company
    void supabase.from('notifications').insert({
      profile_id: companyId,
      type: 'public_rating',
      title: `New public rating: ${rating}/5`,
      body: notes
        ? String(notes).slice(0, 160)
        : contactName
          ? `From ${contactName}`
          : 'Someone rated you from a quotation QR',
      metadata: meta,
      read: false,
    });

    return NextResponse.json({
      success: true,
      stored,
      message: 'Thank you — your rating helps build trust on SupplierAdvisor.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
