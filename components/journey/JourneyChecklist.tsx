'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Rocket,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

export type JourneyStep = {
  id: string;
  title: string;
  href: string;
  done: boolean;
};

type Role = 'buyer' | 'supplier';

const BUYER_DEFAULTS: JourneyStep[] = [
  {
    id: 'profile',
    title: 'Complete company profile',
    href: '/dashboard/my-business/profile',
    done: false,
  },
  {
    id: 'discover',
    title: 'Discover & shortlist suppliers',
    href: '/dashboard/suppliers/discover',
    done: false,
  },
  {
    id: 'connect',
    title: 'Connect with a supplier',
    href: '/dashboard/connections',
    done: false,
  },
  {
    id: 'po',
    title: 'Raise a purchase order',
    href: '/dashboard/suppliers/po',
    done: false,
  },
  {
    id: 'rate',
    title: 'Rate a delivered partner',
    href: '/dashboard/suppliers/ratings',
    done: false,
  },
];

const SUPPLIER_DEFAULTS: JourneyStep[] = [
  {
    id: 'profile',
    title: 'Complete & publish profile',
    href: '/dashboard/my-business/profile',
    done: false,
  },
  {
    id: 'catalogue',
    title: 'Publish sellable catalogue',
    href: '/dashboard/inventory/products?type=finished_good',
    done: false,
  },
  {
    id: 'banking',
    title: 'Add bank details (invoices)',
    href: '/dashboard/my-business/profile#banking',
    done: false,
  },
  {
    id: 'inbound',
    title: 'Accept an inbound PO',
    href: '/dashboard/customers/orders',
    done: false,
  },
  {
    id: 'invoice',
    title: 'Send a customer invoice',
    href: '/dashboard/customers/invoices',
    done: false,
  },
];

/**
 * Compact role journey banner for buyer / supplier hubs.
 * Uses onboarding progress when available, else static checklist.
 */
export default function JourneyChecklist({ role }: { role: Role }) {
  const companyId = getSelectedCompanyId();
  const [steps, setSteps] = useState<JourneyStep[]>(
    role === 'buyer' ? BUYER_DEFAULTS : SUPPLIER_DEFAULTS
  );
  const [open, setOpen] = useState(true);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/business/onboarding?companyId=${companyId}`,
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const map = (data.steps || []) as Array<{
          id: string;
          done?: boolean;
          title?: string;
          href?: string;
        }>;
        if (map.length) {
          // Keep role-specific defaults; mark done when golden-path ids overlap
          setSteps((prev) =>
            prev.map((s) => {
              const hit = map.find(
                (m) =>
                  m.id === s.id ||
                  (s.id === 'profile' && m.id === 'profile') ||
                  (s.id === 'connect' &&
                    (m.id === 'first_partner' || m.id === 'invite')) ||
                  (s.id === 'po' &&
                    (m.id === 'first_trade' || m.id === 'quote_or_po')) ||
                  (s.id === 'rate' && m.id === 'rate_partner') ||
                  (s.id === 'catalogue' && m.id === 'catalogue') ||
                  (s.id === 'banking' && m.id === 'billing') ||
                  (s.id === 'inbound' && m.id === 'first_trade') ||
                  (s.id === 'invoice' && m.id === 'first_trade')
              );
              return hit ? { ...s, done: Boolean(hit.done) } : s;
            })
          );
        }
        setPct(Number(data.progressPercent) || 0);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const doneCount = steps.filter((s) => s.done).length;
  const progress =
    pct > 0 ? pct : Math.round((doneCount / Math.max(steps.length, 1)) * 100);
  if (progress >= 100) return null;

  const Icon = role === 'buyer' ? ShoppingCart : Truck;

  return (
    <div className="mb-4 rounded-2xl border border-[#00b4d8]/25 bg-gradient-to-br from-[#e0f7fc] to-white p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00b4d8]/15 text-[#0077b6]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 inline-flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5 text-[#00b4d8]" />
              {role === 'buyer' ? 'Buyer journey' : 'Supplier journey'}
            </p>
            <p className="text-[11px] text-neutral-500">
              {doneCount} of {steps.length} steps · {progress}%
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-neutral-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" />
        )}
      </button>
      {open && (
        <ul className="mt-3 space-y-1.5">
          {steps.map((s) => (
            <li key={s.id}>
              <Link
                href={s.href}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-white/80 transition-colors"
              >
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-neutral-300 shrink-0" />
                )}
                <span
                  className={
                    s.done
                      ? 'text-neutral-500 line-through'
                      : 'font-semibold text-slate-800'
                  }
                >
                  {s.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
