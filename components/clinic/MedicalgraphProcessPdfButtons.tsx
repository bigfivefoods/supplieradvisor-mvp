import { Download, FileText } from 'lucide-react';
import { medicalgraphProcessGuidePdfUrl } from '@/lib/clinic/medicalgraph-process-guide-links';

type Variant = 'header' | 'inline' | 'map';

export default function MedicalgraphProcessPdfButtons({
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
          href={medicalgraphProcessGuidePdfUrl('landscape', { download: true })}
          className="btn-primary !py-2.5 !px-3.5 text-sm inline-flex items-center gap-2"
          title="Download A4 landscape process design (2 pages)"
        >
          <Download className="w-4 h-4" />
          Landscape
        </a>
        <a
          href={medicalgraphProcessGuidePdfUrl('portrait', { download: true })}
          className="btn-secondary !py-2.5 !px-3.5 text-sm inline-flex items-center gap-2"
          title="Download A4 portrait process design (2 pages)"
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
          href={medicalgraphProcessGuidePdfUrl('landscape', { download: true })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white text-emerald-800 px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-emerald-50 transition-colors"
          title="A4 landscape · 2 pages"
        >
          <Download className="w-3.5 h-3.5" />
          Landscape PDF
        </a>
        <a
          href={medicalgraphProcessGuidePdfUrl('portrait', { download: true })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/90 text-emerald-800 px-3.5 py-2 text-xs font-bold shadow-sm border border-white/40 hover:bg-emerald-50 transition-colors"
          title="A4 portrait · 2 pages"
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
        href={medicalgraphProcessGuidePdfUrl('landscape')}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
        title="Open A4 landscape process design"
      >
        <FileText className="w-3.5 h-3.5" /> Landscape PDF
      </a>
      <a
        href={medicalgraphProcessGuidePdfUrl('portrait')}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
        title="Open A4 portrait process design"
      >
        <FileText className="w-3.5 h-3.5" /> Portrait PDF
      </a>
    </div>
  );
}
