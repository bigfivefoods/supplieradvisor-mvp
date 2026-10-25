import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { SA_OG_IMAGE_URL } from '@/lib/brand/assets';
import {
  companyCanonicalUrl,
  companyDisplayName,
  companyPublicPath,
  companySeoDescription,
  companySeoKeywords,
  companySeoTitle,
} from '@/lib/seo/company-public';
import {
  loadCachedPublicRatings,
  loadPublicCompany,
} from '@/lib/seo/load-public-company';
import CompanyPublicView from './CompanyPublicView';

/** Literal required by Next.js segment config. Keep equal to PUBLIC_PAGE_REVALIDATE_SECONDS. */
export const revalidate = 3600;

/** No build-time paths. The first request caches each company for revalidate seconds. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await loadPublicCompany(id);
  if (!c) {
    return {
      title: 'Company not found',
      robots: { index: false, follow: false },
    };
  }

  const ratings = await loadCachedPublicRatings(c.id);
  const title = companySeoTitle(c);
  const description = companySeoDescription(c, {
    ratingAvg: ratings.avg,
    ratingCount: ratings.count,
  });
  const canonical = companyCanonicalUrl(c);
  const name = companyDisplayName(c);
  const keywords = companySeoKeywords(c);
  const images = c.logo_url
    ? [{ url: c.logo_url, alt: `${name} logo` }]
    : [{ url: SA_OG_IMAGE_URL, alt: 'SupplierAdvisor directory' }];

  return {
    title,
    description,
    keywords,
    authors: [{ name, url: canonical }],
    creator: name,
    publisher: 'SupplierAdvisor',
    category: c.industry || 'Business',
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      url: canonical,
      siteName: 'SupplierAdvisor®',
      locale: 'en_ZA',
      title,
      description,
      images: images.map((img) => ({ ...img, width: 1200, height: 630 })),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: c.logo_url ? [c.logo_url] : [SA_OG_IMAGE_URL],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    other: {
      ...(c.country ? { 'geo.region': c.country } : {}),
      ...(c.city ? { 'geo.placename': c.city } : {}),
      ...(c.updated_at ? { 'article:modified_time': c.updated_at } : {}),
    },
  };
}

/**
 * Public SEO company page — /c/[slug-id]
 * Discoverable companies only. Quote and rate links are rewritten to /open.
 */
export default async function PublicCompanyPage({ params }: Props) {
  const { id: routeParam } = await params;
  const c = await loadPublicCompany(routeParam);
  if (!c) notFound();

  const canonicalPath = companyPublicPath(c);
  if (`/c/${routeParam}` !== canonicalPath) {
    permanentRedirect(canonicalPath);
  }

  const ratings = await loadCachedPublicRatings(c.id);
  return <CompanyPublicView company={c} ratings={ratings} />;
}
