/**
 * Server-rendered site-wide JSON-LD for Google / rich results / AI crawlers.
 * Keep as a server component (no 'use client').
 * FAQ markup stays on the pages that actually show those questions.
 */
import { jsonLdString, siteJsonLd } from '@/lib/seo/jsonld';

export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(siteJsonLd()) }}
    />
  );
}
