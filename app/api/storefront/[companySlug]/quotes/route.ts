import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  getStoreProduct,
  resolveStoreCompany,
} from '@/lib/storefront/catalog';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  calcDocTotals,
  docNumber,
  normalizeItems,
} from '@/lib/customers/documents';
import { logActivity } from '@/lib/customers/access';

/**
 * POST /api/storefront/{companySlug}/quotes
 * B2B quote request against seller (institutional / NSNP quote-first).
 *
 * Body (anonymous or logged-in):
 * {
 *   companyId?, privyUserId?,  // buyer company when logged in
 *   contactName, contactEmail, contactPhone?,
 *   tradingName?,
 *   lines: [{ name, sku?, externalRef?, quantity, notes? }],
 *   notes?, channel?, source?, ref?, product?
 * }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ companySlug: string }> | { companySlug: string } }
) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`storefront-quote:${ip}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many quote requests. Try again later.' },
        { status: 429 }
      );
    }

    const params = await Promise.resolve(ctx.params);
    const seller = await resolveStoreCompany(params.companySlug);
    if (!seller || !seller.id) {
      return NextResponse.json(
        {
          error:
            'Seller store is not fully provisioned yet. Contact Big Five Foods via the marketing site or try again after catalog seed.',
          code: 'SELLER_NOT_READY',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    // Accept marketing-site contract + extended multi-line body
    const contactEmail = String(body.contactEmail || body.email || '')
      .toLowerCase()
      .trim();
    const contactName = String(body.contactName || body.name || '').trim();
    const tradingName = String(
      body.tradingName ||
        body.companyName ||
        body.organisation ||
        body.organization ||
        contactName ||
        'Storefront buyer'
    ).trim();
    const contactPhone = body.contactPhone || body.phone || null;
    const message = body.message != null ? String(body.message) : null;

    if (!contactEmail.includes('@')) {
      return NextResponse.json(
        { error: 'A valid contact email is required' },
        { status: 400 }
      );
    }

    const rawLines: Array<Record<string, unknown>> = Array.isArray(body.lines)
      ? body.lines
      : [];
    // Multi-product from marketing order list
    if (!rawLines.length && body.products) {
      const ids = String(body.products)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const id of ids) {
        rawLines.push({
          externalRef: id,
          product: id,
          name: body.productName || id,
          quantity: Number(body.quantity) || 1,
        });
      }
    }
    if (!rawLines.length && (body.sku || body.externalRef || body.product)) {
      rawLines.push({
        sku: body.sku,
        externalRef: body.externalRef || body.product,
        name: body.productName || body.name || 'Product',
        quantity: Number(body.quantity) || 1,
      });
    }
    if (!rawLines.length) {
      return NextResponse.json(
        { error: 'Add at least one line to request a quote' },
        { status: 400 }
      );
    }

    // Optional buyer company (authenticated)
    let buyerCompanyId: number | null = null;
    const requestedCompanyId = Number(body.companyId || 0);
    if (Number.isFinite(requestedCompanyId) && requestedCompanyId > 0) {
      const gate = await requireCompanyAccess(request, requestedCompanyId, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (gate.ok) buyerCompanyId = requestedCompanyId;
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Resolve product display lines
    const items = [];
    for (const line of rawLines) {
      const key = String(
        line.externalRef || line.product || line.sku || line.productId || ''
      );
      let name = String(line.name || '').trim();
      let sku = line.sku ? String(line.sku) : null;
      let unit = Number(line.unitPrice);
      if (key) {
        const p = await getStoreProduct(seller, key);
        if (p) {
          name = name || p.name;
          sku = sku || p.sku;
          if (!Number.isFinite(unit) && p.price != null) unit = p.price;
        }
      }
      if (!name) name = sku || 'Line item';
      const qty = Math.max(1, Number(line.quantity) || 1);
      const unit_price = Number.isFinite(unit) ? unit : 0;
      items.push({
        name,
        sku,
        quantity: qty,
        unit_price,
        line_total: Math.round(qty * unit_price * 100) / 100,
        uom: 'unit',
        currency: 'ZAR',
        notes: line.notes || null,
      });
    }

    const totals = calcDocTotals(normalizeItems(items), 15);
    const attribution = {
      source: body.source || null,
      ref: body.ref || null,
      channel: body.channel || null,
      product: body.product || null,
      store_slug: seller.slug,
      buyer_company_id: buyerCompanyId,
    };

    const notes = [
      message || (body.notes ? String(body.notes) : ''),
      `[storefront quote request]`,
      `sla=response within 1 business day`,
      attribution.source ? `source=${attribution.source}` : '',
      attribution.ref ? `ref=${attribution.ref}` : '',
      attribution.channel ? `channel=${attribution.channel}` : '',
      contactName ? `contact=${contactName}` : '',
      contactEmail ? `email=${contactEmail}` : '',
      contactPhone ? `phone=${contactPhone}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Ensure CRM customer under seller
    let customerId: number | null = null;
    {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', seller.id)
        .ilike('email', contactEmail)
        .limit(1)
        .maybeSingle();
      if (existingCust?.id) {
        customerId = Number(existingCust.id);
      } else {
        const { data: created } = await supabase
          .from('customers')
          .insert({
            profile_id: seller.id,
            trading_name: tradingName,
            email: contactEmail,
            contact_name: contactName || null,
            phone: contactPhone ? String(contactPhone) : null,
            status: 'active',
            source: 'storefront',
            notes: `From storefront ${seller.slug}`,
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single();
        if (created?.id) {
          customerId = Number(created.id);
          const { ensureCustomerArLeaf } = await import(
            '@/lib/accounting/party-gl-accounts'
          );
          await ensureCustomerArLeaf({
            profileId: seller.id,
            customerId: Number(created.id),
            name: tradingName || 'Customer',
          });
        }
      }
    }

    const quoteNumber = docNumber('QT');
    const quotePayload: Record<string, unknown> = {
      profile_id: seller.id,
      customer_id: customerId,
      quote_number: quoteNumber,
      status: 'draft',
      currency: 'ZAR',
      subtotal: totals.subtotal,
      tax_rate: totals.tax_rate,
      tax_amount: totals.tax_amount,
      total_amount: totals.total_amount,
      customer_name: tradingName,
      contact_name: contactName || null,
      contact_email: contactEmail,
      contact_phone: contactPhone ? String(contactPhone) : null,
      notes,
      items,
      terms: 'Quote request from public storefront — prices subject to confirmation.',
      created_at: now,
      updated_at: now,
    };

    const { data: quote, error: qErr } = await supabase
      .from('customer_quotes')
      .insert(quotePayload)
      .select('id, quote_number, status, total_amount')
      .single();

    if (qErr) {
      // Soft fallback without optional columns
      const minimal = {
        profile_id: seller.id,
        quote_number: quoteNumber,
        status: 'draft',
        currency: 'ZAR',
        total_amount: totals.total_amount,
        customer_name: tradingName,
        contact_email: contactEmail,
        notes,
        items,
        created_at: now,
        updated_at: now,
      };
      const retry = await supabase
        .from('customer_quotes')
        .insert(minimal)
        .select('id, quote_number, status, total_amount')
        .single();
      if (retry.error) {
        return NextResponse.json(
          {
            error: 'Could not create quote request',
            details: qErr.message,
            hint: 'Ensure customer_quotes table exists (CRM sales lifecycle migration)',
          },
          { status: 500 }
        );
      }
      await logActivity({
        profile_id: seller.id,
        action: 'storefront.quote_request',
        entity_type: 'customer_quotes',
        entity_id: String(retry.data?.id),
        summary: `Storefront quote ${quoteNumber} from ${tradingName}`,
        metadata: attribution,
      });
      await notifySellerQuote({
        sellerId: seller.id,
        sellerName: seller.tradingName,
        quoteNumber,
        tradingName,
        contactEmail,
        contactName,
        channel: String(attribution.channel || ''),
        source: String(attribution.source || ''),
      });
      return NextResponse.json({
        ok: true,
        success: true,
        quoteId: retry.data?.id ?? quoteNumber,
        quote: retry.data,
        sla: 'Response within 1 business day',
        message:
          'Quote request received. We aim to respond within 1 business day with pricing and terms.',
        seller: { id: seller.id, slug: seller.slug, tradingName: seller.tradingName },
        next: buyerCompanyId
          ? {
              connect: `/dashboard/connections/discover?peer=${seller.id}`,
              store: `/store/${seller.slug}`,
            }
          : {
              onboarding: `/onboarding?type=business&partner=${seller.slug}&intent=order`,
              store: `/store/${seller.slug}`,
            },
      });
    }

    await logActivity({
      profile_id: seller.id,
      action: 'storefront.quote_request',
      entity_type: 'customer_quotes',
      entity_id: String(quote?.id),
      summary: `Storefront quote ${quoteNumber} from ${tradingName}`,
      metadata: attribution,
    });

    await notifySellerQuote({
      sellerId: seller.id,
      sellerName: seller.tradingName,
      quoteNumber,
      tradingName,
      contactEmail,
      contactName,
      channel: String(attribution.channel || ''),
      source: String(attribution.source || ''),
    });

    // Soft handshake: pending connection from buyer → seller
    if (buyerCompanyId && buyerCompanyId !== seller.id) {
      try {
        await supabase.from('business_connections').upsert(
          {
            requester_profile_id: buyerCompanyId,
            requestee_profile_id: seller.id,
            status: 'pending',
            connection_type: 'customer',
            notes: `Storefront quote ${quoteNumber}`,
            metadata: attribution,
            updated_at: now,
          },
          { onConflict: 'requester_profile_id,requestee_profile_id' }
        );
      } catch {
        /* unique index may differ */
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      quoteId: quote?.id ?? quoteNumber,
      quote,
      sla: 'Response within 1 business day',
      message:
        'Quote request received. We aim to respond within 1 business day with pricing and terms on SupplierAdvisor®.',
      seller: {
        id: seller.id,
        slug: seller.slug,
        tradingName: seller.tradingName,
      },
      next: buyerCompanyId
        ? {
            connect: `/dashboard/connections/discover?peer=${seller.id}`,
            store: `/store/${seller.slug}`,
            po: `/dashboard/suppliers/po?peer=${seller.id}`,
          }
        : {
            onboarding: `/onboarding?type=business&partner=${seller.slug}&intent=order`,
            login: `/login?next=${encodeURIComponent(`/store/${seller.slug}`)}`,
            store: `/store/${seller.slug}`,
          },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** Soft notify seller email + buyer confirmation when Resend is configured */
async function notifySellerQuote(opts: {
  sellerId: number;
  sellerName: string;
  quoteNumber: string;
  tradingName: string;
  contactEmail: string;
  contactName: string;
  channel: string;
  source: string;
}) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const { getResend, getResendFrom } = await import('@/lib/resend');
    const resend = getResend();
    const from = getResendFrom();
    const supabase = getSupabaseAdmin();
    const { data: prof } = await supabase
      .from('profiles')
      .select('email, contact_email, trading_name')
      .eq('id', opts.sellerId)
      .maybeSingle();
    const sellerTo =
      String(prof?.email || prof?.contact_email || '').trim() || null;
    const app =
      process.env.NEXT_PUBLIC_APP_URL || 'https://www.supplieradvisor.com';
    const quotesUrl = `${app.replace(/\/$/, '')}/dashboard/customers/quotes`;

    if (sellerTo?.includes('@')) {
      await resend.emails.send({
        from,
        to: sellerTo,
        subject: `New storefront quote ${opts.quoteNumber} — ${opts.tradingName}`,
        html: `<p><strong>New quote request</strong> on SupplierAdvisor®</p>
<p>Quote: <strong>${opts.quoteNumber}</strong><br/>
Buyer: ${opts.tradingName} · ${opts.contactName} · ${opts.contactEmail}<br/>
Channel: ${opts.channel || '—'} · Source: ${opts.source || 'storefront'}</p>
<p>SLA: respond within <strong>1 business day</strong>.</p>
<p><a href="${quotesUrl}">Open Quotes inbox</a></p>`,
      });
    }

    // Buyer confirmation
    if (opts.contactEmail.includes('@')) {
      await resend.emails.send({
        from,
        to: opts.contactEmail,
        subject: `Quote request received — ${opts.sellerName}`,
        html: `<p>Hi ${opts.contactName || 'there'},</p>
<p>We received your quote request <strong>${opts.quoteNumber}</strong> for <strong>${opts.sellerName}</strong> on SupplierAdvisor®.</p>
<p>We aim to respond within <strong>1 business day</strong> with pricing and terms.</p>
<p>This is a verified B2B trade network — not a second order book.</p>
<p>— SupplierAdvisor®</p>`,
      });
    }
  } catch (e) {
    console.warn('storefront quote notify soft-fail', e);
  }
}
