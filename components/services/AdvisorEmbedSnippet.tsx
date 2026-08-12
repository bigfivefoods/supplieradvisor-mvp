'use client';

import { useState } from 'react';
import { Check, Copy, Code2 } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  embedPath: string;
  title?: string;
  height?: number;
};

export function AdvisorEmbedSnippet({
  embedPath,
  title = 'Website embed',
  height = 640,
}: Props) {
  const [copied, setCopied] = useState<'url' | 'iframe' | null>(null);
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.supplieradvisor.io';
  const url = `${origin}${embedPath.startsWith('/') ? embedPath : `/${embedPath}`}`;
  const iframe = `<iframe src="${url}" title="Book online" style="width:100%;min-height:${height}px;border:0;border-radius:16px" loading="lazy" allow="payment *"></iframe>`;

  const copy = async (kind: 'url' | 'iframe', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === 'url' ? 'Public URL copied' : 'Embed snippet copied');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Code2 className="w-4 h-4 text-violet-600" />
        <p className="text-sm font-black">{title}</p>
      </div>
      <p className="text-[11px] text-slate-500">
        Paste the iframe on your website, or share the public booking link.
      </p>
      <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-3 py-2 text-[11px] font-mono break-all text-slate-700 dark:text-slate-300">
        {url}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-bold"
          onClick={() => void copy('url', url)}
        >
          {copied === 'url' ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          Copy URL
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-xl bg-violet-600 text-white px-3 py-1.5 text-xs font-bold"
          onClick={() => void copy('iframe', iframe)}
        >
          {copied === 'iframe' ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Code2 className="w-3.5 h-3.5" />
          )}
          Copy iframe
        </button>
      </div>
      <pre className="text-[10px] leading-relaxed rounded-xl bg-slate-950 text-slate-200 p-3 overflow-x-auto">
        {iframe}
      </pre>
    </div>
  );
}
