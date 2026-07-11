import type { MetadataRoute } from 'next';

const SITE = 'https://www.supplieradvisor.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
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
          '/p/',
          '/t/',
          '/actions/',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
