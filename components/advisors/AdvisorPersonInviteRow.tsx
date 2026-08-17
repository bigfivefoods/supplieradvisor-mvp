'use client';

import { useState } from 'react';
import { Loader2, Mail, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import type { AdvisorWorkforceModule } from '@/lib/services/advisor-workforce';

export function AdvisorPersonInviteRow({
  module,
  personId,
  email,
  engagement,
  inviteStatus,
  onChanged,
}: {
  module: AdvisorWorkforceModule;
  personId: string;
  email?: string | null;
  engagement?: string | null;
  inviteStatus?: string | null;
  onChanged?: () => void;
}) {
  const { companyId, withAuthJson } = useApiAuth();
  const [busy, setBusy] = useState(false);
  const [lane, setLane] = useState(
    engagement === 'employed' ? 'employed' : 'contractor'
  );

  const post = async (action: string) => {
    if (!companyId) return;
    setBusy(true);
    try {
      const data = await withAuthJson<{ message?: string; warning?: string }>(
        '/api/advisors/workforce',
        {
          method: 'POST',
          jsonBody: {
            companyId,
            module,
            action,
            person_id: personId,
            engagement: lane,
            email,
          },
        }
      );
      if (data.warning) toast.message(data.warning);
      else toast.success(data.message || 'Done');
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold dark:border-slate-600 dark:bg-slate-900"
        value={lane}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value;
          setLane(next);
          void (async () => {
            if (!companyId) return;
            setBusy(true);
            try {
              await withAuthJson('/api/advisors/workforce', {
                method: 'POST',
                jsonBody: {
                  companyId,
                  module,
                  action: 'set_engagement',
                  person_id: personId,
                  engagement: next,
                },
              });
              toast.success(
                next === 'employed'
                  ? 'Employed — B2B workspace'
                  : 'Contractor — work app'
              );
              onChanged?.();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed');
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <option value="contractor">Contractor · work app</option>
        <option value="employed">Employed · workspace</option>
      </select>
      <button
        type="button"
        disabled={busy || !String(email || '').includes('@')}
        onClick={() => void post('invite_person')}
        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Mail className="h-3 w-3" />
        )}
        {inviteStatus === 'pending' ? 'Resend invite' : 'Email invite'}
      </button>
      {inviteStatus === 'pending' || inviteStatus === 'accepted' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void post('revoke_person')}
          className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700"
        >
          <UserMinus className="h-3 w-3" /> Revoke
        </button>
      ) : null}
      {inviteStatus && inviteStatus !== 'none' ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {inviteStatus}
        </span>
      ) : null}
    </div>
  );
}
