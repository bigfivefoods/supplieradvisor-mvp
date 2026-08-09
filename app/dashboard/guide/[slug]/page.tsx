'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getGuideSection,
  filterGuideSections,
  GUIDE_ALWAYS_VISIBLE_SLUGS,
} from '@/lib/guide/curriculum';
import { SectionTraining } from '@/components/guide/GuideChrome';
import { useCompanyRole } from '@/lib/business/useCompanyRole';

export default function GuideSectionPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const section = getGuideSection(slug);
  const { isCompanyModuleEnabled, loading } = useCompanyRole();
  const visible = filterGuideSections(isCompanyModuleEnabled);
  const idx = visible.findIndex((s) => s.slug === slug);
  const prev = idx > 0 ? visible[idx - 1] : undefined;
  const next =
    idx >= 0 && idx < visible.length - 1 ? visible[idx + 1] : undefined;

  // Section exists but module is off for this company
  const gatedOff =
    section &&
    section.moduleId &&
    !GUIDE_ALWAYS_VISIBLE_SLUGS.has(section.slug) &&
    !isCompanyModuleEnabled(section.moduleId);

  if (!section) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center px-4">
        <h1 className="text-xl font-black text-slate-900 mb-2">Module not found</h1>
        <p className="text-sm text-neutral-500 mb-6">
          That training section does not exist. Pick a module from the guide home.
        </p>
        <Link href="/dashboard/guide" className="btn-primary !py-2.5 !px-6 text-sm">
          Open system guide
        </Link>
      </div>
    );
  }

  if (!loading && gatedOff) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center px-4">
        <h1 className="text-xl font-black text-slate-900 mb-2">
          Module not enabled
        </h1>
        <p className="text-sm text-neutral-500 mb-2">
          <strong>{section.title}</strong> is not turned on for this company, so
          its training chapter is hidden.
        </p>
        <p className="text-xs text-neutral-400 mb-6">
          Enable it under Company → Modules to use the product and this guide.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/my-business/modules"
            className="btn-primary !py-2.5 !px-6 text-sm"
          >
            Edit modules
          </Link>
          <Link
            href="/dashboard/guide"
            className="btn-secondary !py-2.5 !px-6 text-sm"
          >
            Back to guide
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SectionTraining
      section={section}
      prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
      next={next ? { slug: next.slug, title: next.title } : undefined}
    />
  );
}
