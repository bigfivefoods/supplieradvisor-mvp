'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Learner = {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string | null;
  class_name?: string | null;
  nsnp_eligible?: boolean;
  verification_status?: string;
  status?: string;
  external_id?: string | null;
};

export default function LearnersPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
      });
      if (q) params.set('q', q);
      const res = await fetch(`/api/schools/learners?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLearners(data.learners || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadTemplate = () => {
    window.open(
      `/api/schools/learners?template=1&companyId=${companyId}`,
      '_blank'
    );
  };

  const onFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch('/api/schools/learners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          import: true,
          csv: text,
          fileName: file.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      toast.success(`Imported ${data.imported} learners`);
      if (data.parseErrors?.length) {
        toast.message(`${data.parseErrors.length} row warnings`);
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const verifySelected = async (status: string) => {
    if (!selected.size) {
      toast.error('Select learners first');
      return;
    }
    try {
      const res = await fetch('/api/schools/learners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ids: [...selected],
          verification_status: status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verify failed');
      toast.success(`Updated ${data.updated} learners → ${status}`);
      setSelected(new Set());
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const verified = learners.filter((l) =>
    ['school_verified', 'attested'].includes(String(l.verification_status))
  ).length;

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Learners"
        titleAccent="Import & verify"
        description="Excel-compatible CSV import · school attestation verification · NSNP eligibility."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Template
            </button>
            <label className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer">
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Import CSV
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / grade…"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-52"
        />
        <span className="text-xs text-slate-500">
          {learners.length} learners · {verified} verified
        </span>
        <button
          type="button"
          onClick={() => void verifySelected('school_verified')}
          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Mark school-verified
        </button>
        <button
          type="button"
          onClick={() => void verifySelected('attested')}
          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark attested
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="px-3 py-3 w-10" />
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Grade</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">NSNP</th>
                  <th className="px-3 py-3">Verification</th>
                  <th className="px-3 py-3">ID</th>
                </tr>
              </thead>
              <tbody>
                {learners.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No learners yet — download the template and import.
                    </td>
                  </tr>
                ) : (
                  learners.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-slate-50 hover:bg-sky-50/40"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {l.first_name} {l.last_name}
                      </td>
                      <td className="px-3 py-2">{l.grade || '—'}</td>
                      <td className="px-3 py-2">{l.class_name || '—'}</td>
                      <td className="px-3 py-2">
                        {l.nsnp_eligible !== false ? 'Yes' : 'No'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            l.verification_status === 'attested'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : l.verification_status === 'school_verified'
                                ? 'bg-sky-50 border-sky-200 text-sky-800'
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {l.verification_status || 'draft'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 font-mono">
                        {l.external_id || l.id}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
