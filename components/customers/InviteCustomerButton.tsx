'use client';

import { useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

type Props = {
  customerId: number;
  customerName?: string;
  defaultEmail?: string;
  defaultContactName?: string;
  onSent?: (result?: { inviteLink?: string }) => void;
  /** Called when the expanded form is cancelled (e.g. clear parent inviteOpenId). */
  onCancel?: () => void;
  className?: string;
  /** Compact link style (profiles table) vs primary button. */
  variant?: 'link' | 'button' | 'primary';
  /** Start expanded (e.g. post-onboard CTA). */
  defaultOpen?: boolean;
  /** Use resend copy when customer already has an outstanding / prior invite. */
  resend?: boolean;
};

/**
 * Reusable POST /api/customers/invites control.
 * Offline CRM customers stay editable without inviting — this is optional.
 */
export default function InviteCustomerButton({
  customerId,
  customerName,
  defaultEmail = '',
  defaultContactName = '',
  onSent,
  onCancel,
  className = '',
  variant = 'link',
  defaultOpen = false,
  resend = false,
}: Props) {
  const { user } = usePrivy();
  const [open, setOpen] = useState(defaultOpen);
  const [email, setEmail] = useState(defaultEmail);
  const [contactName, setContactName] = useState(defaultContactName);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastLink, setLastLink] = useState('');

  const title = resend ? 'Resend platform invite' : 'Invite to platform';
  const collapsedLabel = resend ? 'Resend invite' : 'Invite to platform';
  const submitLabel = resend ? 'Resend invite' : 'Send invite';

  const close = () => {
    setOpen(false);
    onCancel?.();
  };

  const send = async () => {
    const companyId = getSelectedCompanyId();
    const privyUserId = getCanonicalUserId(user?.id);
    if (!companyId) {
      toast.error('Select a company first');
      return;
    }
    if (!privyUserId) {
      toast.error('Sign in required to send invitations');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('A valid email is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/customers/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          customerId,
          privyUserId,
          email: email.trim().toLowerCase(),
          contactName: contactName.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'Invite failed');
      }
      if (data.warning) {
        toast.message('Invitation created', { description: data.warning });
      } else {
        toast.success(data.message || (resend ? 'Invitation resent' : 'Invitation sent'));
      }
      if (data.inviteLink) setLastLink(data.inviteLink);
      onSent?.({ inviteLink: data.inviteLink });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    const base =
      variant === 'primary'
        ? 'btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1.5'
        : variant === 'button'
          ? 'btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5'
          : 'inline-flex items-center gap-1.5 text-sm font-medium text-[#00b4d8] hover:underline';
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${base} ${className}`}
      >
        <Mail className="w-4 h-4" /> {collapsedLabel}
      </button>
    );
  }

  return (
    <div
      className={`p-4 rounded-2xl border border-[#00b4d8]/30 bg-[#00b4d8]/5 space-y-3 text-left ${className}`}
    >
      <div className="text-sm font-semibold text-slate-900">
        {title}
        {customerName ? ` · ${customerName}` : ''}
      </div>
      <p className="text-xs text-neutral-600">
        Sends an email so they can join SupplierAdvisor and connect as a buyer. Your offline CRM
        record stays editable either way.
      </p>
      <input
        className="input w-full !p-2.5 !text-sm"
        placeholder="Contact name"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
      />
      <input
        className="input w-full !p-2.5 !text-sm"
        type="email"
        placeholder="Email *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <textarea
        className="input w-full !p-2.5 !text-sm min-h-[56px]"
        placeholder="Optional message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={close}
          className="btn-secondary flex-1 !py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void send()}
          className="btn-primary flex-1 !py-2 text-sm inline-flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" /> {submitLabel}
            </>
          )}
        </button>
      </div>
      {lastLink && (
        <p className="text-xs text-neutral-500 break-all">
          Link (if email fails):{' '}
          <button
            type="button"
            className="text-[#00b4d8] hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(lastLink);
              toast.success('Invite link copied');
            }}
          >
            Copy
          </button>{' '}
          {lastLink}
        </p>
      )}
    </div>
  );
}
