'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Truck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AccountLogoField } from '@/components/relationship/AccountLogoField';
import GeoSelectFields from '@/components/geo/GeoSelectFields';
import {
  SRM_BOOK_PROFILE_FIELDS,
  srmBookProfileGaps,
  srmPortalDocuments,
  srmRecordToBookProfile,
  type SrmBookProfile,
} from '@/lib/suppliers/book-profile';
import {
  SRM_STATUSES,
  SUPPLIER_INDUSTRIES,
  srmStatusClass,
  type SrmSupplierRecord,
} from '@/lib/suppliers/types';
import type { PartyRoleRow } from '@/lib/accounting/party-roles';
import { glCodeFromMeta } from '@/lib/accounting/party-roles';
import { PartyBookRoleSelect } from '@/components/accounting/PartyBookRoleSelect';
import { HostCommercial } from '@/components/commercial/CommercialPanel';

export function SupplierBookProfile({
  supplier,
  companyId,
  privyUserId,
  party,
  onClose,
  onSaved,
}: {
  supplier: SrmSupplierRecord;
  companyId: number;
  privyUserId?: string | null;
  party?: PartyRoleRow | null;
  onClose: () => void;
  onSaved: (next: SrmSupplierRecord) => void;
}) {
  const [form, setForm] = useState<SrmBookProfile>(() =>
    srmRecordToBookProfile(supplier)
  );
  const [status, setStatus] = useState(supplier.status || 'prospect');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(srmRecordToBookProfile(supplier));
    setStatus(supplier.status || 'prospect');
  }, [supplier]);

  const set = (key: keyof SrmBookProfile, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const gaps = srmBookProfileGaps(form);
  const docs = srmPortalDocuments({
    ...supplier,
    ...form,
    metadata: supplier.metadata,
  });
  const filledDocs = docs.filter((d) => d.url).length;

  const save = async () => {
    if (!form.trading_name.trim()) {
      toast.error('Trading name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: supplier.id,
          companyId,
          privyUserId: privyUserId || undefined,
          status,
          trading_name: form.trading_name,
          legal_name: form.legal_name,
          contact_name: form.contact_name,
          job_title: form.job_title,
          email: form.email,
          phone: form.phone,
          website: form.website,
          vat_number: form.vat_number,
          registration_number: form.registration_number,
          address: form.address,
          continent: form.continent,
          country: form.country,
          province: form.province,
          region: form.province,
          city: form.city,
          payment_terms: form.payment_terms,
          industry: form.industry,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Saved to SRM — this is the same profile the portal syncs');
      const saved = data.supplier as SrmSupplierRecord | undefined;
      onSaved(saved && saved.id ? saved : supplier);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const industries = (SUPPLIER_INDUSTRIES as readonly string[]).includes(
    form.industry
  )
    ? SUPPLIER_INDUSTRIES
    : form.industry
      ? [form.industry, ...SUPPLIER_INDUSTRIES]
      : SUPPLIER_INDUSTRIES;

  return (
    <aside
      id="srm-supplier-profile"
      className="rounded-[1.5rem] border border-white/70 bg-white shadow-sm overflow-hidden lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
    >
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
            Profile · SRM
          </p>
          <h2 className="text-lg font-black text-slate-900 truncate">
            {form.trading_name || supplier.trading_name}
          </h2>
          <p className="text-sm text-neutral-600 mt-1">
            Same record the supplier portal saves. Changes here show there, and
            the other way around.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-slate-700"
          aria-label="Close profile"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-1">
            Books · CoA
          </p>
          <PartyBookRoleSelect
            companyId={companyId}
            supplierId={supplier.id}
            customerId={party?.customer_id}
            role={party?.role || 'supplier'}
            arCode={party?.ar_account_code}
            apCode={party?.ap_account_code || glCodeFromMeta(supplier.metadata)}
            onChanged={() => onSaved(supplier)}
          />
        </div>
        <AccountLogoField
          companyId={companyId}
          privyUserId={privyUserId}
          kind="supplier"
          recordId={supplier.id}
          logoUrl={form.logo_url || supplier.logo_url}
          name={form.trading_name}
          size="lg"
          onChange={(url) => set('logo_url', url || '')}
        />

        {gaps.length ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
            Still needed: {gaps.join(', ')}
          </p>
        ) : (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            Profile is complete on SRM — same as the portal.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Status
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {SRM_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end pb-1">
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${srmStatusClass(status)}`}
            >
              {status}
            </span>
          </div>
          {SRM_BOOK_PROFILE_FIELDS.filter(
            (f) => f.key !== 'payment_terms' && f.key !== 'industry'
          ).map((f) => (
            <label
              key={f.key}
              className={`text-[10px] font-bold uppercase tracking-wider text-neutral-400 ${
                f.span ? 'sm:col-span-2' : ''
              }`}
            >
              {f.label}
              {f.required ? <span className="text-rose-500"> *</span> : null}
              {f.key === 'address' ? (
                <textarea
                  className="input mt-0.5 w-full !p-2.5 !text-sm min-h-[64px] font-medium normal-case tracking-normal"
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                  type={f.key === 'email' ? 'email' : 'text'}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
          <div className="sm:col-span-2">
            <GeoSelectFields
              compact
              continentRequired
              countryRequired
              disabled={saving}
              value={{
                continent: form.continent || '',
                country: form.country || '',
                province: form.province || '',
                city: form.city || '',
              }}
              onChange={(g) =>
                setForm((prev) => ({
                  ...prev,
                  continent: g.continent,
                  country: g.country,
                  province: g.province,
                  city: g.city,
                }))
              }
            />
          </div>
          {SRM_BOOK_PROFILE_FIELDS.filter(
            (f) => f.key === 'payment_terms' || f.key === 'industry'
          ).map((f) => (
            <label
              key={f.key}
              className="text-[10px] font-bold uppercase tracking-wider text-neutral-400"
            >
              {f.label}
              {f.key === 'industry' ? (
                <select
                  className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                  value={form.industry}
                  onChange={(e) => set('industry', e.target.value)}
                >
                  <option value="">Select…</option>
                  {industries.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary w-full !py-2.5 text-sm"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Save to SRM'
          )}
        </button>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
              Documents · {filledDocs}/{docs.length}
            </p>
            <Link
              href="/dashboard/suppliers/documents"
              className="text-[11px] font-bold text-[#0077b6]"
            >
              Open vault
            </Link>
          </div>
          <ul className="space-y-1">
            {docs.map((d) => (
              <li
                key={d.field}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-slate-700 truncate">{d.name}</span>
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#0077b6] shrink-0"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-neutral-400 shrink-0">Missing</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <HostCommercial
          companyId={companyId}
          partyKind="supplier"
          supplierId={supplier.id}
          partyName={form.trading_name || supplier.trading_name || 'Supplier'}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/suppliers/po?supplierId=${supplier.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
          >
            <Truck className="w-3.5 h-3.5" /> Raise PO
          </Link>
          <Link
            href="/dashboard/suppliers/documents"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
          >
            <FileText className="w-3.5 h-3.5" /> Documents
          </Link>
          <Link
            href="/dashboard/suppliers/portal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
          >
            <Globe className="w-3.5 h-3.5" /> Portal
          </Link>
        </div>
      </div>
    </aside>
  );
}
