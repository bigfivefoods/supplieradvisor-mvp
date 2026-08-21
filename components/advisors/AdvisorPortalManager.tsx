'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkingHoursEditor } from '@/components/schedule/WorkingHoursEditor';
import type { WorkingHours } from '@/lib/schedule/working-hours';
import { AdvisorPayAccepted } from '@/components/billing/ApplePayAccepted';
import { AdvisorGrowPreviews } from '@/components/advisors/AdvisorGrowPreviews';
import { AdvisorMemberPwaCard } from '@/components/advisors/AdvisorMemberPwaCard';
import type { AdvisorPortalModule } from '@/lib/advisors/portal-sections';
import {
  htmlColorValue,
  isAdvisorPwaModule,
  type AdvisorPwaSettings,
} from '@/lib/advisors/member-pwa';
import {
  isPlaceholderPhone,
  whatsAppUrl,
} from '@/lib/services/advisor-whatsapp';

export type AdvisorPortalValues = {
  enabled: boolean;
  brand_name: string;
  public_bio: string;
  website_url: string;
  contact_email: string;
  contact_phone: string;
  city?: string;
  color: string;
  allow_booking?: boolean;
};

export function AdvisorPortalManager({
  eyebrow,
  values,
  onChange,
  onSave,
  saving,
  portalPath,
  hours,
  onHoursSave,
  hoursSaving,
  extras,
  bookingLabel = 'Allow online booking',
  showCity = true,
  showBooking = true,
  module,
  logoUrl,
  settings,
  onSavePwa,
}: {
  eyebrow: string;
  values: AdvisorPortalValues;
  onChange: (next: AdvisorPortalValues) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  /** Public path, e.g. /embed/hire/{token} */
  portalPath?: string | null;
  /** When set, shows the member/client PWA and website preview. */
  module?: AdvisorPortalModule;
  logoUrl?: string | null;
  hours?: WorkingHours | null;
  onHoursSave?: (next: WorkingHours) => void | Promise<void>;
  hoursSaving?: boolean;
  extras?: ReactNode;
  bookingLabel?: string;
  showCity?: boolean;
  showBooking?: boolean;
  settings?: Record<string, unknown> | null;
  onSavePwa?: (patch: AdvisorPwaSettings) => void | Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.supplieradvisor.com';
  const live = Boolean(portalPath);
  const href = live ? `${origin}${portalPath}` : '';
  const brand = values.brand_name.trim() || 'Your brand';
  const publicToken = String(
    (settings && typeof settings.public_token === 'string'
      ? settings.public_token
      : '') ||
      decodeURIComponent(
        String(portalPath || '').split('/').filter(Boolean).pop() || ''
      )
  ).trim();
  const pwaSettings: Record<string, unknown> = {
    ...(settings || {}),
    brand_name: values.brand_name || settings?.brand_name,
    public_bio: values.public_bio || settings?.public_bio,
    embed_primary_color: values.color,
    company_logo_url: logoUrl || settings?.company_logo_url,
    public_token: publicToken || settings?.public_token,
  };
  const showPwa =
    Boolean(module && isAdvisorPwaModule(module) && onSavePwa);
  const waPortal = href ? whatsAppUrl('', href) : '';
  const qrSrc = useMemo(
    () =>
      href
        ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(href)}`
        : '',
    [href]
  );

  const color = htmlColorValue(values.color, '#0f172a');
  const phoneValue = isPlaceholderPhone(values.contact_phone)
    ? ''
    : values.contact_phone;

  const checks = [
    { id: 'brand', label: 'Brand name', done: Boolean(values.brand_name.trim()) },
    { id: 'bio', label: 'Public bio', done: Boolean(values.public_bio.trim()) },
    {
      id: 'contact',
      label: 'Phone or email',
      done: Boolean(phoneValue.trim() || values.contact_email.trim()),
    },
    { id: 'color', label: 'Brand colour', done: Boolean(values.color) },
    { id: 'live', label: 'Portal link issued', done: live },
    { id: 'published', label: 'Published', done: values.enabled === true },
  ];
  const doneCount = checks.filter((c) => c.done).length;

  const patch = (p: Partial<AdvisorPortalValues>) => onChange({ ...values, ...p });

  useEffect(() => {
    if (!values.contact_phone || !isPlaceholderPhone(values.contact_phone)) return;
    patch({ contact_phone: '' });
    // Parent `values` is a new object each render — only react to the phone string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.contact_phone]);

  const copy = async () => {
    if (!href) return;
    await navigator.clipboard.writeText(href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Portal link copied');
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="text-white" style={{ backgroundColor: color }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">
              {eyebrow}
            </p>
            <h2 className="truncate text-lg font-black">{brand}</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
              values.enabled
                ? 'bg-white text-slate-900'
                : 'bg-black/25 text-white'
            }`}
          >
            {values.enabled ? 'Live' : 'Draft'}
          </span>
        </div>
        {values.public_bio ? (
          <p className="line-clamp-2 px-4 pb-3 text-sm text-white/85 sm:px-5">
            {values.public_bio}
          </p>
        ) : (
          <p className="px-4 pb-3 text-sm text-white/70 sm:px-5">
            Set your brand, contact and hours — this is what customers see.
          </p>
        )}
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {showPwa && module && onSavePwa ? (
          <AdvisorMemberPwaCard
            module={module}
            publicToken={publicToken}
            settings={pwaSettings}
            onSave={onSavePwa}
            saving={saving}
          />
        ) : null}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {qrSrc ? (
            <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt="Portal QR"
                width={160}
                height={160}
                className="h-36 w-36 sm:h-40 sm:w-40"
              />
            </div>
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center text-[11px] font-bold text-slate-400">
              Save once to issue a portal QR
            </div>
          )}
          <div className="min-w-0 w-full space-y-2 sm:flex-1">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <QrCode className="h-3.5 w-3.5" /> Public portal
            </p>
            <p className="text-sm text-slate-600">
              Customers open this like a website — timetable, team, shop or
              catalogue. Print the QR or share the link.
            </p>
            {href ? (
              <p className="break-all font-mono text-[11px] text-slate-500">
                {href}
              </p>
            ) : (
              <p className="text-[11px] text-amber-700">
                A public token is issued the first time you save.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={values.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                />
                Publish
              </label>
              {href ? (
                <>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open portal
                  </a>
                  <a
                    href={waPortal}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => void copy()}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy link
                  </button>
                </>
              ) : null}
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              Setup {doneCount}/{checks.length}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {checks.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    c.done
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.done ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {module ? (
          <AdvisorGrowPreviews
            module={module}
            eyebrow={eyebrow}
            settings={{
              enabled: values.enabled,
              brand_name: values.brand_name,
              public_bio: values.public_bio,
              website_url: values.website_url,
              embed_primary_color: values.color,
              company_logo_url: logoUrl,
            }}
            embedPath={portalPath || ''}
            websiteHref=""
            websiteEnabled={values.enabled === true}
            placement="website-settings"
          />
        ) : null}

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
        >
          <label className="block text-xs font-bold text-slate-600">
            Brand name
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
              value={values.brand_name}
              onChange={(e) => patch({ brand_name: e.target.value })}
              placeholder="Shown on your portal"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Brand colour
            <input
              type="color"
              className="mt-1 h-10 w-14 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white p-0.5 [&::-moz-color-swatch]:rounded-[10px] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[10px] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              value={color}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> Phone
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={phoneValue}
              onChange={(e) => patch({ contact_phone: e.target.value })}
              placeholder="Call button on the portal"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="email"
              value={values.contact_email}
              onChange={(e) => patch({ contact_email: e.target.value })}
              placeholder="Enquiries"
            />
          </label>
          {showCity ? (
            <label className="block text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> City
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={values.city || ''}
                onChange={(e) => patch({ city: e.target.value })}
                placeholder="Shown on the portal"
              />
            </label>
          ) : null}
          <label className="block text-xs font-bold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" /> Your own website
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={values.website_url}
              onChange={(e) => patch({ website_url: e.target.value })}
              placeholder="https://"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
            Public bio
            <textarea
              className="mt-1 min-h-[4.5rem] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={values.public_bio}
              onChange={(e) => patch({ public_bio: e.target.value })}
              placeholder="A short about for the portal hero"
            />
          </label>
          {showBooking ? (
            <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
              <input
                type="checkbox"
                checked={values.allow_booking !== false}
                onChange={(e) => patch({ allow_booking: e.target.checked })}
              />
              {bookingLabel}
            </label>
          ) : null}
          {extras}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              style={{ backgroundColor: color }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save portal
            </button>
            <AdvisorPayAccepted tone="onLight" size="sm" label="Shown when payout is connected" />
          </div>
        </form>

        {onHoursSave ? (
          <WorkingHoursEditor
            value={hours}
            onSave={onHoursSave}
            saving={hoursSaving}
            defaultCollapsed={false}
            title="Portal hours"
            description="Shown on your public portal Visit card and footer."
            embedded
          />
        ) : null}
      </div>
    </section>
  );
}
