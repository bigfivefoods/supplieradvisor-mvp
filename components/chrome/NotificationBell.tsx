'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type Note = {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  body: string;
  href: string;
  created_at: string;
  source: string;
};

/** Short label for the primary deep-link action */
function actionLabel(href: string): string {
  const h = href.toLowerCase();
  if (h.includes('/ratings')) return 'Rate';
  if (h.includes('otifef') || h.includes('/suppliers/po')) return 'OTIFEF';
  if (h.includes('/buyer/documents')) return 'View invoice';
  if (h.includes('frompo=') || h.includes('/customers/invoices')) return 'Invoice';
  if (h.includes('/customers/orders')) return 'Inbound PO';
  if (h.includes('/profile')) return 'Profile';
  if (h.includes('/connections')) return 'Network';
  if (h.includes('/ar')) return 'AR';
  return 'Open';
}

const iconFor = (s: Note['severity']) => {
  if (s === 'critical' || s === 'warning') return AlertTriangle;
  if (s === 'positive') return CheckCircle2;
  return Info;
};

const tone = (s: Note['severity']) => {
  if (s === 'critical') return 'text-red-600 bg-red-50';
  if (s === 'warning') return 'text-amber-700 bg-amber-50';
  if (s === 'positive') return 'text-emerald-700 bg-emerald-50';
  return 'text-sky-700 bg-sky-50';
};

const DISMISS_KEY = 'sa_notif_dismissed';

function readDismissed(companyId: number): Set<string> {
  try {
    const raw = localStorage.getItem(`${DISMISS_KEY}_${companyId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(companyId: number, ids: Set<string>) {
  try {
    localStorage.setItem(
      `${DISMISS_KEY}_${companyId}`,
      JSON.stringify([...ids].slice(-80))
    );
  } catch {
    /* private mode */
  }
}

export default function NotificationBell() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [badge, setBadge] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) return;
    setDismissed(readDismissed(companyId));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/notifications?${params}`);
      const json = await res.json();
      if (res.ok) {
        const dismissedIds = readDismissed(companyId);
        const all = (json.notifications || []) as Note[];
        const visible = all.filter((n) => !dismissedIds.has(n.id));
        setNotes(visible);
        // Badge = undismissed critical/warning only
        const b = visible.filter(
          (n) => n.severity === 'critical' || n.severity === 'warning'
        ).length;
        setBadge(b);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  const dismissOne = (id: string) => {
    if (!companyId) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeDismissed(companyId, next);
      return next;
    });
    setNotes((n) => {
      const next = n.filter((x) => x.id !== id);
      setBadge(
        next.filter(
          (x) => x.severity === 'critical' || x.severity === 'warning'
        ).length
      );
      return next;
    });
  };

  const dismissAll = () => {
    if (!companyId) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const n of notes) next.add(n.id);
      writeDismissed(companyId, next);
      return next;
    });
    setNotes([]);
    setBadge(0);
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 90_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, load]);

  if (!companyId) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2.5 rounded-2xl hover:bg-neutral-100 text-slate-700 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {badge > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] max-h-[70vh] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
            <div className="min-w-0">
              <div className="font-bold text-sm">Action centre</div>
              <div className="text-[11px] text-neutral-500">
                Live signals · dismissed hidden on this device
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {notes.length > 0 && (
                <button
                  type="button"
                  onClick={dismissAll}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && notes.length === 0 ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : notes.length === 0 ? (
              <div className="py-12 px-4 text-center text-sm text-neutral-500">
                All clear — no open holds, unmatched bank, or urgent POs.
              </div>
            ) : (
              <ul className="divide-y">
                {notes.map((n) => {
                  const Icon = iconFor(n.severity);
                  return (
                    <li key={n.id} className="relative group">
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 px-4 py-3 pr-10 hover:bg-neutral-50 transition-colors"
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${tone(n.severity)}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 leading-snug">
                            {n.title}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                            {n.body}
                          </div>
                          {n.href && n.href !== '/dashboard' ? (
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#00b4d8]">
                              {actionLabel(n.href)} →
                            </div>
                          ) : null}
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => dismissOne(n.id)}
                        className="absolute right-2 top-2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Dismiss notification"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t px-4 py-2 text-[11px] text-neutral-400 text-center">
            Refreshes every 90s · derived from live data
          </div>
        </div>
      )}
    </div>
  );
}
