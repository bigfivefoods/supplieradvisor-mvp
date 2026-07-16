'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck, Filter } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import SharedCompanyCard from '@/components/business/SharedCompanyCard';
import type { DiscoverSupplier } from '@/lib/suppliers/types';

/**
 * Buyer shortlist: CIPC-verified + high trust/OTIFEF suppliers.
 */
export default function SupplierShortlistPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [rows, setRows] = useState<DiscoverSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [minTrust, setMinTrust] = useState(50);
  const [minOtifef, setMinOtifef] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        verified: '1',
        trustMin: String(minTrust),
        otifefMin: String(minOtifef),
        role: 'supplier',
        limit: '80',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/suppliers/discover?${params}`);
      const data = await res.json();
      const list = (data.suppliers || []) as DiscoverSupplier[];
      setRows(
        list.filter(
          (s) =>
            s.verified ||
            s.is_verified ||
            String(s.verification_status || '').toLowerCase() === 'verified'
        )
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, minTrust, minOtifef]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="Verified"
        titleAccent="shortlist"
        description="CIPC-verified suppliers with trust / OTIFEF filters — who can we ship with?"
        action={
          <Link
            href="/dashboard/suppliers/discover"
            className="btn-secondary !py-2 !px-4 text-sm"
          >
            Full discover
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <Filter className="w-4 h-4 text-[#00b4d8] mb-2" />
        <label className="text-xs font-semibold text-neutral-600">
          Min trust
          <input
            type="number"
            min={0}
            max={100}
            className="input mt-1 w-24 !py-2 !px-2 !text-sm"
            value={minTrust}
            onChange={(e) => setMinTrust(Number(e.target.value) || 0)}
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          Min OTIFEF %
          <input
            type="number"
            min={0}
            max={100}
            className="input mt-1 w-24 !py-2 !px-2 !text-sm"
            value={minOtifef}
            onChange={(e) => setMinOtifef(Number(e.target.value) || 0)}
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-primary !py-2 !px-4 text-sm"
        >
          Apply
        </button>
        <p className="text-[11px] text-neutral-500 self-center">
          <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-600" /> Only
          verified (CIPC) profiles that pass discovery completeness.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500">
          No verified suppliers match these filters.{' '}
          <Link
            href="/dashboard/suppliers/discover"
            className="font-semibold text-[#0077b6] underline"
          >
            Open discover
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((s) => (
            <SharedCompanyCard
              key={s.id}
              company={{
                id: s.id,
                trading_name: s.trading_name,
                legal_name: s.legal_name,
                logo_url: s.logo_url,
                verification_status: s.verification_status,
                is_verified: s.is_verified || s.verified,
                industry: s.industry,
                city: s.city,
                province: s.province,
                country: s.country,
                trust_score: s.trust_score,
                otifef_pct: s.otifef_average,
                certifications: s.certifications,
                href: `/c/${s.id}`,
              }}
              compact
              footer={
                <Link
                  href={`/dashboard/connections/${s.id}`}
                  className="text-xs font-bold text-[#0077b6] hover:underline"
                >
                  Connection workspace →
                </Link>
              }
            />
          ))}
        </div>
      )}
    </SuppliersPage>
  );
}
