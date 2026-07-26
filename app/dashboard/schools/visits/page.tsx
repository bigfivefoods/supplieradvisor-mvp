'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function VisitsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
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
  const [saving, setSaving] = useState(false);

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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!schoolId) return toast.error('Select a school');
    setSaving(true);
    try {
      const res = await fetch('/api/schools/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          school_profile_id: Number(schoolId),
          checklist: checks,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Visit logged · score ${data.visit?.overall_score}`);
      setNotes('');
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
        description="District/PEU checklist: hygiene, stock vs menu, learners vs meals, kitchen condition. Scores feed agency oversight."
        action={
          <button type="button" onClick={() => void load()} className="btn-secondary !py-2 !px-3 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 space-y-3 max-w-xl">
        <label className="text-xs block">
          <span className="text-[10px] font-bold uppercase text-slate-400">Approved school</span>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
        <div className="space-y-2">
          {(
            [
              ['hygiene', 'Hygiene acceptable'],
              ['stock_matches_menu', 'Stock matches menu'],
              ['menu_ok', 'Menu displayed / followed'],
              ['learners_vs_meals', 'Learners vs meals consistent'],
              ['kitchen_ok', 'Kitchen condition OK'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={checks[k]}
                onChange={(e) =>
                  setChecks((c) => ({ ...c, [k]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <textarea
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          rows={2}
          placeholder="Notes / evidence"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
          Log visit
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-3 py-3">School</th>
                <th className="px-3 py-3 text-right">Score</th>
                <th className="px-3 py-3">Visitor</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={String(v.id)} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{String(v.visit_date)}</td>
                  <td className="px-3 py-2 font-semibold">{String(v.school_name || v.school_profile_id)}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums">{Number(v.overall_score || 0)}</td>
                  <td className="px-3 py-2 text-xs">{String(v.visitor_name || '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SchoolsPage>
  );
}
