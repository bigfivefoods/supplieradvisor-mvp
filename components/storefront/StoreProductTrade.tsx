'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TradeCtas } from '@/components/storefront/StoreShell';
import QuoteRequestForm from '@/components/storefront/QuoteRequestForm';
import { mergeStoreAttribution, storePath } from '@/lib/storefront/attribution';
import type { StoreCompany, StoreProduct } from '@/lib/storefront/types';

function StoreProductTradeInner({
  company,
  product,
}: {
  company: StoreCompany;
  product: StoreProduct;
}) {
  const sp = useSearchParams();
  const attr = mergeStoreAttribution(undefined, sp.toString() ? `?${sp.toString()}` : '');
  const productKey = product.externalRef || product.sku || String(product.id);
  const returnPath = storePath(company.slug, productKey, attr);

  if (product.ctaHref) {
    return (
      <a
        href={product.ctaHref}
        className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#0077b6] px-5 text-sm font-black text-white"
      >
        {product.ctaLabel || 'Open shop'}
      </a>
    );
  }

  return (
    <>
      <TradeCtas company={company} product={product} attr={attr} returnPath={returnPath} />
      <div className="pt-2">
        <QuoteRequestForm companySlug={company.slug} product={product} attr={attr} />
      </div>
    </>
  );
}

export default function StoreProductTrade(props: {
  company: StoreCompany;
  product: StoreProduct;
}) {
  return (
    <Suspense fallback={null}>
      <StoreProductTradeInner {...props} />
    </Suspense>
  );
}
