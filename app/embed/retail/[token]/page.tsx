'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Store } from 'lucide-react';
import { AdvisorAnnouncementFeed } from '@/components/services/AdvisorAnnouncementFeed';
import { formatZar } from '@/lib/b2c/member-account-types';
import {
  AdvisorPublicSection,
  AdvisorPublicSite,
  AdvisorPublicStatus,
} from '@/components/advisors/AdvisorPublicSite';
import { AdvisorPayAccepted } from '@/components/billing/ApplePayAccepted';

type Site = {
  brand: string;
  bio?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
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
    return <AdvisorPublicStatus color="#ea580c" />;
  }
  if (error || !site) {
    return <AdvisorPublicStatus error={error || 'Not found'} />;
  }

  const color = site.primary_color || '#ea580c';
  const skus = site.skus || [];
  const nav = [
    ...(site.announcements?.length ? [{ id: 'news', label: 'News' }] : []),
    { id: 'shop', label: 'Shop' },
    ...(site.contact_phone || site.contact_email
      ? [{ id: 'contact', label: 'Contact' }]
      : []),
  ];

  return (
    <AdvisorPublicSite
      eyebrow="RetailAdvisor®"
      brand={site.brand}
      bio={site.bio}
      phone={site.contact_phone}
      email={site.contact_email}
      websiteUrl={site.website_url}
      logoUrl={site.logo_url}
      color={color}
      payoutReady={payoutReady}
      nav={nav}
      cta={{ href: '#shop', label: 'Shop' }}
      footerNote="Powered by RetailAdvisor® · SupplierAdvisor"
    >
      {site.announcements?.length ? (
        <AdvisorPublicSection id="news" title="From the desk">
          <AdvisorAnnouncementFeed items={site.announcements} title="" />
        </AdvisorPublicSection>
      ) : null}

      <AdvisorPublicSection
        id="shop"
        title="On the shelf"
        icon={<Store className="h-5 w-5" style={{ color }} />}
        aside={
          <p className="text-sm text-slate-500">
            {skus.length} item{skus.length === 1 ? '' : 's'}
          </p>
        }
      >
        {skus.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            No products published yet.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {skus.map((sku) => (
              <li
                key={sku.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-black text-slate-900">{sku.name}</p>
                  {sku.sku ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">{sku.sku}</p>
                  ) : null}
                </div>
                <p className="mt-4 text-lg font-black tabular-nums" style={{ color }}>
                  {formatZar(sku.price_zar)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {payoutReady ? (
          <div className="mt-5">
            <AdvisorPayAccepted tone="onLight" label="Accepted in store" />
          </div>
        ) : null}
      </AdvisorPublicSection>

      {site.contact_phone || site.contact_email ? (
        <AdvisorPublicSection id="contact" title="Contact">
          <div className="grid gap-3 sm:grid-cols-2">
            {site.contact_phone ? (
              <a
                href={`tel:${site.contact_phone.replace(/\s+/g, '')}`}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Phone
                </p>
                <p className="mt-1 font-bold">{site.contact_phone}</p>
              </a>
            ) : null}
            {site.contact_email ? (
              <a
                href={`mailto:${site.contact_email}`}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Email
                </p>
                <p className="mt-1 break-all font-bold">{site.contact_email}</p>
              </a>
            ) : null}
          </div>
        </AdvisorPublicSection>
      ) : null}
    </AdvisorPublicSite>
  );
}
