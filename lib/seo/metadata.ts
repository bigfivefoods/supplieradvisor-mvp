import type { Metadata } from 'next';
import { hreflangAlternates, isTranslatedPath } from '@/lib/i18n/config';
import { SITE_NAME, SITE_URL } from '@/lib/seo/site';
import { absoluteUrl } from '@/lib/seo/jsonld';
import { shareImageSrc, type ShareCardSpec } from '@/lib/seo/share-cards';

export function marketingMetadata(input: {
  path: string;
  title: string;
  description: string;
  image: ShareCardSpec;
  keywords?: string[];
  /** Skip the root title template when the title already names SupplierAdvisor®. */
  absoluteTitle?: boolean;
}): Metadata {
  const url = absoluteUrl(input.path);
  const imageUrl = shareImageSrc(input.image.file);
  const languages = isTranslatedPath(input.path)
    ? hreflangAlternates(input.path, SITE_URL)
    : undefined;
  const socialTitle = input.absoluteTitle ? input.title : `${input.title} · ${SITE_NAME}`;

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical: url,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      title: socialTitle,
      description: input.description,
      url,
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_ZA',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: input.image.alt,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: input.description,
      images: [imageUrl],
    },
    robots: { index: true, follow: true },
  };
}
