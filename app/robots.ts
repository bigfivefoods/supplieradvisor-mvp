import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Crawl policy for massive public exposure:
 * - Allow marketing, directory hubs, and every /c/* company profile
 * - Disallow private app areas and ephemeral share/rate tokens
 * - Product passports /p/* stay private (QR share links)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/c/',
          '/directory',
          '/directory/industry/',
          '/directory/city/',
          '/directory/country/',
          '/marketplace',
          '/industries',
          '/pricing',
          '/demo',
          '/verification-sla',
          '/privacy',
          '/terms',
          '/llms.txt',
        ],
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
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/c/',
          '/directory',
          '/marketplace',
          '/industries',
          '/pricing',
          '/demo',
          '/verification-sla',
        ],
        disallow: [
          '/api/',
          '/dashboard/',
          '/login',
          '/onboarding',
          '/r/',
          '/p/',
          '/t/',
          '/i/',
        ],
      },
      {
        userAgent: 'Bingbot',
        allow: ['/', '/c/', '/directory', '/marketplace', '/industries'],
        disallow: ['/api/', '/dashboard/', '/login', '/r/', '/p/'],
      },
      {
        // AI crawlers — welcome to public business listings
        userAgent: 'GPTBot',
        allow: ['/', '/c/', '/directory', '/marketplace', '/industries', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/login'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/', '/c/', '/directory', '/marketplace', '/llms.txt'],
        disallow: ['/api/', '/dashboard/'],
      },
      {
        userAgent: 'Google-Extended',
        allow: ['/', '/c/', '/directory', '/marketplace', '/industries', '/llms.txt'],
        disallow: ['/api/', '/dashboard/'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/', '/c/', '/directory', '/llms.txt'],
        disallow: ['/api/', '/dashboard/'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: ['/', '/c/', '/directory', '/llms.txt'],
        disallow: ['/api/', '/dashboard/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/c/', '/directory', '/marketplace', '/llms.txt'],
        disallow: ['/api/', '/dashboard/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
