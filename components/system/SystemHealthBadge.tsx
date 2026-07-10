'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type Health = {
  ok: boolean;
  degraded?: boolean;
  latencyMs?: number;
  schemaReady?: number;
  schemaTotal?: number;
  serviceRole?: boolean;
  hint?: string;
};

/**
 * Compact Supabase sync indicator for sidebar / command surfaces.
 */
export default function SystemHealthBadge({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/system/health', { cache: 'no-store' });
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-400 px-1">
        <Loader2 className="w-3 h-3 animate-spin text-[#00b4d8]" />
        {!compact && 'Checking Supabase…'}
      </div>
    );
  }

  const ok = health?.ok;
  const degraded = health?.degraded;
  const Icon = !ok ? AlertTriangle : degraded ? Activity : CheckCircle2;
  const tone = !ok
    ? 'text-rose-600 bg-rose-50 border-rose-100'
    : degraded
      ? 'text-amber-700 bg-amber-50 border-amber-100'
      : 'text-emerald-700 bg-emerald-50 border-emerald-100';
  const label = !ok
    ? 'Supabase offline'
    : degraded
      ? 'Schema partial'
      : 'Supabase live';

  return (
    <button
      type="button"
      onClick={() => void load()}
      title={
        health?.hint ||
        `Latency ${health?.latencyMs ?? '—'}ms · schema ${health?.schemaReady ?? 0}/${health?.schemaTotal ?? 0} · ${
          health?.serviceRole ? 'service role' : 'anon'
        }`
      }
      className={`w-full flex items-center gap-2 rounded-2xl border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors hover:opacity-90 ${tone}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {!compact && health?.latencyMs != null && (
        <span className="ml-auto tabular-nums opacity-70">{health.latencyMs}ms</span>
      )}
    </button>
  );
}
