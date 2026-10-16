import type { Metadata } from 'next';
import Link from 'next/link';
import LandingNav from '@/components/marketing/LandingNav';
import SiteFooter from '@/components/marketing/SiteFooter';
import { CatalogueGrid } from '@/components/catalogues/CatalogueGrid';
import { marketingMetadata } from '@/lib/seo/metadata';
import { HOME_SHARE_CARD } from '@/lib/seo/share-cards';

export const metadata: Metadata = marketingMetadata({
  path: '/catalogues',
  title: 'Catalogues · SupplierAdvisor®',
  absoluteTitle: true,
  description: 'Download the SupplierAdvisor® and industry pack catalogues as PDF.',
  image: HOME_SHARE_CARD,
});

export default function CataloguesPage() {
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav />
      <main className="mx-auto max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-10">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <Link href="/" className="font-semibold text-[#0077b6] hover:underline">
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-slate-700">Catalogues</span>
        </nav>
        <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Catalogues</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          PDF catalogues for SupplierAdvisor® and each industry pack. Free to download, no sign-in.
        </p>
        <div className="mt-12">
          <CatalogueGrid groups />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
