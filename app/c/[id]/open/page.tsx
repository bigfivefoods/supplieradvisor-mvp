import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  companyDisplayName,
  companyPublicPath,
} from '@/lib/seo/company-public';
import {
  loadPublicCompany,
  loadPublicRatingSnapshot,
} from '@/lib/seo/load-public-company';
import CompanyPublicView from '../CompanyPublicView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await loadPublicCompany(id, { bypassDiscovery: true });
  if (!c) return { title: 'Company not found', robots: { index: false, follow: false } };
  return {
    title: companyDisplayName(c),
    robots: { index: false, follow: false },
  };
}

/**
 * Uncached deep link for quote, rate, and referral URLs.
 * Listed companies redirect onto the cached public page.
 */
export default async function OpenCompanyPage({ params }: Props) {
  const { id: routeParam } = await params;
  const listed = await loadPublicCompany(routeParam);
  if (listed) permanentRedirect(companyPublicPath(listed));

  const c = await loadPublicCompany(routeParam, { bypassDiscovery: true });
  if (!c) notFound();
  const ratings = await loadPublicRatingSnapshot(c.id);
  return <CompanyPublicView company={c} ratings={ratings} />;
}
