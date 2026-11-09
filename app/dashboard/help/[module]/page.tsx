import { notFound } from 'next/navigation';
import { HelpGuide } from '@/components/help/HelpGuide';
import { getModuleGuide, MODULE_GUIDES } from '@/lib/help/module-guides';

export function generateStaticParams() {
  return MODULE_GUIDES.map((guide) => ({ module: guide.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const guide = getModuleGuide(module);
  return {
    title: guide ? `${guide.name} guide · SupplierAdvisor®` : 'Guide · SupplierAdvisor®',
    robots: { index: false, follow: false },
  };
}

export default async function ModuleHelpPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const guide = getModuleGuide(module);
  if (!guide) notFound();
  return <HelpGuide guide={guide} />;
}
