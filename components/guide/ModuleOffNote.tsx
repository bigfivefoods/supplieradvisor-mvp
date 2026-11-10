'use client';

import Link from 'next/link';
import { useCompanyRole } from '@/lib/business/useCompanyRole';

/** Shown when a how-to is open for a module this company has switched off. */
export function ModuleOffNote({ moduleId, title }: { moduleId: string; title: string }) {
  const { isCompanyModuleEnabled, loading } = useCompanyRole();
  if (loading || isCompanyModuleEnabled(moduleId)) return null;
  return (
    <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      <p className="font-black text-slate-900">Module not enabled</p>
      <p className="mt-1 leading-relaxed">
        <strong>{title}</strong> is not turned on for this company. This how-to still opens. Enable it under Company → Modules to use the product screens.
      </p>
      <Link href="/dashboard/my-business/modules" className="mt-3 inline-flex text-xs font-bold text-[#0077b6] underline">
        Edit modules
      </Link>
    </div>
  );
}
