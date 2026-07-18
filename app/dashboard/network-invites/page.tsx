'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';

type InviteRow = {
  id: string | number;
  email: string | null;
  summary?: string;
  status?: string;
  created_at?: string;
  action?: string;
};

type NetworkMetrics = {
  densityScore: number;
  qualityScore: number;
  partnerCount: number;
  partnerGoal: number;
  connectionsAccepted: number;
  connectionsPending: number;
  invitesSent: number;
  invitesOpened: number;
  invitesAccepted: number;
  openRate: number | null;
  acceptRate: number | null;
  firstTradeDone: boolean;
  openToTrade: boolean | null;
  recommendations: string[];
};

function MetricChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/90 px-2.5 py-1.5">
      <div className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </div>
      <div className="font-black text-slate-800">{value}</div>
    </div>
  );
}

export default function NetworkInvitesPage() {
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
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [funnel, setFunnel] = useState<
    Array<{
      email: string;
      sent: number;
      opened: number;
      accepted: number;
      status: string;
      quality: string;
      personalNote: boolean;
    }>
  >([]);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [activation, setActivation] = useState<
    Array<{ id: string; label: string; count: number; pct: number | null }>
  >([]);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, mRes, aRes] = await Promise.all([
        fetch(`/api/business/network-invites?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/business/network-metrics?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/business/activation-funnel?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setInvites(data.invites || []);
      setFunnel(data.funnel || []);
      setRemainingToday(
        data.remainingToday != null ? Number(data.remainingToday) : null
      );
      if (mRes.ok) {
        const md = await mRes.json().catch(() => ({}));
        setMetrics((md.metrics as NetworkMetrics) || null);
      }
      if (aRes.ok) {
        const ad = await aRes.json().catch(() => ({}));
        setActivation(ad.funnel?.stages || []);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendOne = async () => {
    if (!email.includes('@')) {
      toast.message('Enter a valid email');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/business/network-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'send',
          email,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Invite sent to ${email}`);
      setEmail('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const sendBulk = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/business/network-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'bulk',
          csv,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        `Sent ${data.sent} invite(s)${
          data.remainingToday != null
            ? ` · ${data.remainingToday} left today`
            : ''
        }`
      );
      setCsv('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (to: string) => {
    const personal =
      note.trim() ||
      window.prompt(
        'Personal note required for resend (quality gate):',
        'Following up — would love to trade on SupplierAdvisor.'
      );
    if (!personal?.trim()) {
      toast.message('Resend cancelled — note required');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/business/network-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'resend',
          email: to,
          note: String(personal).trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Resent to ${to}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomersPage>
      <CustomersHeader
        title="Network invites"
        titleAccent="CRM"
        description="Track outbound directory / partner invites. Accept links land on /invite with your referral attribution."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/dashboard/customers/profiles"
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              Customer book
            </Link>
          </div>
        }
      />

      {metrics ? (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-black text-slate-900">
                Network density & invite quality
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Partners {metrics.partnerCount}/{metrics.partnerGoal} · accepted
                connections {metrics.connectionsAccepted}
                {metrics.connectionsPending
                  ? ` · ${metrics.connectionsPending} pending`
                  : ''}
              </p>
            </div>
            <div className="flex gap-3 text-center">
              <div className="rounded-xl bg-white border border-sky-100 px-3 py-2 min-w-[4.5rem]">
                <div className="text-lg font-black text-sky-700">
                  {metrics.densityScore}
                </div>
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Density
                </div>
              </div>
              <div className="rounded-xl bg-white border border-emerald-100 px-3 py-2 min-w-[4.5rem]">
                <div className="text-lg font-black text-emerald-700">
                  {metrics.qualityScore}
                </div>
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Quality
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
            <MetricChip label="Sent" value={metrics.invitesSent} />
            <MetricChip
              label="Open rate"
              value={
                metrics.openRate != null ? `${metrics.openRate}%` : '—'
              }
            />
            <MetricChip label="Accepted" value={metrics.invitesAccepted} />
            <MetricChip
              label="Accept rate"
              value={
                metrics.acceptRate != null ? `${metrics.acceptRate}%` : '—'
              }
            />
          </div>
          {metrics.recommendations?.[0] ? (
            <p className="text-xs text-sky-900/90 leading-relaxed">
              {metrics.recommendations[0]}
              {!metrics.firstTradeDone ? (
                <>
                  {' '}
                  <Link
                    href="/dashboard"
                    className="font-bold text-[#0077b6] underline"
                  >
                    Open first-trade path
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {activation.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-xs font-bold text-emerald-950 mb-2">
            Activation funnel (this company)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-[10px]">
            {activation.map((s) => (
              <div
                key={s.id}
                className="rounded-lg bg-white border border-emerald-100 px-1.5 py-2"
              >
                <div className="text-base font-black text-slate-900">
                  {s.count}
                </div>
                <div className="font-bold text-slate-500 leading-tight">
                  {s.label}
                </div>
                {s.pct != null ? (
                  <div className="text-emerald-700 font-bold">{s.pct}%</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {funnel.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
          <p className="text-xs font-bold text-violet-950 mb-2">
            Invite funnel (per email)
            {remainingToday != null
              ? ` · ${remainingToday} invites left today`
              : ''}
          </p>
          <ul className="max-h-40 overflow-y-auto divide-y divide-violet-100 text-xs">
            {funnel.slice(0, 12).map((f) => (
              <li
                key={f.email}
                className="py-1.5 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-semibold text-slate-800">{f.email}</span>
                <span className="text-neutral-500">
                  sent {f.sent}
                  {f.opened ? ` · open ${f.opened}` : ''}
                  {f.accepted ? ` · accept ${f.accepted}` : ''} · {f.status}
                  {f.quality === 'low' ? ' · low quality' : ''}
                  {f.personalNote ? ' · noted' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2">
          <p className="text-xs font-bold text-slate-800">Send invite</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@company.com"
              className="input flex-1 !py-2 !text-sm min-w-[12rem]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendOne()}
              className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1"
            >
              <Mail className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs"
            placeholder="Personal note (required for resend & bulk &gt;5)"
          />
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2">
          <p className="text-xs font-bold text-slate-800">
            Bulk CSV (max 15/batch · daily cap)
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-mono"
            placeholder="a@co.com, b@co.com"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendBulk()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            Send bulk
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : invites.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-12">
          No invites logged yet. Send one above or use Invite all with email on
          customer profiles.
        </p>
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
          <ul className="divide-y divide-neutral-100">
            {invites.map((inv) => (
              <li
                key={String(inv.id)}
                className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {inv.email || '—'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {inv.created_at
                      ? String(inv.created_at).slice(0, 16).replace('T', ' ')
                      : ''}
                    {inv.action ? ` · ${inv.action}` : ''}
                    {inv.status ? ` · ${inv.status}` : ' · sent'}
                    {String(inv.action || '').includes('opened')
                      ? ' · opened'
                      : ''}
                    {String(inv.action || '').includes('accepted')
                      ? ' · accepted'
                      : ''}
                    {String(inv.action || '').includes('seq_')
                      ? ' · sequence'
                      : ''}
                  </div>
                </div>
                {inv.email ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resend(inv.email!)}
                    className="btn-secondary !py-1.5 !px-3 text-xs"
                  >
                    Resend
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </CustomersPage>
  );
}
