'use client';

import { useEffect, useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  SHARE_KIND_LABEL,
  type AdvisorShareKind,
  type AdvisorSharePeer,
  type ProfileShare,
  type ProfileShareSnapshot,
} from '@/lib/b2c/profile-share-types';

type Incoming = {
  share_id?: string;
  id?: string;
  from_company_name: string;
  from_kind: AdvisorShareKind;
  member_name?: string;
  patient_name?: string;
  status: string;
  note?: string | null;
  snapshot: ProfileShareSnapshot | null;
};

export function AdvisorIncomingShares({
  companyId,
  embedded,
  showEmpty,
}: {
  companyId: number;
  embedded?: boolean;
  showEmpty?: boolean;
}) {
  const { withAuthJson } = useApiAuth();
  const [rows, setRows] = useState<Incoming[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      withAuthJson<{ incoming?: Incoming[] }>(
        `/api/advisors/profile-shares?companyId=${companyId}`
      ),
      withAuthJson<{ inbound?: Incoming[] }>(
        `/api/clinic/practice-referral?companyId=${companyId}`
      ),
    ])
      .then(([shares, refs]) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const next: Incoming[] = [];
        for (const r of [...(refs.inbound || []), ...(shares.incoming || [])]) {
          const key = `${r.from_company_name}:${r.snapshot?.name || r.patient_name || r.member_name}:${r.note || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(r);
        }
        setRows(next);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, withAuthJson]);

  if (loading) {
    if (!showEmpty) return null;
    return <p className="text-sm text-slate-500">Loading shared profiles…</p>;
  }
  if (!rows.length) {
    if (!showEmpty) return null;
    return (
      <p className="text-sm text-slate-500">
        No patient profiles have been shared with this desk yet.
      </p>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'space-y-3'
          : 'rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30'
      }
    >
      {embedded ? null : (
        <>
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            Shared with you
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Patients another practice referred to you — only the details they
            consented to share.
          </p>
        </>
      )}
      <ul className={embedded ? 'space-y-2' : 'mt-3 space-y-2'}>
        {rows.map((r) => {
          const snap = r.snapshot;
          const name = snap?.name || r.patient_name || r.member_name;
          return (
          <li
            key={r.id || r.share_id || name}
            className="rounded-xl border border-emerald-100 bg-white p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40"
          >
            <p className="font-black text-slate-900 dark:text-emerald-50">
              {name}
            </p>
            <p className="text-[11px] text-slate-500">
              From {snap?.practice?.brand || r.from_company_name} ·{' '}
              {SHARE_KIND_LABEL[r.from_kind]}
              {snap?.practice?.referring_practitioner
                ? ` · ${snap.practice.referring_practitioner}`
                : ''}
            </p>
            {r.note || snap?.referral_reason ? (
              <p className="mt-1 text-[12px] text-slate-700 dark:text-emerald-100">
                {r.note || snap?.referral_reason}
              </p>
            ) : null}
            {snap?.health ? (
              <p className="mt-1 text-[12px] text-slate-700 dark:text-emerald-100">
                {snap.health}
              </p>
            ) : null}
            {snap?.medical?.allergies ? (
              <p className="mt-1 text-[11px] text-slate-600">
                Allergies: {String(snap.medical.allergies)}
              </p>
            ) : null}
            {snap?.practice ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {[
                  snap.practice.contact_phone,
                  snap.practice.contact_email,
                  snap.practice.city,
                  snap.practice.practice_number
                    ? `Prac. ${snap.practice.practice_number}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
            {snap?.visits?.length ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Last visit: {snap.visits[0].date} · {snap.visits[0].service_name}
              </p>
            ) : null}
            {snap?.email ? (
              <p className="mt-1 text-[11px] text-slate-500">{snap.email}</p>
            ) : null}
          </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdvisorProfileShare({
  companyId,
  personId,
  kind,
  personName,
  email,
  platformUserId,
}: {
  companyId: number;
  personId: string;
  kind: AdvisorShareKind;
  personName?: string;
  email?: string | null;
  platformUserId?: string | null;
}) {
  const { withAuthJson } = useApiAuth();
  const [peers, setPeers] = useState<AdvisorSharePeer[]>([]);
  const [outgoing, setOutgoing] = useState<ProfileShare[]>([]);
  const [memberLinked, setMemberLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toCompany, setToCompany] = useState('');
  const [toKind, setToKind] = useState('');
  const [busy, setBusy] = useState(false);

  const qs = new URLSearchParams({
    companyId: String(companyId),
    personId,
    kind,
  });
  if (email) qs.set('email', email);
  if (platformUserId) qs.set('platformUserId', platformUserId);

  const load = async () => {
    const data = await withAuthJson<{
      peers?: AdvisorSharePeer[];
      outgoing?: ProfileShare[];
      member_linked?: boolean;
    }>(`/api/advisors/profile-shares?${qs.toString()}`);
    setPeers(data.peers || []);
    setOutgoing(data.outgoing || []);
    setMemberLinked(data.member_linked === true);
  };

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, personId, kind]);

  const peer = peers.find((p) => String(p.company_id) === toCompany);
  const kinds = peer?.kinds || [];

  const request = async () => {
    if (!toCompany || !toKind) {
      toast.error('Pick an Advisor and desk');
      return;
    }
    setBusy(true);
    try {
      const data = await withAuthJson<{ message?: string }>(
        '/api/advisors/profile-shares',
        {
          method: 'POST',
          jsonBody: {
            action: 'request',
            companyId,
            personId,
            kind,
            toCompanyId: Number(toCompany),
            to_kind: toKind,
            email,
            platformUserId,
          },
        }
      );
      toast.success(data.message || 'Consent request sent');
      setToCompany('');
      setToKind('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not request share');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading share options…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        Share {personName || 'this profile'}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        The member must consent in SA Member before the other Advisor can see
        their profile.
      </p>
      {!memberLinked ? (
        <p className="mt-2 text-[12px] font-semibold text-amber-800 dark:text-amber-200">
          Invite them to SA Member first — consent happens in the app.
        </p>
      ) : peers.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-500">
          Connect this business to another Advisor in Network to share.
        </p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={toCompany}
            onChange={(e) => {
              setToCompany(e.target.value);
              setToKind('');
            }}
          >
            <option value="">Connected Advisor…</option>
            {peers.map((p) => (
              <option key={p.company_id} value={p.company_id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={toKind}
            onChange={(e) => setToKind(e.target.value)}
            disabled={!peer}
          >
            <option value="">Desk…</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {SHARE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !toCompany || !toKind}
            onClick={() => void request()}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#0077b6] px-3 py-2 text-[12px] font-black text-white disabled:opacity-50 sm:col-span-2"
          >
            <Share2 className="h-3.5 w-3.5" /> Ask member to consent
          </button>
        </div>
      )}
      {outgoing.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
          {outgoing.map((s) => (
            <li key={s.id}>
              {s.to_company_name} · {SHARE_KIND_LABEL[s.to_kind]} ·{' '}
              <span className="font-bold capitalize">{s.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
