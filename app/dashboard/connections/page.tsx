'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
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
  ArrowRight,
  CreditCard,
  Building2,
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
  OperatingPrinciples,
  Panel,
  ProcessLifecycle,
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

/** Single linear lifecycle — one place for each step (no duplicate paths). */
const PROCESS = [
  {
    label: 'Discover',
    href: '/dashboard/suppliers/discover',
    desc: 'Find companies by trust, industry, and location.',
  },
  {
    label: 'Connect',
    href: '/dashboard/connections',
    desc: 'Request → accept → secure handshake.',
  },
  {
    label: 'Pricing',
    href: '/dashboard/connections/pricing',
    desc: 'List prices between connected companies.',
  },
  {
    label: 'Trade',
    href: '/dashboard/suppliers/po',
    desc: 'Raise POs once the edge is live.',
  },
  {
    label: 'Invoice',
    href: '/dashboard/accounting/accounts-receivable',
    desc: 'Bill and collect against the same counterparty.',
  },
  {
    label: 'Market',
    href: '/dashboard/connections/marketplace',
    desc: 'Optional marketplace reach beyond the graph.',
  },
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

  // Surface incoming first when there are pending requests
  useEffect(() => {
    if (!loading && summary.pendingIn > 0 && tab === 'all') {
      // soft highlight only — don't force tab
    }
  }, [loading, summary.pendingIn, tab]);

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
      const peerName = peerDisplayName(edge);
      const labels: Record<string, string> = {
        accept: `Connected with ${peerName} — trade is unlocked`,
        decline: `Declined ${peerName}`,
        cancel: `Cancelled request to ${peerName}`,
        suspend: `Suspended ${peerName}`,
        unsuspend: `Restored ${peerName}`,
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
        eyebrow="Company network"
        title="Connection"
        titleAccent="graph"
        description="One graph for every company you trade with. Request → accept → pricing, POs, invoices, and on-chain settlement in a secure ecosystem."
        action={
          <>
            <Link
              href="/dashboard/suppliers/discover"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Search className="w-4 h-4" /> Find companies
            </Link>
            <Link
              href="/dashboard/invite-business"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Send className="w-4 h-4" /> Invite off-platform
            </Link>
          </>
        }
      />

      {warning && (
        <AlertBanner>
          {warning}
        </AlertBanner>
      )}

      {summary.pendingIn > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-900">
            <strong>{summary.pendingIn}</strong> incoming connection
            {summary.pendingIn === 1 ? ' request' : ' requests'} waiting for your decision.
          </div>
          <button
            type="button"
            onClick={() => setTab('pending_in')}
            className="btn-primary !py-2 !px-4 text-xs"
          >
            Review incoming
          </button>
        </div>
      )}

      <ProcessLifecycle
        title="Network lifecycle"
        intro="Discover → connect → price → trade → invoice. Marketplace is optional reach on top of the secure graph."
        steps={PROCESS}
      />

      <SectionLabel>Pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <button type="button" className="text-left" onClick={() => setTab('accepted')}>
          <KpiCard
            icon={Handshake}
            label="Connected"
            value={summary.accepted}
            tone="emerald"
            loading={loading}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('pending_in')}>
          <KpiCard
            icon={Inbox}
            label="Incoming"
            value={summary.pendingIn}
            tone={summary.pendingIn > 0 ? 'amber' : 'neutral'}
            loading={loading}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('pending_out')}>
          <KpiCard
            icon={Send}
            label="Sent"
            value={summary.pendingOut}
            tone="cyan"
            loading={loading}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('suppliers')}>
          <KpiCard icon={Truck} label="Suppliers" value={summary.suppliers} loading={loading} />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('customers')}>
          <KpiCard icon={Users} label="Customers" value={summary.customers} loading={loading} />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('suspended')}>
          <KpiCard
            icon={PauseCircle}
            label="Suspended"
            value={summary.suspended}
            tone={summary.suspended > 0 ? 'amber' : 'neutral'}
            loading={loading}
          />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !py-2.5 !pl-10 !text-sm"
            placeholder="Search by trading name, city, industry…"
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

      <Panel title="Your companies">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              {tab === 'all' ? 'No connections yet' : 'Nothing in this filter'}
            </p>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mb-6">
              Find a company on SupplierAdvisor and send a connection request. When they accept,
              you can set pricing, raise POs, and settle on-chain.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/dashboard/suppliers/discover"
                className="btn-primary !py-2.5 !px-5 text-sm"
              >
                Find companies
              </Link>
              {tab !== 'all' && (
                <button
                  type="button"
                  onClick={() => setTab('all')}
                  className="btn-secondary !py-2.5 !px-5 text-sm"
                >
                  Show all
                </button>
              )}
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

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink
          href="/dashboard/suppliers/discover"
          icon={Search}
          label="Discover companies"
          desc="Search the platform & request connect"
        />
        <QuickLink
          href="/dashboard/connections/pricing"
          icon={FileText}
          label="Pricing agreements"
          desc="List prices between connected companies"
        />
        <QuickLink
          href="/dashboard/suppliers/po"
          icon={ShoppingCart}
          label="Purchase orders"
          desc="Trade with accepted suppliers"
        />
        <QuickLink
          href="/dashboard/accounting/accounts-receivable"
          icon={Wallet}
          label="Invoice & pay"
          desc="AR/AP with network counterparties"
        />
      </div>

      <OperatingPrinciples
        items={[
          {
            title: 'Request, then handshake',
            body: 'Trade only after both companies accept. Edges unlock POs, pricing, documents, and settlement.',
          },
          {
            title: 'One graph, many roles',
            body: 'The same connection can be supplier or customer depending on the flow — identity stays company-scoped.',
          },
          {
            title: 'Suspend without erase',
            body: 'Paused edges block new collaboration while history remains readable for audit and claims.',
          },
        ]}
      />
    </ConnectionsPage>
  );
}

function peerDisplayName(edge: NetworkEdge): string {
  const peer = edge.peer;
  const name =
    (peer.trading_name && String(peer.trading_name).trim()) ||
    (peer.legal_name && String(peer.legal_name).trim()) ||
    '';
  return name || `Company ${peer.id}`;
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
  const name = peerDisplayName(edge);
  const verified =
    peer.is_verified === true ||
    String(peer.verification_status || '').toLowerCase() === 'verified';
  const pendingIn = edge.status === 'pending' && edge.direction === 'received';
  const pendingOut = edge.status === 'pending' && edge.direction === 'sent';
  const connected = edge.status === 'accepted';

  return (
    <li className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-slate-800 truncate text-base">{name}</span>
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
          {[peer.industry, peer.city, peer.country].filter(Boolean).join(' · ') ||
            'Registered on SupplierAdvisor'}
          {peer.email ? ` · ${peer.email}` : ''}
        </div>
        {edge.message && (
          <p className="text-xs text-neutral-600 mt-1.5 line-clamp-2 italic">
            “{edge.message}”
          </p>
        )}
        <div className="text-[10px] text-neutral-400 mt-1.5">
          {edge.direction === 'sent' ? 'You requested' : 'They requested'} ·{' '}
          {edge.requested_at
            ? new Date(edge.requested_at).toLocaleDateString()
            : '—'}
        </div>

        {connected && !edge.suspended && (
          <div className="flex flex-wrap gap-2 mt-3">
            {edge.hrefs.po && (
              <Link
                href={edge.hrefs.po}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#00b4d8]/25 bg-[#00b4d8]/10 text-[#0077b6] hover:bg-[#00b4d8]/15"
              >
                <ShoppingCart className="w-3 h-3" /> POs
              </Link>
            )}
            <Link
              href="/dashboard/connections/pricing"
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
            >
              <FileText className="w-3 h-3 text-[#00b4d8]" /> Pricing
            </Link>
            <Link
              href="/dashboard/accounting/accounts-receivable"
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
            >
              <Wallet className="w-3 h-3 text-emerald-600" /> Invoice
            </Link>
            <Link
              href="/dashboard/accounting/accounts-payable"
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
            >
              <CreditCard className="w-3 h-3 text-violet-600" /> Pay
            </Link>
            {edge.hrefs.ratings && (
              <Link
                href={edge.hrefs.ratings}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40"
              >
                <Star className="w-3 h-3 text-amber-500" /> Rate
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
            className="btn-secondary !py-2 !px-4 text-xs"
          >
            <PauseCircle className="w-3.5 h-3.5" /> Suspend
          </button>
        )}
        {connected && edge.suspended && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct(edge, 'unsuspend')}
            className="btn-primary !py-2 !px-4 text-xs"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Restore
          </button>
        )}
        {connected && !edge.suspended && (
          <Link
            href={edge.hrefs.primary}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0077b6] hover:underline px-2"
          >
            Workspace <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </li>
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
      className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 transition-colors group"
    >
      <Icon className="w-5 h-5 text-[#00b4d8] mb-2" />
      <div className="text-sm font-semibold text-slate-800 group-hover:text-[#0077b6]">
        {label}
      </div>
      <div className="text-xs text-neutral-500 mt-0.5">{desc}</div>
    </Link>
  );
}
