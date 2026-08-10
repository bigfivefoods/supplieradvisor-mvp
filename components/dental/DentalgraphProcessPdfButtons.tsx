import { Download, FileText } from 'lucide-react';
import { dentalgraphProcessGuidePdfUrl } from '@/lib/dental/dentalgraph-process-guide-links';

type Variant = 'header' | 'inline' | 'map';

export default function DentalgraphProcessPdfButtons({
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
          href={dentalgraphProcessGuidePdfUrl('landscape', { download: true })}
          className="btn-primary !py-2.5 !px-3.5 text-sm inline-flex items-center gap-2"
          title="Download A4 landscape process design (2 pages)"
        >
          <Download className="w-4 h-4" />
          Landscape
        </a>
        <a
          href={dentalgraphProcessGuidePdfUrl('portrait', { download: true })}
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
          href={dentalgraphProcessGuidePdfUrl('landscape', { download: true })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white text-sky-800 px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-sky-50 transition-colors"
          title="A4 landscape · 2 pages"
        >
          <Download className="w-3.5 h-3.5" />
          Landscape PDF
        </a>
        <a
          href={dentalgraphProcessGuidePdfUrl('portrait', { download: true })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/90 text-sky-800 px-3.5 py-2 text-xs font-bold shadow-sm border border-white/40 hover:bg-sky-50 transition-colors"
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
        href={dentalgraphProcessGuidePdfUrl('landscape')}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
        title="Open A4 landscape process design"
      >
        <FileText className="w-3.5 h-3.5" /> Landscape PDF
      </a>
      <a
        href={dentalgraphProcessGuidePdfUrl('portrait')}
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
