import { redirect } from 'next/navigation';

/** Contractor ops consolidated under network contractors list. */
export default async function ContainerContractorRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(
    `/dashboard/containers/contractors?containerId=${encodeURIComponent(id)}`
  );
}
