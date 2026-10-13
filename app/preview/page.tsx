import Link from 'next/link';

const LINKS = [
  { href: '/preview/dashboard', label: 'Command center' },
  { href: '/preview/crm', label: 'CRM' },
  { href: '/preview/srm', label: 'SRM' },
  { href: '/preview/po', label: 'Purchase orders' },
  { href: '/preview/inventory', label: 'Inventory' },
  { href: '/preview/ratings', label: 'Ratings' },
  { href: '/preview/sheq', label: 'SHEQ' },
];

export default function PreviewIndexPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
          SupplierAdvisor® · sample walkthrough · not saved
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Fixture screens</h1>
        <p className="mt-2 text-sm text-slate-600">
          These pages read sample rows in the browser. Nothing is written to SupplierAdvisor®.
        </p>
        <ul className="mt-6 space-y-2">
          {LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold hover:border-[#00b4d8]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
