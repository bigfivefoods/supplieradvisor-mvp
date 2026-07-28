'use client';

/**
 * Platform control surface — only useful for platform operators.
 * Does not list authorised emails (those live in system config / env).
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  CompanyRequired,
  BusinessPage,
  BusinessHeader,
} from '@/components/business/BusinessShell';

export default function PlatformControlPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState(false);
  const [pending, setPending] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/platform-control', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setOperator(Boolean(data.operator));
      setPending(data.pending_departments || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async (targetId: number, family: string) => {
    try {
      const path =
        family === 'health'
          ? '/api/health/agency'
          : '/api/schools/agency';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId: targetId,
          action: 'activate_agency',
          target_company_id: targetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activation failed');
      toast.success(data.message || 'Department activated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <BusinessPage>
      <BusinessHeader
        title="Platform"
        titleAccent="control"
        description="System settings for programme departments. Access is determined by platform configuration."
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

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !operator ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <Shield className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <p className="font-bold text-slate-900">Not available</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            This console is only for platform-authorised accounts.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
            Pending government departments
          </div>
          {pending.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No departments awaiting activation.
            </p>
          ) : (
            <ul className="divide-y">
              {pending.map((p) => (
                <li
                  key={String(p.profile_id)}
                  className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <p className="font-bold">{String(p.agency_name)}</p>
                    <p className="text-xs text-slate-500">
                      {String(p.agency_type)} · {String(p.family)} · company #
                      {String(p.profile_id)}
                      {p.province ? ` · ${String(p.province)}` : ''}
                      {p.contact_email
                        ? ` · ${String(p.contact_email)}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void activate(
                        Number(p.profile_id),
                        String(p.family || 'education')
                      )
                    }
                    className="btn-primary !py-1.5 !px-3 text-xs"
                  >
                    Activate
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </BusinessPage>
  );
}
