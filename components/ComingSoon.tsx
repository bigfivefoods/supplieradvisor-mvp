'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Construction,
  type LucideIcon,
  Sparkles,
} from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description?: string;
  backHref?: string;
  features?: string[];
  /** Preferred live path when this feature lives elsewhere */
  primaryHref?: string;
  primaryLabel?: string;
  icon?: LucideIcon;
}

/**
 * Light roadmap / bridge page — never dark, always Lucide + brand cyan.
 * Prefer linking to a live module over dead-end stubs.
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
    <div className="sa-page">
      <div className="px-1 sm:px-2 max-w-3xl mx-auto pt-2">
        <div className="inline-flex items-center gap-2 bg-sky-50 text-[#0077b6] px-3.5 py-1.5 rounded-full text-xs font-bold mb-6 border border-cyan-100">
          <Construction className="w-3.5 h-3.5" />
          Roadmap · light workspace
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-slate-900 mb-3">
          {title}
        </h1>
        <p className="text-base sm:text-lg text-neutral-600 mb-8 leading-relaxed">
          {description}
        </p>

        <div className="sa-panel p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="sa-icon-chip">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">What you can expect</h2>
              <p className="text-neutral-500 text-sm leading-relaxed">
                Same design system as Operations, Manufacturing, Distribution, and Inventory —
                light, bright, and Lucide-native.
              </p>
            </div>
          </div>

          <ul className="space-y-2.5 mb-8">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-neutral-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00b4d8] shrink-0" />
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
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            {!primaryHref && (
              <Link
                href="/dashboard"
                className="btn-primary !py-3 !px-6 text-sm inline-flex items-center gap-2"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
