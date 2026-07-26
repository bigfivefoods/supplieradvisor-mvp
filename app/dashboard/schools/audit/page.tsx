'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileLock2, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function AuditPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 3)
  );
  const [loading, setLoading] = useState(true);
  const [packs, setPacks] = useState<Array<Record<string, unknown>>>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schools/audit?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPacks(data.packs || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (isPublic: boolean) => {
    setCreating(true);
    try {
      const res = await fetch('/api/schools/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          from: period.from,
          to: period.to,
          is_public: isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        isPublic
          ? `Public pack ready · ${data.public_url}`
          : `Sealed · hash ${String(data.content_hash).slice(0, 16)}…`
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Audit pack"
        titleAccent="Evidence"
        description="Seal feeding, GRNs, POs, PEU visits, and attendance into a content-hashed pack. Optionally publish a transparency link."
        action={
          <button type="button" onClick={() => void load()} className="btn-secondary !py-2 !px-3 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />
      <PeriodSlicer value={period} onChange={setPeriod} className="mb-4" />

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          disabled={creating}
          onClick={() => void create(false)}
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileLock2 className="w-3.5 h-3.5" />}
          Seal private pack
        </button>
        <button
          type="button"
          disabled={creating}
          onClick={() => void create(true)}
          className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          <Share2 className="w-3.5 h-3.5" /> Seal + public transparency
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">Period</th>
                <th className="px-3 py-3">Hash</th>
                <th className="px-3 py-3">Public</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {packs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    No packs yet
                  </td>
                </tr>
              ) : (
                packs.map((p) => (
                  <tr key={String(p.id)} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-xs">
                      {String(p.period_from)} → {String(p.period_to)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] break-all max-w-[14rem]">
                      {String(p.content_hash)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {p.is_public && p.public_token ? (
                        <a
                          href={`/nsnp/transparency/${p.public_token}`}
                          className="font-bold text-[#0077b6] hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : (
                        'Private'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {String(p.created_at || '').slice(0, 10)}
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
