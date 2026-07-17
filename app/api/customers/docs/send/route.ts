import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';
import {
  buildCommercialDocumentPdf,
  commercialPdfFilename,
} from '@/lib/customers/commercial-doc-pdf';
import {
  buildDocShareToken,
  commercialDocPdfUrl,
} from '@/lib/customers/doc-share-token';

const TABLES = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
} as const;

const LABELS = {
  quote: 'Quotation',
  order: 'Sales order',
  invoice: 'Invoice',
} as const;

/**
 * POST { companyId, type, id, to?, ccMe?, message? }
 * Emails document using company identity (logo/VAT/reg/bank) and customer email from CRM.
 * CC you by default.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const type = String(body.type || 'invoice').toLowerCase() as keyof typeof TABLES;
    if (!Number.isFinite(companyId) || !Number.isFinite(id) || !TABLES[type]) {
      return NextResponse.json({ error: 'companyId, type, id required' }, { status: 400 });
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

    const loaded = await loadCommercialDocument({ companyId, type, id });
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const {
      input,
      toEmail,
      bankDetailsIncluded,
      doc,
      softWarnings = [],
      hasLogo,
      hasVat,
      hasRegistration,
    } = loaded;
    const forceSend = body.forceSend === true || body.force === true;
    const acknowledgeSoft =
      body.acknowledgeSoftWarnings === true ||
      body.ackSoft === true ||
      forceSend;

    // Quality gate: require bank details on invoices unless forceSend
    if (
      type === 'invoice' &&
      !bankDetailsIncluded &&
      !forceSend
    ) {
      return NextResponse.json(
        {
          error: 'Bank details missing on seller profile',
          code: 'BANK_DETAILS_REQUIRED',
          bankWarning:
            'Add bank details under My Business → Profile → Banking, or retry with forceSend: true to send without EFT block.',
          hint: 'Complete Banking (bank name, account number, branch code) then Email again.',
          softWarnings,
        },
        { status: 400 }
      );
    }

    // Soft gate: logo / VAT / reg — only hard-block when client opts into strict quality
    if (
      softWarnings.length > 0 &&
      !acknowledgeSoft &&
      body.requireQuality === true
    ) {
      return NextResponse.json(
        {
          error: 'Document quality warnings',
          code: 'SOFT_QUALITY_WARNINGS',
          softWarnings,
          hasLogo,
          hasVat,
          hasRegistration,
          bankDetailsIncluded,
          hint:
            'Add logo, VAT, or registration on Profile — or resend with acknowledgeSoftWarnings: true.',
        },
        { status: 422 }
      );
    }

    const to =
      String(body.to || toEmail || '')
        .toLowerCase()
        .trim() || '';
    if (!to || !to.includes('@')) {
      return NextResponse.json(
        {
          error: 'Customer email required',
          hint:
            'Ensure the customer profile has an email, or the invoice contact_email is set. Then try Email again.',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
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

    const isResend =
      body.resend === true ||
      ['sent', 'partial', 'overdue', 'paid', 'viewed'].includes(
        String(doc.status || '').toLowerCase()
      );

    const sellerName =
      input.seller.trading_name || input.seller.legal_name || 'Your supplier';
    const number = input.number;
    const subject = isResend
      ? `Reminder: ${LABELS[type]} ${number} from ${sellerName}`
      : `${LABELS[type]} ${number} from ${sellerName}`;
    const firstName = input.contactName
      ? String(input.contactName).split(' ')[0]
      : '';
    const intro =
      body.message != null && String(body.message).trim()
        ? `<p style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a;line-height:1.5">${String(
            body.message
          )
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</p>`
        : type === 'invoice'
          ? isResend
            ? `<p style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a;line-height:1.5">Hi${
                firstName ? ` ${firstName}` : ''
              },<br/><br/>This is a <strong>resend</strong> of <strong>invoice ${number}</strong> from <strong>${sellerName}</strong>. The PDF is attached — payment details are on the invoice. Use <strong>${number}</strong> as your payment reference.</p>`
            : `<p style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a;line-height:1.5">Hi${
                firstName ? ` ${firstName}` : ''
              },<br/><br/>Please find <strong>invoice ${number}</strong> from <strong>${sellerName}</strong> as a PDF attachment. Payment can be made by bank transfer — details are on the invoice. Use <strong>${number}</strong> as your payment reference.</p>`
          : type === 'quote'
            ? `<p style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a;line-height:1.5">Hi${
                firstName ? ` ${firstName}` : ''
              },<br/><br/>Please find <strong>quotation ${number}</strong> from <strong>${sellerName}</strong> as a PDF attachment${
                isResend ? ' (resend)' : ''
              }.${
                input.validUntil
                  ? ` Valid until <strong>${String(input.validUntil).slice(0, 10)}</strong>.`
                  : ''
              }</p>`
            : `<p style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a;line-height:1.5">Please find your ${LABELS[type].toLowerCase()} <strong>${number}</strong> from <strong>${sellerName}</strong> as a PDF attachment${
                isResend ? ' (resend)' : ''
              }.</p>`;

    const cc: string[] = [];
    if (body.ccMe !== false) {
      const me = String(
        body.cc ||
          member?.email ||
          member?.invited_email ||
          input.seller.email ||
          input.seller.contact_email ||
          ''
      )
        .toLowerCase()
        .trim();
      if (me.includes('@') && me !== to) cc.push(me);
    }

    // Beautiful PDF attachment (pdfkit)
    let pdfBuffer: Buffer;
    let pdfName: string;
    try {
      pdfBuffer = await buildCommercialDocumentPdf(input);
      pdfName = commercialPdfFilename(input);
    } catch (pdfErr) {
      console.error('commercial PDF build failed:', pdfErr);
      return NextResponse.json(
        {
          error: 'Failed to generate PDF attachment',
          hint: pdfErr instanceof Error ? pdfErr.message : 'PDF error',
        },
        { status: 500 }
      );
    }

    const shareToken = buildDocShareToken({
      companyId,
      type,
      id,
      ttlSeconds: type === 'quote' ? 60 * 60 * 24 * 45 : 60 * 60 * 24 * 30,
    });
    const pdfLink = commercialDocPdfUrl(shareToken);

    const resend = getResend();
    const from = getResendFrom();
    const replyTo =
      getResendReplyTo() ||
      input.seller.email ||
      input.seller.contact_email ||
      undefined;

    const emailHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto">
        ${intro}
        <p style="margin:20px 0">
          <a href="${pdfLink}"
             style="display:inline-block;background:#00b4d8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">
            Open PDF ${LABELS[type].toLowerCase()} →
          </a>
        </p>
        <p style="font-size:13px;color:#64748b">The formal PDF is also attached to this email for your records.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
        <p style="font-size:12px;color:#94a3b8">Sent via SupplierAdvisor® · ${sellerName}</p>
      </div>
    `;

    const { data: sent, error: sendErr } = await resend.emails.send({
      from,
      to: [to],
      cc: cc.length ? cc : undefined,
      replyTo: replyTo || undefined,
      subject,
      html: emailHtml,
      attachments: [
        {
          filename: pdfName,
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    if (sendErr) {
      return NextResponse.json(
        { error: typeof sendErr === 'object' ? JSON.stringify(sendErr) : String(sendErr) },
        { status: 502 }
      );
    }

    // Status: don't downgrade paid/partial/overdue on resend; only promote draft → sent
    if (type === 'invoice' || type === 'quote') {
      const prev = String(doc.status || '').toLowerCase();
      let nextStatus = prev;
      if (type === 'invoice') {
        if (['draft', '', 'open'].includes(prev)) nextStatus = 'sent';
        // keep paid | partial | overdue | void | sent as-is on resend
      } else if (type === 'quote' && prev === 'draft') {
        nextStatus = 'sent';
      }
      await supabase
        .from(TABLES[type])
        .update({
          status: nextStatus || 'sent',
          contact_email: to,
          customer_name: input.customerName || doc.customer_name,
          contact_name: input.contactName || doc.contact_name,
          updated_at: new Date().toISOString(),
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId);

      void supabase.from('activity_log').insert({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: isResend ? `${type}.resend` : `${type}.send`,
        entity_type: TABLES[type],
        entity_id: String(id),
        summary: `${isResend ? 'Resent' : 'Sent'} ${LABELS[type].toLowerCase()} ${number} to ${to}`,
        metadata: { to, cc, emailId: sent?.id, resend: isResend },
      });

      if (type === 'invoice') {
        void (async () => {
          try {
            const { notifyInvoiceSent } = await import(
              '@/lib/notifications/email-alerts'
            );
            await notifyInvoiceSent({
              sellerProfileId: companyId,
              customerEmail: to,
              invoiceNumber: number,
              sellerName:
                input.seller.trading_name || input.seller.legal_name || null,
              totalAmount: Number(input.totalAmount || 0),
              currency: String(input.currency || 'ZAR'),
              resend: isResend,
            });
            void supabase.from('notifications').insert({
              profile_id: companyId,
              type: 'invoice_sent',
              title: isResend ? 'Invoice re-sent' : 'Invoice sent',
              body: `${number} → ${to}`,
              metadata: { invoiceId: id, to, resend: isResend },
              read: false,
            });
          } catch {
            /* soft */
          }
        })();
      }
    }

    return NextResponse.json({
      success: true,
      emailId: sent?.id,
      to,
      cc,
      subject,
      resend: isResend,
      attachment: pdfName,
      format: 'pdf',
      pdfUrl: pdfLink,
      bankDetailsIncluded,
      bankVerified:
        String(input.seller.bank_verification_status || '').toLowerCase() ===
        'verified',
      bankWarning: bankDetailsIncluded
        ? null
        : 'Invoice sent without bank details — add Banking on company profile.',
      sellerVerified: Boolean(input.seller.is_verified),
      hasLogo: Boolean(input.seller.logo_url),
      hasVat: Boolean(input.seller.vat_number),
      hasRegistration: Boolean(input.seller.registration_number),
      softWarnings,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Send failed' },
      { status: 500 }
    );
  }
}
