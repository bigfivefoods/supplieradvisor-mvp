'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { FormCard, StatRow, fieldClass } from '@/components/hire/SimpleEntityForm';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { AdvisorDeskInviteCard } from '@/components/advisors/AdvisorDeskInviteCard';
import { AdvisorPayoutSettings } from '@/components/advisors/AdvisorPayoutSettings';
import { AdvisorEmbedSnippet } from '@/components/services/AdvisorEmbedSnippet';
import { hirePublicEmbedPath } from '@/lib/hire/hiregraph';
import { AdvisorPortalManager } from '@/components/advisors/AdvisorPortalManager';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import type { WorkingHours } from '@/lib/schedule/working-hours';

export default function HiregraphWebsitePage() {
  const { companyId, store, loading, saving, post, summary } = useHiregraph();
  const [form, setForm] = useState({
    enabled: false,
    brand_name: '',
    website_url: '',
    public_bio: '',
    contact_email: '',
    contact_phone: '',
    city: '',
    allow_portal_booking: true,
    primary_color: '#0891b2',
    timezone: 'Africa/Johannesburg',
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!store?.settings) return;
    const s = store.settings;
    setForm({
      enabled: s.enabled === true,
      brand_name: s.brand_name || '',
      website_url: s.website_url || '',
      public_bio: s.public_bio || '',
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      city: s.city || '',
      allow_portal_booking: s.allow_portal_booking !== false,
      primary_color: s.primary_color || '#0891b2',
      timezone: s.timezone || 'Africa/Johannesburg',
    });
  }, [store]);

  const token = store?.settings?.public_token || '';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://www.supplieradvisor.com';
  const page = useMemo(
    () => (token ? `${origin}${hirePublicEmbedPath(token)}` : ''),
    [origin, token]
  );
  const qrImg = useMemo(
    () =>
      page
        ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(page)}`
        : '',
    [page]
  );

  const save = async (rotate = false) => {
    if (rotate && !confirm('Rotate the public catalogue link? Existing embeds will break until you update them.')) {
      return;
    }
    await post({
      action: 'update_settings',
      settings: form,
      rotate_token: rotate,
    });
    toast.success(rotate ? 'Public token rotated' : 'Website settings saved');
  };

  const saveHours = async (working_hours: WorkingHours) => {
    await post({
      action: 'update_settings',
      settings: { working_hours },
    });
    toast.success('Portal hours saved');
  };

  const copy = async () => {
    if (!page) return;
    await navigator.clipboard.writeText(page);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied');
  };

  return (
    <HiregraphWorkbench
      title="Website"
      titleAccent="QR · embed · profile"
      description="Publish your hire catalogue, SA Member join QR, and embed for your own site."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <AdvisorPortalManager
            module="hiregraph"
            logoUrl={logoUrlFromSettings(store.settings)}
            eyebrow="HireAdvisor®"
            values={{
              enabled: form.enabled,
              brand_name: form.brand_name,
              public_bio: form.public_bio,
              website_url: form.website_url,
              contact_email: form.contact_email,
              contact_phone: form.contact_phone,
              city: form.city,
              color: form.primary_color,
              allow_booking: form.allow_portal_booking,
            }}
            onChange={(next) =>
              setForm((f) => ({
                ...f,
                enabled: next.enabled,
                brand_name: next.brand_name,
                public_bio: next.public_bio,
                website_url: next.website_url,
                contact_email: next.contact_email,
                contact_phone: next.contact_phone,
                city: next.city || '',
                primary_color: next.color,
                allow_portal_booking: next.allow_booking !== false,
              }))
            }
            onSave={() => void save()}
            saving={saving}
            settings={store.settings as Record<string, unknown>}
            onSavePwa={async (pwa) => {
              await post({ action: 'update_settings', settings: pwa });
            }}
            portalPath={token ? hirePublicEmbedPath(token) : ''}
            hours={store.settings?.working_hours}
            onHoursSave={saveHours}
            hoursSaving={saving}
            bookingLabel="Allow hire requests from the portal"
          />

          <StatRow
            items={[
              { label: 'Published', value: form.enabled ? 'Yes' : 'No' },
              {
                label: 'Token',
                value: token ? 'Issued' : '—',
              },
              {
                label: 'Online requests',
                value: form.allow_portal_booking ? 'On' : 'Off',
              },
              {
                label: 'Live ads',
                value: Number(summary?.liveAnnouncements) || 0,
              },
            ]}
          />

          <AdvisorMemberAppInvite
            kind="hire"
            companyId={companyId}
            brand={form.brand_name || store.settings?.brand_name}
            audience="customers"
          />
          <AdvisorPayoutSettings compact />
          <AdvisorDeskInviteCard module="hiregraph" />

          {token ? (
            <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4 sm:p-5">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                {qrImg ? (
                  <div className="shrink-0 rounded-2xl border border-cyan-100 bg-white p-2.5 shadow-sm sm:p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImg}
                      alt="Hire catalogue QR"
                      width={200}
                      height={200}
                      className="h-40 w-40 sm:h-[200px] sm:w-[200px]"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 w-full space-y-2 sm:flex-1">
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-700">
                    <QrCode className="h-3.5 w-3.5" /> Public catalogue QR
                  </p>
                  <h3 className="text-lg font-black text-slate-900">
                    Customers scan this to browse hire gear
                  </h3>
                  <p className="break-all font-mono text-[11px] text-slate-500">
                    {page}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void copy()}
                      className="inline-flex items-center gap-1 rounded-full bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy link
                    </button>
                    <a
                      href={page}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-white px-3 py-1.5 text-xs font-bold text-cyan-900"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void save(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Rotate token
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {token ? (
            <AdvisorEmbedSnippet
              embedPath={hirePublicEmbedPath(token)}
              title="Hire catalogue embed"
            />
          ) : null}

          <FormCard
            title="Public hire profile"
            onSubmit={() => void save()}
            saving={saving}
            submitLabel="Save settings"
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              Publish public catalogue
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.allow_portal_booking}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allow_portal_booking: e.target.checked,
                  }))
                }
              />
              Allow portal hire requests
            </label>
            <input
              className={fieldClass()}
              placeholder="Brand name"
              value={form.brand_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, brand_name: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Website URL"
              value={form.website_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, website_url: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Contact email"
              value={form.contact_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Contact phone"
              value={form.contact_phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_phone: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
            <input
              className={fieldClass()}
              type="color"
              value={form.primary_color}
              onChange={(e) =>
                setForm((f) => ({ ...f, primary_color: e.target.value }))
              }
              title="Brand colour"
            />
            <textarea
              className={fieldClass() + ' min-h-[4rem] sm:col-span-2'}
              placeholder="Public bio"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
          </FormCard>
        </div>
      )}
    </HiregraphWorkbench>
  );
}
