'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { FormCard, StatRow, fc } from '@/components/clinic/PhysioForm';
import { AdvisorOpsPoliciesCard } from '@/components/services/AdvisorOpsPoliciesCard';
import { AdvisorRoomsCard } from '@/components/services/AdvisorRoomsCard';
import { clinicRoomNames } from '@/lib/clinic/clinic-rooms';
import { PracticeProfilePdfButton } from '@/components/schedule/PracticeProfilePdfButton';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { AdvisorDeskInviteCard } from '@/components/advisors/AdvisorDeskInviteCard';
import { AdvisorPayoutSettings } from '@/components/advisors/AdvisorPayoutSettings';
import { AdvisorMemberCalendarShareCard } from '@/components/advisors/AdvisorMemberCalendarShareCard';
import { AdvisorEmbedSnippet } from '@/components/services/AdvisorEmbedSnippet';
import { AdvisorPortalManager } from '@/components/advisors/AdvisorPortalManager';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import type { WorkingHours } from '@/lib/schedule/working-hours';

export default function WebsitePage() {
  const { companyId, store, loading, saving, post, summary } =
    usePhysiograph();
  const [form, setForm] = useState({
    enabled: false,
    brand_name: '',
    website_url: '',
    public_bio: '',
    allow_public_booking: true,
    show_practitioners: true,
    show_pricing: true,
    contact_email: '',
    contact_phone: '',
    embed_primary_color: '#0d9488',
    timezone: 'Africa/Johannesburg',
    city: '',
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
      show_practitioners: s.show_practitioners !== false,
      show_pricing: s.show_pricing !== false,
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      embed_primary_color: s.embed_primary_color || '#0d9488',
      timezone: s.timezone || 'Africa/Johannesburg',
      city: s.marketplace?.city || '',
    });
  }, [store]);

  const save = async () => {
    const { city, ...settings } = form;
    await post({
      action: 'update_settings',
      settings: {
        ...settings,
        marketplace: {
          ...(store?.settings?.marketplace || {}),
          city,
        },
      },
    });
    toast.success('Clinic website settings saved');
  };

  const saveHours = async (working_hours: WorkingHours) => {
    await post({
      action: 'update_settings',
      settings: { working_hours },
    });
    toast.success('Portal hours saved');
  };

  const token = store?.settings?.public_token || '';

  return (
    <PhysiographWorkbench
      title="Website"
      titleAccent="& profile"
      description="Publish your clinic brand bio and diary settings. Public booking and practitioner cards can go live on your site."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <AdvisorPortalManager
            module="physiograph"
            logoUrl={logoUrlFromSettings(store.settings)}
            eyebrow="PhysioAdvisor®"
            values={{
              enabled: form.enabled,
              brand_name: form.brand_name,
              public_bio: form.public_bio,
              website_url: form.website_url,
              contact_email: form.contact_email,
              contact_phone: form.contact_phone,
              city: form.city,
              color: form.embed_primary_color,
              allow_booking: form.allow_public_booking,
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
                embed_primary_color: next.color,
                allow_public_booking: next.allow_booking !== false,
              }))
            }
            onSave={() => void save()}
            saving={saving}
            settings={store.settings as Record<string, unknown>}
            onSavePwa={async (pwa) => {
              await post({ action: 'update_settings', settings: pwa });
            }}
            portalPath={
              token
                ? `/embed/advisor/physiograph/${encodeURIComponent(token)}`
                : ''
            }
            hours={store.settings?.working_hours}
            onHoursSave={saveHours}
            hoursSaving={saving}
            bookingLabel="Allow online booking on the portal"
          />

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
          <AdvisorMemberAppInvite
            kind="physio"
            companyId={companyId}
            brand={form.brand_name || store.settings?.brand_name}
            audience="patients"
          />
          <AdvisorPayoutSettings compact />
          <AdvisorDeskInviteCard module="physiograph" />
          <AdvisorMemberCalendarShareCard
            shareMemberCalendar={store.settings?.share_member_calendar !== false}
            generateMemberSlots={store.settings?.generate_member_slots !== false}
            requireAcceptJoin={store.settings?.require_accept_join === true}
            memberSlotMinutes={store.settings?.member_slot_minutes}
            saving={saving}
            onSave={async (patch) => {
              await post({ action: 'update_settings', settings: patch });
            }}
          />
          {token ? (
            <AdvisorEmbedSnippet
              embedPath={`/embed/advisor/physiograph/${encodeURIComponent(token)}`}
              title="Public booking embed"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <PracticeProfilePdfButton
              companyId={companyId}
              module="physiograph"
              label="Download practice PDF"
            />
            <p className="text-[11px] text-slate-500">
              Brand, hours, practitioners, and services as a printable A4 PDF.
            </p>
          </div>
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
              Publish clinic website profile
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
                checked={form.show_practitioners}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    show_practitioners: e.target.checked,
                  }))
                }
              />
              Show practitioners
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
            rooms={clinicRoomNames(store.settings?.rooms)}
            saving={saving}
            accentClass="border-teal-200"
            manageHref="/dashboard/physiograph/rooms"
            hint="Quick list. Open Rooms (Floor) for equipment and which practitioners use each room."
            onSave={async (rooms) => {
              const { mergeClinicRoomNames } = await import(
                '@/lib/clinic/clinic-rooms'
              );
              await post({
                action: 'update_settings',
                settings: {
                  rooms: mergeClinicRoomNames(store.settings?.rooms, rooms),
                },
              });
            }}
          />
          <AdvisorOpsPoliciesCard
            reschedule={store.settings?.reschedule_policy}
            marketplace={store.settings?.marketplace}
            allowConcurrent={true}
            showConcurrent={false}
            saving={saving}
            accentClass="border-teal-200"
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
                /embed/advisor/physiograph/{token}
              </p>
              <a
                href={`/embed/advisor/physiograph/${token}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-xs font-bold text-sky-700 dark:text-sky-300 underline"
              >
                Open public diary
              </a>
            </div>
          ) : null}

          {token ? (
            <p className="text-[11px] font-mono text-teal-800 dark:text-teal-200 break-all">
              Public token: {token}
            </p>
          ) : null}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Website enabled: {summary?.websiteEnabled ? 'yes' : 'no'}. Mark diary
            slots public so they appear on the public book page.
          </p>
        </div>
      )}
    </PhysiographWorkbench>
  );
}
