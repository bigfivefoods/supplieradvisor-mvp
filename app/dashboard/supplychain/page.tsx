import { redirect } from 'next/navigation';

/** Legacy demo page → live Operations control tower. */
export default function SupplyChainRedirect() {
  redirect('/dashboard/operations');
}
