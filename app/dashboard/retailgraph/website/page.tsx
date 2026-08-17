'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { AdvisorDeskInviteCard } from '@/components/advisors/AdvisorDeskInviteCard';
import { AdvisorPayoutSettings } from '@/components/advisors/AdvisorPayoutSettings';
import { AdvisorEmbedSnippet } from '@/components/services/AdvisorEmbedSnippet';
import { AdvisorPortalManager } from '@/components/advisors/AdvisorPortalManager';
import type { RetailgraphStore } from '@/lib/retail/retailgraph';

export default function RetailgraphWebsitePage() {
  const { companyId, withAuthJson } = useApiAuth();
  const [store, setStore] = useState<RetailgraphStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    enabled: false,
    brand_name: '',
    website_url: '',
    public_bio: '',
    contact_email: '',
    contact_phone: '',
    embed_primary_color: '#ea580c',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ store?: RetailgraphStore }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    const next = data.store || null;
    setStore(next);
    if (next?.settings) {
      const s = next.settings;
      setForm({
        enabled: s.enabled === true,
        brand_name: s.brand_name || '',
        website_url: s.website_url || '',
        public_bio: s.public_bio || '',
        contact_email: s.contact_email || '',
        contact_phone: s.contact_phone || '',
        embed_primary_color: s.embed_primary_color || '#ea580c',
      });
    }
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [load]);

  const save = async (rotate = false) => {
    if (!companyId) return;
    if (rotate && !confirm('Rotate the public shop link? Existing embeds will break until you update them.')) {
      return;
    }
    setSaving(true);
    try {
      const data = await withAuthJson<{ store?: RetailgraphStore }>(
        '/api/retail/retailgraph',
        {
          method: 'POST',
          jsonBody: {
            companyId,
            action: 'update_settings',
            settings: form,
            rotate_token: rotate,
          },
        }
      );
      if (data.store) setStore(data.store);
      toast.success(rotate ? 'Public token rotated' : 'Website settings saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const token = store?.settings?.public_token || '';
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.supplieradvisor.com';
  const page = useMemo(
    () =>
      token ? `${origin}/embed/retail/${encodeURIComponent(token)}` : '',
    [origin, token]
  );
  const qrImg = useMemo(
    () =>
      page
        ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(page)}`
        : '',
    [page]
  );

  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="Website"
        description="Publish your shop profile, SA Member join QR, and a catalogue embed for your site."
      >
        {loading || !store || !companyId ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <div className="space-y-6">
            <AdvisorPortalManager
              eyebrow="RetailAdvisor®"
              values={{
                enabled: form.enabled,
                brand_name: form.brand_name,
                public_bio: form.public_bio,
                website_url: form.website_url,
                contact_email: form.contact_email,
                contact_phone: form.contact_phone,
                color: form.embed_primary_color,
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
                  embed_primary_color: next.color,
                }))
              }
              onSave={() => void save()}
              saving={saving}
              portalPath={
                token ? `/embed/retail/${encodeURIComponent(token)}` : ''
              }
              showCity={false}
              showBooking={false}
            />
            <AdvisorMemberAppInvite
              kind="retail"
              companyId={companyId}
              brand={form.brand_name || store.settings.brand_name}
              audience="customers"
            />
            <AdvisorPayoutSettings compact />
            <AdvisorDeskInviteCard module="retailgraph" />

            {token ? (
              <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4 sm:p-5">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                  {qrImg ? (
                    <div className="shrink-0 rounded-2xl border border-orange-100 bg-white p-2.5 shadow-sm sm:p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImg}
                        alt="Shop QR"
                        width={200}
                        height={200}
                        className="h-40 w-40 sm:h-[200px] sm:w-[200px]"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 w-full space-y-2 sm:flex-1">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-orange-700">
                      <QrCode className="h-3.5 w-3.5" /> Public shop QR
                    </p>
                    <h3 className="text-lg font-black text-slate-900">
                      Customers scan this to see prices
                    </h3>
                    <p className="break-all font-mono text-[11px] text-slate-500">
                      {page}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(page);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                          toast.success('Copied');
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy link
                      </button>
                      <a
                        href={page}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-xs font-bold text-orange-900"
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
                embedPath={`/embed/retail/${encodeURIComponent(token)}`}
                title="Shop catalogue embed"
              />
            ) : null}

            <form
              className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <h2 className="sm:col-span-2 text-sm font-black">Shop public profile</h2>
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
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Brand name"
                value={form.brand_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand_name: e.target.value }))
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Website URL"
                value={form.website_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, website_url: e.target.value }))
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Contact email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_email: e.target.value }))
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Contact phone"
                value={form.contact_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_phone: e.target.value }))
                }
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type="color"
                value={form.embed_primary_color}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_primary_color: e.target.value,
                  }))
                }
              />
              <textarea
                className="min-h-[4rem] rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Public shop bio"
                value={form.public_bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, public_bio: e.target.value }))
                }
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50 sm:col-span-2"
              >
                Save settings
              </button>
            </form>
          </div>
        )}
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}
