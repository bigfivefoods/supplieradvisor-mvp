import type { MetadataRoute } from 'next';

const SITE = 'https://www.supplieradvisor.com';

/**
 * Crawl policy:
 * - Allow public marketing + company directory /c/*
 * - Disallow private app areas and ephemeral share/rate tokens
 * - Product passports /p/* stay private-ish (share links); company SEO is /c/*
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/c/', '/pricing', '/privacy', '/terms'],
        disallow: [
          '/api/',
          '/dashboard/',
          '/login',
          '/onboarding',
          '/invite/',
          '/join/',
          '/contractor/',
          '/consumer/',
          '/sales/',
          '/reseller/',
          '/embed/',
          '/r/', // public rate forms — thin / spam-prone for SERP
          '/p/', // product passport tokens
          '/t/',
          '/i/',
          '/actions/',
          '/install',
        ],
      },
      {
        // Explicitly welcome major engines to company profiles
        userAgent: 'Googlebot',
        allow: ['/', '/c/'],
        disallow: ['/api/', '/dashboard/', '/login', '/r/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
