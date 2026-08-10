'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { FormCard, StatRow, fc } from '@/components/dental/DentalForm';
import { AdvisorOpsPoliciesCard } from '@/components/services/AdvisorOpsPoliciesCard';
import { AdvisorRoomsCard } from '@/components/services/AdvisorRoomsCard';

export default function WebsitePage() {
  const { store, loading, saving, post, summary } = useDentalgraph();
  const [form, setForm] = useState({
    enabled: false,
    brand_name: '',
    website_url: '',
    public_bio: '',
    allow_public_booking: true,
    show_staff: true,
    show_pricing: true,
    contact_email: '',
    contact_phone: '',
    embed_primary_color: '#0284c7',
    timezone: 'Africa/Johannesburg',
  });

  useEffect(() => {
    if (!store?.settings) return;
    const s = store.settings;
    setForm({
      enabled: s.enabled === true,
      brand_name: s.brand_name || '',
      website_url: s.website_url || '',
      public_bio: s.public_bio || '',
      allow_public_booking: s.allow_public_booking !== false,
      show_staff: s.show_staff !== false,
      show_pricing: s.show_pricing !== false,
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      embed_primary_color: s.embed_primary_color || '#0284c7',
      timezone: s.timezone || 'Africa/Johannesburg',
    });
  }, [store]);

  const save = async () => {
    await post({ action: 'update_settings', settings: form });
    toast.success('Practice website settings saved');
  };

  const token = store?.settings?.public_token || '';

  return (
    <DentalgraphWorkbench
      title="Website"
      titleAccent="& profile"
      description="Publish your clinic brand bio and diary settings. Public booking and clinician cards can go live on your site."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Published',
                value: form.enabled ? 'Yes' : 'No',
              },
              {
                label: 'Token',
                value: token ? 'Issued' : '—',
              },
              {
                label: 'Online booking',
                value: form.allow_public_booking ? 'On' : 'Off',
              },
            ]}
          />
          <FormCard
            title="Clinic public profile"
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
              Publish practice website profile
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.allow_public_booking}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allow_public_booking: e.target.checked,
                  }))
                }
              />
              Allow online booking
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.show_staff}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    show_staff: e.target.checked,
                  }))
                }
              />
              Show staff
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.show_pricing}
                onChange={(e) =>
                  setForm((f) => ({ ...f, show_pricing: e.target.checked }))
                }
              />
              Show service pricing
            </label>
            <input
              className={fc()}
              placeholder="Brand name"
              value={form.brand_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, brand_name: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Website URL"
              value={form.website_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, website_url: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Contact email"
              value={form.contact_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Contact phone"
              value={form.contact_phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_phone: e.target.value }))
              }
            />
            <textarea
              className={fc() + ' min-h-[4rem] sm:col-span-2 lg:col-span-3'}
              placeholder="Public clinic bio"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
          </FormCard>
          
          <AdvisorRoomsCard
            rooms={store.settings?.rooms || []}
            saving={saving}
            accentClass="border-sky-200"
            onSave={async (rooms) => {
              await post({
                action: 'update_settings',
                settings: { rooms },
              });
            }}
          />
          <AdvisorOpsPoliciesCard
            reschedule={store.settings?.reschedule_policy}
            marketplace={store.settings?.marketplace}
            allowConcurrent={true}
            showConcurrent={false}
            saving={saving}
            accentClass="border-sky-200"
            onSave={async (payload) => {
              await post({
                action: 'update_settings',
                settings: {
                  reschedule_policy: payload.reschedule_policy,
                  marketplace: {
                    ...(store.settings?.marketplace || {}),
                    ...payload.marketplace,
                  },
                },
              });
              toast.success('Ops policies saved');
            }}
          />

          
          {token ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4 space-y-2">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                Public book page
              </p>
              <p className="text-[11px] text-slate-500">
                Share this link or embed it. Guests book open public diary slots
                (emails still send from SupplierAdvisor® on behalf of your brand).
              </p>
              <p className="text-[11px] font-mono break-all text-slate-700 dark:text-slate-200">
                /embed/advisor/dentalgraph/{token}
              </p>
              <a
                href={`/embed/advisor/dentalgraph/${token}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-xs font-bold text-sky-700 dark:text-sky-300 underline"
              >
                Open public diary
              </a>
            </div>
          ) : null}

          {token ? (
            <p className="text-[11px] font-mono text-sky-800 dark:text-sky-200 break-all">
              Public token: {token}
            </p>
          ) : null}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Website enabled: {summary?.websiteEnabled ? 'yes' : 'no'}. Mark diary slots public so they appear on the public book page.
          </p>
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
