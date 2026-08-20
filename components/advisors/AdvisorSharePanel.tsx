'use client';

import { Copy, Mail, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';

export function AdvisorSharePanel({
  brand,
  bio,
  phone,
  email,
  color,
  productLine,
  hint,
  lead,
  emailSubject,
  copiedOk,
  shareUrl,
}: {
  brand: string;
  bio?: string;
  phone?: string;
  email?: string;
  color: string;
  productLine: string;
  hint: string;
  lead: string;
  emailSubject: string;
  copiedOk: string;
  /** Public URL to share (defaults to this page). */
  shareUrl?: string;
}) {
  const ink = advisorBrandInk(color);
  const url =
    shareUrl ||
    (typeof window !== 'undefined' ? window.location.href.split('?')[0] : '');
  const blurb = [lead, bio ? String(bio).trim() : '', phone ? `Call ${phone}` : '', url]
    .filter(Boolean)
    .join('\n');

  const shareNative = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: brand, text: blurb, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(blurb);
      toast.success(copiedOk);
    } catch {
      toast.error('Could not share');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(blurb);
      toast.success(copiedOk);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black text-slate-900 dark:text-white">
          Share {brand}
        </h2>
        <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      </div>
      <div
        className="rounded-3xl p-4"
        style={{ backgroundColor: color, color: ink }}
      >
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
          {productLine}
        </p>
        <p className="mt-1 text-xl font-black">{brand}</p>
        {bio ? <p className="mt-2 text-sm font-semibold opacity-80">{bio}</p> : null}
        {phone ? <p className="mt-1 text-sm font-bold">{phone}</p> : null}
        {email ? <p className="text-sm font-bold">{email}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void shareNative()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white dark:bg-white dark:text-slate-900"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(blurb)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-800 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
        >
          Facebook
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(blurb)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-800 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
        >
          X / Twitter
        </a>
        {email ? (
          <a
            href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(blurb)}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-800 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
          >
            <Mail className="h-4 w-4" /> Email
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-800 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
        >
          <Copy className="h-4 w-4" /> Copy
        </button>
      </div>
    </div>
  );
}
