import { Download, FileText } from 'lucide-react';
import { fieldgraphProcessGuidePdfUrl } from '@/lib/agri/fieldgraph-process-guide-links';

type Variant = 'header' | 'inline' | 'map';

/**
 * Dual A4 process design downloads — landscape + portrait.
 * Mirrors NSNP ProcessGuidePdfButtons for CropAdvisor®.
 */
export default function FieldgraphProcessPdfButtons({
  variant = 'inline',
  className = '',
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === 'header') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <a
          href={fieldgraphProcessGuidePdfUrl('landscape', { download: true })}
          className="btn-primary !py-2.5 !px-3.5 text-sm inline-flex items-center gap-2"
          title="CropAdvisor® A4 landscape process design (2 pages)"
        >
          <Download className="w-4 h-4" />
          Landscape
        </a>
        <a
          href={fieldgraphProcessGuidePdfUrl('portrait', { download: true })}
          className="btn-secondary !py-2.5 !px-3.5 text-sm inline-flex items-center gap-2"
          title="CropAdvisor® A4 portrait process design (2 pages)"
        >
          <Download className="w-4 h-4" />
          Portrait
        </a>
      </div>
    );
  }

  if (variant === 'map') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <a
          href={fieldgraphProcessGuidePdfUrl('landscape', { download: true })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white text-emerald-800 dark:text-emerald-950 px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-emerald-50 transition-colors"
          title="CropAdvisor® A4 landscape · 2 pages"
        >
          <Download className="w-3.5 h-3.5" />
          Landscape PDF
        </a>
        <a
          href={fieldgraphProcessGuidePdfUrl('portrait', { download: true })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/90 text-emerald-800 dark:text-emerald-950 px-3.5 py-2 text-xs font-bold shadow-sm border border-white/40 hover:bg-emerald-50 transition-colors"
          title="CropAdvisor® A4 portrait · 2 pages"
        >
          <Download className="w-3.5 h-3.5" />
          Portrait PDF
        </a>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={fieldgraphProcessGuidePdfUrl('landscape')}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
        title="Open CropAdvisor® A4 landscape process design"
      >
        <FileText className="w-3.5 h-3.5" /> Landscape PDF
      </a>
      <a
        href={fieldgraphProcessGuidePdfUrl('portrait')}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
        title="Open CropAdvisor® A4 portrait process design"
      >
        <FileText className="w-3.5 h-3.5" /> Portrait PDF
      </a>
    </div>
  );
}
