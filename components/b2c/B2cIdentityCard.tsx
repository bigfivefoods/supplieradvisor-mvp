'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, Loader2, Shield } from 'lucide-react';

export type B2cVerification = {
  status?: string;
  provider?: string | null;
  verified_at?: string | null;
  verified_name?: string | null;
  status_text?: string | null;
  is_verified?: boolean;
};

function statusLabel(status?: string) {
  switch (String(status || 'unverified')) {
    case 'verified':
      return 'Verified';
    case 'pending':
      return 'Pending';
    case 'in_review':
      return 'In review';
    case 'mismatch':
      return 'Name mismatch';
    case 'failed':
      return 'Failed';
    default:
      return 'Not verified';
  }
}

function statusColor(status?: string) {
  switch (String(status || 'unverified')) {
    case 'verified':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'pending':
    case 'in_review':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'mismatch':
    case 'failed':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function B2cIdentityCard({
  initial,
  idNumber,
  onIdNumberChange,
  onChange,
}: {
  initial?: B2cVerification | null;
  idNumber: string;
  onIdNumberChange: (v: string) => void;
  onChange?: (v: B2cVerification) => void;
}) {
  const [identity, setIdentity] = useState<B2cVerification>(
    initial || { status: 'unverified', is_verified: false }
  );
  const [providers, setProviders] = useState({
    verifynow: true,
    didit: true,
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [diditUrl, setDiditUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initial) setIdentity(initial);
  }, [initial]);

  const apply = useCallback(
    (next: B2cVerification) => {
      setIdentity(next);
      onChange?.(next);
    },
    [onChange]
  );

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/b2c/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.providers) setProviders(data.providers);
    if (data.identity) apply(data.identity);
    return data;
  };

  useEffect(() => {
    void (async () => {
      try {
        const data = await post({ action: 'status' });
        if (data.providers) setProviders(data.providers);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runVerifyNow = async () => {
    setBusy('verifynow');
    setMsg(null);
    setErr(null);
    try {
      const data = await post({
        action: 'verifynow',
        id_number: idNumber,
        consent: true,
      });
      setMsg(data.message || 'VerifyNow complete');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'VerifyNow failed');
    } finally {
      setBusy(null);
    }
  };

  const startDidit = async () => {
    setBusy('didit');
    setMsg(null);
    setErr(null);
    try {
      const data = await post({ action: 'didit_start', consent: true });
      const url = data.didit?.url as string | undefined;
      if (url) {
        setDiditUrl(url);
        setMsg(data.message || 'Continue on Didit');
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Didit failed');
    } finally {
      setBusy(null);
    }
  };

  const refreshDidit = async () => {
    setBusy('refresh');
    setMsg(null);
    setErr(null);
    try {
      const data = await post({ action: 'didit_refresh' });
      setMsg(data.message || 'Status updated');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setBusy(null);
    }
  };

  const verified = identity.is_verified || identity.status === 'verified';

  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            verified ? 'bg-emerald-600 text-white' : 'bg-sky-100 text-[#0077b6]'
          }`}
        >
          {verified ? (
            <BadgeCheck className="h-5 w-5" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Verify yourself</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            SA ID via VerifyNow, or passport / international ID via Didit. Free.
            Hire desks can see you are verified.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusColor(identity.status)}`}
            >
              {statusLabel(identity.status)}
            </span>
            {identity.verified_name ? (
              <span className="truncate text-xs text-slate-600">
                {identity.verified_name}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {!verified ? (
        <>
          <label className="block text-[11px] font-bold text-slate-600">
            SA ID number
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono"
              inputMode="numeric"
              autoComplete="off"
              placeholder="13-digit SA ID"
              value={idNumber}
              onChange={(e) => onIdNumberChange(e.target.value)}
              disabled={!!busy}
            />
          </label>
          <label className="flex items-start gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={!!busy}
            />
            <span>
              I consent to identity verification on my personal SA Member wallet
              (POPIA). VerifyNow processes SA IDs; Didit processes international
              documents.
            </span>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!consent || !!busy || !providers.verifynow}
              onClick={() => void runVerifyNow()}
              className="rounded-2xl bg-[#0077b6] py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {busy === 'verifynow' ? (
                <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
              ) : null}
              Verify SA ID
            </button>
            <button
              type="button"
              disabled={!consent || !!busy || !providers.didit}
              onClick={() => void startDidit()}
              className="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-800 disabled:opacity-50"
            >
              {busy === 'didit' ? (
                <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
              )}
              International ID
            </button>
          </div>
          {(identity.status === 'pending' ||
            identity.status === 'in_review' ||
            diditUrl) && (
            <div className="flex flex-wrap items-center gap-2">
              {diditUrl ? (
                <a
                  href={diditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#0077b6] underline"
                >
                  Resume Didit
                </a>
              ) : null}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void refreshDidit()}
                className="text-xs font-bold text-slate-600 underline disabled:opacity-50"
              >
                {busy === 'refresh' ? 'Checking…' : 'I finished — refresh'}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs font-medium text-emerald-800">
          You are verified
          {identity.verified_at
            ? ` · ${new Date(identity.verified_at).toLocaleDateString()}`
            : ''}
          . Hire and clinic desks can trust this badge.
        </p>
      )}

      {msg ? <p className="text-xs font-medium text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
    </section>
  );
}
