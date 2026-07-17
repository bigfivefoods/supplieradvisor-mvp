'use client';

import { useState } from 'react';
import { Loader2, Mail, Upload } from 'lucide-react';
import { toast } from 'sonner';

/** Public invite from directory / company page (+ optional bulk CSV) */
export default function DirectoryInviteForm({
  companyId,
  companyName,
  compact,
  showBulk,
}: {
  companyId?: number;
  companyName?: string;
  compact?: boolean;
  showBulk?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/public/directory-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          companyId: companyId || undefined,
          companyName: companyName || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(`Invite sent to ${email}`);
      setEmail('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  const sendBulk = async () => {
    if (!csv.trim()) {
      toast.message('Paste emails (comma or newline separated)');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/public/directory-invite/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bulk invite failed');
      toast.success(`Sent ${data.sent} invite(s)`, {
        description:
          data.failed?.length > 0
            ? `${data.failed.length} failed`
            : undefined,
      });
      setCsv('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? 'space-y-2'
          : 'rounded-2xl border border-sky-100 bg-sky-50/60 p-4 space-y-3'
      }
    >
      <form
        onSubmit={(e) => void send(e)}
        className="flex flex-wrap gap-2 items-center"
      >
        {!compact ? (
          <p className="text-xs font-bold text-sky-950 w-full">
            Invite a company by email
          </p>
        ) : null}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partner@company.com"
          className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm flex-1 min-w-[12rem]"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] px-4 py-2 text-xs font-bold text-white hover:bg-[#0096c7] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Mail className="w-3.5 h-3.5" />
          )}
          Send invite
        </button>
      </form>
      {showBulk !== false && !compact ? (
        <div className="border-t border-sky-100 pt-3 space-y-2">
          <p className="text-[10px] font-bold uppercase text-sky-800/80">
            Bulk CSV (max 25)
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={3}
            placeholder="a@co.com, b@co.com&#10;or one email per line"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-mono"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendBulk()}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-50 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Send bulk invites
          </button>
        </div>
      ) : null}
    </div>
  );
}
