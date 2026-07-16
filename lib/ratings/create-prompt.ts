/**
 * Create rating prompts after real trade events (PO delivered, invoice paid, etc.)
 * Soft-fail always — never block the primary transaction.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

export type CreateRatingPromptOpts = {
  /** Company that should rate (viewer) */
  profileId: number;
  /** Company being rated */
  counterpartyProfileId: number;
  counterpartyName?: string | null;
  /** How we know them: supplier | customer | partner */
  rateeRole: 'supplier' | 'customer' | 'partner';
  contextType: 'po' | 'invoice' | 'shipment' | 'connection' | 'general';
  contextId?: string | null;
  userId?: string | null;
  /** Optional email to notify */
  notifyEmail?: string | null;
};

/**
 * Idempotent-ish: skip if a pending prompt already exists for same
 * profile + counterparty + context within last 14 days.
 */
export async function createRatingPrompt(
  opts: CreateRatingPromptOpts
): Promise<{ ok: boolean; created: boolean; promptId?: number; error?: string }> {
  const profileId = Number(opts.profileId);
  const counterparty = Number(opts.counterpartyProfileId);
  if (
    !Number.isFinite(profileId) ||
    !Number.isFinite(counterparty) ||
    profileId <= 0 ||
    counterparty <= 0 ||
    profileId === counterparty
  ) {
    return { ok: false, created: false, error: 'Invalid profile pair' };
  }

  try {
    const supabase = getSupabaseServer();
    const now = new Date();
    const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    let dedupe = supabase
      .from('rating_prompts')
      .select('id')
      .eq('profile_id', profileId)
      .eq('counterparty_profile_id', counterparty)
      .eq('status', 'pending')
      .gte('created_at', since)
      .limit(1);

    if (opts.contextId) {
      dedupe = dedupe.eq('context_id', String(opts.contextId));
    }

    const { data: existing } = await dedupe.maybeSingle();
    if (existing?.id) {
      return { ok: true, created: false, promptId: Number(existing.id) };
    }

    // Resolve name if missing
    let name = opts.counterpartyName || null;
    if (!name) {
      const { data: peer } = await supabase
        .from('profiles')
        .select('trading_name, legal_name, email')
        .eq('id', counterparty)
        .maybeSingle();
      name = peer?.trading_name || peer?.legal_name || null;
    }

    const { data: row, error } = await supabase
      .from('rating_prompts')
      .insert({
        profile_id: profileId,
        user_id: opts.userId || null,
        counterparty_profile_id: counterparty,
        counterparty_name: name,
        ratee_role: opts.rateeRole,
        context_type: opts.contextType,
        context_id: opts.contextId ? String(opts.contextId) : null,
        status: 'pending',
        due_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          auto: true,
          note: 'Rate after trade — continuous supplier↔customer feedback',
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return { ok: true, created: false, error: error.message };
      }
      return { ok: false, created: false, error: error.message };
    }

    const promptId = Number(row.id);

    // Soft email nudge
    if (opts.notifyEmail && opts.notifyEmail.includes('@')) {
      void sendRatingNudgeEmail({
        to: opts.notifyEmail,
        counterpartyName: name || 'your trading partner',
        rateeRole: opts.rateeRole,
      }).catch(() => undefined);
    } else {
      // Try company contact email
      const { data: me } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', profileId)
        .maybeSingle();
      if (me?.email) {
        void sendRatingNudgeEmail({
          to: String(me.email),
          counterpartyName: name || 'your trading partner',
          rateeRole: opts.rateeRole,
        }).catch(() => undefined);
      }
    }

    return { ok: true, created: true, promptId };
  } catch (e: unknown) {
    return {
      ok: false,
      created: false,
      error: e instanceof Error ? e.message : 'createRatingPrompt failed',
    };
  }
}

/** After buyer marks PO delivered — buyer rates supplier */
export async function promptAfterPoDelivered(opts: {
  buyerProfileId: number;
  supplierProfileId: number | null | undefined;
  supplierName?: string | null;
  poId: number;
  userId?: string | null;
}): Promise<void> {
  const supplierId = Number(opts.supplierProfileId);
  if (!Number.isFinite(supplierId) || supplierId <= 0) return;
  await createRatingPrompt({
    profileId: opts.buyerProfileId,
    counterpartyProfileId: supplierId,
    counterpartyName: opts.supplierName,
    rateeRole: 'supplier',
    contextType: 'po',
    contextId: String(opts.poId),
    userId: opts.userId,
  });
}

/** After seller marks invoice paid — seller rates customer (and vice versa if linked) */
export async function promptAfterInvoicePaid(opts: {
  sellerProfileId: number;
  customerLinkedProfileId?: number | null;
  customerName?: string | null;
  invoiceId: number;
  userId?: string | null;
}): Promise<void> {
  const buyerId = Number(opts.customerLinkedProfileId);
  if (!Number.isFinite(buyerId) || buyerId <= 0) return;

  // Seller rates customer
  await createRatingPrompt({
    profileId: opts.sellerProfileId,
    counterpartyProfileId: buyerId,
    counterpartyName: opts.customerName,
    rateeRole: 'customer',
    contextType: 'invoice',
    contextId: String(opts.invoiceId),
    userId: opts.userId,
  });

  // Buyer rates seller (supplier)
  await createRatingPrompt({
    profileId: buyerId,
    counterpartyProfileId: opts.sellerProfileId,
    rateeRole: 'supplier',
    contextType: 'invoice',
    contextId: String(opts.invoiceId),
    userId: null,
  });
}

/**
 * After shipment marked delivered — resolve counterparty via PO / customer book when possible.
 * Soft no-op if we cannot map to an on-platform peer profile.
 */
export async function promptAfterShipmentDelivered(opts: {
  companyProfileId: number;
  shipment: Record<string, unknown>;
  userId?: string | null;
}): Promise<void> {
  const companyId = Number(opts.companyProfileId);
  if (!Number.isFinite(companyId) || companyId <= 0) return;

  try {
    const supabase = getSupabaseServer();
    const ship = opts.shipment;
    const shipmentId = Number(ship.id);
    let peerId: number | null = null;
    let peerName: string | null = null;
    let rateeRole: 'supplier' | 'customer' | 'partner' = 'partner';

    // 1) Linked purchase order
    const refType = String(ship.reference_type || '').toLowerCase();
    const refId = Number(ship.reference_id);
    const poRefRaw = ship.po_reference != null ? String(ship.po_reference) : '';
    const poIdFromRef =
      Number.isFinite(refId) &&
      refId > 0 &&
      (refType.includes('po') || refType.includes('purchase'))
        ? refId
        : /^\d+$/.test(poRefRaw.trim())
          ? Number(poRefRaw.trim())
          : null;

    if (poIdFromRef) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select(
          'id, buyer_profile_id, supplier_profile_id, supplier_id, supplier_name'
        )
        .eq('id', poIdFromRef)
        .maybeSingle();
      if (po) {
        const buyer = Number(po.buyer_profile_id);
        const supplier = Number(po.supplier_profile_id ?? po.supplier_id);
        if (buyer === companyId && Number.isFinite(supplier) && supplier > 0) {
          peerId = supplier;
          peerName = po.supplier_name || null;
          rateeRole = 'supplier';
        } else if (
          supplier === companyId &&
          Number.isFinite(buyer) &&
          buyer > 0
        ) {
          peerId = buyer;
          rateeRole = 'customer';
        }
      }
    }

    // 2) CRM customer book by numeric customer id in customer_ref
    if (!peerId && ship.customer_ref != null) {
      const cid = Number(ship.customer_ref);
      if (Number.isFinite(cid) && cid > 0) {
        const { data: cust } = await supabase
          .from('customers')
          .select('id, linked_profile_id, trading_name, legal_name, company_name')
          .eq('id', cid)
          .eq('profile_id', companyId)
          .maybeSingle();
        const linked = Number(cust?.linked_profile_id);
        if (Number.isFinite(linked) && linked > 0) {
          peerId = linked;
          peerName =
            cust?.trading_name ||
            cust?.legal_name ||
            cust?.company_name ||
            null;
          rateeRole = 'customer';
        }
      }
    }

    if (!peerId || peerId === companyId) return;

    await createRatingPrompt({
      profileId: companyId,
      counterpartyProfileId: peerId,
      counterpartyName: peerName,
      rateeRole,
      contextType: 'shipment',
      contextId: Number.isFinite(shipmentId) ? String(shipmentId) : undefined,
      userId: opts.userId,
    });
  } catch (e) {
    console.warn('promptAfterShipmentDelivered soft-fail:', e);
  }
}

/** After connection accepted — soft mutual rate prompts */
export async function promptAfterConnectionAccepted(opts: {
  companyA: number;
  companyB: number;
  connectionType?: string | null;
  userId?: string | null;
}): Promise<void> {
  const a = Number(opts.companyA);
  const b = Number(opts.companyB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 || a === b) {
    return;
  }
  const type = String(opts.connectionType || 'partner').toLowerCase();
  const roleForA =
    type === 'supplier' ? 'supplier' : type === 'customer' ? 'customer' : 'partner';
  const roleForB =
    type === 'supplier' ? 'customer' : type === 'customer' ? 'supplier' : 'partner';

  await createRatingPrompt({
    profileId: a,
    counterpartyProfileId: b,
    rateeRole: roleForA as 'supplier' | 'customer' | 'partner',
    contextType: 'connection',
    contextId: `${a}-${b}`,
    userId: opts.userId,
  });
  await createRatingPrompt({
    profileId: b,
    counterpartyProfileId: a,
    rateeRole: roleForB as 'supplier' | 'customer' | 'partner',
    contextType: 'connection',
    contextId: `${a}-${b}`,
    userId: null,
  });
}

async function sendRatingNudgeEmail(opts: {
  to: string;
  counterpartyName: string;
  rateeRole: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const resend = getResend();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com';
    const href =
      opts.rateeRole === 'customer'
        ? `${appUrl}/dashboard/customers/ratings`
        : `${appUrl}/dashboard/suppliers/ratings`;

    await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: opts.to,
      subject: `Rate ${opts.counterpartyName} on SupplierAdvisor`,
      html: `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="font-size:12px;font-weight:700;color:#00b4d8;letter-spacing:0.08em;text-transform:uppercase;">Trust loop</div>
    <h1 style="font-size:20px;margin:12px 0 8px;color:#0f172a;">How did trade go with ${escapeHtml(opts.counterpartyName)}?</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      On SupplierAdvisor, <strong>suppliers and customers rate each other</strong> after trade.
      Peer stars and OTIFEF (On-Time · In-Full · Error-Free) build trust for the whole network.
    </p>
    <p style="margin:24px 0;">
      <a href="${href}" style="background:#00b4d8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">
        Leave a rating →
      </a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">SupplierAdvisor® · Continuous feedback that improves every business</p>
  </div>
</body></html>`,
    });
  } catch (e) {
    console.warn('rating nudge email soft-fail:', e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
