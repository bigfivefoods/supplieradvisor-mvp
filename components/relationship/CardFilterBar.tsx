'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import {
  SCORE_BANDS,
  cardQueryActive,
  titleLabel,
  type CardQuery,
} from '@/lib/relationship/card-filter';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b4d8] focus-visible:ring-offset-2';

function Pill({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${focus} inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold ${
        pressed
          ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950'
          : 'border-slate-200 bg-white text-slate-700 hover:border-[#00b4d8]'
      }`}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

export function CardFilterBar({
  query,
  onQuery,
  count,
  noun,
  searchLabel,
  placeholder,
  inputRef,
  statuses,
  moreStatuses = [],
  regions,
  industries,
  showScore = false,
  showCompliance = false,
  sort,
  view,
}: {
  query: CardQuery;
  onQuery: (next: CardQuery) => void;
  count: string;
  noun: string;
  searchLabel: string;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  statuses: string[];
  moreStatuses?: string[];
  regions: string[];
  industries: string[];
  showScore?: boolean;
  showCompliance?: boolean;
  sort?: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void };
  view?: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void };
}) {
  const moreId = useId();
  const popRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const active = cardQueryActive(query);
  const moreFilters =
    query.region !== 'all' ||
    query.industry !== 'all' ||
    query.compliance !== 'all' ||
    moreStatuses.includes(query.status) ||
    query.band === 'mid' ||
    query.band === 'low';
  const primaryScores = SCORE_BANDS.filter((band) => ['all', 'high', 'none'].includes(band.value));
  const moreScores = SCORE_BANDS.filter((band) => band.value === 'mid' || band.value === 'low');

  useEffect(() => {
    if (!moreOpen) return;
    const panel = popRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel?.contains(target) || moreButtonRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [moreOpen]);

  const set = (patch: Partial<CardQuery>) => onQuery({ ...query, ...patch });

  return (
    <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{searchLabel}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            ref={inputRef as Ref<HTMLInputElement> | undefined}
            value={query.q}
            onChange={(event) => set({ q: event.target.value })}
            placeholder={placeholder}
            className={`${focus} min-h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-950 placeholder:text-slate-400`}
          />
        </label>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <p className="text-sm font-semibold text-slate-600" aria-live="polite">
            {count}
          </p>
          {active ? (
            <button
              type="button"
              onClick={() =>
                onQuery({ q: '', status: 'all', region: 'all', industry: 'all', band: 'all', compliance: 'all' })
              }
              className={`${focus} inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-[#0077b6]`}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label={`Filter ${noun}s`}>
        <Pill pressed={query.status === 'all'} onClick={() => set({ status: 'all' })}>
          All
        </Pill>
        {statuses.map((status) => (
          <Pill key={status} pressed={query.status === status} onClick={() => set({ status })}>
            {titleLabel(status)}
          </Pill>
        ))}
        {showScore ? (
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:inline-block" aria-hidden />
        ) : null}
        {showScore
          ? primaryScores.map((band) => (
              <Pill key={band.value} pressed={query.band === band.value} onClick={() => set({ band: band.value })}>
                {band.label}
              </Pill>
            ))
          : null}
        <div className="relative">
          <button
            ref={moreButtonRef}
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((open) => !open)}
            className={`${focus} inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
              moreFilters
                ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950'
                : 'border-slate-200 bg-white text-slate-700 hover:border-[#00b4d8]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            More
          </button>
          {moreOpen ? (
            <div
              ref={popRef}
              id={moreId}
              role="dialog"
              aria-label="More filters"
              className="absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:left-auto sm:right-0"
            >
              <div className="space-y-4">
                {moreStatuses.length ? (
                  <Group label="Status">
                    {moreStatuses.map((status) => (
                      <Pill key={status} pressed={query.status === status} onClick={() => set({ status })}>
                        {titleLabel(status)}
                      </Pill>
                    ))}
                  </Group>
                ) : null}
                {regions.length ? (
                  <Group label="Region">
                    <Pill pressed={query.region === 'all'} onClick={() => set({ region: 'all' })}>
                      All
                    </Pill>
                    {regions.map((region) => (
                      <Pill key={region} pressed={query.region === region} onClick={() => set({ region })}>
                        {region}
                      </Pill>
                    ))}
                  </Group>
                ) : null}
                {industries.length ? (
                  <Group label="Industry">
                    <Pill pressed={query.industry === 'all'} onClick={() => set({ industry: 'all' })}>
                      All
                    </Pill>
                    {industries.map((industry) => (
                      <Pill key={industry} pressed={query.industry === industry} onClick={() => set({ industry })}>
                        {industry}
                      </Pill>
                    ))}
                  </Group>
                ) : null}
                {showScore ? (
                  <Group label="Score">
                    {moreScores.map((band) => (
                      <Pill key={band.value} pressed={query.band === band.value} onClick={() => set({ band: band.value })}>
                        {band.label}
                      </Pill>
                    ))}
                  </Group>
                ) : null}
                {showCompliance ? (
                  <Group label="Compliance">
                    <Pill pressed={query.compliance === 'all'} onClick={() => set({ compliance: 'all' })}>
                      All
                    </Pill>
                    <Pill pressed={query.compliance === 'certified'} onClick={() => set({ compliance: 'certified' })}>
                      Certified
                    </Pill>
                    <Pill pressed={query.compliance === 'missing'} onClick={() => set({ compliance: 'missing' })}>
                      Missing
                    </Pill>
                  </Group>
                ) : null}
                {sort ? (
                  <Group label="Sort">
                    {sort.options.map((option) => (
                      <Pill
                        key={option.value}
                        pressed={sort.value === option.value}
                        onClick={() => sort.onChange(option.value)}
                      >
                        {option.label}
                      </Pill>
                    ))}
                  </Group>
                ) : null}
                {view ? (
                  <Group label="Layout">
                    {view.options.map((option) => (
                      <Pill
                        key={option.value}
                        pressed={view.value === option.value}
                        onClick={() => view.onChange(option.value)}
                      >
                        {option.label}
                      </Pill>
                    ))}
                  </Group>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
