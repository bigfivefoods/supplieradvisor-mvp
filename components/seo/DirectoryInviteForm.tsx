'use client';

import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

/** Public invite from directory / company page */
export default function DirectoryInviteForm({
  companyId,
  companyName,
  compact,
}: {
  companyId?: number;
  companyName?: string;
  compact?: boolean;
}) {
  const [email, setEmail] = useState('');
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

  return (
    <form
      onSubmit={(e) => void send(e)}
      className={
        compact
          ? 'flex flex-wrap gap-2 items-center'
          : 'rounded-2xl border border-sky-100 bg-sky-50/60 p-4 space-y-2'
      }
    >
      {!compact ? (
        <p className="text-xs font-bold text-sky-950">
          Invite a company by email
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 flex-1 min-w-0">
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
      </div>
    </form>
  );
}
