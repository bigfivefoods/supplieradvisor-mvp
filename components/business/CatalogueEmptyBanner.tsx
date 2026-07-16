'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, ArrowRight, X } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

const DISMISS_KEY = 'sa_catalogue_empty_dismiss';

/**
 * When this company has no sellable catalogue, nudge them to publish
 * finished goods so connected buyers can raise clean POs.
 */
export default function CatalogueEmptyBanner() {
  const companyId = getSelectedCompanyId();
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState('');
  const [tips, setTips] = useState<string[]>([]);

  useEffect(() => {
    if (!companyId) return;
    try {
      if (sessionStorage.getItem(`${DISMISS_KEY}_${companyId}`) === '1') {
        return;
      }
    } catch {
      /* private mode */
    }

    let cancelled = false;
    (async () => {
      try {
        // Reuse catalogue endpoint against self — readiness for seller
        const params = new URLSearchParams({
          companyId: String(companyId),
          sellerProfileId: String(companyId),
          readinessOnly: '1',
        });
        const res = await fetch(`/api/suppliers/catalogue?${params}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const readiness = data.readiness as
          | {
              level?: string;
              label?: string;
              tips?: string[];
              sellableProducts?: number;
            }
          | undefined;
        if (!readiness) return;
        const empty =
          readiness.level === 'empty' ||
          (Number(readiness.sellableProducts) || 0) === 0;
        if (empty) {
          setLabel(readiness.label || 'Publish what you sell');
          setTips(
            Array.isArray(readiness.tips) ? readiness.tips.slice(0, 2) : []
          );
          setShow(true);
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!show || !companyId) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0 flex items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <Package className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-black text-slate-900">{label}</p>
          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
            {tips[0] ||
              'Connected buyers hit an empty catalogue when raising POs. Add finished goods or services so they can pick lines.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard/inventory/products?type=finished_good"
          className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
        >
          Publish catalogue <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100"
          aria-label="Dismiss"
          onClick={() => {
            try {
              sessionStorage.setItem(`${DISMISS_KEY}_${companyId}`, '1');
            } catch {
              /* */
            }
            setShow(false);
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
