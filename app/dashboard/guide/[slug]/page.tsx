import Link from 'next/link';
import { CurriculumChapter } from '@/components/guide/CurriculumChapter';
import { ModuleOffNote } from '@/components/guide/ModuleOffNote';
import { SectionTraining } from '@/components/guide/GuideChrome';
import { HelpGuide } from '@/components/help/HelpGuide';
import { GUIDE_SECTIONS } from '@/lib/guide/curriculum';
import { resolveGuideRoute } from '@/lib/help/guide-route';
import { MODULE_GUIDES } from '@/lib/help/module-guides';

export function generateStaticParams() {
  const slugs = new Set<string>();
  for (const guide of MODULE_GUIDES) slugs.add(guide.id);
  for (const section of GUIDE_SECTIONS) slugs.add(section.slug);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = resolveGuideRoute(slug);
  const name = resolved?.guide?.name || resolved?.section?.title;
  return {
    title: name ? `${name} guide · SupplierAdvisor®` : 'Guide · SupplierAdvisor®',
    robots: { index: false, follow: false },
  };
}

export default async function GuideSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = resolveGuideRoute(slug);
  if (!resolved) {
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

  if (!resolved.guide) {
    return <CurriculumChapter slug={slug} />;
  }

  const section = resolved.section;
  return (
    <HelpGuide
      guide={resolved.guide}
      handbook={
        section ? (
          <>
            {section.moduleId ? <ModuleOffNote moduleId={section.moduleId} title={section.title} /> : null}
            <SectionTraining section={section} embedded />
          </>
        ) : null
      }
    />
  );
}
