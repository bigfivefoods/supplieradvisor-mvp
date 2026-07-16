'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildWhatsAppShareUrl,
  formatPhoneDisplay,
  openWhatsAppShare,
  toWhatsAppE164Digits,
} from '@/lib/invites/whatsapp';

type Props = {
  /** Pre-built message body */
  text: string;
  /** Optional E.164 / local phone — opens chat with that contact when valid */
  phone?: string | null;
  /**
   * When true and phone is missing/invalid, prompt the user for a number
   * (blank still opens WhatsApp contact picker).
   */
  promptIfNoPhone?: boolean;
  label?: string;
  title?: string;
  className?: string;
  size?: 'sm' | 'md';
  iconOnly?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onShared?: (info: { phone: string | null; url: string }) => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'children'>;

/**
 * Client-side WhatsApp share (wa.me) — uses the user's own WhatsApp, no Twilio.
 */
export default function WhatsAppShareButton({
  text,
  phone,
  promptIfNoPhone = true,
  label = 'WhatsApp',
  title,
  className = '',
  size = 'sm',
  iconOnly = false,
  disabled,
  children,
  onShared,
  ...rest
}: Props) {
  const pad = size === 'sm' ? '!py-1.5 !px-3 text-xs' : '!py-2 !px-4 text-sm';

  const handleClick = () => {
    const body = String(text || '').trim();
    if (!body) {
      toast.error('Nothing to share yet');
      return;
    }

    let resolved = phone || null;
    if (promptIfNoPhone && !toWhatsAppE164Digits(resolved)) {
      const entered = window.prompt(
        'WhatsApp number (optional — leave blank to pick a contact):',
        resolved || ''
      );
      if (entered === null) return; // cancelled
      resolved = entered.trim() || null;
    }

    const url = buildWhatsAppShareUrl({ phone: resolved, text: body });
    openWhatsAppShare({ phone: resolved, text: body });
    onShared?.({ phone: resolved, url });

    const digits = toWhatsAppE164Digits(resolved);
    toast.success(
      digits
        ? `WhatsApp opened for ${formatPhoneDisplay(resolved)}`
        : 'WhatsApp opened — pick a contact'
    );
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      title={
        title ||
        (toWhatsAppE164Digits(phone)
          ? `Share on WhatsApp to ${formatPhoneDisplay(phone)}`
          : 'Share on WhatsApp (pick contact or enter number)')
      }
      className={
        className ||
        `btn-secondary ${pad} inline-flex items-center gap-1 border-emerald-300/70 text-emerald-800 hover:bg-emerald-50`
      }
      {...rest}
    >
      {children ?? (
        <>
          <MessageCircle className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          {!iconOnly ? label : null}
        </>
      )}
    </button>
  );
}
