import { Download } from 'lucide-react';
import { catalogueById, formatCatalogueSize } from '@/lib/catalogues';

/** Navy on light surfaces. Cyan when that surface itself is dark in dark mode. */
export const CATALOGUE_FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a] dark:focus-visible:outline-[#00b4d8]';

/** Navy in both themes. A cyan header does not switch colour in dark mode. */
export const CATALOGUE_FOCUS_ON_CYAN =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a]';

/** White with an offset. Cyan is below 3:1 on several Advisor gradient stops. */
export const CATALOGUE_FOCUS_ON_GRADIENT =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export function CatalogueDownloadButton({
  id,
  variant = 'primary',
  tone = 'light',
  focus = 'auto',
  size = 'default',
  label,
  showMeta = false,
  className = '',
}: {
  id?: string;
  variant?: 'primary' | 'secondary' | 'inline' | 'quiet';
  /** Surface behind a quiet control. Cyan and navy need different text than a light page. */
  tone?: 'light' | 'cyan' | 'inverse';
  /** `on-dark` uses a white ring. Gradient headers stay dark in both themes. */
  focus?: 'auto' | 'on-dark';
  /** `chip` matches the compact one-pager control on a gradient header. */
  size?: 'default' | 'chip';
  label?: string;
  showMeta?: boolean;
  className?: string;
}) {
  if (!id) return null;
  const entry = catalogueById(id);
  if (!entry || entry.status !== 'available' || !entry.file) return null;
  const text = label ?? 'Download the catalogue';
  const fileSize = formatCatalogueSize(entry.file.bytes);
  const ring =
    focus === 'on-dark' || tone === 'inverse'
      ? CATALOGUE_FOCUS_ON_GRADIENT
      : tone === 'cyan'
        ? CATALOGUE_FOCUS_ON_CYAN
        : CATALOGUE_FOCUS;
  const quietText =
    tone === 'cyan' ? 'text-[#0f172a]' : tone === 'inverse' ? 'text-white' : 'text-[#0077b6]';
  const box =
    size === 'chip'
      ? 'inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold'
      : 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold';
  const classes =
    variant === 'primary'
      ? `sa-btn-brand ${box} ${ring}`
      : variant === 'secondary'
        ? `${box} border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors hover:border-[#00b4d8] motion-reduce:transition-none ${ring}`
        : variant === 'quiet'
          ? `inline-flex min-h-11 items-center gap-2 rounded-2xl px-2 text-sm font-semibold underline-offset-4 hover:underline ${quietText} ${ring}`
          : `inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#0077b6] underline underline-offset-4 ${ring}`;

  return (
    <a
      href={`/catalogues/${entry.id}/download`}
      data-catalogue-id={entry.id}
      className={`${classes}${className ? ` ${className}` : ''}`}
    >
      <Download className={size === 'chip' ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} aria-hidden />
      <span>{text}</span>
      {showMeta ? <span className="text-xs font-semibold text-slate-600">PDF · {fileSize}</span> : null}
      <span className="sr-only">{`(PDF, ${fileSize})`}</span>
    </a>
  );
}
