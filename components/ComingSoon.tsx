'use client';

import Link from 'next/link';
import { ArrowLeft, Construction, Sparkles } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface ComingSoonProps {
  title: string;
  description?: string;
  backHref?: string;
  features?: string[];
}

export default function ComingSoon({
  title,
  description = 'This module is part of the SupplierAdvisor platform roadmap and is under active development.',
  backHref = '/dashboard',
  features = [
    'Live data from your company workspace',
    'Role-based access and audit trails',
    'On-chain records where applicable',
  ],
}: ComingSoonProps) {
  return (
    <div className="px-4 md:px-8 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-amber-100">
          <Construction className="w-4 h-4" />
          In development
        </div>

        <h1 className="font-black text-4xl md:text-5xl tracking-[-2px] text-[#00b4d8] mb-4">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-neutral-600 mb-10 leading-relaxed">
          {description}
        </p>

        <div className="bg-white border border-neutral-200 rounded-3xl p-8 md:p-10 shadow-sm">
          <div className="flex items-start gap-4 mb-8">
            <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
              <Sparkles className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">What you can expect</h2>
              <p className="text-neutral-600 text-sm">
                This area will ship with the same design system as the rest of your dashboard.
              </p>
            </div>
          </div>

          <ul className="space-y-3 mb-10">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-neutral-700"
              >
                <span className="mt-1.5 w-2 h-2 rounded-full bg-[#00b4d8] flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-neutral-200 hover:border-neutral-300 bg-white font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#00b4d8] hover:bg-[#0099b8] text-white font-semibold transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
