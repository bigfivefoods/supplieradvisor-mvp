import { Download } from 'lucide-react';
import { catalogueById, formatCatalogueSize } from '@/lib/catalogues';

/** Navy on light surfaces. Cyan on dark surfaces, where navy disappears. */
export const CATALOGUE_FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a] dark:focus-visible:outline-[#00b4d8]';

/** Cyan with an offset. For gradient and navy headers that are dark in both themes. */
export const CATALOGUE_FOCUS_ON_DARK =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00b4d8]';

export function CatalogueDownloadButton({
  id,
  variant = 'primary',
  tone = 'light',
  focus = 'auto',
  label,
  showMeta = false,
  className = '',
}: {
  id?: string;
  variant?: 'primary' | 'secondary' | 'inline' | 'quiet';
  /** Surface behind a quiet control. Cyan and navy need different text than a light page. */
  tone?: 'light' | 'cyan' | 'inverse';
  /** `on-dark` keeps a cyan ring on gradient headers even when the theme is light. */
  focus?: 'auto' | 'on-dark';
  label?: string;
  showMeta?: boolean;
  className?: string;
}) {
  if (!id) return null;
  const entry = catalogueById(id);
  if (!entry || entry.status !== 'available' || !entry.file) return null;
  const text = label ?? 'Download the catalogue';
  const size = formatCatalogueSize(entry.file.bytes);
  const ring = focus === 'on-dark' || tone === 'inverse' ? CATALOGUE_FOCUS_ON_DARK : CATALOGUE_FOCUS;
  const quietText =
    tone === 'cyan' ? 'text-[#0f172a]' : tone === 'inverse' ? 'text-white' : 'text-[#0077b6]';
  const classes =
    variant === 'primary'
      ? `sa-btn-brand inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold ${ring}`
      : variant === 'secondary'
        ? `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:border-[#00b4d8] motion-reduce:transition-none ${ring}`
        : variant === 'quiet'
          ? `inline-flex min-h-11 items-center gap-2 rounded-2xl px-2 text-sm font-semibold underline-offset-4 hover:underline ${quietText} ${ring}`
          : `inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#0077b6] underline underline-offset-4 ${ring}`;

  return (
    <a
      href={`/catalogues/${entry.id}/download`}
      data-catalogue-id={entry.id}
      className={`${classes}${className ? ` ${className}` : ''}`}
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
      {showMeta ? <span className="text-xs font-semibold text-slate-600">PDF · {size}</span> : null}
      <span className="sr-only">{`(PDF, ${size})`}</span>
    </a>
  );
}
