import { redirect } from 'next/navigation';

/** Coach diary now lives on the gym calendar. */
export default function CoachCalendarRedirectPage() {
  redirect('/dashboard/fitgraph/calendar');
}
