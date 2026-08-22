'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Building2 } from 'lucide-react';
import { canOpenCompanyWorkspace } from '@/lib/business/permissions';
import { setSelectedCompanyId } from '@/lib/containers/company';

/**
 * Owners who also coach / practise see this on the staff PWA.
 * Employed coaches never do — they only have the work app.
 */
export function OwnerWorkspaceCta({
  companyId,
  brand,
}: {
  companyId?: number | null;
  brand: string;
}) {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [biz, setBiz] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !companyId) return;
    let cancelled = false;
    void fetch('/api/b2c/me?include=lite', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const hit = (
          (data.businesses || []) as Array<{
            id: number;
            name?: string;
            role?: string | null;
          }>
        ).find(
          (b) =>
            Number(b.id) === Number(companyId) &&
            canOpenCompanyWorkspace(b.role)
        );
        if (hit) {
          setBiz({
            id: Number(hit.id),
            name: String(hit.name || brand),
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, companyId, brand]);

  if (!biz) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setSelectedCompanyId(biz.id, { name: biz.name });
        try {
          localStorage.setItem('saWorkspace', 'business');
          window.dispatchEvent(new Event('sa:company-changed'));
        } catch {
          /* private mode */
        }
        router.push('/dashboard');
      }}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
        <Building2 className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">Open SupplierAdvisor</span>
        <span className="block text-[11px] text-slate-400">
          You own {biz.name}. Coaches who work here only get this work app.
        </span>
      </span>
    </button>
  );
}
