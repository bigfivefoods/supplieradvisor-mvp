'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Users,
  Download,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';

type Entry = {
  id: number;
  email: string;
  company_name?: string | null;
  user_id?: string | null;
  notes?: string | null;
  status: string;
  created_at: string;
};

type Slots = {
  limit: number;
  used: number;
  remaining: number;
  full: boolean;
};

const STATUSES = [
  'all',
  'waiting',
  'slots_available',
  'contacted',
  'invited',
  'converted',
  'declined',
] as const;

/**
 * Platform ops: founding free cohort waitlist (when slots full).
 * Auth same as referral-ops (root owner/admin).
 */
export default function FoundingWaitlistOpsPage() {
  return (
    <CompanyRequired>
      <WaitlistInner />
    </CompanyRequired>
  );
}

function WaitlistInner() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [warning, setWarning] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const qs = new URLSearchParams({ limit: '150' });
      if (filter !== 'all') qs.set('status', filter);
      const res = await fetch(`/api/business/founding-waitlist?${qs}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        setEntries([]);
        setSlots(null);
        return;
      }
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || 'Failed to load waitlist'
        );
      }
      setEntries(
        Array.isArray((data as { entries?: Entry[] }).entries)
          ? (data as { entries: Entry[] }).entries
          : []
      );
      setSlots((data as { slots?: Slots }).slots || null);
      setWarning((data as { warning?: string }).warning || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: number, status: string) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/business/founding-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_status', id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || 'Update failed'
        );
      }
      toast.success(`Marked ${status}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    const header = ['id', 'email', 'company_name', 'status', 'created_at', 'notes'];
    const rows = entries.map((e) =>
      [
        e.id,
        e.email,
        e.company_name || '',
        e.status,
        e.created_at,
        (e.notes || '').replace(/"/g, '""'),
      ]
        .map((c) => `"${String(c)}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `founding-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <BusinessPage>
      <BusinessHeader
        title="Founding"
        titleAccent="waitlist"
        description="When the free founding cohort is full, homepage sign-ups land here. Platform operators only (same gate as referral ops)."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!entries.length}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-2 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <Link
              href="/dashboard/my-business/referral-ops"
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              Referral ops
            </Link>
          </div>
        }
      />

      {forbidden && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 mb-6">
          You need to be an owner/admin of the programme root company (or use{' '}
          <code className="text-xs">REFERRAL_OPS_SECRET</code>) to manage the
          founding waitlist.
        </div>
      )}

      {warning && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-2 text-xs text-amber-900 mb-4">
          {warning}
        </div>
      )}

      {slots && (
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Founding limit
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {slots.limit}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Companies used
            </div>
            <div className="text-2xl font-black text-sky-700 mt-1">
              {slots.used}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Slots remaining
            </div>
            <div
              className={`text-2xl font-black mt-1 ${
                slots.full ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {slots.remaining}
              {slots.full ? ' · full' : ''}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition ${
              filter === s
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-sky-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      ) : !forbidden && entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">No waitlist entries</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            When founding slots are full, homepage visitors can join via the
            founding waitlist form. SQL:{' '}
            <code className="text-xs">SELECT * FROM founding_waitlist</code>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Company</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Joined</th>
                <th className="px-4 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-sky-50/40">
                  <td className="px-4 py-3">
                    <a
                      href={`mailto:${e.email}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-sky-800 hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {e.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {e.company_name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {e.created_at
                      ? new Date(e.created_at).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input !py-1.5 !px-2 !text-xs max-w-[140px]"
                      disabled={busyId === e.id}
                      value={e.status}
                      onChange={(ev) =>
                        void setStatus(e.id, ev.target.value)
                      }
                    >
                      {[
                        'waiting',
                        'slots_available',
                        'contacted',
                        'invited',
                        'converted',
                        'declined',
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BusinessPage>
  );
}
