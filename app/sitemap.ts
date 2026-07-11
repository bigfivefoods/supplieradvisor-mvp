import type { MetadataRoute } from 'next';

const SITE = 'https://www.supplieradvisor.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
    priority: number;
  }> = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/onboarding', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  ];

  return routes.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
