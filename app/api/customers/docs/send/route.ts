import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  extractBankFromProfile,
  renderCommercialDocumentHtml,
} from '@/lib/customers/invoice-document';
import { normalizeItems } from '@/lib/customers/documents';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

const TABLES = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
} as const;

const NUM_FIELD = {
  quote: 'quote_number',
  order: 'order_number',
  invoice: 'invoice_number',
} as const;

const LABELS = {
  quote: 'Quotation',
  order: 'Sales order',
  invoice: 'Invoice',
} as const;

/**
 * POST { companyId, type, id, to?, ccMe?, message? }
 * Emails HTML document to customer; optionally CC the signed-in user / company email.
 * Invoices include bank details from company profile.
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

    const supabase = getSupabaseServer();
    const [{ data: doc, error }, { data: profile }, { data: memberRows }] =
      await Promise.all([
        supabase
          .from(TABLES[type])
          .select('*')
          .eq('id', id)
          .eq('profile_id', companyId)
          .maybeSingle(),
        supabase.from('profiles').select('*').eq('id', companyId).maybeSingle(),
        supabase
          .from('business_users')
          .select('email, invited_email, name, user_id')
          .eq('profile_id', companyId)
          .eq('status', 'active')
          .limit(20),
      ]);
    const members = memberRows || [];
    const member =
      members.find((m) =>
        String(m.user_id || '')
          .toLowerCase()
          .includes(String(gate.userId || '').toLowerCase().replace(/^did:privy:/, ''))
      ) || members[0];

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const seller = extractBankFromProfile((profile || {}) as Record<string, unknown>);
    const to =
      String(body.to || doc.contact_email || '')
        .toLowerCase()
        .trim() || '';
    if (!to || !to.includes('@')) {
      return NextResponse.json(
        {
          error: 'Customer email required',
          hint: 'Set contact email on the invoice or pass { to: "customer@…" }.',
        },
        { status: 400 }
      );
    }

    const items = normalizeItems(doc.items);
    const number = String(doc[NUM_FIELD[type]] || id);
    const html = renderCommercialDocumentHtml({
      kind: type,
      number,
      status: doc.status,
      currency: doc.currency,
      issuedAt: doc.created_at || doc.issued_at,
      dueDate: doc.due_date,
      validUntil: doc.valid_until,
      customerName: doc.customer_name,
      contactName: doc.contact_name,
      contactEmail: doc.contact_email,
      contactPhone: doc.contact_phone,
      notes: doc.notes,
      items,
      subtotal: Number(doc.subtotal || 0),
      taxRate: Number(doc.tax_rate || 0),
      taxAmount: Number(doc.tax_amount || 0),
      totalAmount: Number(doc.total_amount || 0),
      seller,
    });

    const sellerName = seller.trading_name || seller.legal_name || 'Your supplier';
    const subject = `${LABELS[type]} ${number} from ${sellerName}`;
    const intro = body.message
      ? `<p style="font-family:system-ui,sans-serif">${String(body.message)
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</p>`
      : type === 'invoice'
        ? `<p style="font-family:system-ui,sans-serif">Please find your invoice <strong>${number}</strong> below. Payment details (bank transfer) are included on the document.</p>`
        : `<p style="font-family:system-ui,sans-serif">Please find your ${LABELS[type].toLowerCase()} <strong>${number}</strong> below.</p>`;

    const cc: string[] = [];
    const ccMe = body.ccMe !== false; // default true — copy sender
    if (ccMe) {
      // Prefer explicit body.cc, then team membership email, then company profile
      const me = String(
        body.cc || member?.email || member?.invited_email || seller.email || seller.contact_email || ''
      )
        .toLowerCase()
        .trim();
      if (me.includes('@') && me !== to) cc.push(me);
    }
    // Always offer company contact email as BCC-style extra CC if different
    const companyMail = String(seller.contact_email || seller.email || '')
      .toLowerCase()
      .trim();
    if (
      body.ccCompany &&
      companyMail.includes('@') &&
      companyMail !== to &&
      !cc.includes(companyMail)
    ) {
      cc.push(companyMail);
    }

    const resend = getResend();
    const from = getResendFrom();
    const replyTo = getResendReplyTo() || seller.email || undefined;

    const { data: sent, error: sendErr } = await resend.emails.send({
      from,
      to: [to],
      cc: cc.length ? cc : undefined,
      replyTo: replyTo || undefined,
      subject,
      html: `${intro}${html}`,
      attachments: [
        {
          filename: `${type}-${number}.html`,
          content: Buffer.from(html, 'utf8').toString('base64'),
        },
      ],
    });

    if (sendErr) {
      return NextResponse.json(
        { error: typeof sendErr === 'object' ? JSON.stringify(sendErr) : String(sendErr) },
        { status: 502 }
      );
    }

    // Mark invoice/quote as sent
    if (type === 'invoice' || type === 'quote') {
      await supabase
        .from(TABLES[type])
        .update({
          status: type === 'invoice' ? 'sent' : doc.status === 'draft' ? 'sent' : doc.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId);
    }

    return NextResponse.json({
      success: true,
      emailId: sent?.id,
      to,
      cc,
      subject,
      bankDetailsIncluded: Boolean(
        seller.bank_name || seller.account_number || seller.iban
      ),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Send failed' },
      { status: 500 }
    );
  }
}
