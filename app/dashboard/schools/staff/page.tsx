'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Download, Upload, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Staff = {
  id: number;
  first_name: string;
  last_name: string;
  role?: string;
  email?: string | null;
  phone?: string | null;
  verification_status?: string;
};

export default function StaffPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/staff?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStaff(data.staff || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const res = await fetch('/api/schools/staff', {
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
      toast.success(`Imported ${data.imported} staff`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    }
  };

  const verify = async () => {
    if (!selected.size) return toast.error('Select staff first');
    const res = await fetch('/api/schools/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        ids: [...selected],
        verification_status: 'school_verified',
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed');
    toast.success(`Verified ${data.updated}`);
    setSelected(new Set());
    void load();
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Staff & teachers"
        titleAccent="Verify"
        description="Import teachers, kitchen managers, NSNP coordinators. Verify employment at school level."
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/schools/staff?template=1&companyId=${companyId}`}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Template
            </a>
            <label className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Import CSV
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void verify()}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Verify selected
            </button>
            <button type="button" onClick={() => void load()} className="btn-secondary !py-2 !px-3 text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 overflow-hidden">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-3 py-3 w-10" />
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Verification</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No staff — import the template or add via CSV.
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (n.has(s.id)) n.delete(s.id);
                            else n.add(s.id);
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {(s.role || 'teacher').replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {[s.email, s.phone].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold uppercase">
                      {s.verification_status || 'draft'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </SchoolsPage>
  );
}
