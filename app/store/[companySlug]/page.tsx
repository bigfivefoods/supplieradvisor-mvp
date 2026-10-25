import type { Metadata } from 'next';
import Link from 'next/link';
import { StoreHero } from '@/components/storefront/StoreShell';
import { StoreOrderProvider } from '@/components/storefront/StoreOrderCart';
import StoreLiveCatalog from '@/components/storefront/StoreLiveCatalog';
import { storeEmbedPath } from '@/lib/storefront/public-store';
import { loadCachedStoreCatalog } from '@/lib/storefront/public-cache';
import { PUBLIC_PAGE_REVALIDATE_SECONDS } from '@/lib/seo/public-page-cache';

type Props = {
  params: Promise<{ companySlug: string }> | { companySlug: string };
};

export const revalidate = PUBLIC_PAGE_REVALIDATE_SECONDS;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const catalog = await loadCachedStoreCatalog(p.companySlug);
  if (!catalog) return { title: 'Store not found' };
  const company = catalog.company;
  return {
    title: `${company.tradingName} — order on SupplierAdvisor®`,
    description:
      company.shortDescription ||
      company.tagline ||
      `Order ${company.tradingName} products on the verified trade network.`,
  };
}

export default async function StoreHomePage({ params }: Props) {
  const p = await Promise.resolve(params);
  const catalog = await loadCachedStoreCatalog(p.companySlug);
  if (!catalog) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-black">Store not found</h1>
        <p className="text-sm text-slate-600 mt-2">
          No public storefront for “{p.companySlug}”.
        </p>
        <Link href="/store/big-five-foods" className="inline-block mt-6 text-[#0077b6] font-bold">
          Try Big Five Foods →
        </Link>
      </div>
    );
  }

  const { company, products } = catalog;
  const embedPath = storeEmbedPath(company.slug);

  return (
    <StoreOrderProvider companySlug={company.slug} companyName={company.tradingName}>
      <div>
        <StoreHero company={company} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <StoreLiveCatalog companySlug={company.slug} products={products} />

          <footer className="mt-14 pt-8 border-t border-slate-200 text-xs text-slate-500 space-y-2">
            <p>
              <strong className="text-slate-700">Seller of record:</strong> {company.tradingName} on
              SupplierAdvisor®. Quotes and orders appear in the seller workspace (Customers → Quotes).
            </p>
            <p>
              <strong className="text-slate-700">Quote SLA:</strong> we aim to respond within 1 business
              day. NSNP / institutional lines are quote-first — not instant public checkout.
            </p>
            <p>
              <strong className="text-slate-700">Returns / damage:</strong> report within 48 hours of
              delivery with photos and order/quote reference. Contact the seller via your SupplierAdvisor®
              workspace or the email on your quote confirmation.
            </p>
            <p>
              <Link href="/" className="text-[#0077b6] font-semibold hover:underline">
                supplieradvisor.com
              </Link>
              {' · '}
              Catalog, stock, and invoices live here — not a second order book on marketing sites.
            </p>
            <p>
              <strong className="text-slate-700">Put this catalogue on your website:</strong> iframe{' '}
              <code className="rounded bg-slate-100 px-1">{embedPath}</code>
            </p>
          </footer>
        </div>
      </div>
    </StoreOrderProvider>
  );
}
