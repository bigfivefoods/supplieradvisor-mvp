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
  const [email, setEmail] = useState('');
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/business/network-invites?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setInvites(data.invites || []);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Sent ${data.sent} invite(s)`);
      setCsv('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (to: string) => {
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
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2">
          <p className="text-xs font-bold text-slate-800">Bulk CSV (max 40)</p>
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
