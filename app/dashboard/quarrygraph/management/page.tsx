import { redirect } from 'next/navigation';

/** Govern → Management report (canonical pack lives on /report) */
export default function ManagementRedirectPage() {
  redirect('/dashboard/quarrygraph/report#management-report');
}
