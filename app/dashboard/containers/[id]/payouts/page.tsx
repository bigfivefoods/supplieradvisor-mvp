import { redirect } from 'next/navigation';

/** Payouts managed at contractor / reseller level for now. */
export default async function ContainerPayoutsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(
    `/dashboard/containers/contractors?containerId=${encodeURIComponent(id)}`
  );
}
