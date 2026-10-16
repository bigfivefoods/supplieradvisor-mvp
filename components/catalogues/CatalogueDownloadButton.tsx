import { Download } from 'lucide-react';
import { catalogueById, formatCatalogueSize } from '@/lib/catalogues';

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a]';

export function CatalogueDownloadButton({
  id,
  variant = 'primary',
  label,
  showMeta = false,
  className = '',
}: {
  id?: string;
  variant?: 'primary' | 'secondary' | 'inline';
  label?: string;
  showMeta?: boolean;
  className?: string;
}) {
  if (!id) return null;
  const entry = catalogueById(id);
  if (!entry || entry.status !== 'available' || !entry.file) return null;
  const text = label ?? 'Download the catalogue';
  const size = formatCatalogueSize(entry.file.bytes);
  const classes =
    variant === 'primary'
      ? `sa-btn-brand inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold ${FOCUS}`
      : variant === 'secondary'
        ? `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:border-[#00b4d8] motion-reduce:transition-none ${FOCUS}`
        : `inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#0077b6] underline underline-offset-4 ${FOCUS}`;

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
