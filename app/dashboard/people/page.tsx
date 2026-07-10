import { redirect } from 'next/navigation';

/** People HR stubs → live Team workspace under My Business. */
export default function PeopleRedirect() {
  redirect('/dashboard/my-business/team');
}
