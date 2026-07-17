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
import { commercialDocWhatsAppText } from '@/lib/invites/whatsapp';
import {
  isTwilioWhatsAppConfigured,
  sendWhatsAppDocument,
} from '@/lib/notifications/twilio-whatsapp';
import { commercialPdfFilename } from '@/lib/customers/commercial-doc-pdf';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';

const TABLES = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
} as const;

/**
 * POST { companyId, type, id, to?, message? }
 *
 * Prefers sending the *actual PDF document* via Twilio WhatsApp MediaUrl
 * (appears as a file in chat, not only a link). Falls back to client share
 * payload (pdfUrl + text) when Twilio is not configured.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const type = String(body.type || 'invoice').toLowerCase() as keyof typeof TABLES;
    const toPhone = String(body.to || body.phone || '').trim();

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
    const loaded = await loadCommercialDocument({
      companyId,
      type,
      id,
    });
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const token = buildDocShareToken({
      companyId,
      type,
      id,
      ttlSeconds: type === 'quote' ? 60 * 60 * 24 * 45 : 60 * 60 * 24 * 30,
    });
    const pdfUrl = commercialDocPdfUrl(token);
    const filename = commercialPdfFilename(loaded.input);
    const number = loaded.input.number;
    const sellerName =
      loaded.input.seller.trading_name ||
      loaded.input.seller.legal_name ||
      'Supplier';
    const siteLink =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com';

    const items = Array.isArray(loaded.input.items) ? loaded.input.items : [];
    const lineSummary = items.slice(0, 6).map((l) => {
      const qty = Number(l.quantity || 0);
      const uom = l.uom ? ` ${String(l.uom)}` : '';
      return `${l.name || 'Line'} × ${qty}${uom}`;
    });

    // Prefer explicit phone, then document contact fields
    const docPhone =
      toPhone ||
      String(
        loaded.input.contactPhone ||
          (loaded.doc as { contact_phone?: string }).contact_phone ||
          ''
      ).trim();

    const textBase = {
      kind: type as 'quote' | 'order' | 'invoice',
      number,
      customerName: loaded.input.customerName || null,
      contactName: loaded.input.contactName || null,
      amount: Number(loaded.input.totalAmount || 0),
      currency: String(loaded.input.currency || 'ZAR'),
      status: String(loaded.input.status || '') || null,
      dueDate: loaded.input.dueDate || null,
      validUntil: loaded.input.validUntil || null,
      promisedDate:
        (loaded.doc as { promised_date?: string | null }).promised_date || null,
      sellerName,
      notes: loaded.input.notes || null,
      lineSummary,
      siteLink: siteLink.replace(/\/$/, ''),
    };

    // ── Prefer Twilio: real PDF document attachment ───────────────────────
    if (isTwilioWhatsAppConfigured() && docPhone.replace(/\D/g, '').length >= 9) {
      const bodyText = commercialDocWhatsAppText({
        ...textBase,
        pdfAttached: true,
        link: null,
      });
      const custom =
        body.message != null && String(body.message).trim()
          ? `${String(body.message).trim()}\n\n${bodyText}`
          : bodyText;

      const send = await sendWhatsAppDocument({
        to: docPhone,
        body: custom.slice(0, 1500),
        mediaUrl: pdfUrl,
      });

      if (send.ok) {
        void supabase.from('activity_log').insert({
          profile_id: companyId,
          actor_user_id: gate.userId,
          action: `${type}.whatsapp_pdf_document`,
          entity_type: TABLES[type],
          entity_id: String(id),
          summary: `Sent ${type} ${number} PDF document via WhatsApp to ${docPhone}`,
          metadata: { pdfUrl, via: 'twilio_media' },
        });
        return NextResponse.json({
          success: true,
          sentVia: 'twilio_document',
          pdfUrl,
          filename,
          to: docPhone,
          message:
            'PDF document sent on WhatsApp (file attachment + SupplierAdvisor link in the message).',
        });
      }
      // Fall through to client payload if Twilio fails
      console.warn('[whatsapp-send] Twilio document failed:', send.error);
    }

    // Client will attach PDF via Web Share API or open wa.me with PDF + site link
    const clientText = commercialDocWhatsAppText({
      ...textBase,
      pdfAttached: false,
      link: pdfUrl,
    });

    return NextResponse.json({
      success: true,
      sentVia: 'client',
      pdfUrl,
      filename,
      text: clientText,
      to: docPhone || null,
      twilioConfigured: isTwilioWhatsAppConfigured(),
      message:
        'Open WhatsApp to share the PDF document (file share on mobile, or PDF opens in chat).',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'WhatsApp send failed' },
      { status: 500 }
    );
  }
}
