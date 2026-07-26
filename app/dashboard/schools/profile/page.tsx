'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Loader2, Save, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { SA_PROVINCES } from '@/lib/schools/types';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number | boolean>>(
    {}
  );
  const [departmentMenu, setDepartmentMenu] = useState<{
    name?: string;
    agency_name?: string | null;
    description?: string | null;
    items?: Array<{
      day: number;
      dish?: string;
      meal_type?: string;
      approved_product_ids?: number[];
    }>;
  } | null>(null);
  const [menuAdherence, setMenuAdherence] = useState<{
    pct?: number;
    matched?: number;
    total?: number;
    period?: { name?: string };
  } | null>(null);

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
      setPhotoUrl(s.photo_url || null);
      setDepartmentMenu(data.departmentMenu || null);
      setMenuAdherence(data.menuAdherence || null);
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
        motto: s.motto || '',
        about: s.about || '',
        privacy_mode: Boolean(s.privacy_mode),
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
      if (photoUrl) body.photo_url = photoUrl;
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
      if (data.school?.photo_url) setPhotoUrl(data.school.photo_url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return toast.error('Please choose a photo (JPG, PNG, WebP)');
    }
    if (file.size > 8 * 1024 * 1024) {
      return toast.error('Photo must be under 8MB');
    }
    setUploading(true);
    try {
      const result = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind: 'school_photo',
      });
      if (!result.url) {
        throw new Error(result.error || 'Upload failed');
      }
      const res = await fetch('/api/schools/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          photo_url: result.url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save photo');
      setPhotoUrl(result.url);
      toast.success('School photo updated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const set = (k: string, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School profile"
        titleAccent="Identity"
        description="Photo, EMIS, location, kitchen flags, and contacts. Your photo appears on food surveys and the command hub."
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
        <div className="space-y-4 max-w-3xl">
          {/* Photo hero */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div className="relative group">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="School"
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-slate-100 shadow-sm"
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-sky-100 to-emerald-50 border border-slate-100 flex items-center justify-center text-3xl font-black text-[#0077b6]">
                  {String(form.school_name || 'S').slice(0, 1).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-2 shadow">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-slate-700" />
                  )}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void onPhoto(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-black text-lg text-slate-900">
                {String(form.school_name || 'Your school')}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Add a clear photo of the school front or kitchen entrance —
                builds pride and helps parents recognise surveys.
              </p>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="mt-3 btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                {photoUrl ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
          </div>

          {/* Department menu on school profile */}
          <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-violet-700 flex items-center gap-1">
                  <Utensils className="w-3.5 h-3.5" />
                  Department menu (must follow)
                </p>
                {departmentMenu ? (
                  <>
                    <p className="font-black text-base mt-1">
                      {departmentMenu.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Set by {departmentMenu.agency_name || 'your department'} ·
                      live for this school
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600 mt-1">
                    No mandated menu yet — join DBE/DoH and wait for them to
                    publish under Schools → Menu.
                  </p>
                )}
              </div>
              {menuAdherence && departmentMenu ? (
                <div className="rounded-2xl bg-white border border-amber-100 px-4 py-2 text-center min-w-[5.5rem]">
                  <p className="text-[9px] font-bold uppercase text-amber-800/70">
                    Adherence
                  </p>
                  <p className="text-2xl font-black tabular-nums text-slate-900">
                    {Number(menuAdherence.pct || 0)}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {menuAdherence.matched}/{menuAdherence.total} days
                    {menuAdherence.period?.name
                      ? ` · ${menuAdherence.period.name}`
                      : ''}
                  </p>
                </div>
              ) : null}
            </div>
            {departmentMenu?.items && departmentMenu.items.length > 0 ? (
              <div className="space-y-2 mb-3">
                {[1, 2, 3, 4, 5].map((day) => {
                  const labels = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
                  const dayItems = (departmentMenu.items || []).filter(
                    (it) => Number(it.day) === day && it.dish
                  );
                  if (!dayItems.length) return null;
                  const breakfast = dayItems.find(
                    (i) => String(i.meal_type) === 'breakfast'
                  );
                  const lunch = dayItems.find(
                    (i) => String(i.meal_type) !== 'breakfast'
                  );
                  return (
                    <div
                      key={day}
                      className="rounded-xl border border-violet-50 bg-white/80 px-3 py-2 text-sm"
                    >
                      <p className="text-[10px] font-black uppercase text-violet-600 mb-1">
                        {labels[day]}
                      </p>
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        <p className="text-xs">
                          <span className="font-bold text-amber-800">
                            Breakfast:{' '}
                          </span>
                          {breakfast?.dish || '—'}
                        </p>
                        <p className="text-xs">
                          <span className="font-bold text-sky-800">Lunch: </span>
                          {lunch?.dish || '—'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <Link
              href="/dashboard/schools/menu"
              className="text-xs font-bold text-[#0077b6] underline underline-offset-2"
            >
              Open full menu & adherence →
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-6">
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
              <Field label="Motto">
                <input
                  className="input"
                  value={String(form.motto || '')}
                  onChange={(e) => set('motto', e.target.value)}
                  placeholder="Optional short motto"
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

            <Field label="About the school">
              <textarea
                className="input min-h-[80px]"
                value={String(form.about || '')}
                onChange={(e) => set('about', e.target.value)}
                placeholder="Short note for agency visits and pride…"
              />
            </Field>

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
                  onChange={(e) =>
                    set('nsnp_coordinator_email', e.target.value)
                  }
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
                  ['privacy_mode', 'Privacy mode (mask learner names)'],
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
