import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  getStoreProduct,
  listStoreProducts,
  resolveStoreCompany,
} from '@/lib/storefront/catalog';
import {
  parseStoreAttribution,
  storePath,
} from '@/lib/storefront/attribution';
import { TradeCtas } from '@/components/storefront/StoreShell';
import QuoteRequestForm from '@/components/storefront/QuoteRequestForm';

type Props = {
  params:
    | Promise<{ companySlug: string; productKey: string }>
    | { companySlug: string; productKey: string };
  searchParams:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const company = await resolveStoreCompany(p.companySlug);
  if (!company) return { title: 'Product' };
  const product = await getStoreProduct(company, p.productKey);
  if (!product) return { title: company.tradingName };
  return {
    title: `${product.name} · ${company.tradingName}`,
    description:
      product.description ||
      `Order ${product.name} from ${company.tradingName} on SupplierAdvisor®`,
  };
}

export default async function StoreProductPage({ params, searchParams }: Props) {
  const p = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  // Merge product key into attribution if not set
  if (!qs.get('product')) qs.set('product', p.productKey);
  const attr = parseStoreAttribution(qs);

  const company = await resolveStoreCompany(p.companySlug);
  if (!company) notFound();

  const product = await getStoreProduct(company, p.productKey);
  if (!product) {
    // Brief says: missing product → store home, not hard 404
    redirect(storePath(company.slug, null, attr));
  }

  const related = (await listStoreProducts(company, {
    channel: attr.channel ? String(attr.channel) : null,
  }))
    .filter((x) => String(x.id) !== String(product.id))
    .slice(0, 4);

  const returnPath = storePath(
    company.slug,
    product.externalRef || product.sku || String(product.id),
    attr
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-xs text-slate-500 mb-4 flex flex-wrap gap-1">
        <Link href={`/store/${company.slug}`} className="text-[#0077b6] font-semibold">
          {company.tradingName}
        </Link>
        <span>/</span>
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden aspect-square relative">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-50 to-emerald-50 text-slate-400 font-semibold">
              {product.category || company.tradingName}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            {product.badges.length ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {product.badges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5"
                  >
                    {b}
                  </span>
                ))}
              </div>
            ) : null}
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {product.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {company.tradingName}
              {product.sku ? ` · SKU ${product.sku}` : ''}
              {product.packSize ? ` · ${product.packSize}` : ''}
            </p>
          </div>

          {product.description ? (
            <p className="text-sm text-slate-700 leading-relaxed">
              {product.description}
            </p>
          ) : null}

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            {product.priceOnRequest || product.price == null ? (
              <p className="text-lg font-black text-amber-900">Price on request</p>
            ) : (
              <p className="text-lg font-black text-slate-900">
                {product.currency} {Number(product.price).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              {product.inStock === false
                ? 'Made to order / check lead time'
                : 'In stock / available'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Channels: {product.channels.join(', ') || 'trade'}
            </p>
          </div>

          <TradeCtas
            company={company}
            product={product}
            attr={attr}
            returnPath={returnPath}
          />

          <div className="pt-2">
            <QuoteRequestForm
              companySlug={company.slug}
              product={product}
              attr={attr}
            />
          </div>
        </div>
      </div>

      {related.length ? (
        <div className="mt-14">
          <h2 className="text-lg font-black mb-4">More from {company.tradingName}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((r) => {
              const key = r.externalRef || r.sku || String(r.id);
              return (
                <Link
                  key={String(r.id)}
                  href={storePath(company.slug, key, attr)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#00b4d8] transition-colors"
                >
                  <p className="font-bold text-sm text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {r.packSize || r.category}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
