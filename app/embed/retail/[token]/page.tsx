'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AdvisorAnnouncementFeed } from '@/components/services/AdvisorAnnouncementFeed';
import { formatZar } from '@/lib/b2c/member-account-types';

type Site = {
  brand: string;
  bio?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  primary_color?: string;
  enabled?: boolean;
  announcements?: Array<{
    id: string;
    title: string;
    body: string;
    pinned?: boolean;
    cta_label?: string | null;
    cta_href?: string | null;
  }>;
  skus?: Array<{ id: string; name: string; sku?: string; price_zar: number }>;
};

export default function RetailPublicEmbedPage() {
  const { token } = useParams<{ token: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [payoutReady, setPayoutReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/public/retailgraph?token=${encodeURIComponent(token || '')}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.site) {
          setError(data.error || 'Not found');
          return;
        }
        setSite(data.site);
        setPayoutReady(data.payout_ready === true);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load shop');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!site && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
      </div>
    );
  }
  if (error || !site) {
    return <p className="p-6 text-sm text-rose-700">{error || 'Not found'}</p>;
  }

  const color = site.primary_color || '#ea580c';
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-5 py-8 text-white" style={{ background: color }}>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
          RetailAdvisor®
        </p>
        <h1 className="mt-1 text-2xl font-black">{site.brand}</h1>
        {site.bio ? <p className="mt-2 max-w-2xl text-sm text-white/90">{site.bio}</p> : null}
        <p className="mt-2 text-xs text-white/80">
          {[site.contact_phone, site.contact_email].filter(Boolean).join(' · ')}
        </p>
        {payoutReady ? (
          <p className="mt-2 text-xs font-semibold text-white/90">
            Card and Apple Pay accepted on this site.
          </p>
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <AdvisorAnnouncementFeed items={site.announcements} />
        <ul className="space-y-2">
          {(site.skus || []).map((sku) => (
            <li
              key={sku.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-black text-slate-900">{sku.name}</p>
                {sku.sku ? (
                  <p className="text-[11px] text-slate-500">{sku.sku}</p>
                ) : null}
              </div>
              <p className="text-sm font-black tabular-nums text-orange-800">
                {formatZar(sku.price_zar)}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
