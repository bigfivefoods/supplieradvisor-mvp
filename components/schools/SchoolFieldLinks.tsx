'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Issue / copy field PWA links (serve day + PEU) for this school company.
 */
export default function SchoolFieldLinks({ companyId }: { companyId: number }) {
  const [loading, setLoading] = useState(true);
  const [serve, setServe] = useState<string | null>(null);
  const [peu, setPeu] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/field-tokens?companyId=${companyId}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setServe(data.serve_path || null);
      setPeu(data.peu_path || null);
    } catch {
      /* soft */
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (path: string, label: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    toast.success(`${label} link copied — open on kitchen phone`);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Field links…
      </div>
    );
  }
  if (!serve && !peu) return null;

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
        <Smartphone className="h-3.5 w-3.5" /> Field PWAs · offline-capable
      </p>
      <div className="flex flex-wrap gap-2">
        {serve ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
            onClick={() => void copy(serve, 'Serve day')}
          >
            <Copy className="h-3 w-3" /> Copy serve day link
          </button>
        ) : null}
        {peu ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-900 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100"
            onClick={() => void copy(peu, 'PEU visit')}
          >
            <Copy className="h-3 w-3" /> Copy PEU visit link
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Kitchen phones use serve day without desk login. PEU monitors use the
        visit checklist offline, then sync.
      </p>
    </div>
  );
}
