import { redirect } from 'next/navigation';

/** Insights → Management report (canonical pack lives on /report) */
export default function ManagementRedirectPage() {
  redirect('/dashboard/fitgraph/report#management-report');
}
