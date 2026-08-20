'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { MODULE_NAV } from '@/lib/chrome/module-nav';

function pretty(seg: string) {
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Dashboard › Module › Step — uses MODULE_NAV labels when known.
 * Process steps stay in the top rail; this is the page trail only.
 */
export function ModuleCrumbs() {
  const pathname = usePathname() || '';
  const path = pathname.split('?')[0];
  if (
    !path.startsWith('/dashboard') &&
    !path.startsWith('/sales') &&
    !path.startsWith('/contractor')
  ) {
    return null;
  }

  const ranked = [...MODULE_NAV].sort(
    (a, b) => b.href.length - a.href.length
  );
  const mod = ranked.find(
    (m) => path === m.href || path.startsWith(m.href + '/')
  );

  const items: Array<{ href: string; label: string }> = [
    { href: '/dashboard', label: 'Dashboard' },
  ];
  if (mod) {
    items.push({ href: mod.href, label: mod.name });
    const step = [...mod.steps]
      .filter((s) => s.href.split('?')[0] !== mod.href)
      .sort((a, b) => b.href.length - a.href.length)
      .find((s) => {
        const h = s.href.split('?')[0];
        return path === h || path.startsWith(h + '/');
      });
    if (step) {
      const h = step.href.split('?')[0];
      if (h !== mod.href) items.push({ href: h, label: step.name });
    } else if (path !== mod.href) {
      const tail = path.slice(mod.href.length).split('/').filter(Boolean);
      if (tail[0]) {
        items.push({ href: path, label: pretty(tail[0]) });
      }
    }
  } else {
    const segs = path.split('/').filter(Boolean).slice(1);
    let acc = '/dashboard';
    for (const s of segs) {
      acc += `/${s}`;
      items.push({ href: acc, label: pretty(s) });
    }
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 flex flex-wrap items-center gap-1 text-xs text-neutral-500"
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.href}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
            ) : null}
            {last ? (
              <span className="font-semibold text-slate-800">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-[#0077b6] min-h-[28px] inline-flex items-center"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
