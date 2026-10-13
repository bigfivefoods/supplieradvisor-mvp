'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { srmFocus } from '@/components/suppliers/srm/SrmDesk';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { useApiAuth } from '@/lib/client/use-api-auth';
import { SUPPLIER_CERTIFICATIONS, SUPPLIER_INDUSTRIES } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';
import GeoSelectFields, { type GeoValue } from '@/components/geo/GeoSelectFields';
import { AccountLogoField } from '@/components/relationship/AccountLogoField';
import { continentFromCountry } from '@/lib/geo/continent-from-country';

export default function AddSupplierPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <SuppliersPage>
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
            </div>
          </SuppliersPage>
        }
      >
        <AddInner />
      </Suspense>
    </CompanyRequired>
  );
}

function AddInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const { withAuth } = useApiAuth();
  const privyUserId = getCanonicalUserId(user?.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCountry = (searchParams.get('country') || '').trim();
  const prefillContinent = (searchParams.get('continent') || '').trim();
  const [saving, setSaving] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const initialCountry = prefillCountry || 'South Africa';
  const initialContinent =
    prefillContinent || continentFromCountry(initialCountry) || 'Africa';
  const [form, setForm] = useState({
    trading_name: '',
    legal_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    industry: '',
    category: '',
    city: '',
    country: initialCountry,
    continent: initialContinent,
    notes: '',
    logo_url: '',
    certifications: [] as string[],
  });
  const geoHint = useMemo(() => {
    if (prefillCountry) return `Prefilled from Discover: ${prefillCountry}`;
    return null;
  }, [prefillCountry]);

  const toggleCert = (c: string) => {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.includes(c)
        ? f.certifications.filter((x) => x !== c)
        : [...f.certifications, c],
    }));
  };

  const submit = async () => {
    if (!form.trading_name.trim()) {
      toast.error('Trading name required');
      return;
    }
    if (sendInvite && !form.contact_email.trim()) {
      toast.error('Email required to invite');
      return;
    }
    setSaving(true);
    try {
      if (sendInvite) {
        const res = await withAuth('/api/suppliers/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            trading_name: form.trading_name,
            legal_name: form.legal_name || form.trading_name,
            contact_name: form.contact_name,
            contact_email: form.contact_email,
            contact_phone: form.contact_phone,
            website: form.website,
            industry: form.industry,
            category: form.category,
            city: form.city,
            country: form.country,
            invitedBy: form.contact_name || 'Buyer',
            logo_url: form.logo_url || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invite failed');
        toast.success(
          data.warning
            ? 'Supplier added — share invite link manually (email failed)'
            : 'Invitation sent — supplier can claim and take over'
        );
        const { toastGoldenPathFromResponse } = await import(
          '@/lib/onboarding/toast-client'
        );
        toastGoldenPathFromResponse(data);
        if (data.inviteLink) {
          try {
            await navigator.clipboard.writeText(data.inviteLink);
            toast.message('Invite link copied to clipboard');
          } catch {
            /* ignore */
          }
        }
      } else {
        const res = await withAuth('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            ...form,
            email: form.contact_email,
            phone: form.contact_phone,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Create failed');
        toast.success('Supplier added to your book');
      }
      router.push('/dashboard/suppliers/network');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="Add or invite supplier"
        description="Suppliers are who you buy from (AP). If you also sell to this firm, onboard them under Customers too — AR and AP stay separate. Invite them onto the platform when you are ready."
      />

      <div className="max-w-2xl bg-white border rounded-3xl p-6 space-y-4">
        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sm font-medium">
          <input
            type="checkbox"
            className={srmFocus}
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
          />
          Send platform invite (recommended) — they take over their company profile
        </label>

        <AccountLogoField
          companyId={companyId}
          privyUserId={privyUserId}
          kind="supplier"
          logoUrl={form.logo_url || null}
          name={form.trading_name}
          size="lg"
          onChange={(url) => setForm((f) => ({ ...f, logo_url: url || '' }))}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700" htmlFor="srm-trading-name">Trading name</label>
            <input
              id="srm-trading-name"
              required
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.trading_name}
              onChange={(e) => setForm({ ...form, trading_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Legal name</label>
            <input
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Contact name</label>
            <input
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Email {sendInvite ? '(required to invite)' : ''}</label>
            <input
              type="email"
              autoComplete="email"
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Phone</label>
            <input
              type="tel"
              autoComplete="tel"
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Industry</label>
            <select
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            >
              <option value="">Select…</option>
              {SUPPLIER_INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Category</label>
            <input
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Dairy ingredients"
            />
          </div>
          <div className="sm:col-span-2">
            {geoHint ? (
              <p className="mb-2 text-[11px] font-semibold text-[#0077b6]">{geoHint}</p>
            ) : null}
            <GeoSelectFields
              compact
              countryRequired={false}
              value={{
                continent: form.continent || '',
                country: form.country || '',
                province: '',
                city: form.city || '',
              }}
              onChange={(g: GeoValue) =>
                setForm((f) => ({
                  ...f,
                  continent:
                    g.continent ||
                    continentFromCountry(g.country) ||
                    f.continent,
                  country: g.country,
                  city: g.city,
                }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Website</label>
            <input
              className={`${srmFocus} input mt-1 w-full !p-3 !text-sm`}
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Notes
          <textarea
            className={`${srmFocus} input mt-1 min-h-[72px] w-full !p-3 !text-sm`}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Payment habits, capacity, or why they are on the book"
          />
        </label>

        {!sendInvite && (
          <div>
            <label className="text-xs font-medium">Known certifications</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUPPLIER_CERTIFICATIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCert(c)}
                  aria-pressed={form.certifications.includes(c)}
                  className={`${srmFocus} rounded-full border px-2 py-1 text-[10px] font-semibold ${
                    form.certifications.includes(c)
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950'
                      : 'border-neutral-200 text-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className={`${srmFocus} btn-primary w-full !py-3`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              {sendInvite ? 'Add & send invite' : 'Add to my book only'}
            </>
          )}
        </button>
      </div>
    </div>
    </SuppliersPage>
  );
}
