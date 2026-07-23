'use client';

import { Building2, Network, Landmark, Users } from 'lucide-react';
import {
  type StructureNode,
  type StructureTree,
  formatOwnership,
} from '@/lib/business/group-structure';

type Props = {
  trees: StructureTree[];
  /** Optional empty-state message */
  emptyHint?: string;
  className?: string;
  /** Compact for embedding in panels */
  compact?: boolean;
};

const TYPE_ICON: Record<string, typeof Building2> = {
  holding: Landmark,
  association: Users,
  group: Network,
  franchise: Building2,
  joint_venture: Network,
  affiliate: Building2,
  other: Building2,
};

/**
 * Visual org / group structure: parent at top, children below with optional ownership %.
 */
export default function GroupStructureDiagram({
  trees,
  emptyHint = 'No active group structure yet. Invite or join companies to see the diagram.',
  className = '',
  compact = false,
}: Props) {
  if (!trees.length) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-8 text-center text-sm text-neutral-500 ${className}`}
      >
        <Network className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
        {emptyHint}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {trees.map((tree, i) => {
        const Icon = TYPE_ICON[tree.link_type] || Network;
        return (
          <div
            key={`${tree.link_type}-${tree.root.id}-${i}`}
            className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white ${
              compact ? '' : 'shadow-sm'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-slate-50/80 px-4 py-2.5">
              <Icon className="h-4 w-4 text-[#0077b6]" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                {tree.label}
              </span>
              <span className="text-[11px] text-neutral-500">
                {tree.parentLabel} → {tree.childLabel}
                {tree.showOwnership ? ' · shareholding %' : ''}
              </span>
            </div>
            <div className={`overflow-x-auto ${compact ? 'px-3 py-5' : 'px-4 py-8 sm:px-6'}`}>
              <div className="flex min-w-min justify-center">
                <TreeNode
                  node={tree.root}
                  showOwnership={tree.showOwnership}
                  isRoot
                  childLabel={tree.childLabel}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TreeNode({
  node,
  showOwnership,
  isRoot = false,
  childLabel,
}: {
  node: StructureNode;
  showOwnership: boolean;
  isRoot?: boolean;
  childLabel: string;
}) {
  const hasChildren = node.children.length > 0;
  const own = formatOwnership(node.ownership_pct);

  return (
    <div className="flex flex-col items-center">
      {/* Edge badge from parent (not on root) */}
      {!isRoot && (
        <div className="flex flex-col items-center">
          <div className="h-4 w-px bg-slate-300" />
          {(own || node.role_label) && (
            <div className="relative z-[1] my-0.5 flex flex-col items-center gap-0.5">
              {own && showOwnership ? (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-violet-900 shadow-sm">
                  {own}
                </span>
              ) : null}
              {!showOwnership || node.role_label ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  {node.role_label || childLabel}
                </span>
              ) : null}
            </div>
          )}
          {!own && !node.role_label && showOwnership && (
            <span className="my-0.5 rounded-full border border-dashed border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-400">
              % n/a
            </span>
          )}
          <div className="h-3 w-px bg-slate-300" />
        </div>
      )}

      <NodeCard node={node} />

      {hasChildren && (
        <>
          <div className="h-4 w-px bg-slate-300" />
          {/* Horizontal bar + children */}
          <div className="relative flex items-start justify-center">
            {node.children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-slate-300"
                style={{
                  left: '12.5%',
                  right: '12.5%',
                }}
              />
            )}
            <div
              className={`flex ${
                node.children.length > 1 ? 'gap-4 sm:gap-6' : 'gap-0'
              } pt-0`}
            >
              {node.children.map((child) => (
                <div key={child.id} className="flex flex-col items-center min-w-[7.5rem] max-w-[11rem]">
                  {node.children.length > 1 && (
                    <div className="h-3 w-px bg-slate-300" />
                  )}
                  <TreeNode
                    node={child}
                    showOwnership={showOwnership}
                    childLabel={childLabel}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NodeCard({ node }: { node: StructureNode }) {
  return (
    <div
      className={`w-full min-w-[7.5rem] max-w-[11rem] rounded-2xl border-2 px-3 py-2.5 text-center shadow-sm ${
        node.isSelf
          ? 'border-[#00b4d8] bg-gradient-to-b from-sky-50 to-white ring-2 ring-[#00b4d8]/20'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
        <Building2
          className={`h-4 w-4 ${node.isSelf ? 'text-[#0077b6]' : 'text-slate-400'}`}
        />
      </div>
      <p
        className={`text-xs font-bold leading-snug line-clamp-2 ${
          node.isSelf ? 'text-[#0a2540]' : 'text-slate-800'
        }`}
        title={node.name}
      >
        {node.name}
      </p>
      {node.isSelf && (
        <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-[#00b4d8]">
          You
        </p>
      )}
      {node.subtitle && !node.isSelf && (
        <p className="mt-0.5 text-[10px] text-neutral-500 line-clamp-1">
          {node.subtitle}
        </p>
      )}
      {node.isSelf && node.subtitle && (
        <p className="mt-0.5 text-[10px] text-neutral-500 line-clamp-1">
          {node.subtitle}
        </p>
      )}
    </div>
  );
}
