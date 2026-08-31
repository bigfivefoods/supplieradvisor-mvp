import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/customers/access';
import { docNumber, formatMoney } from '@/lib/customers/documents';
import { buildPurchaseOrderPdf } from '@/lib/procurement/po-document-pdf';
import {
  isLegacyPoNumber,
  normalizeEmail,
  purchaseOrderCcList,
  purchaseOrderEmailHtml,
  purchaseOrderEmailSubject,
  purchaseOrderPdfFilename,
  srmIdFromPo,
} from '@/lib/procurement/po-email';
import { assemblePurchaseOrderPdfInput } from '@/lib/procurement/po-parties';
import { poHostedByBuyer } from '@/lib/portals/supplier-portal-party';

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
      .maybeSingle();
    if (poErr) {
      return NextResponse.json({ error: poErr.message }, { status: 500 });
    }
    if (!po || !poHostedByBuyer(po as Record<string, unknown>, companyId)) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const assembled = await assemblePurchaseOrderPdfInput({
      companyId,
      po: po as Record<string, unknown>,
      toOverride: body.to,
    });
    const { srm, buyer, supplier: supplierParty, to } = assembled;
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

    const senderEmail =
      normalizeEmail(body.cc) ||
      normalizeEmail(gate.emails?.[0]) ||
      normalizeEmail(member?.email) ||
      normalizeEmail(member?.invited_email) ||
      normalizeEmail(buyer.email);

    const ccMe = body.ccMe !== false;
    const cc = purchaseOrderCcList({
      to,
      ccMe,
      senderEmail,
    });

    const buyerName = buyer.name || 'Buyer';
    const supplierName = supplierParty.name || String(po.supplier_name || 'Supplier');
    const number = assembled.input.number;
    const currency = String(assembled.input.currency || po.currency || 'ZAR').toUpperCase();
    const total = assembled.input.totalAmount;

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildPurchaseOrderPdf(assembled.input);
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
      contactName:
        supplierParty.contact_name ||
        (srm?.contact_name != null ? String(srm.contact_name) : null),
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
    const nowIso = new Date().toISOString();
    const prevMeta =
      po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
        ? { ...(po.metadata as Record<string, unknown>) }
        : {};
    const srmId = srmIdFromPo(po as { supplier_id?: unknown; metadata?: unknown });
    if (srmId && !Number(prevMeta.srm_supplier_id)) {
      prevMeta.srm_supplier_id = srmId;
    }
    try {
      const { uploadPortalDocument } = await import('@/lib/portals/portal-storage');
      const stored = await uploadPortalDocument({
        path: `${companyId}/portal-po/po-${id}-${Date.now()}.pdf`,
        body: pdfBuffer,
        contentType: 'application/pdf',
      });
      if (stored.ok) {
        prevMeta.pdf_url = stored.url;
        prevMeta.attachment_url = stored.url;
      }
    } catch (storeErr) {
      console.warn('PO PDF store', storeErr);
    }
    const patch: Record<string, unknown> = {
      buyer_profile_id: companyId,
      metadata: prevMeta,
      updated_at: nowIso,
    };
    if (prev === 'draft') patch.status = 'sent';
    // Stamp a real po_number on legacy rows when sending
    if (isLegacyPoNumber(po.po_number as string | null | undefined)) {
      patch.po_number = docNumber('PO');
    }
    const { error: upErr } = await supabase
      .from('purchase_orders')
      .update(patch)
      .eq('id', id);
    if (upErr) {
      console.warn('PO email status sent patch', upErr.message);
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
