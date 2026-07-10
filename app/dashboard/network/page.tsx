import { redirect } from 'next/navigation';

export default function NetworkRedirect() {
  redirect('/dashboard/connections');
}
