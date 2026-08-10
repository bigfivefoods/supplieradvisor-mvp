'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function EmisPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [template, setTemplate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schools/emis?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      setTemplate(String(json.template || ''));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const attest = async () => {
    try {
      const res = await fetch('/api/schools/emis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'attest' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('EMIS / register attested for this term');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const onFile = async (file: File) => {
    try {
      const csv = await file.text();
      const res = await fetch('/api/schools/emis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'import', csv }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success(`EMIS snapshot: ${json.enrolled} enrolled across ${json.grades} grades`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="EMIS & attestation"
        titleAccent="Identity"
        description="Import provincial EMIS-style grade headcounts and attest learner numbers each term for fair prizes and claims."
        action={
          <button type="button" onClick={() => void load()} className="btn-secondary !py-2 !px-3 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-4 max-w-xl">
          <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-5">
            <p className="text-sm">
              <strong>EMIS:</strong> {String(data?.emis_number || '—')}
            </p>
            <p className="text-sm mt-1">
              Enrolled {Number(data?.learner_count_enrolled || 0)} · Verified{' '}
              {Number(data?.learner_count_verified || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Last attested:{' '}
              {data?.emis_attested_at
                ? String(data.emis_attested_at).slice(0, 10)
                : 'Never'}
            </p>
            <button
              type="button"
              onClick={() => void attest()}
              className="btn-primary !py-2 !px-3 text-xs mt-3 inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Attest current register
            </button>
          </div>

          <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-5">
            <h3 className="text-sm font-black mb-2">Import grade headcounts</h3>
            <pre className="text-[10px] bg-slate-50 border rounded-xl p-3 overflow-x-auto mb-3">
              {template}
            </pre>
            <label className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Upload CSV
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
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
