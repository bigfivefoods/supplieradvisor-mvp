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
import type { NetworkEdge } from '@/lib/connections/types';

/**
 * Per-peer connection workspace — logo, trust, deep links to trade.
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

  useEffect(() => {
    void load();
  }, [load]);

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
        <div className="mt-8 rounded-3xl border border-dashed border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500">
          No connection with company #{peerId}.{' '}
          <Link href="/dashboard/suppliers/discover" className="text-[#0077b6] font-semibold underline">
            Discover suppliers
          </Link>
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

  return (
    <ConnectionsPage>
      <ConnectionsHeader
        title={name}
        titleAccent="workspace"
        description="Trade, documents, and trust for this connection."
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
          <p className="text-sm text-neutral-600 italic border-t border-neutral-100 pt-3">
            “{edge.message}”
          </p>
        ) : null}

        <Link
          href={`/c/${peer.id}`}
          className="text-xs font-semibold text-[#0077b6] hover:underline"
        >
          Public directory profile →
        </Link>
      </div>
    </ConnectionsPage>
  );
}
