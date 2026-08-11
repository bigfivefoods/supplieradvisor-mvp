'use client';

/**
 * Cmd/Ctrl+K command palette — jump to modules, trade, settle, Super-Cube, etc.
 * Sprint D — reduce surface anxiety for power users.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import { useCompanyRole } from '@/lib/business/useCompanyRole';

type Cmd = {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords?: string;
};

const EXTRA: Cmd[] = [
  {
    id: 'messages',
    label: 'Messages (inbox)',
    href: '/dashboard/messages',
    group: 'Network',
    keywords: 'chat message colleague supplier customer inbox team trade care',
  },
  {
    id: 'settle',
    label: 'Settle cockpit',
    href: '/dashboard/settle',
    group: 'Money',
    keywords: 'pay claim ar escrow',
  },
  {
    id: 'escrow',
    label: 'On-chain escrow',
    href: '/dashboard/escrow',
    group: 'Money',
    keywords: 'usdc eth release dispute',
  },
  {
    id: 'money',
    label: 'Money hub',
    href: '/dashboard/customers/money',
    group: 'Money',
    keywords: 'ar ap claims',
  },
  {
    id: 'leadership',
    label: 'Super-Cube® leadership',
    href: '/dashboard/intelligence/leadership-development',
    group: 'Intelligence',
    keywords: 'leadership super cube develop',
  },
  {
    id: 'insights',
    label: 'Neural insights',
    href: '/dashboard/intelligence/neural-insights',
    group: 'Intelligence',
    keywords: 'insight action riad',
  },
  {
    id: 'pulse',
    label: 'Pulse dashboard',
    href: '/dashboard/intelligence/pulse-dashboard',
    group: 'Intelligence',
  },
  {
    id: 'board-pack',
    label: 'Board pack export',
    href: '/dashboard/intelligence',
    group: 'Intelligence',
    keywords: 'board pack weekly',
  },
  {
    id: 'po',
    label: 'Purchase orders',
    href: '/dashboard/suppliers/po',
    group: 'Trade',
    keywords: 'po order receive',
  },
  {
    id: 'quotes',
    label: 'Customer quotes',
    href: '/dashboard/customers/quotes',
    group: 'Trade',
  },
  {
    id: 'crm-book',
    label: 'Customer book',
    href: '/dashboard/customers/profiles',
    group: 'Trade',
    keywords: 'crm profiles accounts',
  },
  {
    id: 'stock',
    label: 'Stock levels',
    href: '/dashboard/inventory/stock',
    group: 'Ops',
  },
  {
    id: 'scan',
    label: 'Scan receive',
    href: '/dashboard/inventory/scan',
    group: 'Ops',
    keywords: 'barcode receive',
  },
  {
    id: 'team',
    label: 'Team & roles',
    href: '/dashboard/my-business/team',
    group: 'Company',
  },
  {
    id: 'profile',
    label: 'Company profile',
    href: '/dashboard/my-business/profile',
    group: 'Company',
  },
  {
    id: 'modules',
    label: 'Workspace modules',
    href: '/dashboard/my-business/modules',
    group: 'Company',
    keywords: 'enable disable sidebar capabilities',
  },
  {
    id: 'guide',
    label: 'In-app guide',
    href: '/dashboard/guide',
    group: 'Help',
  },
];

function buildCommands(): Cmd[] {
  const fromNav: Cmd[] = [];
  for (const mod of MODULE_NAV) {
    fromNav.push({
      id: `mod-${mod.id}`,
      label: mod.name,
      href: mod.href,
      group: 'Modules',
      keywords: mod.id,
    });
    for (const step of mod.steps) {
      fromNav.push({
        id: `step-${mod.id}-${step.href}`,
        label: `${mod.name} · ${step.name}`,
        href: step.href,
        group: mod.name,
        keywords: step.desc || '',
      });
    }
  }
  // Prefer extras first for common money/trade jumps
  const seen = new Set<string>();
  const out: Cmd[] = [];
  for (const c of [...EXTRA, ...fromNav]) {
    if (seen.has(c.href + c.label)) continue;
    seen.add(c.href + c.label);
    out.push(c);
  }
  return out;
}

export default function CommandPalette() {
  const router = useRouter();
  const { canAccessRoute, isCompanyModuleEnabled, ready } = useCompanyRole();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const all = useMemo(() => buildCommands(), []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all;
    if (ready) {
      list = list.filter((c) => {
        if (!canAccessRoute(c.href)) return false;
        // Soft-filter by top-level module enablement when path is under dashboard
        const mod = MODULE_NAV.find(
          (m) => c.href === m.href || c.href.startsWith(m.href + '/')
        );
        if (mod && !isCompanyModuleEnabled(mod.id)) return false;
        return true;
      });
    }
    if (!needle) return list.slice(0, 12);
    return list
      .filter((c) => {
        const hay = `${c.label} ${c.group} ${c.keywords || ''} ${c.href}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 16);
  }, [all, q, ready, canAccessRoute, isCompanyModuleEnabled]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[active]) {
        e.preventDefault();
        go(filtered[active].href);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('sa:open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('sa:open-command-palette', onOpen);
    };
  }, [open, filtered, active]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQ('');
      router.push(href);
    },
    [router]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-start justify-center sm:pt-[10vh] md:pt-[12vh] px-0 sm:px-4 pb-safe">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] border-0 p-0 cursor-pointer"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden max-h-[min(88dvh,40rem)] flex flex-col"
      >
        <div className="sm:hidden flex justify-center pt-2 pb-0">
          <span className="h-1 w-10 rounded-full bg-neutral-200" aria-hidden />
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 shrink-0">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to settle, PO, Super-Cube, stock…"
            className="flex-1 text-base sm:text-sm outline-none placeholder:text-neutral-400 bg-transparent min-w-0"
            enterKeyHint="go"
          />
          <kbd className="hidden sm:inline text-[10px] font-bold text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <ul className="flex-1 overflow-y-auto overscroll-contain py-2 min-h-0">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-sm text-neutral-400 text-center">
              No matches
            </li>
          )}
          {filtered.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => go(c.href)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 sm:py-2.5 text-left text-sm min-h-[48px] sm:min-h-0 touch-manipulation ${
                  i === active ? 'bg-sky-50 text-slate-900' : 'text-slate-700'
                }`}
              >
                <span className="min-w-0">
                  <span className="font-semibold block truncate">{c.label}</span>
                  <span className="block text-[10px] text-neutral-400 font-medium uppercase tracking-wide">
                    {c.group}
                  </span>
                </span>
                {i === active && (
                  <CornerDownLeft className="w-3.5 h-3.5 text-neutral-400 shrink-0 hidden sm:block" />
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 py-2 border-t border-neutral-100 text-[10px] text-neutral-400 flex justify-between shrink-0 pb-safe sm:pb-2">
          <span className="hidden sm:inline">↑↓ navigate · ↵ open</span>
          <span className="sm:hidden">Tap a result</span>
          <span className="hidden sm:inline">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
