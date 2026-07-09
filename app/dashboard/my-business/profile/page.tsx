'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck, AlertTriangle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import type { CompanyProfile } from '@/lib/business/types';

const CERTS = [
  'ISO 9001',
  'ISO 22000',
  'ISO 14001',
  'ISO 45001',
  'HACCP',
  'BRC',
  'SQF',
  'Halal',
  'Kosher',
  'Organic',
  'Fairtrade',
  'FSSC 22000',
];

const BEE = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Non-compliant',
];

export default function BusinessProfilePage() {
  return (
    <CompanyRequired>
      <ProfileInner />
    </CompanyRequired>
  );
}

function ProfileInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [form, setForm] = useState<Partial<CompanyProfile>>({});
  const [certs, setCerts] = useState<string[]>([]);
  const [completeness, setCompleteness] = useState<{ pct: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/profile?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const profile = (data.profile || {}) as Partial<CompanyProfile>;
      setForm(profile);
      // Prefer normalized certifications; fall back to any leftover names
      const fromProfile = Array.isArray(profile.certifications)
        ? profile.certifications.map(String)
        : [];
      setCerts(fromProfile);
      setCompleteness(data.completeness || null);
      setWarning(typeof data.warning === 'string' ? data.warning : null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /** Dual-write phone aliases so contact_number (legacy) always stays in sync. */
  const setPhone = (value: string) => {
    setForm((prev) => ({
      ...prev,
      contact_phone: value,
      contact_number: value,
      phone: value,
    }));
  };

  /** Dual-write address / street (legacy column is street). */
  const setAddress = (value: string) => {
    setForm((prev) => ({
      ...prev,
      address: value,
      street: value,
    }));
  };

  /** Dual-write description / short_description / about. */
  const setDescription = (value: string) => {
    setForm((prev) => ({
      ...prev,
      description: value,
      short_description: value,
      about: value,
    }));
  };

  const setIndustry = (value: string) => {
    setForm((prev) => ({
      ...prev,
      industry: value,
      industries: value ? [value] : [],
    }));
  };

  const toggleCert = (c: string) => {
    setCerts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const save = async () => {
    if (!form.trading_name?.toString().trim()) {
      toast.error('Trading name is required');
      return;
    }
    setSaving(true);
    try {
      // Dual-write certs to both modern + legacy columns
      const phone =
        form.contact_phone || form.contact_number || form.phone || null;
      const street = form.street || form.address || null;
      const description =
        form.description || form.short_description || form.about || null;

      const res = await fetch('/api/business/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          ...form,
          contact_phone: phone,
          contact_number: phone,
          phone,
          street,
          address: street,
          description,
          short_description: description,
          about: description,
          certifications: certs,
          iso_certifications: certs,
          industries:
            Array.isArray(form.industries) && form.industries.length
              ? form.industries
              : form.industry
                ? [String(form.industry)]
                : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setForm(data.profile || form);
      if (Array.isArray(data.profile?.certifications)) {
        setCerts(data.profile.certifications.map(String));
      }
      setCompleteness(data.completeness || null);
      toast.success('Profile saved to Supabase');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BusinessPage>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </BusinessPage>
    );
  }

  return (
    <BusinessPage>
      <BusinessHeader
        title="Company"
        titleAccent="profile"
        description="Identity, contacts, banking, and certifications — full profiles row from Supabase (legacy + modern columns)."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save profile
              </>
            )}
          </button>
        }
      />

      {warning && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Profile loaded with a membership warning (data still shown): {warning}
          </span>
        </div>
      )}

      {/* Completeness bar */}
      <div className="mb-8 rounded-[1.35rem] border border-neutral-200/90 bg-white p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Completeness
          </span>
          <span className="text-2xl font-black tracking-tighter tabular-nums">
            {completeness?.pct ?? 0}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6]"
            style={{ width: `${completeness?.pct ?? 0}%` }}
          />
        </div>
        {(form.is_verified || form.verification_status === 'verified') && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified company
          </div>
        )}
        {form.public_id && (
          <div className="mt-2 text-[11px] text-neutral-400 font-mono">
            public_id: {String(form.public_id)}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <Panel title="Identity">
          <div className="p-5 space-y-3">
            <Field label="Trading name *">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.trading_name || ''}
                onChange={(e) => set('trading_name', e.target.value)}
              />
            </Field>
            <Field label="Legal name">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.legal_name || ''}
                onChange={(e) => set('legal_name', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Registration no.">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.registration_number || ''}
                  onChange={(e) => set('registration_number', e.target.value)}
                />
              </Field>
              <Field label="VAT number">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.vat_number || ''}
                  onChange={(e) => set('vat_number', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Tax number">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.tax_number || ''}
                onChange={(e) => set('tax_number', e.target.value)}
              />
            </Field>
            <Field label="About / short description">
              <textarea
                className="input w-full !p-3 !text-sm min-h-[88px]"
                value={String(
                  form.description || form.short_description || form.about || ''
                )}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this company do?"
              />
            </Field>
            <Field label="Logo URL">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.logo_url || ''}
                onChange={(e) => set('logo_url', e.target.value)}
                placeholder="https://…"
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Contacts">
          <div className="p-5 space-y-3">
            <Field label="Primary contact">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.contact_name || ''}
                onChange={(e) => set('contact_name', e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="input w-full !p-3 !text-sm"
                value={form.email || ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone (contact_number)">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={
                    form.contact_phone ||
                    form.contact_number ||
                    form.phone ||
                    ''
                  }
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="Website">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.website || ''}
                  onChange={(e) => set('website', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Wallet address (on-chain)">
              <input
                className="input w-full !p-3 !text-sm font-mono"
                value={form.wallet_address || ''}
                onChange={(e) => set('wallet_address', e.target.value)}
                placeholder="0x…"
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Location">
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Continent">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.continent || ''}
                  onChange={(e) => set('continent', e.target.value)}
                />
              </Field>
              <Field label="Country">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.country || ''}
                  onChange={(e) => set('country', e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Province / state">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.province || form.region || ''}
                  onChange={(e) => {
                    set('province', e.target.value);
                    set('region', e.target.value);
                  }}
                />
              </Field>
              <Field label="City">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.city || ''}
                  onChange={(e) => set('city', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Street address">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.street || form.address || ''}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field label="Postal code">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.postal_code || ''}
                onChange={(e) => set('postal_code', e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Industry & compliance">
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={
                    form.industry ||
                    (Array.isArray(form.industries) ? form.industries[0] : '') ||
                    ''
                  }
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </Field>
              <Field label="Sub-industry">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.sub_industry || ''}
                  onChange={(e) => set('sub_industry', e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Business type">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.business_type || form.category || ''}
                  onChange={(e) => {
                    set('business_type', e.target.value);
                    set('category', e.target.value);
                  }}
                />
              </Field>
              <Field label="B-BBEE level">
                <select
                  className="input w-full !p-3 !text-sm"
                  value={form.bee_level || ''}
                  onChange={(e) => set('bee_level', e.target.value)}
                >
                  <option value="">Select…</option>
                  {BEE.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="BEE certificate URL">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.bee_certificate_url || ''}
                onChange={(e) => set('bee_certificate_url', e.target.value)}
              />
            </Field>
            <Field label="VAT certificate URL">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.vat_certificate_url || ''}
                onChange={(e) => set('vat_certificate_url', e.target.value)}
              />
            </Field>
            <SectionLabel>Certifications (ISO + other)</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {CERTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCert(c)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    certs.includes(c)
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-neutral-200 text-neutral-600 hover:border-[#00b4d8]/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {/* Show any cert names from Supabase that aren't in the preset list */}
            {certs.filter((c) => !CERTS.includes(c)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {certs
                  .filter((c) => !CERTS.includes(c))
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCert(c)}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-[#00b4d8] bg-[#00b4d8] text-white"
                    >
                      {c}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Banking">
          <div className="p-5 space-y-3">
            <Field label="Bank name">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.bank_name || ''}
                onChange={(e) => set('bank_name', e.target.value)}
              />
            </Field>
            <Field label="Account name">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.account_name || ''}
                onChange={(e) => set('account_name', e.target.value)}
              />
            </Field>
            <Field label="Account number">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.account_number || ''}
                onChange={(e) => set('account_number', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IBAN">
                <input
                  className="input w-full !p-3 !text-sm font-mono"
                  value={form.iban || ''}
                  onChange={(e) => set('iban', e.target.value)}
                />
              </Field>
              <Field label="SWIFT / BIC">
                <input
                  className="input w-full !p-3 !text-sm font-mono"
                  value={form.swift || ''}
                  onChange={(e) => set('swift', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Bank confirmation URL">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.bank_confirmation_url || ''}
                onChange={(e) => set('bank_confirmation_url', e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Licenses & director">
          <div className="p-5 space-y-3">
            <Field label="Director ID number">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.director_id_number || ''}
                onChange={(e) => set('director_id_number', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Export license no.">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.export_license_number || ''}
                  onChange={(e) => set('export_license_number', e.target.value)}
                />
              </Field>
              <Field label="Import license no.">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.import_license_number || ''}
                  onChange={(e) => set('import_license_number', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Export license URL">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.export_license_url || ''}
                onChange={(e) => set('export_license_url', e.target.value)}
              />
            </Field>
            <Field label="Import license URL">
              <input
                className="input w-full !p-3 !text-sm"
                value={form.import_license_url || ''}
                onChange={(e) => set('import_license_url', e.target.value)}
              />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary !py-3 !px-8 text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save to Supabase'}
        </button>
      </div>
    </BusinessPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
