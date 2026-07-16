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
} from 'lucide-react';
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
            href="/dashboard/accounting/accounts-receivable"
            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:border-[#00b4d8]/40"
          >
            <Wallet className="w-4 h-4 text-emerald-600" /> Invoices
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
              {openPos.map((po) => (
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
                  <span className="text-xs font-bold tabular-nums text-slate-700 shrink-0">
                    {money(po.total_amount, po.currency)}
                  </span>
                </li>
              ))}
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
