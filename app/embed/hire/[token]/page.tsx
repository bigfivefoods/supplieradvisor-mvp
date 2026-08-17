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
  city?: string | null;
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
  catalogue?: Array<{
    id: string;
    title: string;
    description?: string;
    category_name?: string;
    rate_zar: number;
    rate_unit: string;
    location?: string;
    includes?: string;
    excludes?: string;
    specs?: string;
    fulfillment_label?: string;
    deposit_zar?: number | null;
    collect_hours?: string;
    delivery_fee_zar?: number | null;
    min_units?: number | null;
    cancellation_note?: string;
    condition_notes?: string;
    operator_included?: boolean;
    fuel_or_power?: string;
    age_or_weight_limit?: string;
  }>;
};

export default function HirePublicEmbedPage() {
  const { token } = useParams<{ token: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [payoutReady, setPayoutReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/public/hiregraph?token=${encodeURIComponent(token || '')}`)
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
        if (!cancelled) setError('Could not load catalogue');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!site && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
      </div>
    );
  }
  if (error || !site) {
    return <p className="p-6 text-sm text-rose-700">{error || 'Not found'}</p>;
  }

  const color = site.primary_color || '#0891b2';
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-5 py-8 text-white" style={{ background: color }}>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
          HireAdvisor®
        </p>
        <h1 className="mt-1 text-2xl font-black">{site.brand}</h1>
        {site.bio ? <p className="mt-2 max-w-2xl text-sm text-white/90">{site.bio}</p> : null}
        <p className="mt-2 text-xs text-white/80">
          {[site.city, site.contact_phone, site.contact_email].filter(Boolean).join(' · ')}
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
          {(site.catalogue || []).map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">{item.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.category_name}
                    {item.location ? ` · ${item.location}` : ''}
                  </p>
                </div>
                <p className="text-sm font-black tabular-nums text-cyan-800">
                  {formatZar(item.rate_zar)} / {item.rate_unit}
                </p>
              </div>
              {item.description ? (
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              ) : null}
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                {item.fulfillment_label ? (
                  <>
                    <dt>Get it</dt>
                    <dd className="text-right font-bold">{item.fulfillment_label}</dd>
                  </>
                ) : null}
                {item.deposit_zar != null ? (
                  <>
                    <dt>Deposit</dt>
                    <dd className="text-right font-bold">
                      {formatZar(item.deposit_zar)} refundable
                    </dd>
                  </>
                ) : null}
                {item.collect_hours ? (
                  <>
                    <dt>Hours</dt>
                    <dd className="text-right font-bold">{item.collect_hours}</dd>
                  </>
                ) : null}
                {item.delivery_fee_zar != null ? (
                  <>
                    <dt>Delivery</dt>
                    <dd className="text-right font-bold">
                      {formatZar(item.delivery_fee_zar)}
                    </dd>
                  </>
                ) : null}
              </dl>
              {item.includes ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  <span className="font-bold">Included: </span>
                  {item.includes}
                </p>
              ) : null}
              {item.excludes ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  <span className="font-bold">Not included: </span>
                  {item.excludes}
                </p>
              ) : null}
              {item.specs ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  <span className="font-bold">Specs: </span>
                  {item.specs}
                </p>
              ) : null}
              {item.condition_notes ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  <span className="font-bold">Condition: </span>
                  {item.condition_notes}
                </p>
              ) : null}
              {item.operator_included ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  Operator included
                </p>
              ) : null}
              {item.fuel_or_power ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  <span className="font-bold">Power / fuel: </span>
                  {item.fuel_or_power}
                </p>
              ) : null}
              {item.age_or_weight_limit ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  <span className="font-bold">Age / weight: </span>
                  {item.age_or_weight_limit}
                </p>
              ) : null}
              {item.cancellation_note ? (
                <p className="mt-1 text-[12px] text-slate-500">
                  Cancel: {item.cancellation_note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {!site.enabled ? (
          <p className="text-[11px] text-amber-700">
            Publish is off on the desk — this preview is for the owner only.
          </p>
        ) : null}
      </main>
    </div>
  );
}
