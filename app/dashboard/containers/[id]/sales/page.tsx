import { redirect } from 'next/navigation';

/** Sales & stock for an outlet live under inventory. */
export default async function ContainerSalesRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/containers/${encodeURIComponent(id)}/inventory`);
}
