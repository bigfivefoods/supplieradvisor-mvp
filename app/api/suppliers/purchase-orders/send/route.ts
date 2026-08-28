import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/customers/access';
import { normalizePoItems } from '@/lib/procurement/types';
import { formatMoney } from '@/lib/customers/documents';
import { buildPurchaseOrderPdf } from '@/lib/procurement/po-document-pdf';
import {
  formatPurchaseOrderNumber,
  normalizeEmail,
  purchaseOrderCcList,
  purchaseOrderEmailHtml,
  purchaseOrderEmailSubject,
  purchaseOrderPdfFilename,
  srmIdFromPo,
} from '@/lib/procurement/po-email';

/**
 * POST { companyId, id, to?, ccMe?, message? }
 * Emails a purchase order (not an invoice) to the supplier and CCs the sender.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: 'Email is not configured',
          hint: 'Set RESEND_API_KEY on the server (Vercel env).',
        },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .eq('buyer_profile_id', companyId)
      .maybeSingle();
    if (poErr) {
      return NextResponse.json({ error: poErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const srmId = srmIdFromPo(po);
    let srm: {
      id?: number;
      trading_name?: string | null;
      email?: string | null;
      phone?: string | null;
      contact_name?: string | null;
      linked_profile_id?: number | null;
    } | null = null;
    if (srmId) {
      const { data } = await supabase
        .from('srm_suppliers')
        .select('id, trading_name, email, phone, contact_name, linked_profile_id')
        .eq('id', srmId)
        .eq('profile_id', companyId)
        .maybeSingle();
      srm = data;
    }
    if (!srm && po.supplier_profile_id) {
      const { data } = await supabase
        .from('srm_suppliers')
        .select('id, trading_name, email, phone, contact_name, linked_profile_id')
        .eq('profile_id', companyId)
        .eq('linked_profile_id', Number(po.supplier_profile_id))
        .maybeSingle();
      srm = data;
    }

    const to =
      normalizeEmail(body.to) ||
      normalizeEmail(srm?.email) ||
      normalizeEmail(
        po.metadata && typeof po.metadata === 'object'
          ? (po.metadata as Record<string, unknown>).supplier_email
          : null
      );
    if (!to) {
      return NextResponse.json(
        {
          error: 'Supplier email required',
          code: 'SUPPLIER_EMAIL_REQUIRED',
          hint:
            'Add an email on the supplier profile, or pass to: on this request.',
        },
        { status: 400 }
      );
    }

    const { data: members } = await supabase
      .from('business_users')
      .select('email, invited_email, user_id')
      .eq('profile_id', companyId)
      .eq('status', 'active')
      .limit(20);

    const member =
      (members || []).find((m) =>
        String(m.user_id || '')
          .toLowerCase()
          .includes(
            String(gate.userId || '')
              .toLowerCase()
              .replace(/^did:privy:/, '')
          )
      ) || (members || [])[0];

    const { data: buyerProf } = await supabase
      .from('profiles')
      .select(
        'trading_name, legal_name, email, contact_email, phone, vat_number, registration_number, address, city, country, logo_url'
      )
      .eq('id', companyId)
      .maybeSingle();

    const senderEmail =
      normalizeEmail(body.cc) ||
      normalizeEmail(gate.emails?.[0]) ||
      normalizeEmail(member?.email) ||
      normalizeEmail(member?.invited_email) ||
      normalizeEmail(buyerProf?.email) ||
      normalizeEmail(buyerProf?.contact_email);

    const ccMe = body.ccMe !== false;
    const cc = purchaseOrderCcList({
      to,
      ccMe,
      senderEmail,
    });

    const buyerName =
      String(buyerProf?.trading_name || buyerProf?.legal_name || '').trim() ||
      'Buyer';
    const supplierName =
      String(
        po.supplier_name || srm?.trading_name || 'Supplier'
      ).trim() || 'Supplier';
    const number = formatPurchaseOrderNumber({
      id: Number(po.id),
      po_number: po.po_number,
      order_number: po.order_number,
    });
    const currency = String(po.currency || 'ZAR').toUpperCase();
    const normalized = normalizePoItems(po.items || []);
    const items = 'items' in normalized ? normalized.items : [];
    const total =
      Number(po.total_amount) ||
      ('total' in normalized ? normalized.total : 0);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildPurchaseOrderPdf({
        number,
        status: po.status,
        issuedAt: String(po.created_at || '').slice(0, 10),
        promisedDate: po.promised_date
          ? String(po.promised_date).slice(0, 10)
          : null,
        paymentTerms: po.payment_terms ? String(po.payment_terms) : null,
        currency,
        notes: po.description ? String(po.description) : null,
        items,
        totalAmount: total,
        buyer: {
          name: buyerName,
          legal_name: buyerProf?.legal_name || null,
          email: buyerProf?.email || buyerProf?.contact_email || senderEmail,
          phone: buyerProf?.phone || null,
          vat_number: buyerProf?.vat_number || null,
          registration_number: buyerProf?.registration_number || null,
          address: buyerProf?.address || null,
          city: buyerProf?.city || null,
          country: buyerProf?.country || null,
        },
        supplier: {
          name: supplierName,
          email: to,
          phone: srm?.phone || null,
          contact_name: srm?.contact_name || null,
        },
      });
    } catch (pdfErr) {
      console.error('PO PDF build failed', pdfErr);
      return NextResponse.json(
        {
          error: 'Failed to generate purchase order PDF',
          hint: pdfErr instanceof Error ? pdfErr.message : 'PDF error',
        },
        { status: 500 }
      );
    }

    const resend = getResend();
    const from = getResendFrom();
    const replyTo = senderEmail || getResendReplyTo() || undefined;
    const resendFlag = body.resend === true;
    const subject = purchaseOrderEmailSubject({
      number,
      buyerName,
      resend: resendFlag,
    });
    const html = purchaseOrderEmailHtml({
      supplierName,
      contactName: srm?.contact_name || null,
      buyerName,
      number,
      totalLabel: formatMoney(total, currency),
      promisedDate: po.promised_date
        ? String(po.promised_date).slice(0, 10)
        : null,
      message: body.message != null ? String(body.message) : null,
      senderCopied: cc.length > 0,
    });

    const { error: sendErr } = await resend.emails.send({
      from,
      to: [to],
      cc: cc.length ? cc : undefined,
      replyTo: replyTo || undefined,
      subject,
      html,
      attachments: [
        {
          filename: purchaseOrderPdfFilename(number),
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    if (sendErr) {
      return NextResponse.json(
        {
          error:
            typeof sendErr === 'object'
              ? JSON.stringify(sendErr)
              : String(sendErr),
        },
        { status: 502 }
      );
    }

    const prev = String(po.status || '').toLowerCase();
    if (prev === 'draft') {
      const nowIso = new Date().toISOString();
      const { error: upErr } = await supabase
        .from('purchase_orders')
        .update({ status: 'sent', updated_at: nowIso })
        .eq('id', id)
        .eq('buyer_profile_id', companyId);
      if (upErr) {
        console.warn('PO email status sent patch', upErr.message);
      }
    }

    void logActivity({
      profile_id: companyId,
      actor_user_id: gate.userId,
      action: 'po.email',
      entity_type: 'purchase_order',
      entity_id: String(id),
      summary: `Emailed purchase order ${number} to ${to}`,
      metadata: { to, cc, number, supplierName },
    });

    return NextResponse.json({
      success: true,
      to,
      cc,
      number,
      kind: 'purchase_order',
      status: prev === 'draft' ? 'sent' : po.status,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
