'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  ShoppingCart,
  FileText,
  Star,
  Wallet,
  MessageSquare,
  Activity,
  ExternalLink,
  Rocket,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  ConnectionsPage,
  ConnectionsHeader,
} from '@/components/connections/ConnectionsShell';
import CompanyLogo from '@/components/business/CompanyLogo';
import TrustBadges from '@/components/business/TrustBadges';
import EmptyState from '@/components/ui/EmptyState';
import type { NetworkEdge } from '@/lib/connections/types';

type WorkspacePo = {
  id: number;
  status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  po_number?: string | null;
};

type WorkspaceInv = {
  id: number;
  status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  invoice_number?: string | null;
  created_at?: string | null;
};

type WorkspaceAct = {
  id?: number;
  action?: string | null;
  summary?: string | null;
  created_at?: string | null;
};

/**
 * Per-peer connection workspace — logo, trust, open trade, activity.
 */
export default function ConnectionPeerPage() {
  return (
    <CompanyRequired>
      <PeerInner />
    </CompanyRequired>
  );
}

function PeerInner() {
  const { peerId } = useParams() as { peerId: string };
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [edge, setEdge] = useState<NetworkEdge | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsLoading, setWsLoading] = useState(false);
  const [openPos, setOpenPos] = useState<WorkspacePo[]>([]);
  const [openInvs, setOpenInvs] = useState<WorkspaceInv[]>([]);
  const [activity, setActivity] = useState<WorkspaceAct[]>([]);
  const [wsMeta, setWsMeta] = useState<{
    poOpen?: number;
    invOpen?: number;
  }>({});
  const [busyPoId, setBusyPoId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/connections?${params}`);
      const data = await res.json();
      const edges: NetworkEdge[] = data.edges || data.connections || [];
      const found =
        edges.find((e) => String(e.peer?.id) === String(peerId)) || null;
      setEdge(found);
    } catch {
      setEdge(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, peerId, privyUserId]);

  const loadWorkspace = useCallback(async () => {
    setWsLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        peerId: String(peerId),
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/connections/peer-workspace?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'workspace failed');
      setOpenPos(data.purchaseOrders?.open || data.purchaseOrders?.recent || []);
      setOpenInvs(data.invoices?.open || data.invoices?.recent || []);
      setActivity(data.activity || []);
      setWsMeta({
        poOpen: data.purchaseOrders?.openCount,
        invOpen: data.invoices?.openCount,
      });
    } catch {
      setOpenPos([]);
      setOpenInvs([]);
      setActivity([]);
    } finally {
      setWsLoading(false);
    }
  }, [companyId, peerId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (edge) void loadWorkspace();
  }, [edge, loadWorkspace]);

  /** We sell to this peer — can accept inbound POs as supplier */
  const weAreSeller =
    edge?.role === 'customer' ||
    edge?.role === 'buyer' ||
    edge?.connection_type === 'customer';

  const acceptInboundPo = async (poId: number) => {
    setBusyPoId(poId);
    try {
      const res = await fetch('/api/customers/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: poId,
          status: 'accepted',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Accept failed');
      toast.success(`PO #${poId} accepted — buyer notified`);
      setOpenPos((prev) =>
        prev.map((p) =>
          p.id === poId ? { ...p, status: 'accepted' } : p
        )
      );
      void loadWorkspace();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setBusyPoId(null);
    }
  };

  if (loading) {
    return (
      <ConnectionsPage>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </ConnectionsPage>
    );
  }

  if (!edge) {
    return (
      <ConnectionsPage>
        <ConnectionsHeader
          title="Connection"
          titleAccent="not found"
          description="This peer is not in your network graph."
        />
        <Link
          href="/dashboard/connections"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#0077b6]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to network
        </Link>
        <div className="mt-8">
          <EmptyState
            title="No connection with this company"
            description={`Company #${peerId} is not linked to your network yet. Discover suppliers or send a connection request.`}
            actionHref="/dashboard/suppliers/discover"
            actionLabel="Discover suppliers"
          />
        </div>
      </ConnectionsPage>
    );
  }

  const peer = edge.peer;
  const name =
    peer.trading_name || peer.legal_name || `Company ${peer.id}`;
  const verified =
    peer.is_verified === true ||
    String(peer.verification_status || '').toLowerCase() === 'verified';

  const money = (amount?: number | null, ccy?: string | null) => {
    if (amount == null || !Number.isFinite(Number(amount))) return '—';
    const cur = (ccy || 'ZAR').toUpperCase();
    return `${cur} ${Number(amount).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`;
  };

  /** Single primary CTA based on connection + open trade state */
  const nextAction = (() => {
    if (edge.suspended) {
      return {
        title: 'Connection suspended',
        body: 'Unsuspend from Network before raising new POs.',
        href: '/dashboard/connections',
        cta: 'Open network',
      };
    }
    const st = String(edge.status || '').toLowerCase();
    if (st === 'pending') {
      if (edge.direction === 'received') {
        return {
          title: 'Respond to connection request',
          body: `${name} is waiting — accept to unlock POs and documents.`,
          href: '/dashboard/connections',
          cta: 'Review request',
        };
      }
      return {
        title: 'Waiting for acceptance',
        body: `Your request to ${name} is still pending.`,
        href: '/dashboard/connections',
        cta: 'View network',
      };
    }
    if (st !== 'accepted') {
      return {
        title: 'Connect first',
        body: 'Accept or request a connection to trade with this company.',
        href: '/dashboard/suppliers/discover',
        cta: 'Discover partners',
      };
    }
    // We sell to this peer (customer/buyer role) — accept inbound first, then invoice
    const awaitingAccept = openPos.find(
      (p) => String(p.status || '').toLowerCase() === 'sent'
    );
    if (weAreSeller && awaitingAccept) {
      return {
        title: 'Accept inbound purchase order',
        body: `PO ${awaitingAccept.po_number || `#${awaitingAccept.id}`} from ${name} is waiting for your accept.`,
        href: `/dashboard/customers/orders?tab=inbound&po=${awaitingAccept.id}`,
        cta: 'Review & accept',
      };
    }
    const invoiceablePo = openPos.find((p) => {
      const s = String(p.status || '').toLowerCase();
      return ['accepted', 'funded', 'open', 'confirmed'].includes(s);
    });
    if (weAreSeller && invoiceablePo) {
      return {
        title: 'Create invoice from open PO',
        body: `PO ${invoiceablePo.po_number || `#${invoiceablePo.id}`} is ready to bill ${name}.`,
        href: `/dashboard/customers/invoices?fromPo=${invoiceablePo.id}&buyerProfileId=${peerId}`,
        cta: 'Create invoice',
      };
    }
    if ((wsMeta.poOpen ?? openPos.length) > 0) {
      return {
        title: 'Continue open purchase orders',
        body: `${wsMeta.poOpen ?? openPos.length} open PO(s) with ${name}. Track delivery, accept, or invoice.`,
        href: weAreSeller
          ? '/dashboard/customers/orders?tab=inbound'
          : edge.hrefs.po || '/dashboard/suppliers/po',
        cta: 'Open POs',
      };
    }
    if ((wsMeta.invOpen ?? openInvs.length) > 0) {
      return {
        title: 'Follow up on open invoices',
        body: `${wsMeta.invOpen ?? openInvs.length} open invoice(s) with this partner.`,
        href: '/dashboard/customers/invoices',
        cta: 'Open invoices',
      };
    }
    if (edge.role === 'supplier' || edge.role === 'seller') {
      return {
        title: 'Raise a purchase order',
        body: `You're ready to buy from ${name}. Pick catalogue lines and send a PO.`,
        href: edge.hrefs.po || '/dashboard/suppliers/po',
        cta: 'Raise PO',
      };
    }
    if (weAreSeller) {
      return {
        title: 'Send a quote or invoice',
        body: `${name} is a customer connection — share commercial documents next.`,
        href: `/dashboard/customers/invoices?buyerProfileId=${peerId}`,
        cta: 'Create invoice',
      };
    }
    return {
      title: 'Start the trade loop',
      body: 'Raise a PO, share pricing, or rate this partner after delivery.',
      href: edge.hrefs.po || '/dashboard/suppliers/po',
      cta: 'Raise PO',
    };
  })();

  return (
    <ConnectionsPage>
      <ConnectionsHeader
        title={name}
        titleAccent="workspace"
        description="Open POs, invoices, and recent activity for this connection."
        action={
          <Link
            href="/dashboard/connections"
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Network
          </Link>
        }
      />

      <div className="mb-4 rounded-2xl border border-[#00b4d8]/30 bg-gradient-to-br from-[#e0f7fc] to-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0 flex items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00b4d8]/15 text-[#0077b6]">
            <Rocket className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">{nextAction.title}</p>
            <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
              {nextAction.body}
            </p>
          </div>
        </div>
        <Link
          href={nextAction.href}
          className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5 shrink-0"
        >
          {nextAction.cta} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4">
        <div className="flex items-start gap-4">
          <CompanyLogo logoUrl={peer.logo_url} name={name} size="lg" />
          <div className="min-w-0">
            <h2 className="text-xl font-black text-slate-900">{name}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {[peer.industry, peer.city, peer.country].filter(Boolean).join(' · ') ||
                'On SupplierAdvisor'}
            </p>
            <div className="mt-2">
              <TrustBadges
                isVerified={verified}
                verificationStatus={peer.verification_status}
                trustScore={peer.trust_score}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500 capitalize">
              Status: <strong>{edge.suspended ? 'suspended' : edge.status}</strong>
              {' · '}
              Role: <strong>{edge.role}</strong>
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {edge.hrefs.po && (
            <Link
              href={edge.hrefs.po}
              className="rounded-2xl border border-[#00b4d8]/25 bg-[#00b4d8]/5 px-4 py-3 text-sm font-bold text-[#0077b6] inline-flex items-center gap-2 hover:bg-[#00b4d8]/10"
            >
              <ShoppingCart className="w-4 h-4" /> Purchase orders
            </Link>
          )}
          <Link
            href="/dashboard/connections/pricing"
            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:border-[#00b4d8]/40"
          >
            <FileText className="w-4 h-4 text-[#00b4d8]" /> Pricing
          </Link>
          <Link
            href={
              edge.role === 'customer' ||
              edge.role === 'buyer' ||
              edge.connection_type === 'customer'
                ? openPos[0]
                  ? `/dashboard/customers/invoices?fromPo=${openPos[0].id}&buyerProfileId=${peerId}`
                  : `/dashboard/customers/invoices?buyerProfileId=${peerId}`
                : '/dashboard/customers/invoices'
            }
            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:border-[#00b4d8]/40"
          >
            <Wallet className="w-4 h-4 text-emerald-600" />{' '}
            {edge.role === 'customer' ||
            edge.role === 'buyer' ||
            edge.connection_type === 'customer'
              ? 'Create invoice'
              : 'Invoices'}
          </Link>
          {edge.hrefs.ratings && (
            <Link
              href={edge.hrefs.ratings}
              className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:border-[#00b4d8]/40"
            >
              <Star className="w-4 h-4 text-amber-500" /> Ratings
            </Link>
          )}
        </div>

        {edge.message ? (
          <p className="text-sm text-neutral-600 italic border-t border-neutral-100 pt-3 flex gap-2">
            <MessageSquare className="w-4 h-4 shrink-0 text-neutral-400 mt-0.5" />
            “{edge.message}”
          </p>
        ) : null}

        <Link
          href={`/c/${peer.id}`}
          className="text-xs font-semibold text-[#0077b6] hover:underline inline-flex items-center gap-1"
        >
          Public directory profile <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Trade depth */}
      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-900 inline-flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#00b4d8]" />
              Open purchase orders
              {wsMeta.poOpen != null ? (
                <span className="text-[10px] font-bold text-neutral-400">
                  {wsMeta.poOpen}
                </span>
              ) : null}
            </h3>
            {wsLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-[#00b4d8]" />
            )}
          </div>
          {openPos.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4">
              No open POs with this peer yet.{' '}
              {edge.hrefs.po ? (
                <Link href={edge.hrefs.po} className="font-semibold text-[#0077b6]">
                  Raise a PO →
                </Link>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {openPos.map((po) => {
                const st = String(po.status || '').toLowerCase();
                const canAccept = weAreSeller && st === 'sent';
                const canInvoice =
                  weAreSeller &&
                  ['accepted', 'funded', 'paid', 'open', 'confirmed'].includes(
                    st
                  );
                return (
                  <li
                    key={po.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">
                        {po.po_number || `PO #${po.id}`}
                      </p>
                      <p className="text-[11px] text-neutral-500 capitalize">
                        {po.status || 'open'}
                        {po.created_at
                          ? ` · ${new Date(po.created_at).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold tabular-nums text-slate-700">
                        {money(po.total_amount, po.currency)}
                      </span>
                      {canAccept && (
                        <button
                          type="button"
                          disabled={busyPoId === po.id}
                          onClick={() => void acceptInboundPo(po.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyPoId === po.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Accept
                        </button>
                      )}
                      {canInvoice && (
                        <Link
                          href={`/dashboard/customers/invoices?fromPo=${po.id}&buyerProfileId=${peerId}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#00b4d8] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#0096c7]"
                        >
                          Invoice
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-900 inline-flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              Open invoices
              {wsMeta.invOpen != null ? (
                <span className="text-[10px] font-bold text-neutral-400">
                  {wsMeta.invOpen}
                </span>
              ) : null}
            </h3>
          </div>
          {openInvs.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4">
              No open invoices with this peer.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {openInvs.map((inv) => (
                <li
                  key={inv.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">
                      {inv.invoice_number || `INV #${inv.id}`}
                    </p>
                    <p className="text-[11px] text-neutral-500 capitalize">
                      {inv.status || 'open'}
                      {inv.created_at
                        ? ` · ${new Date(inv.created_at).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-slate-700 shrink-0">
                    {money(inv.total_amount, inv.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-3xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-black text-slate-900 inline-flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-violet-600" />
          Recent activity
        </h3>
        {activity.length === 0 ? (
          <p className="text-xs text-neutral-500 py-2">
            No recent activity logged for this peer.
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.map((a, i) => (
              <li
                key={a.id ?? i}
                className="flex gap-3 text-sm border-b border-neutral-50 last:border-0 pb-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-slate-700">
                    {a.summary || a.action || 'Activity'}
                  </p>
                  {a.created_at ? (
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConnectionsPage>
  );
}
