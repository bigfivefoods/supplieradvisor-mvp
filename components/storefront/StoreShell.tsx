import Link from 'next/link';
import { ShieldCheck, Building2 } from 'lucide-react';
import type { StoreAttribution, StoreCompany, StoreProduct } from '@/lib/storefront/types';
import {
  attributionToQuery,
  loginWithReturn,
  onboardingWithPartner,
  storePath,
} from '@/lib/storefront/attribution';
import {
  CATEGORY_BLURBS,
  categoryAnchorId,
} from '@/lib/storefront/categories';

export function StoreHero({
  company,
  attr,
}: {
  company: StoreCompany;
  attr?: StoreAttribution;
}) {
  const verified =
    String(company.verificationStatus || '').toLowerCase() === 'verified';
  return (
    <div className="bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-emerald-600 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
          Verified network storefront
        </p>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt=""
                className="w-14 h-14 rounded-2xl bg-white object-contain p-1"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
                <Building2 className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight truncate">
                {company.tradingName}
              </h1>
              <p className="text-sm text-white/90 mt-1">
                {company.tagline}
              </p>
            </div>
          </div>
          {verified ? (
            <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified on SupplierAdvisor®
            </span>
          ) : null}
        </div>
        {company.shortDescription ? (
          <p className="mt-4 max-w-2xl text-sm text-white/90 leading-relaxed">
            {company.shortDescription}
          </p>
        ) : null}
        {attr?.source ? (
          <p className="mt-3 text-[11px] text-white/70">
            Via {attr.source}
            {attr.ref ? ` · ${attr.ref}` : ''}
            {attr.channel ? ` · ${attr.channel}` : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CategorySection({
  category,
  products,
  companySlug,
  attr,
}: {
  category: string;
  products: StoreProduct[];
  companySlug: string;
  attr?: StoreAttribution;
}) {
  const id = categoryAnchorId(category);
  const blurb = CATEGORY_BLURBS[category];
  const isNsnp = /nsnp|institutional/i.test(category);

  return (
    <section
      id={id}
      className="scroll-mt-24"
      aria-labelledby={`${id}-heading`}
    >
      <div
        className={`rounded-2xl px-4 py-4 sm:px-5 sm:py-5 mb-4 border ${
          isNsnp
            ? 'bg-gradient-to-r from-violet-50 via-white to-emerald-50/60 border-violet-100'
            : 'bg-white border-slate-200/90 shadow-sm'
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0077b6]">
              Category
            </p>
            <h2
              id={`${id}-heading`}
              className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5"
            >
              {category}
            </h2>
            {blurb ? (
              <p className="text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
                {blurb}
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
              isNsnp
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {products.length} product{products.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard
            key={String(product.id)}
            companySlug={companySlug}
            product={product}
            attr={attr}
            hideCategory
          />
        ))}
      </div>
    </section>
  );
}

export function ProductCard({
  companySlug,
  product,
  attr,
  hideCategory = false,
}: {
  companySlug: string;
  product: StoreProduct;
  attr?: StoreAttribution;
  /** When true, omit category line (section header already shows it) */
  hideCategory?: boolean;
}) {
  const key = product.externalRef || product.sku || String(product.id);
  const href = storePath(companySlug, key, {
    ...attr,
    product: product.externalRef || attr?.product,
    sku: product.sku || attr?.sku,
    name: product.name,
  });

  return (
    <Link
      href={href}
      className="group rounded-3xl border border-slate-200 bg-white overflow-hidden hover:border-[#00b4d8]/50 hover:shadow-md transition-all flex flex-col"
    >
      {/* Full pack visible — contain on light plate, no crop */}
      <div className="relative flex h-24 sm:h-28 items-center justify-center bg-[#f8f7f5] px-2.5 py-2 border-b border-black/[0.06]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full max-w-[7rem] object-contain object-center"
          />
        ) : (
          <span className="text-slate-300 text-sm font-semibold">
            {product.category || 'Product'}
          </span>
        )}
        {product.badges?.[0] ? (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
            {product.badges[0]}
          </span>
        ) : null}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {!hideCategory ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {product.category || (product.channels || []).join(' · ')}
          </p>
        ) : (product.channels || []).length ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {(product.channels || []).join(' · ')}
          </p>
        ) : null}
        <h3 className="font-bold text-slate-900 mt-0.5 group-hover:text-[#0077b6] leading-snug">
          {product.name}
        </h3>
        {product.packSize ? (
          <p className="text-xs text-slate-500 mt-1">Pack: {product.packSize}</p>
        ) : null}
        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div>
            {product.priceOnRequest || product.price == null ? (
              <p className="text-sm font-bold text-amber-800">Price on request</p>
            ) : (
              <p className="text-sm font-black text-slate-900">
                {product.currency} {Number(product.price).toLocaleString()}
              </p>
            )}
            <p className="text-[10px] font-semibold text-slate-500">
              {product.inStock === false ? 'Made to order' : 'In stock / available'}
            </p>
            {product.quoteFirst ? (
              <p className="text-[10px] font-semibold text-violet-700">
                Quote-first (institutional)
              </p>
            ) : null}
          </div>
          <span className="text-[11px] font-bold text-[#0077b6]">View →</span>
        </div>
      </div>
    </Link>
  );
}

export function TradeCtas({
  company,
  product,
  attr,
  returnPath,
}: {
  company: StoreCompany;
  product?: StoreProduct | null;
  attr?: StoreAttribution;
  returnPath: string;
}) {
  const qs = attributionToQuery(attr || {});
  const loginHref = loginWithReturn(returnPath);
  const onboardHref = onboardingWithPartner({
    partner: company.slug,
    intent: 'order',
    source: attr?.source,
    product: product?.externalRef || attr?.product,
    sku: product?.sku || attr?.sku,
    channel: attr?.channel ? String(attr.channel) : null,
  });

  const productKey = product
    ? product.externalRef || product.sku || String(product.id)
    : null;

  const poHref =
    company.id > 0
      ? `/dashboard/suppliers/po?peer=${company.id}${
          product
            ? `&q=${encodeURIComponent(product.name)}&sku=${encodeURIComponent(
                product.sku || ''
              )}`
            : ''
        }&source=${encodeURIComponent(attr?.source || 'storefront')}`
      : loginHref;

  const quoteFirst = product?.quoteFirst || attr?.channel === 'institutional';

  return (
    <div className="space-y-3">
      {quoteFirst ? (
        <p className="text-xs text-violet-900 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
          <strong>Institutional / NSNP:</strong> request a quote on the verified
          network — not anonymous instant checkout.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {quoteFirst ? (
          <a
            href={`#quote-form`}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-[#00b4d8] text-white text-sm font-bold hover:bg-[#0096c7]"
          >
            Request quote
          </a>
        ) : (
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-[#00b4d8] text-white text-sm font-bold hover:bg-[#0096c7]"
          >
            Login to trade
          </Link>
        )}
        <Link
          href={poHref}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-800 hover:border-[#00b4d8]"
        >
          {quoteFirst ? 'Order after quote' : 'Raise PO / order'}
        </Link>
        <Link
          href={onboardHref}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-[#0077b6] hover:bg-sky-50"
        >
          Join as business
        </Link>
      </div>
      <p className="text-[11px] text-slate-500">
        Orders and stock live in {company.tradingName}&apos;s SupplierAdvisor®
        workspace — system of record for trade.
        {productKey ? ` · Ref ${productKey}` : ''}
        {qs ? ` · ${qs.replace('?', '')}` : ''}
      </p>
    </div>
  );
}
