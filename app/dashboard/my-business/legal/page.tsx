'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

/**
 * Legal & compliance — writes registration / BEE / tax fields to profiles via business profile API.
 */
export default function LegalPage() {
  return (
    <CompanyRequired>
      <LegalInner />
    </CompanyRequired>
  );
}

function LegalInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [form, setForm] = useState({
    registration_number: '',
    vat_number: '',
    tax_number: '',
    bee_level: '',
    legal_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/profile?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const p = data.profile || {};
      setForm({
        registration_number: p.registration_number || '',
        vat_number: p.vat_number || '',
        tax_number: p.tax_number || '',
        bee_level: p.bee_level || '',
        legal_name: p.legal_name || '',
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/business/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Legal details saved to Supabase');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BusinessPage>
      <BusinessHeader
        title="Legal &"
        titleAccent="compliance"
        description="Registration, tax, and B-BBEE fields live on the company profile — the same record CRM and SRM trust."
        action={
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
          </button>
        }
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="max-w-2xl">
          <Panel title="Statutory identity">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium mb-2">
                <ShieldCheck className="w-4 h-4" /> Synced via /api/business/profile
              </div>
              <Field label="Legal name">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.legal_name}
                  onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                />
              </Field>
              <Field label="Company registration number">
                <input
                  className="input w-full !p-3 !text-sm"
                  value={form.registration_number}
                  onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="VAT number">
                  <input
                    className="input w-full !p-3 !text-sm"
                    value={form.vat_number}
                    onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                  />
                </Field>
                <Field label="Tax number">
                  <input
                    className="input w-full !p-3 !text-sm"
                    value={form.tax_number}
                    onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="B-BBEE level">
                <select
                  className="input w-full !p-3 !text-sm"
                  value={form.bee_level}
                  onChange={(e) => setForm({ ...form, bee_level: e.target.value })}
                >
                  <option value="">Select…</option>
                  {['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Non-compliant'].map(
                    (b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    )
                  )}
                </select>
              </Field>
            </div>
          </Panel>
          <p className="text-xs text-neutral-500 mt-4">
            Upload certificates and POPIA policies under Documents. Profile certifications are managed on the Profile page.
          </p>
        </div>
      )}
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
