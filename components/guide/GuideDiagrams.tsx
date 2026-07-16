'use client';

import { ArrowDown, ArrowRight, GitBranch, Layers, Network } from 'lucide-react';
import type { FlowNode } from '@/lib/guide/curriculum';

const TONES: Record<string, string> = {
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
  violet: 'border-violet-200 bg-violet-50 text-violet-950',
  rose: 'border-rose-200 bg-rose-50 text-rose-950',
  slate: 'border-slate-200 bg-slate-50 text-slate-900',
};

/** Multi-layer OS stack — identity → network → ops → money → trust → insight */
export function LayerStackDiagram({
  layers,
  title = 'Platform architecture',
}: {
  title?: string;
  layers: Array<{ name: string; body: string; tone?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-[#00b4d8]" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          {title}
        </p>
      </div>
      <div className="space-y-2">
        {layers.map((layer, i) => (
          <div key={layer.name}>
            <div
              className={`rounded-2xl border px-4 py-3 ${
                TONES[layer.tone || 'cyan']
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[11px] font-black text-slate-700 border border-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-black">{layer.name}</div>
                  <p className="text-xs opacity-80 mt-0.5 leading-relaxed">
                    {layer.body}
                  </p>
                </div>
              </div>
            </div>
            {i < layers.length - 1 && (
              <div className="flex justify-center py-0.5 text-neutral-300">
                <ArrowDown className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two-column trade loop: buyer | supplier */
export function TradeLoopDiagram() {
  const buyer = [
    'Select company',
    'Connect supplier',
    'Catalogue pick lines',
    'Send PO',
    'Receive + OTIFEF',
    'Rate partner',
  ];
  const supplier = [
    'Publish finished goods',
    'Price agreement (opt.)',
    'Inbound PO alert',
    'Accept / decline',
    'Fulfil / ship',
    'Earn trust score',
  ];
  return (
    <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-sky-50 p-4 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-4 h-4 text-violet-600" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          B2B trade loop (integration)
        </p>
      </div>
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        <div className="rounded-2xl border border-sky-200 bg-white p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-sky-700 mb-3">
            Buyer (you procure)
          </div>
          <ol className="space-y-2">
            {buyer.map((s, i) => (
              <li key={s} className="flex gap-2 text-xs text-slate-800">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-100 text-[10px] font-black text-sky-800">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="hidden md:flex flex-col items-center justify-center gap-1 text-neutral-300 px-1">
          <ArrowRight className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase text-neutral-400 writing-mode-vertical">
            Network
          </span>
          <ArrowRight className="w-5 h-5 rotate-180" />
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-white p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-3">
            Supplier (they sell)
          </div>
          <ol className="space-y-2">
            {supplier.map((s, i) => (
              <li key={s} className="flex gap-2 text-xs text-slate-800">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-black text-emerald-800">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-slate-600 leading-relaxed text-center max-w-2xl mx-auto">
        PO lines come from the <strong>supplier’s</strong> catalogue (agreed prices +
        sellable inventory) — not the buyer’s warehouse. Sales quotes use{' '}
        <strong>your</strong> finished goods.
      </p>
    </div>
  );
}

/** Money cycle diagram */
export function MoneyFlowDiagram() {
  const nodes = [
    { l: 'Quote', t: 'Offer' },
    { l: 'Order', t: 'Commit' },
    { l: 'Invoice', t: 'Bill' },
    { l: 'Bank', t: 'Allocate' },
    { l: 'Journal', t: 'Post' },
    { l: 'Close', t: 'Lock' },
  ];
  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-4 sm:p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 mb-3">
        Flow of money
      </p>
      <div className="flex flex-wrap items-center gap-1.5 justify-center">
        {nodes.map((n, i) => (
          <div key={n.l} className="flex items-center gap-1.5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center min-w-[4.5rem]">
              <div className="text-xs font-black text-emerald-950">{n.l}</div>
              <div className="text-[10px] text-emerald-800/70">{n.t}</div>
            </div>
            {i < nodes.length - 1 && (
              <ArrowRight className="w-4 h-4 text-emerald-300 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Principle cards grid */
export function PrinciplesGrid({
  principles,
  title = 'Module principles',
}: {
  principles: Array<{ title: string; body: string }>;
  title?: string;
}) {
  if (!principles?.length) return null;
  return (
    <div className="mb-10">
      {title ? (
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400 mb-3">
          {title}
        </h2>
      ) : null}
      <div className="grid sm:grid-cols-2 gap-3">
        {principles.map((p, i) => (
          <div
            key={p.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00b4d8]/10 text-[10px] font-black text-[#00b4d8]">
                {i + 1}
              </span>
              <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed pl-8">
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact module map for home */
export function ModuleMapStrip({
  items,
}: {
  items: Array<{ slug: string; title: string; tagline: string }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 overflow-x-auto">
      <div className="flex items-center gap-2 mb-3">
        <Network className="w-4 h-4 text-[#00b4d8]" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          Module map (click a card below to train)
        </p>
      </div>
      <div className="flex gap-2 min-w-max pb-1">
        {items.map((m, i) => (
          <div
            key={m.slug}
            className="flex items-center gap-1.5 shrink-0"
          >
            <div className="rounded-xl border border-white bg-white px-2.5 py-1.5 shadow-sm max-w-[7.5rem]">
              <div className="text-[9px] font-black text-neutral-400">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="text-[11px] font-bold text-slate-900 truncate">
                {m.title}
              </div>
            </div>
            {i < items.length - 1 && (
              <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Swimlane-style critical path with optional branches */
export function SwimlaneFlow({
  title,
  lanes,
}: {
  title?: string;
  lanes: Array<{ name: string; nodes: FlowNode[] }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
      {title && (
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          {title}
        </p>
      )}
      {lanes.map((lane) => (
        <div key={lane.name}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {lane.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lane.nodes.map((n, i) => (
              <div key={n.id} className="flex items-center gap-1">
                <span
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                    TONES[n.tone || 'slate']
                  }`}
                >
                  {n.label}
                  {n.hint ? (
                    <span className="font-medium opacity-70"> · {n.hint}</span>
                  ) : null}
                </span>
                {i < lane.nodes.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
