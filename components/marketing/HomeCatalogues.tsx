import { CatalogueGrid } from '@/components/catalogues/CatalogueGrid';

export default function HomeCatalogues() {
  return (
    <section id="catalogues" className="sa-anchor border-t border-slate-200 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] sa-text-brand-on-light">
            Catalogues
          </p>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
            Download the catalogue for your industry.
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Each PDF opens with the SupplierAdvisor® platform overview, then shows the industry pack in detail.
          </p>
        </div>
        <CatalogueGrid />
        <p className="mt-10 text-center">
          <a
            href="/catalogues"
            className="inline-flex min-h-11 items-center text-sm font-bold text-[#0077b6] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a]"
          >
            See all catalogues →
          </a>
        </p>
      </div>
    </section>
  );
}
