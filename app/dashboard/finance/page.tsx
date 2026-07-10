import { redirect } from 'next/navigation';

/** Finance hub merged into live Accounting module — avoid duplicate ComingSoon trees. */
export default function FinanceRedirect() {
  redirect('/dashboard/accounting');
}
