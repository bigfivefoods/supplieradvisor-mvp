'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Network,
  Handshake,
  Inbox,
  Send,
  ShieldCheck,
  Truck,
  Users,
  PauseCircle,
  PlayCircle,
  Check,
  X,
  Ban,
  Search,
  Loader2,
  Wallet,
  FileText,
  ShoppingCart,
  Star,
  AlertTriangle,
  ArrowRight,
  Link2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  roleBadgeClass,
  roleLabel,
  statusBadgeClass,
  type NetworkEdge,
  type NetworkSummary,
} from '@/lib/connections/types';
import {
  CompanyRequired,
  ConnectionsNav,
  ConnectionsPage,
} from '@/components/connections/ConnectionsShell';
import {
  AlertBanner,
  KpiCard,
  Panel,
  ProcessRail,
  RelationshipHeader,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';

type Tab =
  | 'all'
  | 'accepted'
  | 'pending_in'
  | 'pending_out'
  | 'suppliers'
  | 'customers'
  | 'suspended';

const PROCESS = [
  { label: 'Discover', href: '/dashboard/suppliers/discover' },
  { label: 'Invite', href: '/dashboard/invite-business' },
  { label: 'Connect', href: '/dashboard/connections' },
  { label: 'Trade', href: '/dashboard/suppliers/po' },
  { label: 'Docs', href: '/dashboard/customers/quotes' },
  { label: 'Rate', href: '/dashboard/suppliers/ratings' },
  { label: 'RIAD', href: '/dashboard/suppliers/riad-log' },
];

const EMPTY_SUMMARY: NetworkSummary = {
  total: 0,
  accepted: 0,
  pendingIn: 0,
  pendingOut: 0,
  suppliers: 0,
  customers: 0,
  partners: 0,
  suspended: 0,
};

export default function ConnectionsHubPage() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [edges, setEdges] = useState<NetworkEdge[]>([]);
  const [summary, setSummary] = useState<NetworkSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (q) params.set('q', q);
      const res = await fetch(`/api/connections?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load network');
      setEdges(data.edges || []);
      setSummary(data.summary || EMPTY_SUMMARY);
      setWarning(data.warning || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = useMemo(() => {
    return edges.filter((e) => {
      if (tab === 'all') return true;
      if (tab === 'accepted') return e.status === 'accepted' && !e.suspended;
      if (tab === 'pending_in') return e.status === 'pending' && e.direction === 'received';
      if (tab === 'pending_out') return e.status === 'pending' && e.direction === 'sent';
      if (tab === 'suppliers')
        return (
          e.status === 'accepted' &&
          (e.role === 'supplier' || e.role === 'seller' || e.connection_type === 'supplier')
        );
      if (tab === 'customers')
        return (
          e.status === 'accepted' &&
          (e.role === 'customer' || e.role === 'buyer' || e.connection_type === 'customer')
        );
      if (tab === 'suspended') return e.suspended;
      return true;
    });
  }, [edges, tab]);

  const act = async (
    edge: NetworkEdge,
    action: 'accept' | 'decline' | 'cancel' | 'suspend' | 'unsuspend'
  ) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusyId(edge.id);
    try {
      const res = await fetch('/api/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          connectionId: edge.id,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      const labels: Record<string, string> = {
        accept: 'Connected — you can trade, share docs, and log RIAD together',
        decline: 'Request declined',
        cancel: 'Request cancelled',
        suspend: 'Collaboration suspended',
        unsuspend: 'Collaboration restored',
      };
      toast.success(labels[action] || 'Updated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: summary.total },
    { key: 'accepted', label: 'Connected', count: summary.accepted },
    { key: 'pending_in', label: 'Incoming', count: summary.pendingIn },
    { key: 'pending_out', label: 'Sent', count: summary.pendingOut },
    { key: 'suppliers', label: 'Suppliers', count: summary.suppliers },
    { key: 'customers', label: 'Customers', count: summary.customers },
    { key: 'suspended', label: 'Suspended', count: summary.suspended },
  ];

  return (
    <ConnectionsPage>
      <RelationshipHeader
        nav={<ConnectionsNav />}
        eyebrow="Integrated supply chain network"
        title="Companies you"
        titleAccent="connect"
        description="Accepted edges unlock seamless trade: purchase orders, invoices, shared documents, peer ratings, and RIAD — with optional on-chain settlement. Pending requests show who is waiting to join your graph."
        action={
          <>
            <Link
              href="/dashboard/suppliers/discover"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Search className="w-4 h-4" /> Find suppliers
            </Link>
            <Link
              href="/dashboard/invite-business"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Send className="w-4 h-4" /> Invite company
            </Link>
          </>
        }
      />

      {warning && (
        <AlertBanner>
          {warning}
          <span className="block text-xs mt-1 opacity-80">
            Membership soft-warning — data still shown when possible.
          </span>
        </AlertBanner>
      )}

      <SectionLabel>Integration lifecycle</SectionLabel>
      <ProcessRail steps={PROCESS} />

      <SectionLabel>Network pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={Network}
          label="Total edges"
          value={summary.total}
          loading={loading}
          href="/dashboard/connections"
        />
        <KpiCard
          icon={Handshake}
          label="Connected"
          value={summary.accepted}
          tone="emerald"
          loading={loading}
        />
        <KpiCard
          icon={Inbox}
          label="Incoming"
          value={summary.pendingIn}
          tone={summary.pendingIn > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
        <KpiCard
          icon={Send}
          label="Sent"
          value={summary.pendingOut}
          tone="cyan"
          loading={loading}
        />
        <KpiCard
          icon={Truck}
          label="Suppliers"
          value={summary.suppliers}
          href="/dashboard/suppliers/network"
          loading={loading}
        />
        <KpiCard
          icon={Users}
          label="Customers"
          value={summary.customers}
          href="/dashboard/customers/profiles"
          loading={loading}
        />
        <KpiCard
          icon={PauseCircle}
          label="Suspended"
          value={summary.suspended}
          tone={summary.suspended > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Why connect */}
      <Panel className="mb-8" title="Why connect matters">
        <div className="px-5 py-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <Why
            icon={ShoppingCart}
            title="Direct POs & invoices"
            body="Raise commercial docs only with connected counterparties — seller and buyer share the same edge."
          />
          <Why
            icon={FileText}
            title="Shared documents"
            body="Quotes, contracts, and certs share in real time once the platform edge is accepted."
          />
          <Why
            icon={Star}
            title="Ratings & trust"
            body="Post-PO peer reviews and OTIFEF scorecards attach to the live connection."
          />
          <Why
            icon={AlertTriangle}
            title="Joint RIAD"
            body="Risks, issues, actions, and decisions span the relationship — one control log."
          />
        </div>
      </Panel>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !py-2.5 !pl-10 !text-sm"
            placeholder="Search company, city, industry…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              tab === t.key
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={`tabular-nums ${
                  tab === t.key ? 'text-white/90' : 'text-neutral-400'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <Panel title="Connection graph">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
              <Link2 className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">No connections here yet</p>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mb-6">
              Discover suppliers, invite customers to the platform, or send a business invite.
              Accepted edges power POs, invoices, ratings, and RIAD across the chain.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/dashboard/suppliers/discover" className="btn-primary !py-2.5 !px-5 text-sm">
                Discover suppliers
              </Link>
              <Link
                href="/dashboard/customers/invites"
                className="btn-secondary !py-2.5 !px-5 text-sm"
              >
                Customer invites
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((edge) => (
              <EdgeRow
                key={edge.id}
                edge={edge}
                busy={busyId === edge.id}
                onAct={act}
              />
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-8 grid sm:grid-cols-3 gap-3">
        <QuickLink
          href="/dashboard/suppliers/po"
          icon={ShoppingCart}
          label="Raise supplier PO"
          desc="Only with connected suppliers"
        />
        <QuickLink
          href="/dashboard/customers/orders"
          icon={FileText}
          label="Customer orders"
          desc="Sell to connected buyers"
        />
        <QuickLink
          href="/dashboard/suppliers/ratings"
          icon={Star}
          label="Ratings & trust"
          desc="Score connected partners"
        />
      </div>
    </ConnectionsPage>
  );
}

function EdgeRow({
  edge,
  busy,
  onAct,
}: {
  edge: NetworkEdge;
  busy: boolean;
  onAct: (
    e: NetworkEdge,
    a: 'accept' | 'decline' | 'cancel' | 'suspend' | 'unsuspend'
  ) => void;
}) {
  const peer = edge.peer;
  const name = peer.trading_name || peer.legal_name || `Company #${peer.id}`;
  const verified =
    peer.is_verified === true || peer.verification_status === 'verified';
  const pendingIn = edge.status === 'pending' && edge.direction === 'received';
  const pendingOut = edge.status === 'pending' && edge.direction === 'sent';
  const connected = edge.status === 'accepted';

  return (
    <li className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-slate-800 truncate">{name}</span>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${roleBadgeClass(edge.role)}`}
          >
            {roleLabel(edge.role)}
          </span>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass(edge.status, edge.suspended)}`}
          >
            {edge.suspended ? 'suspended' : edge.status}
          </span>
          {verified && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
          {peer.wallet_address && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#0077b6]">
              <Wallet className="w-3 h-3" /> On-chain ready
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500">
          {[peer.industry, peer.city, peer.country].filter(Boolean).join(' · ') || '—'}
          {peer.email ? ` · ${peer.email}` : ''}
        </div>
        {edge.message && (
          <p className="text-xs text-neutral-600 mt-1.5 line-clamp-2 italic">
            “{edge.message}”
          </p>
        )}
        <div className="text-[10px] text-neutral-400 mt-1.5">
          {edge.direction === 'sent' ? 'You sent' : 'They sent'} ·{' '}
          {edge.requested_at
            ? new Date(edge.requested_at).toLocaleDateString()
            : '—'}
          {edge.connection_type ? ` · type ${edge.connection_type}` : ''}
        </div>

        {/* Commerce shortcuts when connected */}
        {connected && !edge.suspended && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              href={edge.hrefs.primary}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00b4d8]/25 bg-[#00b4d8]/10 text-[#0077b6] hover:bg-[#00b4d8]/15"
            >
              Open workspace <ArrowRight className="w-3 h-3" />
            </Link>
            {edge.hrefs.po && (
              <Link
                href={edge.hrefs.po}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
              >
                <ShoppingCart className="w-3 h-3 text-[#00b4d8]" /> POs
              </Link>
            )}
            {edge.hrefs.documents && (
              <Link
                href={edge.hrefs.documents}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
              >
                <FileText className="w-3 h-3 text-[#00b4d8]" /> Docs
              </Link>
            )}
            {edge.hrefs.ratings && (
              <Link
                href={edge.hrefs.ratings}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
              >
                <Star className="w-3 h-3 text-amber-500" /> Rate
              </Link>
            )}
            {edge.hrefs.riad && (
              <Link
                href={edge.hrefs.riad}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
              >
                <AlertTriangle className="w-3 h-3 text-amber-600" /> RIAD
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {pendingIn && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAct(edge, 'accept')}
              className="btn-primary !py-2 !px-4 text-xs"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Accept
                </>
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAct(edge, 'decline')}
              className="btn-secondary !py-2 !px-4 text-xs"
            >
              <X className="w-3.5 h-3.5" /> Decline
            </button>
          </>
        )}
        {pendingOut && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct(edge, 'cancel')}
            className="btn-secondary !py-2 !px-4 text-xs text-red-600 border-red-200"
          >
            <Ban className="w-3.5 h-3.5" /> Cancel request
          </button>
        )}
        {connected && !edge.suspended && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct(edge, 'suspend')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-amber-200 text-amber-800 hover:bg-amber-50 cursor-pointer disabled:opacity-50"
            title="Block new POs and shares"
          >
            <PauseCircle className="w-3.5 h-3.5" /> Suspend
          </button>
        )}
        {connected && edge.suspended && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct(edge, 'unsuspend')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer disabled:opacity-50"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Restore
          </button>
        )}
      </div>
    </li>
  );
}

function Why({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#00b4d8]" />
      </div>
      <div>
        <div className="font-semibold text-slate-800 text-sm mb-0.5">{title}</div>
        <p className="text-xs text-neutral-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white px-4 py-3.5 hover:border-[#00b4d8] hover:shadow-md transition-all group"
    >
      <div className="p-2 rounded-xl bg-[#00b4d8]/10 text-[#00b4d8]">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 group-hover:text-[#0077b6]">
          {label}
        </div>
        <div className="text-[11px] text-neutral-500">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto group-hover:text-[#00b4d8]" />
    </Link>
  );
}
