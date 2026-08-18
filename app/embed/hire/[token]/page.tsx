'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { AdvisorAnnouncementFeed } from '@/components/services/AdvisorAnnouncementFeed';
import { formatZar } from '@/lib/b2c/member-account-types';
import {
  AdvisorPublicSection,
  AdvisorPublicSite,
  AdvisorPublicStatus,
} from '@/components/advisors/AdvisorPublicSite';

type CatalogueItem = {
  id: string;
  title: string;
  description?: string;
  category_name?: string;
  rate_zar: number;
  rate_unit: string;
  location?: string;
  photo_url?: string | null;
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
};

type Site = {
  brand: string;
  bio?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  city?: string | null;
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
  catalogue?: CatalogueItem[];
};

export default function HirePublicEmbedPage() {
  const { token } = useParams<{ token: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [payoutReady, setPayoutReady] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of site?.catalogue || []) {
      if (item.category_name) set.add(item.category_name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [site]);

  const items = useMemo(() => {
    const all = site?.catalogue || [];
    if (category === 'all') return all;
    return all.filter((i) => i.category_name === category);
  }, [site, category]);

  if (!site && !error) {
    return <AdvisorPublicStatus color="#0891b2" />;
  }
  if (error || !site) {
    return <AdvisorPublicStatus error={error || 'Not found'} />;
  }

  const color = site.primary_color || '#0891b2';
  const enquireHref = site.contact_email
    ? `mailto:${site.contact_email}?subject=${encodeURIComponent('Hire enquiry · ' + site.brand)}`
    : site.contact_phone
      ? `tel:${site.contact_phone.replace(/\s+/g, '')}`
      : '#catalogue';
  const sec = (site as { sections?: Record<string, boolean> }).sections || {};
  const nav = [
    ...(sec.news !== false && site.announcements?.length
      ? [{ id: 'news', label: 'News' }]
      : []),
    ...(sec.catalogue !== false
      ? [{ id: 'catalogue', label: 'Catalogue' }]
      : []),
    ...(sec.contact !== false &&
    (site.city || site.contact_phone || site.contact_email)
      ? [{ id: 'contact', label: 'Contact' }]
      : []),
  ];

  return (
    <AdvisorPublicSite
      eyebrow="HireAdvisor®"
      brand={site.brand}
      bio={site.bio}
      city={site.city}
      phone={site.contact_phone}
      email={site.contact_email}
      websiteUrl={site.website_url}
      logoUrl={site.logo_url}
      color={color}
      payoutReady={payoutReady}
      nav={nav}
      cta={{ href: '#catalogue', label: 'Browse hire' }}
      footerNote="Powered by HireAdvisor® · SupplierAdvisor"
    >
      {sec.news !== false && site.announcements?.length ? (
        <AdvisorPublicSection id="news" title="From the desk">
          <AdvisorAnnouncementFeed items={site.announcements} title="" />
        </AdvisorPublicSection>
      ) : null}

      {sec.catalogue !== false ? (
      <AdvisorPublicSection
        id="catalogue"
        title="Catalogue"
        icon={<Package className="h-5 w-5" style={{ color }} />}
        aside={
          <p className="text-sm text-slate-500">
            {items.length} item{items.length === 1 ? '' : 's'}
          </p>
        }
      >
        {categories.length > 1 ? (
          <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                category === 'all'
                  ? 'text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
              style={category === 'all' ? { backgroundColor: color } : undefined}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                  category === c
                    ? 'text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
                style={category === c ? { backgroundColor: color } : undefined}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            Nothing listed in this category yet.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                {item.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.photo_url}
                    alt=""
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-28 items-center justify-center text-white/80"
                    style={{ backgroundColor: color }}
                  >
                    <Package className="h-8 w-8" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.category_name}
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black tabular-nums" style={{ color }}>
                      {formatZar(item.rate_zar)}
                      <span className="block text-right text-[10px] font-bold text-slate-400">
                        / {item.rate_unit}
                      </span>
                    </p>
                  </div>
                  {item.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
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
                          {formatZar(item.deposit_zar)}
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
                    <p className="mt-2 text-[12px] text-slate-600">
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
                    <p className="mt-1 text-[12px] text-slate-600">Operator included</p>
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
                  <a
                    href={enquireHref}
                    className="mt-4 rounded-xl py-2 text-center text-xs font-black text-white"
                    style={{ backgroundColor: color }}
                  >
                    Enquire
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!site.enabled ? (
          <p className="mt-4 text-[11px] text-amber-700">
            Publish is off on the desk — this preview is for the owner only.
          </p>
        ) : null}
      </AdvisorPublicSection>
      ) : null}

      {sec.contact !== false &&
      (site.city || site.contact_phone || site.contact_email) ? (
        <AdvisorPublicSection id="contact" title="Contact">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {site.city ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Location
                </p>
                <p className="mt-1 font-bold">{site.city}</p>
              </div>
            ) : null}
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
