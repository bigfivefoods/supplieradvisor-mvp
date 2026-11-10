import { permanentRedirect } from 'next/navigation';

export default async function ModuleHelpPage({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleId } = await params;
  permanentRedirect(`/dashboard/guide/${moduleId}`);
}
