'use client';

/**
 * After directory connect / accept: peer prefilled first-trade kickstart.
 * Query: ?peerTrade=ID&peerName=Name
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ArrowRight, Network, X } from 'lucide-react';

export default function PeerTradeKickstart() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const peerId = Number(searchParams?.get('peerTrade') || 0);
  const peerName = searchParams?.get('peerName') || `Partner #${peerId}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (peerId > 0) setShow(true);
  }, [peerId]);

  if (!show || peerId <= 0) return null;

  const clear = () => {
    setShow(false);
    if (!pathname) return;
    const next = new URLSearchParams(searchParams?.toString() || '');
    next.delete('peerTrade');
    next.delete('peerName');
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <div className="mb-4 rounded-2xl border border-sky-300 bg-gradient-to-br from-sky-50 via-white to-violet-50 px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Network className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-sky-950">
              Connected with {peerName}
            </p>
            <p className="text-xs text-sky-900/85 mt-0.5 leading-relaxed">
              Close the loop: quote or invoice this partner, send, settle, then
              rate. First trade path is ready on your dashboard.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clear}
          className="p-1.5 text-sky-800/50 hover:text-sky-900"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/customers/quotes?peer=${peerId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-sky-700 text-white text-xs font-bold px-3 py-2"
          onClick={clear}
        >
          New quote
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href={`/dashboard/customers/invoices?new=1&peer=${peerId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white text-sky-900 text-xs font-bold px-3 py-2"
          onClick={clear}
        >
          New invoice
        </Link>
        <Link
          href="/dashboard/customers/money"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-950 text-xs font-bold px-3 py-2"
          onClick={clear}
        >
          Money hub
        </Link>
      </div>
    </div>
  );
}
