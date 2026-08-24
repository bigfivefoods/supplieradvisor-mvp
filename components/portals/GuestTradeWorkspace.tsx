'use client';

import { useState } from 'react';
import type { PublicPortalPayload } from '@/lib/portals/trade-portal';

export function GuestTradeWorkspace({
  token,
  portal,
  onRefresh,
}: {
  token: string;
  portal: PublicPortalPayload;
  onRefresh: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="space-y-4 rounded-[1.5rem] border border-white/70 bg-white/90 p-6 shadow-sm">
      <p className="text-sm font-bold text-slate-900">Portal workspace</p>
      <p className="text-sm text-neutral-600">
        Full guest workspace is being restored. Orders, OTIFEF, Statement and Projects
        tabs will return shortly. Host: {portal.host?.name || '—'}.
      </p>
      {note ? <p className="text-xs text-[#0077b6]">{note}</p> : null}
      <button
        type="button"
        className="btn-secondary !py-2 !px-3 text-xs"
        onClick={() => {
          setNote('Refreshed');
          onRefresh();
        }}
      >
        Refresh
      </button>
    </div>
  );
}
