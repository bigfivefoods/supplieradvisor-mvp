import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Crawl policy:
 * - Allow marketing + every /c/* company profile
 * - Disallow private app areas, ephemeral tokens, and retired /directory
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/c/',
          '/marketplace',
          '/industries',
          '/pricing',
          '/demo',
          '/verification-sla',
          '/privacy',
          '/terms',
          '/cancellation-refund',
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
          '/directory',
          '/directory/',
          '/r/',
          '/p/',
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
          '/directory',
          '/r/',
          '/p/',
          '/t/',
          '/i/',
        ],
      },
      {
        userAgent: 'Bingbot',
        allow: ['/', '/c/', '/marketplace', '/industries'],
        disallow: ['/api/', '/dashboard/', '/login', '/directory', '/r/', '/p/'],
      },
      {
        userAgent: 'GPTBot',
        allow: ['/', '/c/', '/marketplace', '/industries', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/login', '/directory'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/', '/c/', '/marketplace', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/directory'],
      },
      {
        userAgent: 'Google-Extended',
        allow: ['/', '/c/', '/marketplace', '/industries', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/directory'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/', '/c/', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/directory'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: ['/', '/c/', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/directory'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/c/', '/marketplace', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/directory'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
