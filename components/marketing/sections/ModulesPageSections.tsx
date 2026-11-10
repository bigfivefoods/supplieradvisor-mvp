import Link from 'next/link';
import { INDUSTRIES } from '@/lib/marketing/industries';

export default function ModulesPageSections() {
  return (
    <>
      <section id="modules" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">Module bands</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ['Core OS', 'Trade, operations, quality, finance, and intelligence.'],
            ['Sector', 'Manufacturing, distribution, and container workflows.'],
            ['Industry', 'Advisor packs for vertical operations.'],
            ['Bespoke', 'Special combinations for specialist operations.'],
          ].map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-black text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="modules-industry" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">Industry modules</h2>
        <p className="mt-3 text-slate-600">Choose the industry packs that match your operation.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {INDUSTRIES.map((industry) => (
            <Link key={industry.slug} href={`/industries/${industry.slug}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {industry.pack ?? industry.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
