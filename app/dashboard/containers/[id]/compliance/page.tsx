import { redirect } from 'next/navigation';

/** Compliance evidence lives on quality + container RIAD. */
export default async function ContainerComplianceRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(
    `/dashboard/containers/riad-log?containerId=${encodeURIComponent(id)}`
  );
}
