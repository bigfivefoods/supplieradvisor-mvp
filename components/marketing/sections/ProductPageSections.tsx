import Link from 'next/link';
import HomeRecent from '@/components/marketing/HomeRecent';
import ProductVideo from '@/components/marketing/ProductVideo';
import ReplaceStackDiagram from '@/components/marketing/ReplaceStackDiagram';

export default function ProductPageSections({ tourHref }: { tourHref: string }) {
  return (
    <>
      <ProductVideo tourHref={tourHref} />
      <ReplaceStackDiagram tourHref={tourHref} />
      <section id="systems" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">Systems that work together</h2>
        <p className="mt-3 text-slate-600">
          SupplierAdvisor® keeps trade, operations, quality, and finance in one shared system so your team works from the same facts.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/modules" className="font-semibold text-[#0077b6] underline underline-offset-4">View modules</Link>
          <Link href="/catalogues" className="font-semibold text-[#0077b6] underline underline-offset-4">Browse catalogues</Link>
        </div>
      </section>
      <HomeRecent tourHref={tourHref} />
    </>
  );
}
