import type { Metadata } from 'next';
import {
  listStoreProducts,
  resolveStoreCompany,
} from '@/lib/storefront/catalog';
import { groupProductsByCategory } from '@/lib/storefront/categories';
import { CategorySection, StoreHero } from '@/components/storefront/StoreShell';
import { StoreOrderProvider } from '@/components/storefront/StoreOrderCart';

type Props = {
  params: Promise<{ companySlug: string }> | { companySlug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const company = await resolveStoreCompany(p.companySlug);
  return {
    title: company
      ? `${company.tradingName} catalogue`
      : 'Catalogue',
    robots: { index: false, follow: true },
  };
}

export default async function StoreEmbedPage({ params }: Props) {
  const p = await Promise.resolve(params);
  const company = await resolveStoreCompany(p.companySlug);
  if (!company) {
    return (
      <div className="p-8 text-center text-sm text-slate-600">
        Catalogue not found.
      </div>
    );
  }
  const products = await listStoreProducts(company);
  const grouped = groupProductsByCategory(products);
  return (
    <StoreOrderProvider
      companySlug={company.slug}
      companyName={company.tradingName}
      attr={{ source: 'website-embed' }}
    >
      <div className="min-h-[100dvh] bg-slate-50">
        <StoreHero company={company} attr={{ source: 'website-embed' }} />
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <p className="font-bold text-slate-800">Catalog coming soon</p>
              <p className="text-sm text-slate-500 mt-1">
                Products appear here once the seller publishes selected items
                on their storefront.
              </p>
            </div>
          ) : (
            grouped.map(({ category, products: items }) => (
              <CategorySection
                key={category}
                category={category}
                products={items}
                companySlug={company.slug}
                attr={{ source: 'website-embed' }}
              />
            ))
          )}
        </div>
      </div>
    </StoreOrderProvider>
  );
}
