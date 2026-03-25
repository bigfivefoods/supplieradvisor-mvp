'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const items = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    return { href, label };
  });

  return (
    <div className="breadcrumb flex items-center gap-2 text-sm text-slate-500 mb-8">
      <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <ChevronRight size={14} />
          {i === items.length - 1 ? (
            <span className="font-medium text-slate-900">{item.label}</span>
          ) : (
            <Link href={item.href} className="hover:text-slate-900">
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}