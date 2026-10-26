'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { CategorySection } from '@/components/storefront/StoreShell';
import StoreClientFilters from '@/components/storefront/StoreClientFilters';
import MultiProductTray from '@/components/storefront/MultiProductTray';
import { groupProductsByCategory } from '@/lib/storefront/categories';
import { mergeStoreAttribution } from '@/lib/storefront/attribution';
import { filterStoreProducts, pinStoreProducts } from '@/lib/storefront/filter-products';
import type { StoreProduct } from '@/lib/storefront/types';

function StoreLiveCatalogInner({
  companySlug,
  products,
}: {
  companySlug: string;
  products: StoreProduct[];
}) {
  const sp = useSearchParams();
  const attr = mergeStoreAttribution(undefined, sp.toString() ? `?${sp.toString()}` : '');
  const q = sp.get('q');
  const channel = typeof attr.channel === 'string' ? attr.channel : null;
  const multiKeys = (sp.get('products') || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const multiKey = multiKeys.join(',');
  const visible = useMemo(() => {
    const filtered = filterStoreProducts(products, { channel, q });
    return pinStoreProducts(filtered, {
      product: attr.product,
      sku: attr.sku,
      multiKeys: multiKey ? multiKey.split(',') : [],
    });
  }, [products, channel, q, attr.product, attr.sku, multiKey]);

  const grouped = groupProductsByCategory(visible);
  const categories = grouped.map((group) => group.category);

  return (
    <>
      {multiKeys.length > 0 ? (
        <MultiProductTray
          companySlug={companySlug}
          products={visible}
          selectedKeys={multiKeys}
          attr={attr}
        />
      ) : null}
      <StoreClientFilters
        companySlug={companySlug}
        initialChannel={channel || ''}
        initialQ={q || ''}
        categories={categories}
        productCount={visible.length}
      />
      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center mt-6">
          <p className="font-bold text-slate-800">
            {products.length === 0 ? 'Catalog coming soon' : 'No matching products'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {products.length === 0
              ? 'Products appear here once the seller publishes selected items on their storefront.'
              : 'Try another channel or search.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-12 sm:space-y-14">
          {grouped.map(({ category, products: items }) => (
            <CategorySection
              key={category}
              category={category}
              products={items}
              companySlug={companySlug}
              attr={attr}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function StoreLiveCatalog(props: {
  companySlug: string;
  products: StoreProduct[];
}) {
  return (
    <Suspense fallback={null}>
      <StoreLiveCatalogInner {...props} />
    </Suspense>
  );
}
