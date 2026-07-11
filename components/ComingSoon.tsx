'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Construction,
  type LucideIcon,
  Sparkles,
} from 'lucide-react';
import {
  CommandWorkbenchBand,
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';

interface ComingSoonProps {
  title: string;
  description?: string;
  backHref?: string;
  features?: string[];
  primaryHref?: string;
  primaryLabel?: string;
  icon?: LucideIcon;
}

/**
 * Command-center roadmap page — light workbench band + principles.
 */
export default function ComingSoon({
  title,
  description = 'This capability is on the SupplierAdvisor roadmap. Use the linked live modules today for the same outcomes.',
  backHref = '/dashboard',
  features = [
    'Live company workspace data from Supabase',
    'Role-based access and audit trails',
    'On-chain records where trade requires trust',
  ],
  primaryHref,
  primaryLabel = 'Open live workspace',
  icon: Icon = Sparkles,
}: ComingSoonProps) {
  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref={backHref}
        backLabel="Command"
        eyebrow="Roadmap workbench"
        title={title}
        titleAccent="Command"
        description={description}
        action={
          primaryHref ? (
            <Link
              href={primaryHref}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              {primaryLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          ) : undefined
        }
      />

      <CommandWorkbenchBand
        pill="Live roadmap · bridge not dead-end"
        title={
          <>
            Same chrome. <span className="text-[#00b4d8]">Coming online.</span>
          </>
        }
        description="This workbench will share the command-center design system — telemetry, process rail, and membership-scoped data."
        stats={[
          { label: 'Status', value: 'Soon', valueClass: 'text-amber-600' },
          { label: 'Design', value: 'Live', valueClass: 'text-emerald-600' },
          { label: 'Scope', value: 'Co.', valueClass: 'text-[#00b4d8]' },
        ]}
      />

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-sky-100 text-[#0077b6]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-sky-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
              <Construction className="h-3 w-3" /> Roadmap
            </div>
            <h2 className="text-lg font-black text-slate-900">What you can expect</h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              Same language as Operations, Manufacturing, and Distribution — light, precise, Lucide.
            </p>
          </div>
        </div>

        <ul className="mb-6 space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-neutral-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4d8]" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3">
          {primaryHref && (
            <Link
              href={primaryHref}
              className="btn-primary !py-3 !px-6 text-sm inline-flex items-center gap-2"
            >
              {primaryLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <Link
            href={backHref}
            className="btn-secondary !py-3 !px-6 text-sm inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to command
          </Link>
        </div>
      </div>
    </RelationshipPage>
  );
}
