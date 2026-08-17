'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, RotateCcw, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import type { AdvisorWorkforceModule } from '@/lib/services/advisor-workforce';

type DeskSnap = {
  has_front_desk?: boolean;
  name?: string;
  email?: string;
  invite_status?: string;
  invite_sent_at?: string | null;
  last_invited_email?: string | null;
};

export function AdvisorDeskInviteCard({
  module,
  defaultHasDesk = true,
}: {
  module: AdvisorWorkforceModule;
  defaultHasDesk?: boolean;
}) {
  const { companyId, withAuthJson } = useApiAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasDesk, setHasDesk] = useState(defaultHasDesk);
  const [name, setName] = useState('Front desk');
  const [email, setEmail] = useState('');
  const [desk, setDesk] = useState<DeskSnap | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ desk?: DeskSnap }>(
      `/api/advisors/workforce?companyId=${companyId}&module=${module}`
    );
    if (data.desk) {
      setDesk(data.desk);
      setHasDesk(data.desk.has_front_desk !== false);
      setName(data.desk.name || 'Front desk');
      setEmail(data.desk.email || '');
    }
  }, [companyId, module, withAuthJson]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Could not load desk');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const post = async (action: string, extra?: Record<string, unknown>) => {
    if (!companyId) return;
    setBusy(true);
    try {
      const data = await withAuthJson<{
        message?: string;
        invite_link?: string;
        warning?: string;
      }>('/api/advisors/workforce', {
        method: 'POST',
        jsonBody: {
          companyId,
          module,
          action,
          name,
          email,
          has_front_desk: hasDesk,
          ...extra,
        },
      });
      if (data.invite_link) setLink(data.invite_link);
      if (data.warning) toast.message(data.warning);
      else toast.success(data.message || 'Saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        Front desk
      </p>
      <h3 className="text-base font-black text-slate-900 dark:text-white">
        Desk email & workspace invite
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Full-time reception joins the B2B workspace (calendar, bookings,
        check-in, messages). If the desk person changes, revoke and send a new
        invite.
      </p>

      {loading ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading desk…
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={hasDesk}
              onChange={(e) => setHasDesk(e.target.checked)}
            />
            This Advisor has a front desk
          </label>
          {hasDesk ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  placeholder="Desk name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  placeholder="desk@studio.co.za"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {desk?.invite_status && desk.invite_status !== 'none' ? (
                <p className="text-xs font-bold text-slate-500">
                  Status: {desk.invite_status}
                  {desk.last_invited_email
                    ? ` · last sent to ${desk.last_invited_email}`
                    : ''}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void post('save_desk')}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                >
                  Save desk details
                </button>
                <button
                  type="button"
                  disabled={busy || !email.includes('@')}
                  onClick={() => void post('invite_desk')}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  {desk?.invite_status === 'pending' ? 'Resend invite' : 'Send invite'}
                </button>
                {desk?.invite_status === 'pending' ||
                desk?.invite_status === 'accepted' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void post('revoke_desk')}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Revoke
                  </button>
                ) : null}
                {desk?.last_invited_email &&
                email &&
                email !== desk.last_invited_email ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void post('invite_desk')}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Invite new desk
                  </button>
                ) : null}
              </div>
              {link ? (
                <p className="break-all font-mono text-[11px] text-slate-500">
                  {link}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
