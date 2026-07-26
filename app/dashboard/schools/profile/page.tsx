'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { SA_PROVINCES } from '@/lib/schools/types';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function SchoolProfilePage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | boolean>>(
    {}
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/profile?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const s = data.school || {};
      setForm({
        school_name: s.school_name || '',
        emis_number: s.emis_number || '',
        school_type: s.school_type || 'public',
        phase: s.phase || 'primary',
        province: s.province || '',
        district: s.district || '',
        circuit: s.circuit || '',
        quintile: s.quintile ?? '',
        urban_rural: s.urban_rural || '',
        address: s.address || '',
        city: s.city || '',
        postal_code: s.postal_code || '',
        lat: s.lat ?? '',
        lng: s.lng ?? '',
        principal_name: s.principal_name || '',
        principal_email: s.principal_email || '',
        principal_phone: s.principal_phone || '',
        nsnp_coordinator_name: s.nsnp_coordinator_name || '',
        nsnp_coordinator_email: s.nsnp_coordinator_email || '',
        has_on_site_kitchen: s.has_on_site_kitchen !== false,
        feeding_breakfast: Boolean(s.feeding_breakfast),
        feeding_lunch: s.feeding_lunch !== false,
        feeding_snack: Boolean(s.feeding_snack),
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { companyId };
      for (const [k, v] of Object.entries(form)) {
        if (k === 'quintile' || k === 'lat' || k === 'lng') {
          body[k] = v === '' || v == null ? null : Number(v);
        } else {
          body[k] = v;
        }
      }
      const res = await fetch('/api/schools/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('School profile saved');
      setForm((f) => ({
        ...f,
        school_name: data.school?.school_name || f.school_name,
      }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School profile"
        titleAccent="Identity"
        description="EMIS, location, kitchen flags, and contacts. Set lat/lng for the map."
        action={
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        }
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-6 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="School name">
              <input
                className="input"
                value={String(form.school_name || '')}
                onChange={(e) => set('school_name', e.target.value)}
              />
            </Field>
            <Field label="EMIS number">
              <input
                className="input"
                value={String(form.emis_number || '')}
                onChange={(e) => set('emis_number', e.target.value)}
              />
            </Field>
            <Field label="Phase">
              <select
                className="input"
                value={String(form.phase || '')}
                onChange={(e) => set('phase', e.target.value)}
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="combined">Combined</option>
                <option value="special">Special</option>
              </select>
            </Field>
            <Field label="Province">
              <select
                className="input"
                value={String(form.province || '')}
                onChange={(e) => set('province', e.target.value)}
              >
                <option value="">Select…</option>
                {SA_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="District">
              <input
                className="input"
                value={String(form.district || '')}
                onChange={(e) => set('district', e.target.value)}
              />
            </Field>
            <Field label="Circuit">
              <input
                className="input"
                value={String(form.circuit || '')}
                onChange={(e) => set('circuit', e.target.value)}
              />
            </Field>
            <Field label="Quintile (1–5)">
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={form.quintile === '' ? '' : Number(form.quintile)}
                onChange={(e) => set('quintile', e.target.value)}
              />
            </Field>
            <Field label="City">
              <input
                className="input"
                value={String(form.city || '')}
                onChange={(e) => set('city', e.target.value)}
              />
            </Field>
            <Field label="Address">
              <input
                className="input"
                value={String(form.address || '')}
                onChange={(e) => set('address', e.target.value)}
              />
            </Field>
            <Field label="Latitude">
              <input
                className="input"
                value={String(form.lat ?? '')}
                onChange={(e) => set('lat', e.target.value)}
                placeholder="-26.2041"
              />
            </Field>
            <Field label="Longitude">
              <input
                className="input"
                value={String(form.lng ?? '')}
                onChange={(e) => set('lng', e.target.value)}
                placeholder="28.0473"
              />
            </Field>
          </div>

          <div className="border-t pt-4 grid sm:grid-cols-2 gap-4">
            <Field label="Principal name">
              <input
                className="input"
                value={String(form.principal_name || '')}
                onChange={(e) => set('principal_name', e.target.value)}
              />
            </Field>
            <Field label="Principal email">
              <input
                className="input"
                value={String(form.principal_email || '')}
                onChange={(e) => set('principal_email', e.target.value)}
              />
            </Field>
            <Field label="NSNP coordinator">
              <input
                className="input"
                value={String(form.nsnp_coordinator_name || '')}
                onChange={(e) => set('nsnp_coordinator_name', e.target.value)}
              />
            </Field>
            <Field label="Coordinator email">
              <input
                className="input"
                value={String(form.nsnp_coordinator_email || '')}
                onChange={(e) => set('nsnp_coordinator_email', e.target.value)}
              />
            </Field>
          </div>

          <div className="border-t pt-4 flex flex-wrap gap-4">
            {(
              [
                ['has_on_site_kitchen', 'On-site kitchen'],
                ['feeding_breakfast', 'Breakfast'],
                ['feeding_lunch', 'Lunch'],
                ['feeding_snack', 'Snack'],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                <input
                  type="checkbox"
                  checked={Boolean(form[k])}
                  onChange={(e) => set(k, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </SchoolsPage>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
