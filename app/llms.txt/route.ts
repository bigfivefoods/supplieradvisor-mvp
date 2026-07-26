import { SITE_URL } from '@/lib/seo/site';

/**
 * AI crawler hint file (llms.txt convention).
 * Served at /llms.txt — mirrors public/llms.txt with live site URL.
 */
export async function GET() {
  const body = `# SupplierAdvisor®

> Verified supply-chain operating system and public B2B company directory.
> B2B, B2G & B2C trade network — SRM, CRM, inventory, manufacturing, finance, SHEQ.

## Canonical site
- ${SITE_URL}

## Primary public pages
- Home: ${SITE_URL}/
- Company directory: ${SITE_URL}/directory
- Marketplace: ${SITE_URL}/marketplace
- Industries: ${SITE_URL}/industries
- Pricing: ${SITE_URL}/pricing
- Demo: ${SITE_URL}/demo
- Verification SLA: ${SITE_URL}/verification-sla
- Sitemap: ${SITE_URL}/sitemap.xml
- Robots: ${SITE_URL}/robots.txt

## Company profiles (every listed business)
Each discoverable company has a public SEO page:
- Pattern: ${SITE_URL}/c/{slug}-{id}
- Includes: name, industry, city, country, verification, ratings, JSON-LD
- Linked from directory hubs and sitemap.xml for Google / Bing / AI discovery

## Directory hubs
- By industry: ${SITE_URL}/directory/industry/{slug}
- By city: ${SITE_URL}/directory/city/{slug}
- By country: ${SITE_URL}/directory/country/{slug}
- Industry × city: ${SITE_URL}/directory/industry/{industry}/in/{city}

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
