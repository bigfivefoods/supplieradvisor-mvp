'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Link2, Building2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function IspsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [directory, setDirectory] = useState<Array<Record<string, unknown>>>(
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schools/isps?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLinks(data.links || []);
      setDirectory(data.directory || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const registerAsIsp = async () => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'register_as_isp',
          // Agency must vet — never self-badge compliant
          compliance_status: 'pending',
          food_handling_cert: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.message ||
          'Registered as NSNP ISP (pending DBE/agency vetting)'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const linkIsp = async (ispProfileId: number) => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          isp_profile_id: ispProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('ISP linked to school');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="ISPs"
        titleAccent="Service providers"
        description="Independent Service Providers deliver only NSNP-approved brands to your kitchen."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/deliveries"
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Truck className="w-3.5 h-3.5" /> Deliveries · POD
            </Link>
            <button
              type="button"
              onClick={() => void registerAsIsp()}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" /> Register as ISP
            </button>
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

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-black mb-3">Linked to this school</h3>
            {links.length === 0 ? (
              <p className="text-sm text-slate-500">No ISPs linked yet.</p>
            ) : (
              <ul className="space-y-2">
                {links.map((l) => (
                  <li
                    key={String(l.id)}
                    className="flex justify-between text-sm border-b border-slate-50 py-2"
                  >
                    <span className="font-semibold">
                      {String(l.display_name || l.isp_profile_id)}
                    </span>
                    <span className="text-xs capitalize text-slate-500">
                      {String(l.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-black mb-3">ISP directory</h3>
            {directory.length === 0 ? (
              <p className="text-sm text-slate-500">
                No ISPs registered yet. Providers can register from this page.
              </p>
            ) : (
              <ul className="space-y-2">
                {directory.map((d) => (
                  <li
                    key={String(d.id)}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                  >
                    <div>
                      <span className="font-semibold">
                        {String(d.display_name || d.trading_name)}
                      </span>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">
                        {String(d.compliance_status)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void linkIsp(Number(d.profile_id))}
                      className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3" /> Link
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
