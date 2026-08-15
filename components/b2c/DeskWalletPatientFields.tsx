'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { WalletCards } from 'lucide-react';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import { usePrivy } from '@privy-io/react-auth';

export type WalletFill = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  photo_url?: string | null;
};

export function DeskUseMyWalletButton({
  onFill,
  disabled,
}: {
  onFill: (w: WalletFill) => void;
  disabled?: boolean;
}) {
  const { user } = usePrivy();
  const [busy, setBusy] = useState(false);

  const fill = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams();
      const uid = getCanonicalUserId(user?.id);
      if (uid) q.set('privyUserId', uid);
      const em = extractEmailFromPrivyUser(user);
      if (em) q.set('email', em);
      const res = await fetch(`/api/b2c/me${q.toString() ? `?${q}` : ''}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load your wallet');
      const p = data.profile || {};
      if (!p.email && !p.full_name) {
        throw new Error('Your SA Member wallet has no name or email yet');
      }
      onFill({
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        photo_url: p.photo_url,
      });
      toast.success('Filled from your SA Member wallet');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load wallet');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => void fill()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-900 hover:bg-sky-100 disabled:opacity-50"
    >
      <WalletCards className="h-3.5 w-3.5" />
      {busy ? 'Loading wallet…' : 'This is me — use my wallet'}
    </button>
  );
}

export function DeskWalletInviteToggle({
  checked,
  onChange,
  email,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  email?: string;
}) {
  return (
    <label className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-black text-slate-900">
          Email a link to their SA Member wallet
        </span>
        <span className="mt-0.5 block text-[11px] text-slate-500">
          {email?.includes('@')
            ? `We'll send ${email} an invite to add this practice to their personal wallet — they should not recapture their profile or family.`
            : "If this is you, we'll use your wallet email. Otherwise add an email so they can accept and link."}
        </span>
      </span>
    </label>
  );
}
