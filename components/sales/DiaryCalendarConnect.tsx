'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

type LinkRow = {
  provider: string;
  account_email: string | null;
  calendar_name: string | null;
  status: string;
  last_error: string | null;
  last_synced_at: string | null;
};

type Status = {
  tableReady: boolean;
  googleReady: boolean;
  outlookReady: boolean;
  links: LinkRow[];
};

const toolBtn =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-3 text-sm font-semibold text-slate-800 no-underline disabled:opacity-60';

/** Same rules as the server check. Kept here so a bad Apple ID never dies as a silent browser tooltip. */
function appleFormError(appleId: string, appPassword: string): string | null {
  if (!appleId.includes('@')) return 'Use the email address for the Apple ID.';
  const code = appPassword.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (code.length < 16) {
    return 'Paste the 16-character app-specific password from appleid.apple.com, under Sign-In and Security. It looks like abcd-efgh-ijkl-mnop. Your normal Apple ID password will not connect.';
  }
  return null;
}

async function messageFromResponse(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* a timed-out function returns an HTML page, not JSON */
  }
  return `${fallback} (HTTP ${res.status}).`;
}

export async function syncConnectedCalendars(
  companyId: number,
  privyUserId?: string | null
): Promise<{ ok: boolean; changed: boolean }> {
  const res = await fetch('/api/sales/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, privyUserId: privyUserId || undefined }),
  });
  if (!res.ok) return { ok: false, changed: false };
  const data = await res.json().catch(() => ({}));
  return { ok: true, changed: Boolean(data.changed) };
}

export function DiaryCalendarConnect({
  companyId,
  privyUserId,
  onChanged,
}: {
  companyId: number;
  privyUserId?: string | null;
  onChanged: () => void;
}) {
  const search = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [appleOpen, setAppleOpen] = useState(false);
  const [appleId, setAppleId] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleBusyLabel, setAppleBusyLabel] = useState('Connecting to Apple…');
  const [appleNote, setAppleNote] = useState<string | null>(null);
  const [appleNoteError, setAppleNoteError] = useState(false);
  const [busy, setBusy] = useState(false);
  const appleLock = useRef(false);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const toasted = useRef<string | null>(null);

  const load = useCallback(async (): Promise<Status | null> => {
    const qs = new URLSearchParams({ companyId: String(companyId) });
    if (privyUserId) qs.set('privyUserId', privyUserId);
    const res = await fetch(`/api/sales/calendar?${qs.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Status;
    setStatus(data);
    return data;
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const flag = search.get('calendar');
    if (!flag || toasted.current === flag) return;
    toasted.current = flag;
    if (flag === 'google' || flag === 'outlook') {
      toast.success(`${flag === 'google' ? 'Google' : 'Outlook'} calendar connected`);
      void syncConnectedCalendars(companyId, privyUserId).then((result) => {
        if (result.changed) onChangedRef.current();
        void load();
      });
    } else if (flag === 'error') {
      toast.error('That calendar could not be connected');
    }
  }, [search, companyId, privyUserId, load]);

  const syncNow = async () => {
    setBusy(true);
    try {
      const result = await syncConnectedCalendars(companyId, privyUserId);
      if (result.changed) onChanged();
      toast.success('Calendar sync finished');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (provider: string) => {
    setBusy(true);
    try {
      await fetch('/api/sales/calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, provider, privyUserId: privyUserId || undefined }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connectApple = async (idRaw: string, passwordRaw: string) => {
    if (appleLock.current) return;
    const id = idRaw.trim();
    const password = passwordRaw;
    setAppleId(id);
    setAppPassword(password);
    const localError = appleFormError(id, password);
    if (localError) {
      setAppleNote(localError);
      setAppleNoteError(true);
      return;
    }
    appleLock.current = true;
    setAppleBusy(true);
    setAppleBusyLabel('Connecting to Apple…');
    setAppleNote('Connecting to Apple…');
    setAppleNoteError(false);
    try {
      const res = await fetch('/api/sales/calendar/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          appleId: id,
          appPassword: password,
          privyUserId: privyUserId || undefined,
        }),
      });
      if (!res.ok) {
        const message = await messageFromResponse(res, 'Apple Calendar could not connect');
        setAppleNote(message);
        setAppleNoteError(true);
        toast.error(message);
        return;
      }
      setAppPassword('');
      setAppleBusyLabel('Copying diary…');
      setAppleNote('Connected. Copying your diary onto Apple…');
      setAppleNoteError(false);
      toast.success('Apple Calendar connected');
      let copied = { ok: false, changed: false };
      try {
        copied = await syncConnectedCalendars(companyId, privyUserId);
      } catch {
        copied = { ok: false, changed: false };
      }
      if (copied.changed) onChanged();
      const next = await load();
      const apple = next?.links?.find((link) => link.provider === 'apple');
      if (apple?.last_error) {
        setAppleNote(`Apple Calendar is connected, but the first copy stopped: ${apple.last_error}`);
        setAppleNoteError(true);
      } else if (!copied.ok) {
        setAppleNote('Apple Calendar is connected. The first copy did not finish. Tap Sync now.');
        setAppleNoteError(true);
      } else {
        setAppleNote('Apple Calendar is connected.');
        setAppleNoteError(false);
        setAppleOpen(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apple Calendar could not connect';
      setAppleNote(message);
      setAppleNoteError(true);
      toast.error(message);
    } finally {
      appleLock.current = false;
      setAppleBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900">Two-way calendars</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Connect Google, Outlook, or Apple. SupplierAdvisor creates a calendar named SupplierAdvisor in that
            account and keeps it in sync both ways. A task saved here is written there. An event you add or change
            on that calendar is saved here. Your other calendars stay private.
          </p>
        </div>
        <button type="button" className={toolBtn} onClick={() => void syncNow()} disabled={busy || appleBusy}>
          Sync now
        </button>
      </div>
      {status && !status.tableReady ? (
        <p className="mt-3 text-sm text-amber-800">Calendar sync is not ready on this database yet.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {status?.googleReady ? (
          <a className={toolBtn} href={`/api/sales/calendar/google/start?companyId=${companyId}`}>
            Connect Google
          </a>
        ) : (
          <p className="text-xs text-neutral-500">Google two-way sync is not set up on this server yet.</p>
        )}
        {status?.outlookReady ? (
          <a className={toolBtn} href={`/api/sales/calendar/outlook/start?companyId=${companyId}`}>
            Connect Outlook
          </a>
        ) : (
          <p className="text-xs text-neutral-500">Outlook two-way sync is not set up on this server yet.</p>
        )}
        <button type="button" className={toolBtn} onClick={() => setAppleOpen((open) => !open)}>
          Connect Apple
        </button>
      </div>
      {appleOpen ? (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void connectApple(String(data.get('appleId') || ''), String(data.get('appleAppPassword') || ''));
          }}
        >
          <label className="block text-xs font-semibold text-neutral-600">
            Apple ID email
            <input
              name="appleId"
              type="text"
              inputMode="email"
              className="input mt-1 min-h-11 w-full !px-3 !py-2.5 !text-sm"
              value={appleId}
              onChange={(event) => setAppleId(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="name@icloud.com"
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            App-specific password
            <input
              name="appleAppPassword"
              type="text"
              className="input mt-1 min-h-11 w-full !px-3 !py-2.5 !text-sm"
              value={appPassword}
              onChange={(event) => setAppPassword(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="abcd-efgh-ijkl-mnop"
            />
          </label>
          <p className="text-xs text-neutral-500 sm:col-span-2">
            This is not your Apple ID password. On appleid.apple.com open Sign-In and Security, then App-Specific
            Passwords, and paste the 16-character code. It is stored sealed for this company login only.
            {appPassword && appPassword.toLowerCase().replace(/[^a-z0-9]/g, '').length < 16
              ? ` So far that is ${appPassword.toLowerCase().replace(/[^a-z0-9]/g, '').length} of 16 characters.`
              : ''}
          </p>
          <button
            type="submit"
            className={`btn-primary min-h-11 sm:col-span-2 sm:w-auto ${appleBusy ? 'opacity-60' : ''}`}
            disabled={appleBusy}
            aria-busy={appleBusy}
            onClick={(event) => {
              event.preventDefault();
              const form = event.currentTarget.form;
              const data = form ? new FormData(form) : null;
              void connectApple(
                String(data?.get('appleId') || appleId),
                String(data?.get('appleAppPassword') || appPassword)
              );
            }}
          >
            {appleBusy ? appleBusyLabel : 'Save Apple Calendar'}
          </button>
        </form>
      ) : null}
      {appleNote ? (
        <p role="status" className={`mt-3 text-sm ${appleNoteError ? 'text-rose-700' : 'text-slate-800'}`}>
          {appleNote}
        </p>
      ) : null}
      {status?.links?.length ? (
        <ul className="mt-4 space-y-2">
          {status.links.map((link) => (
            <li key={link.provider} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-semibold capitalize text-slate-900">{link.provider}</span>
                {link.account_email ? ` · ${link.account_email}` : ''}
                {link.status === 'error' ? ' · needs reconnecting' : ''}
                {link.last_error ? ` · ${link.last_error}` : ''}
              </span>
              <button
                type="button"
                className={toolBtn}
                onClick={() => void disconnect(link.provider)}
                disabled={busy || appleBusy}
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
