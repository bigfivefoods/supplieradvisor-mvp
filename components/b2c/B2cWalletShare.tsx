'use client';

import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { B2cProfileShares } from '@/components/b2c/B2cProfileShares';

export function B2cWalletShare({
  displayName,
  places,
}: {
  displayName: string;
  places: Array<{ brand: string; portal_path: string }>;
}) {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://supplieradvisor.com';
  const meUrl = `${origin}/me`;

  const share = async (title: string, text: string, url: string) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success('Copied');
    } catch {
      toast.error('Could not share');
    }
  };

  const copy = async (value: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(ok);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
          Your wallet
        </p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
          Invite someone to SA Member
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Same personal wallet you use — gyms, clinics, hire and shops in one
          place. Free.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void share(
                'SA Member',
                `${displayName} uses SA Member for gyms, clinics and hire.`,
                meUrl
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0077b6] px-4 py-2.5 text-xs font-black text-white"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Join me on SA Member — ${meUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-800"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <button
            type="button"
            onClick={() => void copy(meUrl, 'Link copied')}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-800"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      </section>

      {places.length > 0 ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">Share a place</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Send a gym, clinic or hire brand you already use.
          </p>
          <ul className="mt-3 space-y-2">
            {places.map((p) => {
              const url = p.portal_path.startsWith('http')
                ? p.portal_path
                : `${origin}${p.portal_path}`;
              return (
                <li
                  key={p.portal_path}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-bold text-slate-900">
                    {p.brand}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void share(p.brand, `See ${p.brand} on SA Member`, url)
                    }
                    className="shrink-0 rounded-full bg-[#0077b6] px-3 py-1.5 text-[10px] font-black text-white"
                  >
                    Share
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <B2cProfileShares />
    </div>
  );
}
