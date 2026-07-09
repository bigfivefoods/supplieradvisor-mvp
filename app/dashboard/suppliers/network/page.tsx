'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, ShieldCheck, Star } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  inviteStatusClass,
  srmStatusClass,
  trustBand,
  type SrmSupplierRecord,
} from '@/lib/suppliers/types';
import { CompanyRequired, SuppliersHeader } from '@/components/suppliers/SuppliersShell';

export default function SupplierNetworkPage() {
  return (
    <CompanyRequired>
      <NetworkInner />
    </CompanyRequired>
  );
}

function NetworkInner() {
  const companyId = getSelectedCompanyId()!;
  const [rows, setRows] = useState<SrmSupplierRecord[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (status !== 'all') params.set('status', status);
      if (q) params.set('q', q);
      const res = await fetch(`/api/suppliers?${params}`);
      const data = await res.json();
      setRows(data.suppliers || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, status, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <SuppliersHeader
        title="My supplier network"
        description="Your company-scoped supplier book — prospects you added, preferred partners, and on-platform connections with live trust signals."
        action={
          <Link href="/dashboard/suppliers/add" className="btn-primary !py-2.5 !px-5 text-sm">
            Add supplier
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !py-2.5 !pl-10 !text-sm"
            placeholder="Search name, industry, cert, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input !py-2.5 !text-sm !w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="preferred">Preferred</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="blocked">Blocked</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center text-sm text-neutral-500">
            No suppliers in your book yet.{' '}
            <Link href="/dashboard/suppliers/discover" className="text-[#00b4d8] underline">
              Discover
            </Link>{' '}
            or{' '}
            <Link href="/dashboard/suppliers/add" className="text-[#00b4d8] underline">
              invite
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((s) => {
              const trust = trustBand(Number(s.trust_score || 0));
              return (
                <li key={s.id} className="px-5 py-4 flex flex-wrap gap-3 justify-between items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{s.trading_name}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${srmStatusClass(s.status)}`}
                      >
                        {s.status}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${inviteStatusClass(s.invite_status)}`}
                      >
                        {(s.invite_status || 'not_invited').replace('_', ' ')}
                      </span>
                      {s.verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                      {s.connection_suspended && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          Suspended
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {[s.industry, s.city, s.country].filter(Boolean).join(' · ') || '—'}
                      {s.email ? ` · ${s.email}` : ''}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(s.certifications || []).slice(0, 6).map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-800"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-1">
                    <div className={`inline-flex px-2 py-0.5 rounded-full border font-semibold ${trust.className}`}>
                      Trust {Number(s.trust_score || 0).toFixed(0)}
                    </div>
                    <div className="text-neutral-600">
                      OTIFEF <strong>{Number(s.otifef_pct || 0).toFixed(0)}%</strong>
                    </div>
                    {Number(s.rating_count || 0) > 0 && (
                      <div className="inline-flex items-center gap-1 text-amber-700 font-medium">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {Number(s.rating_avg || 0).toFixed(1)} ({s.rating_count})
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
