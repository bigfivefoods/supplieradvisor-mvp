import { redirect } from 'next/navigation';

/** Procurement merged into Suppliers (SRM) + Operations procure workbench. */
export default function ProcurementRedirect() {
  redirect('/dashboard/suppliers');
}
