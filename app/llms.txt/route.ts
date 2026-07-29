import { SITE_URL } from '@/lib/seo/site';

/**
 * AI crawler hint file (llms.txt convention).
 * Served at /llms.txt — mirrors public/llms.txt with live site URL.
 */
export async function GET() {
  const body = `# SupplierAdvisor®

> Verified supply-chain operating system for B2B, B2G & B2C.
> Trade network — SRM, CRM, inventory, manufacturing, finance, SHEQ.

## Canonical site
- ${SITE_URL}

## Primary public pages
- Home: ${SITE_URL}/
- Marketplace: ${SITE_URL}/marketplace
- Industries: ${SITE_URL}/industries
- Pricing: ${SITE_URL}/pricing
- Demo: ${SITE_URL}/demo
- Verification SLA: ${SITE_URL}/verification-sla
- Sitemap: ${SITE_URL}/sitemap.xml
- Robots: ${SITE_URL}/robots.txt

## Company profiles
Discoverable companies may have a public SEO page:
- Pattern: ${SITE_URL}/c/{slug}-{id}
- Includes: name, industry, city, country, verification, ratings, JSON-LD

## List or claim a business
- ${SITE_URL}/onboarding?type=business

## Brand
- SupplierAdvisor® · https://x.com/supplieradvisa
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
