'use client';

/**
 * Outlook-style till present: QR + NFC URL write + live status.
 * Used on RetailAdvisor till and every Advisor accounts desk.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Nfc, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import { PayQr } from '@/components/till/PayQr';
import { formatZar } from '@/lib/b2c/member-account-types';
import type { TillLine, TillModule, TillSession, TillSessionKind } from '@/lib/till/types';

type Props = {
  module: TillModule;
  kind: TillSessionKind;
  amountZar: number;
  label: string;
  lines?: TillLine[];
  chargeIds?: string[];
  onPaid?: (session: TillSession) => void;
  onClose: () => void;
};

async function writeNfcUrl(url: string): Promise<string> {
  const w = window as unknown as {
    NDEFWriter?: new () => { write: (msg: unknown) => Promise<void> };
  };
  if (!w.NDEFWriter) {
    return 'NFC write needs Chrome on Android. Customer can scan the QR instead.';
  }
  try {
    const writer = new w.NDEFWriter();
    await writer.write({ records: [{ recordType: 'url', data: url }] });
    return 'Ready — customer can tap this screen with their phone.';
  } catch (e) {
    return e instanceof Error ? e.message : 'NFC write failed — use the QR.';
  }
}

export function TillPresentPay(props: Props) {
  const { companyId, withAuthJson } = useApiAuth();
  const [session, setSession] = useState<TillSession | null>(null);
  const [payUrl, setPayUrl] = useState('');
  const [nfcNote, setNfcNote] = useState('');
  const [busy, setBusy] = useState(true);

  const create = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ session: TillSession; pay_url: string }>(
      '/api/till/sessions',
      {
        method: 'POST',
        jsonBody: {
          action: 'create',
          companyId,
          module: props.module,
          kind: props.kind,
          amount_zar: props.amountZar,
          label: props.label,
          lines: props.lines,
          charge_ids: props.chargeIds,
        },
      }
    );
    setSession(data.session);
    setPayUrl(data.pay_url);
    setBusy(false);
    void writeNfcUrl(data.pay_url).then(setNfcNote);
  }, [
    companyId,
    props.amountZar,
    props.chargeIds,
    props.kind,
    props.label,
    props.lines,
    props.module,
    withAuthJson,
  ]);

  useEffect(() => {
    void create().catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Could not open till');
      setBusy(false);
    });
  }, [create]);

  useEffect(() => {
    if (!session || !companyId) return;
    if (session.status === 'paid' || session.status === 'cancelled') return;
    const t = window.setInterval(() => {
      void withAuthJson<{ session: TillSession }>(
        `/api/till/sessions?companyId=${companyId}&token=${encodeURIComponent(session.token)}`
      )
        .then((data) => {
          setSession(data.session);
          if (data.session.status === 'paid') {
            toast.success('Paid at till');
            props.onPaid?.(data.session);
          }
        })
        .catch(() => {});
    }, 2500);
    return () => window.clearInterval(t);
  }, [companyId, props, session, withAuthJson]);

  const cancel = async () => {
    if (!companyId || !session) {
      props.onClose();
      return;
    }
    try {
      await withAuthJson('/api/till/sessions', {
        method: 'POST',
        jsonBody: { action: 'cancel', companyId, token: session.token },
      });
    } catch {
      /* close anyway */
    }
    props.onClose();
  };

  const cash = async () => {
    if (!companyId || !session) return;
    try {
      const data = await withAuthJson<{ session: TillSession }>(
        '/api/till/sessions',
        {
          method: 'POST',
          jsonBody: { action: 'cash', companyId, token: session.token },
        }
      );
      setSession(data.session);
      toast.success('Marked paid · cash');
      props.onPaid?.(data.session);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not mark cash');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Present payment"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close till"
        onClick={() => void cancel()}
      />
      <div className="relative w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Present at till
            </p>
            <h2 className="text-lg font-black text-slate-900">{props.label}</h2>
            <p className="text-2xl font-black tabular-nums text-orange-700">
              {props.kind === 'wallet' ? 'Open bills' : formatZar(props.amountZar)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cancel()}
            className="rounded-xl border border-slate-200 p-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {busy || !payUrl ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
          </div>
        ) : (
          <>
            <PayQr url={payUrl} label="Scan to pay" />
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[12px] text-orange-950">
              <Nfc className="mt-0.5 h-4 w-4 shrink-0" />
              {nfcNote ||
                'Android Chrome can write this URL to NFC. iPhone and others scan the QR.'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[12px] text-slate-500">
              <Smartphone className="h-3.5 w-3.5" />
              Status:{' '}
              <strong className="text-slate-800">
                {session?.status || 'open'}
              </strong>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {props.kind !== 'wallet' ? (
                <button
                  type="button"
                  onClick={() => void cash()}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"
                >
                  Paid in cash
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void cancel()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
