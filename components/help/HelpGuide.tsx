import Link from 'next/link';
import { ArrowLeft, ArrowRight, CircleHelp, MapPin } from 'lucide-react';
import { ProcessFlow } from '@/components/guide/ProcessFlow';
import type { ModuleGuide } from '@/lib/help/types';

export function HelpGuide({ guide }: { guide: ModuleGuide }) {
  return (
    <div className="mx-auto max-w-5xl pb-16">
      <Link
        href="/dashboard/help"
        className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-[#0077b6]"
      >
        <ArrowLeft className="h-4 w-4 text-[#00b4d8]" />
        All guides
      </Link>

      <header className="mb-8">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
          SupplierAdvisor® · how this works
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {guide.name} <span className="text-[#00b4d8]">guide</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">{guide.purpose}</p>
      </header>

      <section className="mb-8 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50 p-5 shadow-sm sm:p-6">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#0077b6]">Who can use it</p>
        <div className="flex flex-wrap gap-2">
          {guide.roles.map((role) => (
            <span
              key={role}
              className="rounded-full border border-cyan-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
            >
              {role}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{guide.outcome}</p>
      </section>

      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-neutral-400">Process flow</h2>
      <div className="mb-10">
        <ProcessFlow
          title={`${guide.name} flow`}
          nodes={guide.flow.map((node) => ({
            id: node.id,
            label: node.label,
            hint: node.hint,
            tone: 'cyan' as const,
          }))}
        />
      </div>

      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
        Feature by feature
      </h2>
      <div className="mb-10 space-y-4">
        {guide.features.map((feature, index) => (
          <article
            key={feature.id}
            id={`guide-${feature.id}`}
            className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm"
          >
            <div className="flex flex-col gap-2 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="mr-2 text-[10px] font-black text-[#00b4d8]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="inline text-base font-bold text-slate-900">{feature.name}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">{feature.who}</p>
              </div>
              {feature.href ? (
                <Link
                  href={feature.href}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0077b6] hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
            <div className="space-y-5 px-5 py-4">
              <p className="text-sm leading-relaxed text-neutral-600">{feature.summary}</p>

              {feature.prerequisites.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                    Before you start
                  </h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                    {feature.prerequisites.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                  Do this
                </h4>
                <ol className="space-y-2">
                  {feature.steps.map((step, stepIndex) => (
                    <li key={`${feature.id}-${stepIndex}`} className="flex gap-3 text-sm text-slate-800">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#00b4d8]/10 text-[10px] font-black text-[#00b4d8]">
                        {stepIndex + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {feature.behind.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                    Behind the scenes
                  </h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                    {feature.behind.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {feature.errors.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                    If you see an error
                  </h4>
                  <ul className="space-y-3">
                    {feature.errors.map((error) => (
                      <li key={error.message} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                        <p className="font-semibold text-slate-900">{error.message}</p>
                        <p className="mt-1 leading-relaxed text-slate-600">{error.fix}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {feature.faqs.length > 0 ? (
                <div className="space-y-2">
                  {feature.faqs.map((faq) => (
                    <details key={faq.q} className="rounded-2xl border border-neutral-100 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-bold text-slate-900">{faq.q}</summary>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</p>
                    </details>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
        <CircleHelp className="h-4 w-4 text-[#00b4d8]" />
        Common questions
      </h2>
      <div className="space-y-3">
        {guide.faqs.map((faq) => (
          <details key={faq.q} className="rounded-3xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">{faq.q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
