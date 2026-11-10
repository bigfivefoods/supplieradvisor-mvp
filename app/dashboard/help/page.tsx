import Link from 'next/link';
import { MODULE_GUIDES } from '@/lib/help/module-guides';

export const metadata = {
  title: 'How this works · SupplierAdvisor®',
  robots: { index: false, follow: false },
};

export default function HelpIndexPage() {
  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="mb-8">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
          SupplierAdvisor®
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          How this <span className="text-[#00b4d8]">works</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
          One guide for every module in the sidebar. Each guide says what the module is for, who can open it, and the steps on the real screens. SupplierAdvisor® does not put sample company rows in these guides.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {MODULE_GUIDES.map((guide) => (
          <li key={guide.id}>
            <Link
              href={`/dashboard/help/${guide.id}`}
              className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-[#00b4d8]"
            >
              <span className="text-base font-black text-slate-900">{guide.name}</span>
              <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{guide.purpose}</span>
              <span className="mt-3 text-xs font-bold text-[#0077b6]">
                {guide.features.length} steps
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
