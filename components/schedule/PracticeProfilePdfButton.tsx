'use client';

/**
 * Download a practice profile PDF (brand, hours, team, services/classes)
 * for Fit + clinic Advisors.
 */
import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ModuleId =
  | 'fitgraph'
  | 'dentalgraph'
  | 'medicalgraph'
  | 'physiograph'
  | 'psychiatrygraph';

type Props = {
  companyId: number | string | null | undefined;
  module: ModuleId;
  label?: string;
  className?: string;
};

export function PracticeProfilePdfButton({
  companyId,
  module,
  label = 'Download practice PDF',
  className = '',
}: Props) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!companyId) {
      toast.error('Select a company first');
      return;
    }
    setBusy(true);
    try {
      const q = new URLSearchParams({
        companyId: String(companyId),
        module,
        kind: 'profile',
      });
      // Open tab on user gesture so the PDF viewer is not blocked / blank
      const preview = window.open('about:blank', '_blank');
      const res = await fetch(`/api/schedule/practice-pdf?${q.toString()}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/pdf' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        preview?.close();
        throw new Error(
          (err as { error?: string }).error || 'Could not build practice PDF'
        );
      }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const filename =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename="?([^";]+)"?/)?.[1]
          ?.trim() || 'practice-profile.pdf';

      if (preview && !preview.closed) {
        preview.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      // Do not revoke immediately — that blanks the PDF viewer tab
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      toast.success('Practice PDF ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF download failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy || !companyId}
      onClick={() => void download()}
      className={
        className ||
        'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
      }
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  );
}
