'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { GUIDE_SECTIONS, getGuideSection } from '@/lib/guide/curriculum';
import { SectionTraining } from '@/components/guide/GuideChrome';

export default function GuideSectionPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const section = getGuideSection(slug);
  const idx = GUIDE_SECTIONS.findIndex((s) => s.slug === slug);
  const prev = idx > 0 ? GUIDE_SECTIONS[idx - 1] : undefined;
  const next =
    idx >= 0 && idx < GUIDE_SECTIONS.length - 1 ? GUIDE_SECTIONS[idx + 1] : undefined;

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

  return (
    <SectionTraining
      section={section}
      prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
      next={next ? { slug: next.slug, title: next.title } : undefined}
    />
  );
}
