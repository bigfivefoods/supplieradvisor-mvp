import { redirect } from 'next/navigation';

/** View portal lives on Website & apps → Preview. */
export default function FitgraphPortalRedirectPage() {
  redirect('/dashboard/fitgraph/website?tab=preview');
}
