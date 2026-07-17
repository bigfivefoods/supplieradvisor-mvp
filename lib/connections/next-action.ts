/**
 * Shared trade-loop next-action for peer workspace, hubs, and digests.
 * Single source of truth: Connect → Accept PO → Invoice → OTIFEF → Rate.
 */

export type TradeNextAction = {
  id: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  priority: number;
  /** Optional second CTA (e.g. resend overdue, WhatsApp) */
  secondaryHref?: string;
  secondaryCta?: string;
};

export type TradeOpenPo = {
  id: number;
  status?: string | null;
  po_number?: string | null;
  total_amount?: number | null;
  currency?: string | null;
};

export type TradeOpenInv = {
  id: number;
  status?: string | null;
  invoice_number?: string | null;
};

export type TradeLoopInput = {
  peerId: number | string;
  peerName: string;
  /** accepted | pending | suspended | other */
  connectionStatus: string;
  connectionDirection?: 'sent' | 'received' | string | null;
  suspended?: boolean;
  /** We sell to this peer (they are customer/buyer) */
  weAreSeller: boolean;
  /** We buy from this peer */
  weAreBuyer: boolean;
  openPos?: TradeOpenPo[];
  openInvs?: TradeOpenInv[];
  poOpenCount?: number;
  invOpenCount?: number;
  /** Optional deep links from edge */
  poHref?: string | null;
  ratingsHref?: string | null;
};

function poStatus(p: TradeOpenPo): string {
  return String(p.status || '').toLowerCase();
}

/**
 * Compute the single primary next action for a peer trade relationship.
 */
export function computePeerTradeNextAction(
  input: TradeLoopInput
): TradeNextAction {
  const name = input.peerName || 'this partner';
  const peerId = String(input.peerId);
  const openPos = input.openPos || [];
  const openInvs = input.openInvs || [];
  const poHref = input.poHref || '/dashboard/suppliers/po';
  const ratingsHref =
    input.ratingsHref ||
    (input.weAreBuyer
      ? `/dashboard/suppliers/ratings?ratee=${peerId}`
      : `/dashboard/customers/ratings?ratee=${peerId}`);

  if (input.suspended) {
    return {
      id: 'suspended',
      priority: 0,
      title: 'Connection suspended',
      body: 'Unsuspend from Network before raising new POs.',
      href: '/dashboard/connections',
      cta: 'Open network',
    };
  }

  const st = String(input.connectionStatus || '').toLowerCase();
  if (st === 'pending') {
    if (input.connectionDirection === 'received') {
      return {
        id: 'accept_connection',
        priority: 10,
        title: 'Respond to connection request',
        body: `${name} is waiting — accept to unlock POs and documents.`,
        href: '/dashboard/connections?focus=incoming',
        cta: 'Review request',
      };
    }
    return {
      id: 'wait_connection',
      priority: 10,
      title: 'Waiting for acceptance',
      body: `Your request to ${name} is still pending.`,
      href: '/dashboard/connections',
      cta: 'View network',
    };
  }

  if (st !== 'accepted') {
    return {
      id: 'connect',
      priority: 5,
      title: 'Connect first',
      body: 'Accept or request a connection to trade with this company.',
      href: '/dashboard/suppliers/discover',
      cta: 'Discover partners',
    };
  }

  // Seller: accept inbound sent POs
  const awaitingAccept = openPos.find((p) => poStatus(p) === 'sent');
  if (input.weAreSeller && awaitingAccept) {
    return {
      id: 'accept_po',
      priority: 90,
      title: 'Accept inbound purchase order',
      body: `PO ${awaitingAccept.po_number || `#${awaitingAccept.id}`} from ${name} is waiting for your accept.`,
      href: `/dashboard/customers/orders?tab=inbound&po=${awaitingAccept.id}`,
      cta: 'Review & accept',
    };
  }

  // Seller: invoice accepted/funded POs
  const invoiceablePo = openPos.find((p) =>
    ['accepted', 'funded', 'open', 'confirmed'].includes(poStatus(p))
  );
  if (input.weAreSeller && invoiceablePo) {
    return {
      id: 'create_invoice',
      priority: 85,
      title: 'Create invoice from open PO',
      body: `PO ${invoiceablePo.po_number || `#${invoiceablePo.id}`} is ready to bill ${name}.`,
      href: `/dashboard/customers/invoices?fromPo=${invoiceablePo.id}&buyerProfileId=${peerId}`,
      cta: 'Create invoice',
    };
  }

  // Buyer: receive + OTIFEF on accepted/sent/funded
  const receivePo = openPos.find((p) =>
    ['accepted', 'funded', 'sent'].includes(poStatus(p))
  );
  if (input.weAreBuyer && receivePo && !input.weAreSeller) {
    return {
      id: 'receive_otifef',
      priority: 80,
      title: 'Record delivery (OTIFEF)',
      body: `PO ${receivePo.po_number || `#${receivePo.id}`} — capture on-time / in-full / error-free, then rate.`,
      href: `${poHref}${poHref.includes('?') ? '&' : '?'}po=${receivePo.id}`,
      cta: 'Receive + OTIFEF',
    };
  }

  // Completed POs without recent rating nudge
  const completedPo = openPos.find((p) =>
    ['completed', 'paid', 'delivered'].includes(poStatus(p))
  );
  if (completedPo) {
    return {
      id: 'rate_partner',
      priority: 70,
      title: 'Rate this partner',
      body: `Close the trust loop after trade with ${name}.`,
      href: ratingsHref,
      cta: 'Rate now',
    };
  }

  const poOpen = input.poOpenCount ?? openPos.length;
  if (poOpen > 0) {
    return {
      id: 'open_pos',
      priority: 60,
      title: 'Continue open purchase orders',
      body: `${poOpen} open PO(s) with ${name}. Track delivery, accept, or invoice.`,
      href: input.weAreSeller
        ? '/dashboard/customers/orders?tab=inbound'
        : poHref,
      cta: 'Open POs',
    };
  }

  const invOpen = input.invOpenCount ?? openInvs.length;
  if (invOpen > 0) {
    return {
      id: 'open_invoices',
      priority: 55,
      title: 'Follow up on open invoices',
      body: `${invOpen} open invoice(s) with this partner.`,
      href: '/dashboard/customers/invoices',
      cta: 'Open invoices',
    };
  }

  if (input.weAreBuyer && !input.weAreSeller) {
    return {
      id: 'raise_po',
      priority: 40,
      title: 'Raise a purchase order',
      body: `You're ready to buy from ${name}. Pick catalogue lines and send a PO.`,
      href: poHref,
      cta: 'Raise PO',
    };
  }

  if (input.weAreSeller) {
    return {
      id: 'send_docs',
      priority: 40,
      title: 'Send a quote or invoice',
      body: `${name} is a customer connection — share commercial documents next.`,
      href: `/dashboard/customers/invoices?buyerProfileId=${peerId}`,
      cta: 'Create invoice',
    };
  }

  return {
    id: 'start_loop',
    priority: 20,
    title: 'Start the trade loop',
    body: 'Raise a PO, share pricing, or rate this partner after delivery.',
    href: poHref,
    cta: 'Raise PO',
  };
}

/**
 * Hub-level next step when no peer is selected (buyer, supplier, or main command).
 */
export function computeHubNextAction(opts: {
  role: 'buyer' | 'supplier' | 'main';
  openInboundPos?: number;
  openOutboundPos?: number;
  pendingConnections?: number;
  /** Seller CRM: draft commercial invoices waiting to email */
  draftInvoices?: number;
  /** Seller CRM: overdue / past-due open invoices */
  overdueInvoices?: number;
  /** 0–100 profile completeness for discover quality */
  profileCompleteness?: number | null;
  catalogueEmpty?: boolean;
  verificationStatus?: string | null;
}): TradeNextAction {
  const v = String(opts.verificationStatus || '').toLowerCase();
  if (v === 'mismatch' || v === 'failed' || v === 'pending') {
    return {
      id: 'fix_verify',
      priority: 95,
      title:
        v === 'mismatch'
          ? 'Fix CIPC name match'
          : v === 'pending'
            ? 'Finish company verification'
            : 'Retry company verification',
      body:
        v === 'mismatch'
          ? 'CIPC name does not match your profile — apply the registered name and re-verify without re-paying.'
          : 'Complete CIPC verification so partners trust your public profile.',
      href: '/dashboard/my-business/profile#identity',
      cta: v === 'mismatch' ? 'Fix name match' : 'Open profile',
    };
  }

  if ((opts.pendingConnections || 0) > 0) {
    return {
      id: 'pending_connections',
      priority: 90,
      title: 'Review connection requests',
      body: `${opts.pendingConnections} pending connection(s) need a response.`,
      href: '/dashboard/connections?focus=incoming',
      cta: 'Open inbox',
    };
  }

  // Low completeness hurts discovery before trade volume matters
  const completeness = Number(opts.profileCompleteness);
  if (
    Number.isFinite(completeness) &&
    completeness >= 0 &&
    completeness < 25
  ) {
    return {
      id: 'profile_completeness',
      priority: 88,
      title: 'Complete your company profile',
      body: `Profile is ${Math.round(completeness)}% complete — reach 25%+ so partners can discover you.`,
      href: '/dashboard/my-business/profile',
      cta: 'Complete profile',
    };
  }

  // Main + supplier: inbound seller work first
  if (
    (opts.role === 'supplier' || opts.role === 'main') &&
    (opts.openInboundPos || 0) > 0
  ) {
    return {
      id: 'inbound_pos',
      priority: 85,
      title: 'Inbound purchase orders waiting',
      body: `${opts.openInboundPos} PO(s) need accept / fulfil / invoice.`,
      href: '/dashboard/customers/orders?tab=inbound',
      cta: 'Open inbound',
    };
  }

  // Seller: overdue AR first (money stuck) — deep-link opens resend tools
  if (
    (opts.role === 'main' || opts.role === 'supplier') &&
    (opts.overdueInvoices || 0) > 0
  ) {
    return {
      id: 'overdue_invoices',
      priority: 84,
      title: 'Overdue invoices need follow-up',
      body: `${opts.overdueInvoices} invoice(s) past due — resend PDF or share on WhatsApp.`,
      href: '/dashboard/customers/invoices?status=overdue&action=resend',
      cta: 'Resend overdue',
      secondaryHref: '/dashboard/customers/invoices?status=overdue',
      secondaryCta: 'Open list',
    };
  }

  // Seller: draft invoices ready to email / collect
  if (
    (opts.role === 'main' || opts.role === 'supplier') &&
    (opts.draftInvoices || 0) > 0
  ) {
    return {
      id: 'draft_invoices',
      priority: 82,
      title: 'Draft invoices ready to send',
      body: `${opts.draftInvoices} draft invoice(s) — review bank details and email when ready.`,
      href: '/dashboard/customers/invoices?status=draft',
      cta: 'Open drafts',
    };
  }

  // Main + buyer: outbound procurement work
  if (
    (opts.role === 'buyer' || opts.role === 'main') &&
    (opts.openOutboundPos || 0) > 0
  ) {
    return {
      id: 'outbound_pos',
      priority: 80,
      title: 'Open purchase orders',
      body: `${opts.openOutboundPos} PO(s) — track accept, receive OTIFEF, and rate.`,
      href: '/dashboard/suppliers/po',
      cta: 'Open POs',
    };
  }

  // Soft completeness nudge (25–69%) after trade priorities
  if (
    Number.isFinite(completeness) &&
    completeness >= 25 &&
    completeness < 70
  ) {
    return {
      id: 'profile_strengthen',
      priority: 55,
      title: 'Strengthen your public profile',
      body: `Profile is ${Math.round(completeness)}% complete — logo, contacts, and industry improve discovery.`,
      href: '/dashboard/my-business/profile',
      cta: 'Improve profile',
    };
  }

  if (opts.catalogueEmpty && (opts.role === 'supplier' || opts.role === 'main')) {
    return {
      id: 'catalogue',
      priority: 50,
      title: 'Add catalogue products',
      body: 'Buyers raise POs from your catalogue — add SKUs and prices.',
      href: '/dashboard/inventory/products',
      cta: 'Open catalogue',
    };
  }

  if (opts.role === 'buyer') {
    return {
      id: 'discover',
      priority: 30,
      title: 'Discover suppliers',
      body: 'Find verified partners and raise your first PO.',
      href: '/dashboard/suppliers/discover',
      cta: 'Discover',
    };
  }

  if (opts.role === 'main') {
    return {
      id: 'discover_or_network',
      priority: 30,
      title: 'Grow trade activity',
      body: 'Discover suppliers, invite customers, or raise a PO to start the loop.',
      href: '/dashboard/suppliers/discover',
      cta: 'Discover',
    };
  }

  return {
    id: 'network',
    priority: 30,
    title: 'Grow your network',
    body: 'Invite customers or accept connections to start the trade loop.',
    href: '/dashboard/connections',
    cta: 'Open network',
  };
}
