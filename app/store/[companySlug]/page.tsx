import type { Metadata } from 'next';
import Link from 'next/link';
import {
  listStoreProducts,
  resolveStoreCompany,
} from '@/lib/storefront/catalog';
import { parseStoreAttribution } from '@/lib/storefront/attribution';
import { ProductCard, StoreHero } from '@/components/storefront/StoreShell';
import StoreClientFilters from '@/components/storefront/StoreClientFilters';

type Props = {
  params: Promise<{ companySlug: string }> | { companySlug: string };
  searchParams:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const company = await resolveStoreCompany(p.companySlug);
  if (!company) return { title: 'Store not found' };
  return {
    title: `${company.tradingName} — order on SupplierAdvisor®`,
    description:
      company.shortDescription ||
      company.tagline ||
      `Order ${company.tradingName} products on the verified trade network.`,
  };
}

export default async function StoreHomePage({ params, searchParams }: Props) {
  const p = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const attr = parseStoreAttribution(qs);
  const channel =
    (typeof sp?.channel === 'string' ? sp.channel : null) || attr.channel;
  const q = typeof sp?.q === 'string' ? sp.q : null;

  const company = await resolveStoreCompany(p.companySlug);
  if (!company) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-black">Store not found</h1>
        <p className="text-sm text-slate-600 mt-2">
          No public storefront for “{p.companySlug}”.
        </p>
        <Link
          href="/store/big-five-foods"
          className="inline-block mt-6 text-[#0077b6] font-bold"
        >
          Try Big Five Foods →
        </Link>
      </div>
    );
  }

  // Deep link with product param but no product path → try redirect message
  const deepProduct = attr.product || attr.sku;
  let products = await listStoreProducts(company, {
    channel: channel ? String(channel) : null,
    q,
  });

  // If product param present, pin that product first
  if (deepProduct) {
    const key = String(deepProduct).toLowerCase();
    products = [...products].sort((a, b) => {
      const aHit =
        a.externalRef === key ||
        a.sku?.toLowerCase() === key ||
        String(a.id) === key
          ? 0
          : 1;
      const bHit =
        b.externalRef === key ||
        b.sku?.toLowerCase() === key ||
        String(b.id) === key
          ? 0
          : 1;
      return aHit - bHit;
    });
  }

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[])
  );

  return (
    <div>
      <StoreHero company={company} attr={attr} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <StoreClientFilters
          companySlug={company.slug}
          initialChannel={channel ? String(channel) : ''}
          initialQ={q || ''}
          categories={categories}
          productCount={products.length}
        />

        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="font-bold text-slate-800">Catalog coming soon</p>
            <p className="text-sm text-slate-500 mt-1">
              Products will appear here once the seller publishes their
              storefront catalog.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {products.map((product) => (
              <ProductCard
                key={String(product.id)}
                companySlug={company.slug}
                product={product}
                attr={attr}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
