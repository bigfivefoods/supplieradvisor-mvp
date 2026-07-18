'use client';

/**
 * Compact notification center — settle deep-links from /api/notifications.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2, X } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

type N = {
  id: string;
  severity: string;
  title: string;
  body: string;
  href: string;
  source?: string;
};

export default function NotificationCenter({
  compact,
}: {
  compact?: boolean;
}) {
  const companyId = getSelectedCompanyId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<N[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems((data.notifications || []) as N[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!companyId) return null;

  const critical = items.filter(
    (n) => n.severity === 'critical' || n.severity === 'warning'
  ).length;

  return (
    <div className={`relative ${compact ? '' : 'mb-4'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-sky-300"
      >
        <Bell className="w-3.5 h-3.5" />
        Inbox
        {critical > 0 ? (
          <span className="rounded-full bg-rose-600 text-white text-[10px] px-1.5 py-0.5 min-w-[1.25rem] text-center">
            {critical}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
            <p className="text-xs font-black text-slate-900">Notifications</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-neutral-100"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#00b4d8]" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-neutral-500 px-3 py-6 text-center">
                All clear — no actionable items.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {items.slice(0, 20).map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href || '/dashboard'}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2.5 hover:bg-slate-50"
                    >
                      <p
                        className={`text-xs font-bold ${
                          n.severity === 'critical'
                            ? 'text-rose-800'
                            : n.severity === 'warning'
                              ? 'text-amber-900'
                              : 'text-slate-900'
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-3 py-2 border-t border-neutral-100 flex gap-2 text-[11px] font-bold">
            <Link
              href="/dashboard/customers/money"
              className="text-emerald-800 underline"
              onClick={() => setOpen(false)}
            >
              Money hub
            </Link>
            <Link
              href="/dashboard/settle"
              className="text-[#0077b6] underline"
              onClick={() => setOpen(false)}
            >
              Settle
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
