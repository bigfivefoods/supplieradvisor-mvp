import { redirect } from 'next/navigation';

/** Performance lives on metrics + impact until a dedicated outlet scorecard ships. */
export default async function ContainerPerformanceRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/containers/metrics?containerId=${encodeURIComponent(id)}`);
}
