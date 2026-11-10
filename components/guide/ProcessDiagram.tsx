'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  Ban,
  BookOpen,
  ChartColumn,
  CircleMinus,
  ClipboardList,
  EyeOff,
  FilePen,
  BadgeCheck,
  Box,
  Building2,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  Dumbbell,
  Factory,
  Files,
  Flag,
  GitBranch,
  GraduationCap,
  Hammer,
  Handshake,
  HardHat,
  HeartPulse,
  KeyRound,
  Landmark,
  Leaf,
  Link2,
  ListChecks,
  Lock,
  MapPin,
  Mountain,
  NotebookPen,
  Package,
  Percent,
  Receipt,
  RotateCcw,
  Scale,
  Send,
  Shield,
  Ship,
  Stamp,
  Tractor,
  Truck,
  Undo2,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import {
  DESKTOP_FLOW_WIDTH,
  estimateNodeHeight,
  flowLanes,
  layoutFlow,
  readingOrder,
  resolveEdges,
  stepNumbers,
  type FlowLayout,
} from '@/lib/help/flow-model';
import type { GuideEdge, GuideFlowIcon, GuideNode } from '@/lib/help/types';

const ICONS: Record<GuideFlowIcon, LucideIcon> = {
  'book-open': BookOpen,
  'file-pen': FilePen,
  scale: Scale,
  send: Send,
  wallet: Wallet,
  'rotate-ccw': RotateCcw,
  receipt: Receipt,
  ban: Ban,
  landmark: Landmark,
  'arrow-left-right': ArrowLeftRight,
  'link-2': Link2,
  'eye-off': EyeOff,
  percent: Percent,
  'clipboard-list': ClipboardList,
  lock: Lock,
  stamp: Stamp,
  'circle-minus': CircleMinus,
  'chart-column': ChartColumn,
  files: Files,
  'git-branch': GitBranch,
  users: Users,
  'user-round': UserRound,
  'hard-hat': HardHat,
  truck: Truck,
  leaf: Leaf,
  hammer: Hammer,
  'calendar-days': CalendarDays,
  'clipboard-check': ClipboardCheck,
  package: Package,
  'map-pin': MapPin,
  shield: Shield,
  'building-2': Building2,
  dumbbell: Dumbbell,
  tractor: Tractor,
  mountain: Mountain,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  warehouse: Warehouse,
  factory: Factory,
  ship: Ship,
  box: Box,
  'badge-check': BadgeCheck,
  flag: Flag,
  'circle-check': CircleCheck,
  handshake: Handshake,
  'list-checks': ListChecks,
  'notebook-pen': NotebookPen,
  'key-round': KeyRound,
  'undo-2': Undo2,
};

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077b6]';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ariaLabel(node: GuideNode, number: number | undefined, edges: GuideEdge[], byId: Map<string, GuideNode>): string {
  const next = edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => {
      const target = byId.get(edge.to)?.label ?? edge.to;
      return edge.label ? `${edge.label}: ${target}` : target;
    })
    .join('; ');
  return [
    node.kind === 'decision' ? 'Decision' : `Step ${number ?? ''}`,
    node.label,
    node.lane,
    node.hint,
    node.books,
    next ? `Next: ${next}` : '',
    node.anchor ? 'Shows this part of the guide' : '',
  ]
    .filter((part) => part && String(part).trim())
    .join('. ');
}

function openFeature(anchor: string) {
  const el = document.getElementById(`guide-${anchor}`);
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

function StepFace({ node, number, showLane }: { node: GuideNode; number?: number; showLane?: boolean }) {
  const Icon = node.icon ? ICONS[node.icon] : null;
  return (
    <span className="flex h-full flex-col px-3 py-2.5">
      <span className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-black tracking-[0.14em] text-[#00b4d8]">{number ? pad(number) : ''}</span>
        {Icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00b4d8]/10 text-[#00b4d8]">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="mt-1 block text-[13px] font-black leading-tight text-slate-900">{node.label}</span>
      {node.hint ? <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">{node.hint}</span> : null}
      {node.books ? (
        <span className="mt-1.5 flex gap-1 text-[10px] leading-snug text-slate-600">
          <BookOpen className="mt-px h-3 w-3 shrink-0 text-[#00b4d8]" aria-hidden />
          <span>{node.books}</span>
        </span>
      ) : null}
      {showLane && node.lane ? (
        <span className="mt-1.5 inline-flex w-fit rounded-full bg-[#00b4d8]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#0077b6]">
          {node.lane}
        </span>
      ) : null}
    </span>
  );
}

function Hit({
  node,
  number,
  edges,
  byId,
  className,
  style,
  children,
}: {
  node: GuideNode;
  number?: number;
  edges: GuideEdge[];
  byId: Map<string, GuideNode>;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const label = ariaLabel(node, number, edges, byId);
  if (!node.anchor) {
    return (
      <div className={className} style={style} role="group" aria-label={label}>
        {children}
      </div>
    );
  }
  return (
    <a
      href={`#guide-${node.anchor}`}
      className={className}
      style={style}
      aria-label={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openFeature(node.anchor as string);
      }}
    >
      {children}
    </a>
  );
}

function Diamond({ label, gradientId }: { label: string; gradientId: string }) {
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" aria-hidden>
        <polygon className="sa-flow-diamond" points="50,2 98,50 50,98 2,50" fill={`url(#${gradientId})`} strokeWidth="1.7" />
      </svg>
      <span className="pointer-events-none absolute inset-[24%] flex items-center justify-center text-center text-[12px] font-black leading-tight text-slate-900">
        {label}
      </span>
    </>
  );
}

const cardClass =
  'sa-flow-hit block h-full w-full rounded-2xl border border-cyan-200/90 bg-gradient-to-br from-white to-cyan-50 text-left shadow-sm';

/**
 * Illustrated process diagram for a how-to guide.
 * Desktop wraps into swimlane bands. Narrow screens use a vertical timeline.
 */
export function ProcessDiagram({
  title,
  nodes,
  edges,
}: {
  title?: string;
  nodes: GuideNode[];
  edges?: GuideEdge[];
}) {
  const rawId = useId().replace(/:/g, '');
  const shellRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef(new Map<string, HTMLDivElement>());
  const showLane = flowLanes(nodes).length > 1;
  const [layout, setLayout] = useState<FlowLayout>(() =>
    layoutFlow({
      nodes,
      edges,
      width: DESKTOP_FLOW_WIDTH,
      heights: Object.fromEntries(
        nodes.filter((node) => node.kind !== 'decision').map((node) => [node.id, estimateNodeHeight(node, showLane)])
      ),
    })
  );
  const resolved = useMemo(() => resolveEdges(nodes, edges), [nodes, edges]);
  const ordered = useMemo(() => readingOrder(nodes, resolved), [nodes, resolved]);
  const numbers = useMemo(() => stepNumbers(ordered), [ordered]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    let frame = 0;
    const measure = () => {
      const width = shell.clientWidth;
      if (width < 280) return;
      const heights: Record<string, number> = {};
      for (const node of nodes) {
        if (node.kind === 'decision') continue;
        const el = measureRefs.current.get(node.id);
        if (el && el.offsetHeight > 0) heights[node.id] = el.offsetHeight;
      }
      const next = layoutFlow({ nodes, edges, width, heights });
      setLayout((prev) => {
        if (
          prev &&
          prev.width === next.width &&
          prev.height === next.height &&
          prev.columns === next.columns &&
          prev.boxes.every((box, index) => {
            const other = next.boxes[index];
            return other && box.id === other.id && box.x === other.x && box.y === other.y && box.h === other.h;
          })
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(shell);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [nodes, edges]);

  const listId = `${rawId}-text`;
  const gradientId = `${rawId}-diamond`;

  return (
    <section
      className="sa-flow-shell relative overflow-hidden rounded-3xl border border-cyan-100/80 bg-gradient-to-br from-white via-white to-cyan-50/70 p-4 shadow-sm sm:p-5"
      aria-labelledby={title ? `${rawId}-title` : undefined}
      aria-describedby={listId}
      data-flow-diagram
    >
      <style>{FLOW_CSS}</style>
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e7f9fd" />
          </linearGradient>
        </defs>
      </svg>
      {title ? (
        <p id={`${rawId}-title`} className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          {title}
        </p>
      ) : null}
      {layout?.showLanes ? (
        <div className="mb-3 hidden flex-wrap gap-2 md:flex">
          {layout.laneNames.map((lane, index) => (
            <span key={lane} className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
              <span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-[#00b4d8]' : 'bg-slate-400'}`} aria-hidden />
              {lane}
            </span>
          ))}
        </div>
      ) : null}

      <ol id={listId} className="sr-only">
        {ordered.map((node) => (
          <li key={node.id}>{ariaLabel(node, numbers.get(node.id), resolved, byId)}</li>
        ))}
      </ol>

      <div className="pointer-events-none absolute -left-[12000px] top-0 w-[176px]" aria-hidden>
        {nodes.map((node) =>
          node.kind === 'decision' ? null : (
            <div
              key={node.id}
              ref={(el) => {
                if (el) measureRefs.current.set(node.id, el);
                else measureRefs.current.delete(node.id);
              }}
              className="mb-2 w-[176px] rounded-2xl border border-transparent"
            >
              <StepFace node={node} number={numbers.get(node.id)} showLane={showLane} />
            </div>
          )
        )}
      </div>

      <MobileTimeline ordered={ordered} edges={resolved} byId={byId} numbers={numbers} gradientId={gradientId} />

      <div ref={shellRef} className="relative hidden min-h-[8rem] md:block" data-flow-desktop data-laid={layout ? '1' : '0'}>
        {layout ? (
          <DesktopCanvas
            layout={layout}
            nodes={nodes}
            numbers={numbers}
            edges={resolved}
            byId={byId}
            markerId={rawId}
            gradientId={gradientId}
            ordered={ordered}
          />
        ) : null}
      </div>
    </section>
  );
}

function MobileTimeline({
  ordered,
  edges,
  byId,
  numbers,
  gradientId,
}: {
  ordered: GuideNode[];
  edges: GuideEdge[];
  byId: Map<string, GuideNode>;
  numbers: Map<string, number>;
  gradientId: string;
}) {
  const indexOf = new Map(ordered.map((node, index) => [node.id, index]));
  return (
    <div className="md:hidden" data-flow-mobile>
      <ol className="relative space-y-3 pl-1">
        <span className="absolute bottom-3 left-[18px] top-3 w-px bg-[#00b4d8]/40" aria-hidden />
        {ordered.map((node, index) => {
          const incoming = edges.filter((edge) => {
            if (edge.to !== node.id || !edge.label) return false;
            return (indexOf.get(edge.from) ?? 0) < index;
          });
          const returns = edges.filter((edge) => edge.from === node.id && (indexOf.get(edge.to) ?? 0) < index);
          const delay = { animationDelay: `${Math.min(index, 14) * 40}ms` };
          return (
            <li key={node.id} className="relative pl-10">
              <span className="absolute left-[11px] top-5 h-3.5 w-3.5 rounded-full border-2 border-[#00b4d8] bg-white" aria-hidden />
              {incoming.length ? (
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#0077b6]">
                  {incoming.map((edge) => edge.label).join(' · ')}
                </p>
              ) : null}
              {node.kind === 'decision' ? (
                <Hit
                  node={node}
                  edges={edges}
                  byId={byId}
                  className={`sa-flow-node sa-flow-hit relative mx-auto block h-[124px] w-[124px] ${FOCUS}`}
                  style={delay}
                >
                  <Diamond label={node.label} gradientId={gradientId} />
                </Hit>
              ) : (
                <Hit
                  node={node}
                  number={numbers.get(node.id)}
                  edges={edges}
                  byId={byId}
                  className={`${cardClass} sa-flow-node ${FOCUS}`}
                  style={delay}
                >
                  <StepFace node={node} number={numbers.get(node.id)} />
                </Hit>
              )}
              {node.lane ? <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#0077b6]">{node.lane}</p> : null}
              {returns.map((edge) => (
                <p key={`${edge.to}-${edge.label ?? ''}`} className="mt-1 text-[11px] font-semibold text-[#0077b6]">
                  ↩ {edge.label ? `${edge.label} → ` : ''}
                  {byId.get(edge.to)?.label}
                </p>
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DesktopCanvas({
  layout,
  nodes,
  numbers,
  edges,
  byId,
  markerId,
  gradientId,
  ordered,
}: {
  layout: FlowLayout;
  nodes: GuideNode[];
  numbers: Map<string, number>;
  edges: GuideEdge[];
  byId: Map<string, GuideNode>;
  markerId: string;
  gradientId: string;
  ordered: GuideNode[];
}) {
  const nodeOf = new Map(nodes.map((node) => [node.id, node]));
  const order = new Map(ordered.map((node, index) => [node.id, index]));
  return (
    <div className="relative" style={{ height: layout.height }}>
      {layout.lanes.map((lane) => (
        <div
          key={`${lane.band}-${lane.lane}`}
          className={`absolute rounded-2xl ${!lane.lane ? 'bg-slate-50/70' : lane.laneIndex % 2 === 1 ? 'bg-slate-100/80' : 'bg-[#00b4d8]/[0.06]'}`}
          style={{ left: lane.x, top: lane.y, width: lane.w, height: lane.h }}
        >
          {lane.lane ? (
            <span className="flex h-full w-[108px] items-center gap-1.5 px-3 text-[11px] font-bold leading-tight text-slate-700">
              <span className={`h-2 w-2 shrink-0 rounded-full ${lane.laneIndex === 0 ? 'bg-[#00b4d8]' : 'bg-slate-400'}`} aria-hidden />
              {lane.lane}
            </span>
          ) : null}
        </div>
      ))}

      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden>
        <defs>
          <marker id={`${markerId}-arrow`} viewBox="0 0 8 8" markerWidth="7" markerHeight="7" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#00b4d8" />
          </marker>
        </defs>
        {layout.routes.map((route) => (
          <path
            key={`${route.from}-${route.to}-${route.label ?? ''}`}
            d={route.d}
            fill="none"
            stroke="#00b4d8"
            strokeWidth="1.6"
            strokeDasharray={route.back ? '4 4' : undefined}
            markerEnd={`url(#${markerId}-arrow)`}
          />
        ))}
      </svg>

      {layout.routes.map((route) =>
        route.label ? (
          <span
            key={`label-${route.from}-${route.to}-${route.label}`}
            className="pointer-events-none absolute z-30 max-w-[6.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100 bg-white px-1.5 py-0.5 text-center text-[9px] font-bold leading-tight text-slate-600"
            style={{ left: route.labelX, top: route.labelY }}
          >
            {route.label}
          </span>
        ) : null
      )}

      {layout.boxes.map((box) => {
        const node = nodeOf.get(box.id);
        if (!node) return null;
        const delay = { animationDelay: `${Math.min(order.get(node.id) ?? 0, 16) * 35}ms` };
        return (
          <div key={node.id} className="sa-flow-node absolute z-40" style={{ left: box.x, top: box.y, width: box.w, height: box.h, ...delay }}>
            {node.kind === 'decision' ? (
              <Hit node={node} edges={edges} byId={byId} className={`relative block h-full w-full ${FOCUS}`}>
                <Diamond label={node.label} gradientId={gradientId} />
              </Hit>
            ) : (
              <Hit
                node={node}
                number={numbers.get(node.id)}
                edges={edges}
                byId={byId}
                className={`sa-flow-hit block h-full w-full rounded-2xl border text-left shadow-sm ${FOCUS} ${
                  node.lane && layout.laneNames[0] && node.lane !== layout.laneNames[0]
                    ? 'border-slate-200 bg-gradient-to-br from-white to-slate-50'
                    : 'border-cyan-200/90 bg-gradient-to-br from-white to-cyan-50'
                }`}
              >
                <StepFace node={node} number={numbers.get(node.id)} showLane={layout.showLanes} />
              </Hit>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FLOW_CSS = `
@keyframes saFlowIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
.sa-flow-node { animation: saFlowIn 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.sa-flow-hit:hover { border-color: #00b4d8; box-shadow: 0 10px 24px -16px rgba(0, 180, 216, 0.9); }
.sa-flow-diamond { stroke: #00b4d8; }
html.dark .sa-flow-diamond { fill: #121820; }
@media (prefers-reduced-motion: reduce) {
  .sa-flow-node, .sa-flow-hit:hover {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
@media print {
  .sa-flow-node, .sa-flow-hit:hover {
    animation: none !important;
    transform: none !important;
    box-shadow: none !important;
  }
  .sa-flow-shell { box-shadow: none !important; background: #fff !important; }
}
`;
