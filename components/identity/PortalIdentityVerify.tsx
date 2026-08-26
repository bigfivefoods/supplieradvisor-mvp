'use client';

/**
 * Self-serve identity verification for member / patient / coach portals.
 * SA → VerifyNow · International → Didit hosted KYC.
 */
import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, Loader2, Shield } from 'lucide-react';

export type PortalIdentitySnapshot = {
  status?: string;
  provider?: string | null;
  verified_at?: string | null;
  verified_name?: string | null;
  status_text?: string | null;
  is_verified?: boolean;
};

type Props = {
  module:
    | 'fitgraph'
    | 'physiograph'
    | 'dentalgraph'
    | 'medicalgraph'
    | 'psychiatrygraph'
    | 'vetgraph';
  role: 'member' | 'patient' | 'coach';
  token: string;
  /** Current ID number from profile form (SA) */
  idNumber: string;
  onIdNumberChange?: (v: string) => void;
  identity?: PortalIdentitySnapshot | null;
  onIdentityChange?: (identity: PortalIdentitySnapshot) => void;
  accentClass?: string;
  buttonClass?: string;
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

export function PortalIdentityVerify({
  module,
  role,
  token,
  idNumber,
  onIdNumberChange,
  identity: identityProp,
  onIdentityChange,
  accentClass = 'border-slate-200',
  buttonClass = 'bg-slate-900 hover:bg-slate-800',
}: Props) {
  const [identity, setIdentity] = useState<PortalIdentitySnapshot>(
    identityProp || { status: 'unverified', is_verified: false }
  );
  const [providers, setProviders] = useState<{
    verifynow: boolean;
    didit: boolean;
  }>({ verifynow: true, didit: true });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [diditUrl, setDiditUrl] = useState<string | null>(null);

  useEffect(() => {
    if (identityProp) setIdentity(identityProp);
  }, [identityProp]);

  const applyIdentity = useCallback(
    (next: PortalIdentitySnapshot) => {
      setIdentity(next);
      onIdentityChange?.(next);
    },
    [onIdentityChange]
  );

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/identity/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, role, token, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.providers) setProviders(data.providers);
    if (data.identity) applyIdentity(data.identity);
    return data;
  };

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const data = await post({ action: 'status' });
        if (data.providers) setProviders(data.providers);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, module, role]);

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
      const data = await post({
        action: 'didit_start',
        consent: true,
      });
      const url = data.didit?.url as string | undefined;
      if (url) {
        setDiditUrl(url);
        setMsg(data.message || 'Continue on Didit');
        // Open hosted flow
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setMsg(data.message || 'Session created');
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
    <div
      className={`rounded-2xl border ${accentClass} bg-slate-50/80 p-4 space-y-3`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            verified ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {verified ? (
            <BadgeCheck className="h-5 w-5" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Identity verification</p>
          <p className="text-xs text-slate-500 mt-0.5">
            South Africa: VerifyNow SA ID check. International passport / ID: Didit
            hosted verification. Results sync to the desk record.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusColor(identity.status)}`}
            >
              {statusLabel(identity.status)}
            </span>
            {identity.provider ? (
              <span className="text-[10px] font-bold uppercase text-slate-400">
                via {identity.provider}
              </span>
            ) : null}
            {identity.verified_name ? (
              <span className="text-xs text-slate-600 truncate">
                {identity.verified_name}
              </span>
            ) : null}
          </div>
          {identity.status_text && identity.status !== 'verified' ? (
            <p className="text-[11px] text-slate-500 mt-1">{identity.status_text}</p>
          ) : null}
        </div>
      </div>

      {!verified ? (
        <>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              SA ID number (for VerifyNow)
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              inputMode="numeric"
              autoComplete="off"
              placeholder="13-digit SA ID"
              value={idNumber}
              onChange={(e) => onIdNumberChange?.(e.target.value)}
              disabled={!!busy}
            />
          </label>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={!!busy}
            />
            <span>
              I consent to identity verification for this gym/clinic record
              (POPIA). VerifyNow processes SA IDs; Didit processes international
              documents under their privacy notice.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={!consent || !!busy || !providers.verifynow}
              onClick={() => void runVerifyNow()}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${buttonClass}`}
              title={
                providers.verifynow
                  ? 'Verify with SA ID via VerifyNow'
                  : 'VerifyNow not configured'
              }
            >
              {busy === 'verifynow' ? (
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
              ) : null}
              Verify SA ID (VerifyNow)
            </button>
            <button
              type="button"
              disabled={!consent || !!busy || !providers.didit}
              onClick={() => void startDidit()}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              title={
                providers.didit
                  ? 'International ID / passport via Didit'
                  : 'Didit not configured'
              }
            >
              {busy === 'didit' ? (
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 inline mr-1" />
              )}
              International (Didit)
            </button>
          </div>

          {(identity.status === 'pending' ||
            identity.status === 'in_review' ||
            diditUrl) && (
            <div className="flex flex-wrap gap-2 items-center">
              {diditUrl ? (
                <a
                  href={diditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-violet-700 underline"
                >
                  Resume Didit verification
                </a>
              ) : null}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void refreshDidit()}
                className="text-xs font-bold text-slate-600 underline disabled:opacity-50"
              >
                {busy === 'refresh' ? 'Checking…' : 'I finished — refresh status'}
              </button>
            </div>
          )}

          {!providers.verifynow && !providers.didit ? (
            <p className="text-[11px] text-amber-700">
              Verification providers are not configured on this environment yet.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-emerald-800 font-medium">
          You are verified
          {identity.verified_at
            ? ` · ${new Date(identity.verified_at).toLocaleDateString()}`
            : ''}
          . Desk staff can see this badge on your record.
        </p>
      )}

      {msg ? (
        <p className="text-xs font-medium text-emerald-700">{msg}</p>
      ) : null}
      {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
    </div>
  );
}
