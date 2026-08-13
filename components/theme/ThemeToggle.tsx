'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, Monitor, Palette, Check } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemeMode } from '@/lib/theme/theme';
import {
  ADVISOR_SKINS,
  SUPPLIER_SKIN,
  type BrandMode,
} from '@/lib/brand/advisor-skins';

type Props = {
  /** compact = icon popover; segmented = appearance only; full = both sections */
  variant?: 'icon' | 'segmented' | 'menu' | 'full';
  className?: string;
};

const APPEARANCE: Array<{ id: ThemeMode; label: string; Icon: typeof Sun }> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

const BRAND_OPTIONS: Array<{ id: BrandMode; label: string; hint: string; swatch: string }> =
  [
    {
      id: 'core',
      label: 'SupplierAdvisor',
      hint: 'Always Core OS branding',
      swatch: SUPPLIER_SKIN.brand,
    },
    {
      id: 'module',
      label: 'Follow module',
      hint: 'Match the Advisor you are in',
      swatch: 'linear-gradient(135deg,#0891b2,#7c3aed,#16a34a)',
    },
    ...ADVISOR_SKINS.map((s) => ({
      id: s.id as BrandMode,
      label: s.name,
      hint: s.tagline,
      swatch: s.brand,
    })),
  ];

/**
 * Theme + Advisor brand picker.
 * Appearance: light / dark / system.
 * Branding: Core OS · follow module · lock Hire/Gym/Physio/…
 */
export default function ThemeToggle({
  variant = 'icon',
  className = '',
}: Props) {
  const { mode, resolved, setMode, brandMode, setBrandMode } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const appearanceRow = (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50/90 p-0.5 dark:border-neutral-700 dark:bg-black/80"
      role="group"
      aria-label="Colour theme"
    >
      {APPEARANCE.map(({ id, label, Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            title={label}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );

  const brandList = (
    <ul className="space-y-0.5">
      {BRAND_OPTIONS.map((opt) => {
        const active = brandMode === opt.id;
        return (
          <li key={opt.id}>
            <button
              type="button"
              onClick={() => setBrandMode(opt.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition ${
                active
                  ? 'bg-[var(--sa-brand-soft)] text-[var(--sa-brand-deep)]'
                  : 'hover:bg-slate-50 dark:hover:bg-neutral-800'
              }`}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                style={{ background: opt.swatch }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold leading-tight">
                  {opt.label}
                </span>
                <span className="block text-[10px] text-slate-500 dark:text-neutral-400">
                  {opt.hint}
                </span>
              </span>
              {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (variant === 'segmented') {
    return appearanceRow;
  }

  if (variant === 'full') {
    return <div className={className}>{brandList}</div>;
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Theme & branding"
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-[var(--sa-brand)]/50 hover:text-[var(--sa-brand-deep)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        {resolved === 'dark' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
      {open ? (
        <div className="absolute right-0 z-[80] mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <Sun className="h-3 w-3" /> Appearance
          </p>
          {appearanceRow}
          <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <Palette className="h-3 w-3" /> Module branding
          </p>
          <div className="max-h-64 overflow-y-auto pr-0.5">{brandList}</div>
        </div>
      ) : null}
    </div>
  );
}
