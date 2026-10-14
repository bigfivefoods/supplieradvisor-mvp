'use client';

import { useState } from 'react';
import { useTradeBook } from '@/components/trades/TradeBook';
import type { PhotoPhase } from '@/lib/trades/desk';

/** Owner and technician composer. Internal notes never reach the client feed. */
export function FeedComposer({ jobId, author }: { jobId: string; author: string }) {
  const { dispatch } = useTradeBook();
  const [note, setNote] = useState('');
  const [internal, setInternal] = useState(false);
  const [phase, setPhase] = useState<PhotoPhase>('during');
  return (
    <form
      className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4"
      data-testid="feed-composer"
      onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: 'add_note', job_id: jobId, note, shared: !internal });
        setNote('');
      }}
    >
      <p className="text-sm font-black">Post to the client feed</p>
      <textarea
        className="min-h-20 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={internal ? 'Internal note' : 'What should the client see?'}
        required
      />
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
        Internal only
      </label>
      <button className="min-h-11 rounded-full bg-[#00b4d8] px-4 text-sm font-bold text-[#0f172a]" type="submit">
        {internal ? 'Save internally' : 'Share with client'}
      </button>
      <label className="block text-sm font-semibold">
        Site photo
        <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={phase} onChange={(event) => setPhase(event.target.value as PhotoPhase)}>
          <option value="before">Before</option>
          <option value="during">During</option>
          <option value="after">After</option>
        </select>
        <input
          className="mt-2 block w-full text-sm"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              dispatch({
                type: 'add_photo',
                job_id: jobId,
                phase,
                url: String(reader.result || ''),
                caption: file.name.replace(/\.[^.]+$/, ''),
                shared: !internal,
              });
            };
            reader.readAsDataURL(file);
            event.target.value = '';
          }}
        />
      </label>
      <p className="text-xs text-slate-500">Posted by {author}. Shared posts push to the client.</p>
    </form>
  );
}
