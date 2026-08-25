'use client';

/**
 * RetailAdvisor® customer portal — shop, orders, profile.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, ShoppingBag, User } from 'lucide-react';
import {
  ProfilePhotoField,
  uploadPortalPersonPhoto,
} from '@/components/chrome/ProfilePhotoField';
import {
  PORTAL_PHOTO_SAVED_MESSAGE,
  PORTAL_PHOTO_SHARE_HINT,
} from '@/lib/services/portal-profile';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';
import { B2cAutoLinkBanner } from '@/components/b2c/B2cAutoLinkBanner';
import { MemberAnnouncementsFeed } from '@/components/services/MemberAnnouncementsFeed';
import { MemberPortalBrandLockup } from '@/components/brand/PortalBrandLogo';
import { MemberAdvisorShell } from '@/components/advisors/MemberAdvisorShell';
import { AdvisorPwaMemberBinder } from '@/components/advisors/AdvisorPwaMemberBinder';
import { formatZar } from '@/lib/b2c/member-account-types';
import type { MemberAnnouncementPublic } from '@/lib/services/member-announcements';

type Sku = { id: string; name: string; sku?: string; price_zar: number };
type Order = {
  id: string;
  created_at: string;
  total_zar: number;
  status: string;
  lines: Array<{ name: string; qty: number; unit_zar: number }>;
};

type Portal = {
  brand: string;
  public_token?: string;
  bio?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  primary_color?: string;
  announcements?: MemberAnnouncementPublic[];
  skus?: Sku[];
  customer: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    photo_url?: string | null;
  };
  orders?: Order[];
};

type TabId = 'shop' | 'orders' | 'account';

export default function MemberRetailgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>('shop');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/retailgraph/customer?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal not found');
      setPortal(data.portal);
      const c = data.portal?.customer;
      if (c) {
        setName(c.name || '');
        setEmail(c.email || '');
        setPhone(c.phone || '');
        setPhotoUrl(c.photo_url || '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('tab');
    if (next === 'shop' || next === 'orders' || next === 'account') {
      setTab(next);
    }
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/retailgraph/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.portal) setPortal(data.portal);
    return data;
  };

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const data = await post({
        action: 'update_profile',
        name,
        email,
        phone,
        photo_url: photoUrl,
      });
      setMsg((data.message as string) || 'Profile saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const color = portal?.primary_color || '#ea580c';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }
  if (error && !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <p className="font-black">Customer portal unavailable</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }
  if (!portal) return null;

  return (
    <>
      <AdvisorPwaMemberBinder
        module="retailgraph"
        memberToken={token}
        publicToken={portal.public_token}
        brandName={portal.brand}
        themeColor={color}
        iconUrl={portal.logo_url}
      />
      <MemberAdvisorShell
        color={color}
        appHref={`/me?link=${encodeURIComponent(token)}`}
        fromClass="from-orange-50"
        tab={tab}
        onTab={(id) => {
          setTab(id as TabId);
          setError(null);
          setMsg(null);
        }}
        mobileNav="bottom"
        tabs={[
          { id: 'shop', label: 'Shop' },
          {
            id: 'orders',
            label: 'Orders',
            badge: portal.orders?.length || undefined,
          },
          { id: 'account', label: 'Account' },
        ]}
        header={
          <div>
            <MemberPortalBrandLockup
              logoUrl={portal.logo_url}
              brand={portal.brand}
              eyebrow="Customer portal · RetailAdvisor®"
            />
            <div className="mt-4 flex items-end gap-3">
              {portal.customer.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portal.customer.photo_url}
                  alt=""
                  className="h-12 w-12 rounded-full border-2 border-white/40 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                  <User className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="font-bold">{portal.customer.name}</p>
                <p className="text-xs text-white/85">
                  {[portal.customer.email, portal.customer.phone]
                    .filter(Boolean)
                    .join(' · ') || 'Your shop account'}
                </p>
              </div>
            </div>
          </div>
        }
      >
        <B2cAutoLinkBanner token={token} tone="amber" />
        <MemberAnnouncementsFeed items={portal.announcements} />
        {(msg || error) && (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              error
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {error || msg}
          </div>
        )}

        {tab === 'shop' && (
          <div className="space-y-3">
            {(portal.skus || []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
                Nothing in the shop yet.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {(portal.skus || []).map((sku) => (
                  <li
                    key={sku.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{sku.name}</p>
                        {sku.sku ? (
                          <p className="text-[11px] text-slate-500">{sku.sku}</p>
                        ) : null}
                      </div>
                      <p
                        className="shrink-0 text-sm font-black tabular-nums"
                        style={{ color }}
                      >
                        {formatZar(sku.price_zar)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {portal.contact_email || portal.contact_phone ? (
              <p className="text-xs text-slate-500">
                Need something?{' '}
                {portal.contact_phone ? (
                  <a
                    className="font-bold"
                    href={`tel:${portal.contact_phone.replace(/\s+/g, '')}`}
                    style={{ color }}
                  >
                    {portal.contact_phone}
                  </a>
                ) : null}
                {portal.contact_phone && portal.contact_email ? ' · ' : null}
                {portal.contact_email ? (
                  <a
                    className="font-bold"
                    href={`mailto:${portal.contact_email}`}
                    style={{ color }}
                  >
                    {portal.contact_email}
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {(portal.orders || []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
                <ShoppingBag className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                No till sales on this account yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {(portal.orders || []).map((order) => (
                  <li
                    key={order.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          {order.status}
                        </p>
                        <p className="text-sm text-slate-600">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                      <p className="font-black" style={{ color }}>
                        {formatZar(order.total_zar)}
                      </p>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                      {order.lines.map((l, i) => (
                        <li key={`${order.id}-${i}`}>
                          {l.qty} × {l.name}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'account' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-black text-slate-900">Your profile</h2>
              <p className="mt-1 text-xs text-slate-500">
                Saved on this shop and your SA Member wallet.
              </p>
              <div className="mt-3">
                <ProfilePhotoField
                  value={photoUrl}
                  onChange={(url) => {
                    setPhotoUrl(url);
                    void post({ action: 'update_profile', photo_url: url })
                      .then((data) => {
                        setError(null);
                        setMsg(
                          (data.message as string) || PORTAL_PHOTO_SAVED_MESSAGE
                        );
                      })
                      .catch((e: unknown) => {
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'Could not share photo'
                        );
                      });
                  }}
                  uploadFile={(file) =>
                    uploadPortalPersonPhoto(
                      '/api/public/retailgraph/customer',
                      token,
                      file
                    )
                  }
                  kind="customer_photo"
                  label="Your photo"
                  description={PORTAL_PHOTO_SHARE_HINT}
                  accentClass="border-orange-200"
                />
              </div>
              <label className="mt-3 block text-xs font-bold">
                Name
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="mt-2 block text-xs font-bold">
                Email
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                />
              </label>
              <label className="mt-2 block text-xs font-bold">
                Phone
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveProfile()}
                className="mt-4 w-full rounded-xl py-3 text-sm font-black text-white disabled:opacity-50"
                style={{ backgroundColor: color }}
              >
                {busy ? 'Saving…' : 'Save profile'}
              </button>
            </div>
            <PopiaConsentNotice />
          </div>
        )}
      </MemberAdvisorShell>
    </>
  );
}
