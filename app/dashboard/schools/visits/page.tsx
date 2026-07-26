'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  ClipboardCheck,
  Loader2,
  MapPin,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/schools/offline-draft';

export default function VisitsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const cameraRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Array<Record<string, unknown>>>([]);
  const [schools, setSchools] = useState<Array<Record<string, unknown>>>([]);
  const [schoolId, setSchoolId] = useState('');
  const [checks, setChecks] = useState({
    hygiene: true,
    stock_matches_menu: true,
    menu_ok: true,
    learners_vs_meals: true,
    kitchen_ok: true,
  });
  const [notes, setNotes] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, aRes] = await Promise.all([
        fetch(`/api/schools/visits?companyId=${companyId}&mode=agency`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/agency?companyId=${companyId}&mode=agency`, {
          cache: 'no-store',
        }),
      ]);
      const v = await vRes.json();
      const a = await aRes.json();
      if (vRes.ok) setVisits(v.visits || []);
      if (aRes.ok) {
        setSchools(
          (a.schools || []).filter(
            (s: { link_status?: string }) => s.link_status === 'active'
          )
        );
      }
      if (v.warning) toast.message(v.warning);
      const draft = loadOfflineDraft<{
        schoolId?: string;
        checks?: typeof checks;
        notes?: string;
        visitorName?: string;
        lat?: number | null;
        lng?: number | null;
        photos?: string[];
      }>('peu-visit', companyId, 'draft');
      if (draft?.payload) {
        if (draft.payload.schoolId) setSchoolId(draft.payload.schoolId);
        if (draft.payload.checks) setChecks(draft.payload.checks);
        if (draft.payload.notes) setNotes(draft.payload.notes);
        if (draft.payload.visitorName)
          setVisitorName(draft.payload.visitorName);
        if (draft.payload.lat != null) setLat(draft.payload.lat);
        if (draft.payload.lng != null) setLng(draft.payload.lng);
        if (draft.payload.photos) setPhotos(draft.payload.photos);
        setDraftNote(
          `Restored field draft (${new Date(draft.savedAt).toLocaleString()})`
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      saveOfflineDraft(
        'peu-visit',
        companyId,
        'draft',
        {
          schoolId,
          checks,
          notes,
          visitorName,
          lat,
          lng,
          photos,
        },
        'PEU visit'
      );
    }, 500);
    return () => clearTimeout(t);
  }, [companyId, schoolId, checks, notes, visitorName, lat, lng, photos]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      return toast.error('GPS not available on this device');
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(
          pos.coords.accuracy != null
            ? Math.round(pos.coords.accuracy)
            : null
        );
        toast.success('GPS captured');
        setGpsBusy(false);
      },
      (err) => {
        toast.error(err.message || 'GPS failed');
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onPhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const up = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind: 'peu_visit_photo',
      });
      if (!up.url) throw new Error(up.error || 'Upload failed');
      setPhotos((p) => [...p, up.url!]);
      toast.success('Photo attached');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const submit = async () => {
    if (!schoolId) return toast.error('Select a school');
    setSaving(true);
    try {
      if (!isBrowserOnline()) {
        saveOfflineDraft(
          'peu-visit',
          companyId,
          'draft',
          {
            schoolId,
            checks,
            notes,
            visitorName,
            lat,
            lng,
            photos,
            pendingSubmit: true,
          },
          'PEU visit pending'
        );
        toast.message('Saved offline — open again online to sync');
        return;
      }
      const res = await fetch('/api/schools/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          school_profile_id: Number(schoolId),
          checklist: checks,
          notes,
          visitor_name: visitorName || null,
          lat,
          lng,
          accuracy_m: accuracy,
          photo_urls: photos,
          offline_synced: Boolean(draftNote),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Visit logged · score ${data.visit?.overall_score}`);
      clearOfflineDraft('peu-visit', companyId, 'draft');
      setNotes('');
      setPhotos([]);
      setDraftNote(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="PEU monitor visits"
        titleAccent="Field pack"
        mode="agency"
        description="GPS + photos + checklist. Drafts autosave offline for rural circuits."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {draftNote ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {draftNote}
        </div>
      ) : null}

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 space-y-3 max-w-xl">
        <label className="text-xs block">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Approved school
          </span>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm min-h-[48px]"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">Select…</option>
            {schools.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {String(s.school_name)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs block">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Visitor name
          </span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            placeholder="PEU officer"
          />
        </label>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            disabled={gpsBusy}
            onClick={captureGps}
            className="btn-secondary !py-2.5 !px-3 text-xs inline-flex items-center gap-1 min-h-[44px]"
          >
            {gpsBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MapPin className="w-3.5 h-3.5" />
            )}
            Capture GPS
          </button>
          {lat != null && lng != null ? (
            <span className="text-[11px] font-mono text-slate-600">
              {lat.toFixed(5)}, {lng.toFixed(5)}
              {accuracy != null ? ` ±${accuracy}m` : ''}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">No GPS yet</span>
          )}
        </div>

        <div className="space-y-2">
          {(
            [
              ['hygiene', 'Hygiene OK'],
              ['stock_matches_menu', 'Stock matches menu'],
              ['menu_ok', 'Menu adherence'],
              ['learners_vs_meals', 'Learners vs meals reasonable'],
              ['kitchen_ok', 'Kitchen condition OK'],
            ] as const
          ).map(([k, label]) => (
            <label
              key={k}
              className="flex items-center gap-3 text-sm font-semibold min-h-[44px]"
            >
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={checks[k]}
                onChange={(e) =>
                  setChecks((c) => ({ ...c, [k]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>

        <label className="text-xs block">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Notes
          </span>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="btn-secondary !py-2.5 !px-3 text-xs inline-flex items-center gap-1 min-h-[44px]"
          >
            <Camera className="w-3.5 h-3.5" /> Photo
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="btn-secondary !py-2.5 !px-3 text-xs inline-flex items-center gap-1 min-h-[44px]"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPhoto(e.target.files?.[0] || null)}
          />
        </div>
        {photos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="w-16 h-16 rounded-lg object-cover border"
              />
            ))}
          </div>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="btn-primary w-full !py-3.5 text-sm inline-flex items-center justify-center gap-2 min-h-[52px]"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ClipboardCheck className="w-4 h-4" />
          )}
          Submit PEU visit
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden max-w-2xl">
          <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
            Recent visits
          </div>
          <ul className="divide-y text-sm">
            {visits.length === 0 ? (
              <li className="px-4 py-8 text-center text-slate-500">
                No visits logged yet
              </li>
            ) : (
              visits.slice(0, 30).map((v) => (
                <li
                  key={String(v.id)}
                  className="px-4 py-3 flex justify-between gap-2"
                >
                  <div>
                    <p className="font-bold">
                      {String(v.school_name || v.school_profile_id)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {String(v.visit_date)} · score{' '}
                      {v.overall_score != null
                        ? Number(v.overall_score).toFixed(0)
                        : '—'}
                      {v.lat != null ? ' · GPS' : ''}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </SchoolsPage>
  );
}
