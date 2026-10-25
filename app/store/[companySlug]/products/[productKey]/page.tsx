import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { storePath } from '@/lib/storefront/attribution';
import { slugifyCompanyName } from '@/lib/seo/company-public';
import { StorePrice } from '@/components/storefront/StorePrice';
import { StoreProductAdd } from '@/components/storefront/StoreProductAdd';
import { StoreOrderProvider } from '@/components/storefront/StoreOrderCart';
import StoreProductTrade from '@/components/storefront/StoreProductTrade';
import { loadCachedStoreCatalog } from '@/lib/storefront/public-cache';
/** Literal required by Next.js segment config. Keep equal to PUBLIC_PAGE_REVALIDATE_SECONDS. */
export const revalidate = 3600;

type Props = {
  params:
    | Promise<{ companySlug: string; productKey: string }>
    | { companySlug: string; productKey: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const catalog = await loadCachedStoreCatalog(p.companySlug);
  const company = catalog?.company;
  if (!company) return { title: 'Product' };
  const product = (catalog?.products || []).find((item) => productMatches(item, p.productKey));
  if (!product) return { title: company.tradingName };
  return {
    title: `${product.name} · ${company.tradingName}`,
    description:
      product.description ||
      `Order ${product.name} from ${company.tradingName} on SupplierAdvisor®`,
  };
}

function productMatches(
  product: { id: number | string; sku: string | null; externalRef?: string | null; name: string },
  productKey: string
) {
  const key = String(productKey || '').trim().toLowerCase();
  if (!key) return false;
  const slug = slugifyCompanyName(product.name);
  return (
    String(product.id).toLowerCase() === key ||
    (product.sku || '').toLowerCase() === key ||
    (product.externalRef || '').toLowerCase() === key ||
    slug === key ||
    slug.includes(key)
  );
}

export default async function StoreProductPage({ params }: Props) {
  const p = await Promise.resolve(params);
  const catalog = await loadCachedStoreCatalog(p.companySlug);
  if (!catalog) notFound();
  const { company, products } = catalog;
  const product = products.find((item) => productMatches(item, p.productKey));
  if (!product) {
    redirect(storePath(company.slug));
  }

  const related = products.filter((item) => String(item.id) !== String(product.id)).slice(0, 4);

  return (
    <StoreOrderProvider
      companySlug={company.slug}
      companyName={company.tradingName}
    >
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-xs text-slate-500 mb-4 flex flex-wrap gap-1">
        <Link href={`/store/${company.slug}`} className="text-[#0077b6] font-semibold">
          {company.tradingName}
        </Link>
        <span>/</span>
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Full pack visible — contain, constrained so it doesn’t dominate */}
        <div className="rounded-3xl border border-slate-200 bg-[#f8f7f5] flex items-center justify-center p-6 sm:p-8 min-h-[280px] lg:min-h-[360px]">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="sa-product-photo w-full max-w-[360px] max-h-[420px] object-contain object-center"
            />
          ) : (
            <div className="flex items-center justify-center text-slate-400 font-semibold min-h-[160px]">
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

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <StorePrice product={product} size="lg" />
          </div>
          <StoreProductAdd product={product} />

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-600 font-semibold">
              {product.inStock === false
                ? 'Made to order / check lead time'
                : 'In stock / available'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Channels: {(product.channels || []).join(', ') || 'trade'}
            </p>
          </div>

          <StoreProductTrade company={company} product={product} />
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
                  href={storePath(company.slug, key)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#00b4d8] transition-colors"
                >
                  <p className="font-bold text-sm text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {r.packSize || r.category}
                  </p>
                  <div className="mt-2">
                    <StorePrice product={r} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
    </StoreOrderProvider>
  );
}
