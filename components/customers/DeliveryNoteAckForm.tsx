'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

type Props = {
  token: string;
  initialName?: string | null;
  initialDate?: string | null;
};

export default function DeliveryNoteAckForm({ token, initialName, initialDate }: Props) {
  const [name, setName] = useState(initialName || '');
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/delivery-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mx-auto mt-4 w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-sm font-bold text-slate-900">Received by</h2>
      <p className="text-xs text-slate-500">
        Sign on the PDF, or record your name and the date here. This does not show prices.
      </p>
      <label className="block text-xs font-semibold text-slate-600">
        Name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
          autoComplete="name"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Date
        <input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="text-sm font-medium text-emerald-700">Received-by saved on this delivery note.</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#00b4d8] px-4 py-3 text-sm font-bold text-[#0077b6]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save received-by
      </button>
    </form>
  );
}
