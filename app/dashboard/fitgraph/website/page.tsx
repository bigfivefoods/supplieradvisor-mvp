'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { AdvisorOpsPoliciesCard } from '@/components/services/AdvisorOpsPoliciesCard';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { FitContractDocsPanel } from '@/components/fitness/FitContractDocs';
import {
  gymBrandColor,
  gymCheckinUrl,
  type FitContractDoc,
} from '@/lib/fitness/fitgraph';
import { AdvisorRoomsCard } from '@/components/services/AdvisorRoomsCard';
import { PracticeProfilePdfButton } from '@/components/schedule/PracticeProfilePdfButton';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { AdvisorDeskInviteCard } from '@/components/advisors/AdvisorDeskInviteCard';
import { AdvisorPayoutSettings } from '@/components/advisors/AdvisorPayoutSettings';
import { gymRequiresPaidMembership } from '@/lib/fitness/gym-shop';

export default function FitgraphWebsitePage() {
  const { companyId, store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    enabled: false,
    brand_name: '',
    website_url: '',
    public_bio: '',
    allow_public_booking: true,
    show_coaches: true,
    show_pricing: true,
    show_contracts: true,
    has_front_desk: true,
    contact_email: '',
    contact_phone: '',
    embed_primary_color: '#E8E830',
    timezone: 'Africa/Johannesburg',
    require_paid_membership: true,
  });
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!store?.settings) return;
    const s = store.settings;
    setForm({
      enabled: s.enabled === true,
      brand_name: s.brand_name || '',
      website_url: s.website_url || '',
      public_bio: s.public_bio || s.bio || '',
      allow_public_booking: s.allow_public_booking !== false,
      show_coaches: s.show_coaches !== false,
      show_pricing: s.show_pricing !== false,
      show_contracts: s.show_contracts !== false,
      has_front_desk: s.has_front_desk !== false,
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      embed_primary_color: gymBrandColor(s.embed_primary_color),
      timezone: s.timezone || 'Africa/Johannesburg',
      require_paid_membership: gymRequiresPaidMembership(store),
    });
  }, [store]);

  const token = store?.settings?.public_token || '';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-app';

  const links = useMemo(() => {
    if (!token) return { page: '', api: '', iframe: '', checkin: '', qrImg: '' };
    const page = `${origin}/embed/fitgraph/${encodeURIComponent(token)}`;
    const api = `${origin}/api/public/fitgraph?token=${encodeURIComponent(token)}`;
    const checkin = gymCheckinUrl(origin, token);
    const iframe = `<iframe src="${page}" title="Class schedule" style="width:100%;min-height:720px;border:0;border-radius:16px" loading="lazy"></iframe>`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(checkin)}`;
    return { page, api, iframe, checkin, qrImg };
  }, [token, origin]);

  const save = async () => {
    await post({
      action: 'update_settings',
      settings: form,
    });
    toast.success('Website settings saved');
  };

  const rotate = async () => {
    if (
      !confirm(
        'Rotate public token? Existing embed links on your website will stop working until you update them.'
      )
    ) {
      return;
    }
    await post({
      action: 'update_settings',
      settings: form,
      rotate_token: true,
    });
    toast.success('Public token rotated');
  };

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied');
  };

  const saveContracts = async (next: FitContractDoc[]) => {
    await post({
      action: 'update_settings',
      settings: { contracts: next },
    });
  };

  return (
    <FitgraphWorkbench
      title="Website"
      titleAccent="QR · embed · profile"
      description="Unique gym check-in QR for member phones, ops model, public bio, contracts, and class calendar embed with online booking."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              {
                label: 'Published',
                value: form.enabled ? 'Yes' : 'No',
              },
              {
                label: 'Ops model',
                value: form.has_front_desk ? 'Front desk' : 'Coach-led',
              },
              {
                label: 'Online booking',
                value: form.allow_public_booking ? 'On' : 'Off',
              },
              {
                label: 'Contracts',
                value: (store.settings?.contracts || []).length,
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <PracticeProfilePdfButton
              companyId={companyId}
              module="fitgraph"
              label="Download gym practice PDF"
            />
            <p className="text-[11px] text-slate-500">
              Brand, operating hours, coaches, and class types as a printable A4
              PDF.
            </p>
          </div>

          <AdvisorMemberAppInvite
            kind="gym"
            companyId={companyId}
            brand={form.brand_name || store.settings?.brand_name}
            audience="members"
          />

          <AdvisorPayoutSettings compact />
          <AdvisorDeskInviteCard module="fitgraph" />

          {token ? (
            <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-5 dark:border-yellow-500/30 dark:from-yellow-950/50 dark:to-slate-950">
              <div className="flex flex-wrap items-start gap-6">
                <div className="shrink-0 rounded-2xl border border-yellow-100 bg-white p-3 shadow-sm dark:border-yellow-500/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={links.qrImg}
                    alt="Gym check-in QR"
                    width={200}
                    height={200}
                    className="h-[200px] w-[200px]"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-yellow-700 dark:text-yellow-300">
                    <QrCode className="h-3.5 w-3.5" /> Unique gym check-in QR
                  </p>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Members scan this at the door
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Every gym on GymAdvisor gets a unique QR (your public gym
                    token). Members open it on their phone, identify themselves,
                    and check in. Paid / unpaid / frozen membership is logged
                    for the desk on{' '}
                    <a
                      href="/dashboard/fitgraph/checkins"
                      className="font-bold text-yellow-700 underline dark:text-yellow-300"
                    >
                      Check-ins
                    </a>
                    .
                  </p>
                  <p className="break-all font-mono text-[11px] text-slate-500">
                    {links.checkin}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void copy('checkin', links.checkin)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#E8E830] px-3 py-1.5 text-xs font-bold text-slate-900"
                    >
                      {copied === 'checkin' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy check-in link
                    </button>
                    <a
                      href={links.checkin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-white px-3 py-1.5 text-xs font-bold text-yellow-900 dark:border-yellow-400/40 dark:bg-yellow-900/40 dark:text-yellow-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                    <a
                      href={links.qrImg}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      Download QR image
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Print and post at reception. Rotating the public token below
                    also rotates this QR — update printed signs after rotate.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <FormCard
            tone="owner"
            title="Gym operations model"
            description="Does this gym run with a front desk / floor admin, or is it coach–member only (owner-coach studio)?"
            onSubmit={() => void save()}
            saving={saving}
            submitLabel="Save ops model"
          >
            <div className="col-span-full space-y-3">
              <label
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                  form.has_front_desk
                    ? 'border-yellow-400 bg-yellow-50/80 dark:border-yellow-500 dark:bg-yellow-950/40'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="ops_model"
                  className="mt-1"
                  checked={form.has_front_desk}
                  onChange={() =>
                    setForm((f) => ({ ...f, has_front_desk: true }))
                  }
                />
                <span>
                  <span className="block text-sm font-black text-slate-900 dark:text-white">
                    We have a front desk
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-600 dark:text-slate-300">
                    Desk books members, check-ins, and messages coaches/members.
                    Process and inbox use a desk persona.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                  !form.has_front_desk
                    ? 'border-yellow-400 bg-yellow-50/80 dark:border-yellow-500 dark:bg-yellow-950/40'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="ops_model"
                  className="mt-1"
                  checked={!form.has_front_desk}
                  onChange={() =>
                    setForm((f) => ({ ...f, has_front_desk: false }))
                  }
                />
                <span>
                  <span className="block text-sm font-black text-slate-900 dark:text-white">
                    No front desk · coach-led
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-600 dark:text-slate-300">
                    Coaches own the floor: coach ↔ member and class-group
                    messages, coach calendar, member portal bookings. Process
                    design drops desk-first steps.
                  </span>
                </span>
              </label>
            </div>
          </FormCard>

          <FormCard tone="owner"
            title="Public calendar & gym profile"
            onSubmit={() => void save()}
            saving={saving}
            submitLabel="Save settings"
          >
            <label className="flex items-center gap-2 text-sm font-medium col-span-full sm:col-span-1">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              Publish public calendar
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
            <label className="flex items-center gap-2 text-sm font-medium col-span-full">
              <input
                type="checkbox"
                checked={form.require_paid_membership}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    require_paid_membership: e.target.checked,
                  }))
                }
              />
              Require paid membership before class booking
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.show_coaches}
                onChange={(e) =>
                  setForm((f) => ({ ...f, show_coaches: e.target.checked }))
                }
              />
              Show coaches
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.show_pricing}
                onChange={(e) =>
                  setForm((f) => ({ ...f, show_pricing: e.target.checked }))
                }
              />
              Show membership pricing
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.show_contracts}
                onChange={(e) =>
                  setForm((f) => ({ ...f, show_contracts: e.target.checked }))
                }
              />
              Show PDF contracts publicly
            </label>
            <input
              className={fc()}
              placeholder="Brand name (e.g. VUKA Fitness)"
              value={form.brand_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, brand_name: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Your website URL"
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
            <input
              className={fc()}
              placeholder="Timezone"
              value={form.timezone}
              onChange={(e) =>
                setForm((f) => ({ ...f, timezone: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="color"
              value={form.embed_primary_color}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  embed_primary_color: e.target.value,
                }))
              }
              title="Brand colour"
            />
            <textarea
              className={fc() + ' min-h-[5rem] resize-y sm:col-span-2 lg:col-span-3'}
              placeholder="Gym public bio / about (shown on your website profile)"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
          </FormCard>

          <FitContractDocsPanel
            companyId={companyId}
            contracts={store.settings?.contracts || []}
            onChange={(next) => void saveContracts(next)}
            title="Gym PDF contracts"
            description="Membership agreements, liability waivers, studio terms — attached to your gym bio/profile. Toggle “Show PDF contracts publicly” above to list them on the embed page."
            defaultKind="membership"
            disabled={saving}
            toneClass="border-yellow-200 bg-yellow-50/70 dark:border-yellow-600/50 dark:bg-yellow-950/40"
          />

          
          <AdvisorRoomsCard
            rooms={store.settings?.rooms || []}
            saving={saving}
            accentClass="border-yellow-200"
            label="Studios & rooms"
            hint="Floor resources for the diary (studio, court, spin room)."
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
            allowConcurrent={
              store.settings?.allow_concurrent_coach_sessions !== false
            }
            saving={saving}
            onSave={async (payload) => {
              await post({
                action: 'update_settings',
                settings: {
                  ...form,
                  reschedule_policy: payload.reschedule_policy,
                  allow_concurrent_coach_sessions:
                    payload.allow_concurrent_coach_sessions !== false,
                  marketplace: {
                    ...(store.settings?.marketplace || {}),
                    ...payload.marketplace,
                  },
                },
              });
              toast.success('Ops policies saved');
            }}
          />

          <div className="rounded-3xl border border-yellow-300 bg-yellow-50 p-4 space-y-4 dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-yellow-50">
                Embed & share links
              </h3>
              <button
                type="button"
                disabled={saving}
                onClick={() => void rotate()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rotate token
              </button>
            </div>
            {!form.enabled && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Publish is off — turn it on and save so the public link works.
              </p>
            )}
            <Field
              label="Public page"
              value={links.page}
              copied={copied === 'page'}
              onCopy={() => void copy('page', links.page)}
              open
            />
            <Field
              label="JSON API (for custom website)"
              value={links.api}
              copied={copied === 'api'}
              onCopy={() => void copy('api', links.api)}
            />
            <Field
              label="Iframe snippet"
              value={links.iframe}
              copied={copied === 'iframe'}
              onCopy={() => void copy('iframe', links.iframe)}
              mono
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Mark sessions as <strong>public</strong> on the Calendar workbench
              (or let coaches share from their portal). Only public scheduled
              classes appear on the website.
            </p>
          </div>
        </div>
      )}
    </FitgraphWorkbench>
  );
}

function Field({
  label,
  value,
  onCopy,
  copied,
  open,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  open?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase text-slate-400 mb-1">
        {label}
      </div>
      <div className="flex gap-2">
        <code
          className={`flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] break-all ${
            mono ? 'whitespace-pre-wrap' : ''
          }`}
        >
          {value || '—'}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
          title="Copy"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        {open && value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
            title="Open"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
