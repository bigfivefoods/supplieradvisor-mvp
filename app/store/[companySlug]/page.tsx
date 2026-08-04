import type { Metadata } from 'next';
import Link from 'next/link';
import {
  listStoreProducts,
  resolveStoreCompany,
} from '@/lib/storefront/catalog';
import { parseStoreAttribution } from '@/lib/storefront/attribution';
import { CategorySection, StoreHero } from '@/components/storefront/StoreShell';
import { groupProductsByCategory } from '@/lib/storefront/categories';
import StoreClientFilters from '@/components/storefront/StoreClientFilters';
import MultiProductTray from '@/components/storefront/MultiProductTray';

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

  // Deep link with product param but no product path → pin product
  const deepProduct = attr.product || attr.sku;
  // Multi-SKU handoff: ?products=id1,id2&intent=cart
  const multiRaw =
    typeof sp?.products === 'string'
      ? sp.products
      : Array.isArray(sp?.products)
        ? sp.products.join(',')
        : '';
  const multiKeys = multiRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

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

  // Multi-product: pin shortlist order first
  if (multiKeys.length) {
    const rank = new Map(
      multiKeys.map((k, i) => [k.toLowerCase(), i] as const)
    );
    products = [...products].sort((a, b) => {
      const ak =
        rank.get(String(a.externalRef || '').toLowerCase()) ??
        rank.get(String(a.sku || '').toLowerCase()) ??
        999;
      const bk =
        rank.get(String(b.externalRef || '').toLowerCase()) ??
        rank.get(String(b.sku || '').toLowerCase()) ??
        999;
      return ak - bk;
    });
  }

  const grouped = groupProductsByCategory(products);
  const categories = grouped.map((g) => g.category);

  return (
    <div>
      <StoreHero company={company} attr={attr} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {multiKeys.length > 0 ? (
          <MultiProductTray
            companySlug={company.slug}
            products={products}
            selectedKeys={multiKeys}
            attr={attr}
          />
        ) : null}

        <StoreClientFilters
          companySlug={company.slug}
          initialChannel={channel ? String(channel) : ''}
          initialQ={q || ''}
          categories={categories}
          productCount={products.length}
        />

        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center mt-6">
            <p className="font-bold text-slate-800">Catalog coming soon</p>
            <p className="text-sm text-slate-500 mt-1">
              Products will appear here once the seller publishes their
              storefront catalog.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-12 sm:space-y-14">
            {grouped.map(({ category, products: items }) => (
              <CategorySection
                key={category}
                category={category}
                products={items}
                companySlug={company.slug}
                attr={attr}
              />
            ))}
          </div>
        )}

        <footer className="mt-14 pt-8 border-t border-slate-200 text-xs text-slate-500 space-y-2">
          <p>
            <strong className="text-slate-700">Seller of record:</strong>{' '}
            {company.tradingName} on SupplierAdvisor®. Quotes and orders appear
            in the seller workspace (Customers → Quotes).
          </p>
          <p>
            <strong className="text-slate-700">Quote SLA:</strong> we aim to
            respond within 1 business day. NSNP / institutional lines are
            quote-first — not instant public checkout.
          </p>
          <p>
            <strong className="text-slate-700">Returns / damage:</strong>{' '}
            report within 48 hours of delivery with photos and order/quote
            reference. Contact the seller via your SupplierAdvisor® workspace
            or the email on your quote confirmation.
          </p>
          <p>
            <Link href="/" className="text-[#0077b6] font-semibold hover:underline">
              supplieradvisor.com
            </Link>
            {' · '}
            Catalog, stock, and invoices live here — not a second order book on
            marketing sites.
          </p>
        </footer>
      </div>
    </div>
  );
}
