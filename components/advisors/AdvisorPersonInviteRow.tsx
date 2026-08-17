'use client';

import { useState } from 'react';
import { Copy, Loader2, Mail, MessageCircle, Share2, Smartphone, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  buildWhatsAppShareUrl,
  openWhatsAppShare,
  toWhatsAppE164Digits,
} from '@/lib/invites/whatsapp';
import type { AdvisorWorkforceModule } from '@/lib/services/advisor-workforce';

export function AdvisorPersonInviteRow({
  module,
  personId,
  email,
  phone,
  engagement,
  inviteStatus,
  onChanged,
}: {
  module: AdvisorWorkforceModule;
  personId: string;
  email?: string | null;
  phone?: string | null;
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
    if (!companyId) return null;
    setBusy(true);
    try {
      const data = await withAuthJson<{
        message?: string;
        warning?: string;
        invite_link?: string;
        share_text?: string;
      }>('/api/advisors/workforce', {
        method: 'POST',
        jsonBody: {
          companyId,
          module,
          action,
          person_id: personId,
          engagement: lane,
          email,
        },
      });
      if (data.warning && action !== 'share_person') toast.message(data.warning);
      else if (action !== 'share_person') toast.success(data.message || 'Done');
      onChanged?.();
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const ensureShare = async () => {
    const data = await post('share_person');
    const link = String(data?.invite_link || '').trim();
    const text = String(data?.share_text || '').trim();
    if (!link && !text) return null;
    return {
      link,
      text: text || `You have been invited. Open: ${link}`,
    };
  };

  const shareWhatsApp = async () => {
    const share = await ensureShare();
    if (!share) return;
    let resolved = phone || null;
    if (!toWhatsAppE164Digits(resolved)) {
      const entered = window.prompt(
        'WhatsApp number (optional — leave blank to pick a contact):',
        resolved || ''
      );
      if (entered === null) return;
      resolved = entered.trim() || null;
    }
    openWhatsAppShare({ phone: resolved, text: share.text });
    toast.success('WhatsApp opened with the invite');
  };

  const copyLink = async () => {
    const share = await ensureShare();
    if (!share?.link) return;
    try {
      await navigator.clipboard.writeText(share.link);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const shareSms = async () => {
    const share = await ensureShare();
    if (!share) return;
    const digits = toWhatsAppE164Digits(phone);
    const href = digits
      ? `sms:+${digits}?body=${encodeURIComponent(share.text)}`
      : `sms:?body=${encodeURIComponent(share.text)}`;
    window.location.href = href;
  };

  const shareSheet = async () => {
    const share = await ensureShare();
    if (!share) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Work invite',
          text: share.text,
          url: share.link || undefined,
        });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
      }
    }
    const url = buildWhatsAppShareUrl({ phone, text: share.text });
    window.open(url, '_blank', 'noopener,noreferrer');
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
        {inviteStatus === 'pending' ? 'Resend email' : 'Email invite'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void shareWhatsApp()}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900 disabled:opacity-50"
      >
        <MessageCircle className="h-3 w-3" /> WhatsApp
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void copyLink()}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        <Copy className="h-3 w-3" /> Copy link
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void shareSms()}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        <Smartphone className="h-3 w-3" /> SMS
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void shareSheet()}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        <Share2 className="h-3 w-3" /> Share
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
