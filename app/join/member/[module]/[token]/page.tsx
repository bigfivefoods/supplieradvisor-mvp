'use client';

/**
 * Accept a GymAdvisor / clinic member or patient invite,
 * then open SA Member and link this business to the wallet.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CalendarDays,
  Check,
  HeartPulse,
  Loader2,
  MessageSquare,
  Shield,
  UserPlus,
} from 'lucide-react';

type InvitePreview = {
  module: string;
  module_label: string;
  role_label: string;
  business_name: string;
  person: { name: string; email?: string | null; code?: string };
  invite_status: string;
  expires_at?: string | null;
  shares: { schedule: boolean; feedback: boolean; medical: boolean };
  can_claim: boolean;
};

export default function JoinServiceMemberPage() {
  const { module: moduleParam, token } = useParams() as {
    module: string;
    token: string;
  };
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        token,
        ...(moduleParam ? { module: moduleParam } : {}),
      });
      const res = await fetch(`/api/public/member-invite?${q}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invitation not found');
      setInvite(data.invite as InvitePreview);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  }, [token, moduleParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/member-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          module: moduleParam,
          action: 'claim',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not accept invitation');
      setDone(true);
      const portalLink = String(data.portal_link || '');
      const portalToken = String(data.portal_token || '');
      const appLink = String(data.member_app_link || '');
      const mod = String(data.module || moduleParam || 'fitgraph');
      const dest =
        appLink ||
        (portalToken ? `/me?link=${encodeURIComponent(portalToken)}` : '') ||
        portalLink;
      if (dest) {
        window.setTimeout(() => {
          if (dest.startsWith('http')) window.location.href = dest;
          else router.push(dest);
        }, 900);
      } else if (portalToken) {
        window.setTimeout(() => {
          router.push(`/member/${mod}/${encodeURIComponent(portalToken)}`);
        }, 900);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setBusy(false);
    }
  };

  const accent =
    invite?.module === 'physiograph'
      ? 'from-teal-500 to-emerald-600'
      : invite?.module === 'dentalgraph'
        ? 'from-sky-500 to-blue-600'
        : invite?.module === 'medicalgraph'
          ? 'from-indigo-500 to-slate-800'
          : invite?.module === 'psychiatrygraph'
            ? 'from-rose-500 to-fuchsia-800'
            : 'from-violet-500 to-indigo-600';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div
        className={`bg-gradient-to-br ${accent} px-6 py-12 text-white text-center`}
      >
        <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-90 mb-2">
          SupplierAdvisor®
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          You&apos;re invited
        </h1>
        <p className="mt-2 text-sm sm:text-base text-white/90 max-w-md mx-auto">
          Join as a member or patient and open your personal portal.
        </p>
      </div>

      <div className="flex-1 px-4 -mt-6 pb-16">
        <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6 sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Loading invitation…</p>
            </div>
          ) : error && !invite ? (
            <div className="text-center py-8 space-y-3">
              <Shield className="w-10 h-10 mx-auto text-rose-400" />
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                {error}
              </p>
              <p className="text-xs text-slate-500">
                Ask the business to resend your invitation from their dashboard.
              </p>
            </div>
          ) : invite ? (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {invite.module_label}
                </p>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {invite.business_name}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Hello{invite.person.name ? ` ${invite.person.name}` : ''} —
                  you&apos;re invited as a{' '}
                  <strong>{invite.role_label}</strong>
                  {invite.person.email ? (
                    <>
                      {' '}
                      · <span className="font-mono text-xs">{invite.person.email}</span>
                    </>
                  ) : null}
                </p>
              </div>

              <ul className="space-y-2.5">
                {invite.shares.schedule ? (
                  <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                    <CalendarDays className="w-4 h-4 mt-0.5 text-violet-600 shrink-0" />
                    <span>
                      View open classes / appointments, book vacancies, and
                      manage your bookings
                    </span>
                  </li>
                ) : null}
                {invite.shares.feedback ? (
                  <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                    <MessageSquare className="w-4 h-4 mt-0.5 text-sky-600 shrink-0" />
                    <span>Leave feedback after classes or visits</span>
                  </li>
                ) : null}
                {invite.shares.medical ? (
                  <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                    <HeartPulse className="w-4 h-4 mt-0.5 text-teal-600 shrink-0" />
                    <span>
                      See shared medical / clinical information the practice
                      shares with you
                    </span>
                  </li>
                ) : null}
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <UserPlus className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                  <span>Update your profile and photo in the portal</span>
                </li>
              </ul>

              {error ? (
                <p className="text-sm text-rose-600 dark:text-rose-400 text-center">
                  {error}
                </p>
              ) : null}

              {done ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
                  <Check className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                    You&apos;re in! Opening your portal…
                  </p>
                </div>
              ) : invite.can_claim ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accept()}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-white bg-gradient-to-r ${accent} shadow-md hover:opacity-95 disabled:opacity-60`}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {invite.invite_status === 'accepted'
                    ? 'Open my portal'
                    : 'Accept invitation'}
                </button>
              ) : (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-center text-sm text-amber-900 dark:text-amber-100">
                  This invitation is{' '}
                  <strong>{invite.invite_status || 'unavailable'}</strong>. Ask
                  the business to send a new invite.
                </div>
              )}

              <p className="text-[11px] text-center text-slate-400 leading-relaxed">
                Links expire after 14 days. Bookmark your portal after accepting
                — you can reopen it anytime with the same link.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
