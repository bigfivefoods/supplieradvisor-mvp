'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Copy,
  ExternalLink,
  Link2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { FormCard, StatRow, fieldClass } from '@/components/hire/SimpleEntityForm';
import {
  HIRE_REQUIREMENT_LABELS,
  hireCustomerPortalPath,
  type HireRequirementKey,
} from '@/lib/hire/hiregraph';

const COMMON_REQ: HireRequirementKey[] = [
  'id_document',
  'proof_of_address',
  'drivers_licence',
  'age_18_plus',
  'age_21_plus',
  'credit_card_hold',
  'adult_supervision',
  'flat_level_ground',
  'power_access_220v',
  'delivery_address',
];

/**
 * Hire renters = Core OS Customers (CRM) book.
 * Hire-only KYC + B2C portal tokens live here.
 */
export default function HireCustomersPage() {
  const { store, coreCustomers, loading, saving, post, summary } =
    useHiregraph();
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [reqs, setReqs] = useState<HireRequirementKey[]>([]);
  const [brandForm, setBrandForm] = useState({
    brand_name: '',
    public_bio: '',
    contact_email: '',
    contact_phone: '',
    city: '',
    allow_portal_booking: true,
  });

  useEffect(() => {
    if (!store) return;
    setBrandForm({
      brand_name: store.settings?.brand_name || '',
      public_bio: store.settings?.public_bio || '',
      contact_email: store.settings?.contact_email || '',
      contact_phone: store.settings?.contact_phone || '',
      city: store.settings?.city || '',
      allow_portal_booking: store.settings?.allow_portal_booking !== false,
    });
  }, [store]);

  const bookingCountByCustomer = new Map<number, number>();
  for (const b of store?.bookings || []) {
    const cid = Number(b.crm_customer_id || b.customer_id);
    if (!cid) continue;
    bookingCountByCustomer.set(cid, (bookingCountByCustomer.get(cid) || 0) + 1);
  }

  const pickCustomer = (id: number) => {
    setSelectedId(id);
    const kyc = store?.customer_kyc?.[String(id)] || [];
    setReqs([...kyc]);
  };

  const toggleReq = (r: HireRequirementKey) => {
    setReqs((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const saveKyc = async () => {
    if (!selectedId) {
      toast.error('Select a customer first');
      return;
    }
    await post({
      action: 'set_kyc',
      crm_customer_id: selectedId,
      requirements_met: reqs,
    });
    toast.success('Hire requirements saved for this customer');
  };

  const issuePortal = async (crmId: number) => {
    const data = await post({
      action: 'issue_portal',
      crm_customer_id: crmId,
    });
    const path =
      (data.portal_path as string) ||
      (data.portal_token
        ? hireCustomerPortalPath(String(data.portal_token))
        : '');
    if (path && typeof window !== 'undefined') {
      const url = `${window.location.origin}${path}`;
      // Also offer member-hub deep link that logs in then links
      const hubUrl = `${window.location.origin}/me?link=${encodeURIComponent(
        String(data.portal_token || path)
      )}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(
          'Portal issued — link copied. Customer can also log in at /me and paste it.'
        );
      } catch {
        toast.success(`Portal: ${url} · Hub: ${hubUrl}`);
      }
    } else {
      toast.success('Portal issued');
    }
  };

  const copyPortal = async (token: string) => {
    const url = `${window.location.origin}${hireCustomerPortalPath(token)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Portal link copied');
  };

  const saveBrand = async () => {
    await post({
      action: 'update_settings',
      settings: brandForm,
    });
    toast.success('Portal brand settings saved');
  };

  const portals = store?.customer_portals || {};

  return (
    <HiregraphWorkbench
      title="Hire customers"
      titleAccent="B2C portal · Core CRM"
      description="Renters live in Core Customers. Issue a portal link — customers use the SA Member app (/me) on their phone to order, track, and complete docs."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 dark:border-cyan-500/30 dark:bg-cyan-950/40">
            <p className="text-sm text-cyan-950 dark:text-cyan-50">
              <strong>Source of truth:</strong> Customers module. Portal =
              hire-only access (catalogue · book · KYC · track).
            </p>
            <Link
              href="/dashboard/customers"
              className="inline-flex items-center gap-1 rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white"
            >
              Open Customers <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <StatRow
            tone="hg-talent"
            items={[
              { label: 'Core customers', value: coreCustomers.length },
              {
                label: 'Portals live',
                value:
                  Number(summary?.customerPortalCount) ||
                  Object.values(portals).filter(
                    (p) => p?.active !== false && p?.portal_token
                  ).length,
              },
              {
                label: 'With bookings',
                value: bookingCountByCustomer.size,
              },
              {
                label: 'Open bookings',
                value: Number(summary?.openBookings) || 0,
              },
            ]}
          />

          <FormCard
            title="Portal brand (what customers see)"
            tone="hg-talent"
            saving={saving}
            onSubmit={() => void saveBrand()}
            submitLabel="Save brand"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Brand name
                <input
                  className={fieldClass()}
                  value={brandForm.brand_name}
                  onChange={(e) =>
                    setBrandForm((f) => ({ ...f, brand_name: e.target.value }))
                  }
                  placeholder="e.g. JumpCastles Cape Town"
                />
              </label>
              <label className="text-xs font-bold">
                City
                <input
                  className={fieldClass()}
                  value={brandForm.city}
                  onChange={(e) =>
                    setBrandForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Public bio
                <input
                  className={fieldClass()}
                  value={brandForm.public_bio}
                  onChange={(e) =>
                    setBrandForm((f) => ({ ...f, public_bio: e.target.value }))
                  }
                  placeholder="Short marketplace intro for the portal header"
                />
              </label>
              <label className="text-xs font-bold">
                Contact email
                <input
                  className={fieldClass()}
                  value={brandForm.contact_email}
                  onChange={(e) =>
                    setBrandForm((f) => ({
                      ...f,
                      contact_email: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Contact phone
                <input
                  className={fieldClass()}
                  value={brandForm.contact_phone}
                  onChange={(e) =>
                    setBrandForm((f) => ({
                      ...f,
                      contact_phone: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
                <input
                  type="checkbox"
                  checked={brandForm.allow_portal_booking}
                  onChange={(e) =>
                    setBrandForm((f) => ({
                      ...f,
                      allow_portal_booking: e.target.checked,
                    }))
                  }
                />
                Allow customers to request hires online
              </label>
            </div>
          </FormCard>

          {coreCustomers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center dark:border-cyan-500/20 dark:bg-cyan-950/30">
              <UserRound className="mx-auto h-8 w-8 text-slate-300 dark:text-cyan-300" />
              <p className="mt-3 font-bold text-slate-800 dark:text-white">
                No customers on this company yet
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-cyan-100/70">
                Add renters under Core Customers, then issue B2C portal links.
              </p>
              <Link
                href="/dashboard/customers"
                className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-bold text-white"
              >
                Go to Customers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 dark:divide-cyan-500/15 dark:border-cyan-500/25">
                {coreCustomers.map((c) => {
                  const n = bookingCountByCustomer.get(c.id) || 0;
                  const active = selectedId === c.id;
                  const portal = portals[String(c.id)];
                  const hasPortal =
                    portal?.active !== false && Boolean(portal?.portal_token);
                  return (
                    <li key={c.id}>
                      <div
                        className={`flex w-full items-start justify-between gap-2 px-4 py-3 transition ${
                          active
                            ? 'bg-cyan-50 dark:bg-cyan-900/40'
                            : 'bg-white dark:bg-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => pickCustomer(c.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="font-bold text-slate-900 dark:text-white">
                            {c.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-cyan-100/65">
                            {[c.email, c.phone, c.city]
                              .filter(Boolean)
                              .join(' · ') || `CRM #${c.id}`}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-cyan-100/70">
                            {n} bookings
                            {hasPortal ? ' · portal live' : ''}
                          </p>
                        </button>
                        <div className="flex shrink-0 flex-col gap-1">
                          {hasPortal ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyPortal(portal!.portal_token)
                                }
                                className="inline-flex items-center gap-1 rounded-full border border-cyan-300 px-2 py-1 text-[10px] font-bold text-cyan-900 dark:border-cyan-400/40 dark:text-cyan-100"
                                title="Copy portal link"
                              >
                                <Copy className="h-3 w-3" /> Copy
                              </button>
                              <a
                                href={hireCustomerPortalPath(
                                  portal!.portal_token
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 dark:border-cyan-500/30 dark:text-cyan-100"
                              >
                                <ExternalLink className="h-3 w-3" /> Open
                              </a>
                            </>
                          ) : null}
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void issuePortal(c.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-cyan-700 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                          >
                            <Link2 className="h-3 w-3" />
                            {hasPortal ? 'Re-issue' : 'Issue portal'}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-cyan-500/25 dark:bg-cyan-950/20">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                  Hire requirements (KYC cache)
                </p>
                <label className="mt-2 block text-xs font-bold">
                  Customer
                  <select
                    className={fieldClass()}
                    value={selectedId}
                    onChange={(e) =>
                      pickCustomer(Number(e.target.value) || 0)
                    }
                  >
                    <option value="">— select —</option>
                    {coreCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {COMMON_REQ.map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={!selectedId}
                      onClick={() => toggleReq(r)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold disabled:opacity-40 ${
                        reqs.includes(r)
                          ? 'border-cyan-500 bg-cyan-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-cyan-500/20 dark:bg-cyan-950/40 dark:text-cyan-50'
                      }`}
                    >
                      {HIRE_REQUIREMENT_LABELS[r]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!selectedId || saving}
                  onClick={() => void saveKyc()}
                  className="mt-4 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save hire requirements'}
                </button>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-cyan-100/60">
                  Customers can also self-serve these on their portal. Desk
                  overrides still win when you save here.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </HiregraphWorkbench>
  );
}
