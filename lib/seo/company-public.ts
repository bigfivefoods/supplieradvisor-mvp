/**
 * SEO helpers for public company directory pages (/c/[id]).
 * Used by generateMetadata, JSON-LD, and sitemap prioritization.
 */

import { SITE_URL as CANONICAL_SITE } from '@/lib/seo/site';

export const SITE_URL = CANONICAL_SITE;

export type CompanySeoInput = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  industry?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  short_description?: string | null;
  description?: string | null;
  about?: string | null;
  logo_url?: string | null;
  website?: string | null;
  verification_status?: string | null;
  registration_number?: string | null;
  trust_score?: number | null;
  otifef_average?: number | null;
};

export function companyDisplayName(c: CompanySeoInput): string {
  return (
    String(c.trading_name || c.legal_name || '').trim() || `Company #${c.id}`
  );
}

export function companyLocationLine(c: CompanySeoInput): string {
  return [c.city, c.province, c.country].filter(Boolean).join(', ');
}

export function isCompanyVerified(c: CompanySeoInput): boolean {
  return String(c.verification_status || '').toLowerCase() === 'verified';
}

/** URL-safe slug from company name (no trailing id). */
export function slugifyCompanyName(name: string): string {
  const s = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return s || 'company';
}

/**
 * Public path for a company — SEO-friendly slug + stable id.
 * Example: /c/big-five-foods-42
 * Pure numeric /c/42 still resolves and should 308 to the slug form.
 */
export function companyPublicPath(c: {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
}): string {
  const id = Number(c.id);
  if (!Number.isFinite(id) || id <= 0) return '/';
  const slug = slugifyCompanyName(
    String(c.trading_name || c.legal_name || '').trim() || `company-${id}`
  );
  return `/c/${slug}-${id}`;
}

export function companyCanonicalUrl(
  c: number | { id: number; trading_name?: string | null; legal_name?: string | null }
): string {
  if (typeof c === 'number') {
    return `${SITE_URL}/c/${c}`;
  }
  return `${SITE_URL}${companyPublicPath(c)}`;
}

/**
 * Parse /c/[param] where param is "42" or "acme-foods-johannesburg-42".
 */
export function parseCompanyRouteParam(param: string): number | null {
  const raw = String(param || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m = raw.match(/-(\d+)$/);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * SEO title optimised for Google: name + role + place + brand.
 * Example: "Big Five Foods | Food Supplier in Johannesburg, South Africa"
 */
export function companySeoTitle(c: CompanySeoInput): string {
  const name = companyDisplayName(c);
  const industry = String(c.industry || '').trim();
  const city = String(c.city || '').trim();
  const country = String(c.country || '').trim();
  const place = [city, country].filter(Boolean).join(', ');

  let role = 'Supplier';
  if (industry) {
    // Keep title readable — short industry phrase
    role = industry.length > 40 ? `${industry.slice(0, 37)}…` : industry;
  }

  if (place) {
    return `${name} | ${role} in ${place}`;
  }
  if (industry) {
    return `${name} | ${role} on SupplierAdvisor`;
  }
  return `${name} | Verified trade profile`;
}

/**
 * Meta description with location, industry, verification — unique per company.
 */
export function companySeoDescription(
  c: CompanySeoInput,
  opts?: { ratingAvg?: number | null; ratingCount?: number }
): string {
  const name = companyDisplayName(c);
  const about = String(
    c.short_description || c.description || c.about || ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  const industry = String(c.industry || '').trim();
  const place = companyLocationLine(c);
  const verified = isCompanyVerified(c);

  const bits: string[] = [];
  if (about) {
    bits.push(about.slice(0, 110));
  } else {
    bits.push(
      `${name} is a${verified ? ' verified' : ''} ${industry || 'B2B'} company on SupplierAdvisor`
    );
  }
  if (place) bits.push(`Based in ${place}.`);
  if (verified) bits.push('CIPC-verified identity.');
  if (opts?.ratingAvg != null && (opts.ratingCount || 0) > 0) {
    bits.push(
      `Rated ${opts.ratingAvg.toFixed(1)}/5 from ${opts.ratingCount} public review${
        opts.ratingCount === 1 ? '' : 's'
      }.`
    );
  }
  bits.push('Connect and trade on SupplierAdvisor.com.');

  const full = bits.join(' ').replace(/\s+/g, ' ').trim();
  return full.length > 160 ? `${full.slice(0, 157)}…` : full;
}

export function companySeoKeywords(c: CompanySeoInput): string[] {
  const name = companyDisplayName(c);
  const industry = String(c.industry || '').trim();
  const city = String(c.city || '').trim();
  const country = String(c.country || '').trim();
  const keys = [
    name,
    industry,
    city,
    country,
    industry && city ? `${industry} ${city}` : '',
    industry && country ? `${industry} suppliers ${country}` : '',
    city ? `suppliers in ${city}` : '',
    country ? `B2B suppliers ${country}` : '',
    'SupplierAdvisor',
    'verified supplier',
    'trade network',
    isCompanyVerified(c) ? 'CIPC verified' : '',
  ];
  return [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
}

/** Schema.org Organization / LocalBusiness graph for a public company page */
export function companyJsonLdGraph(
  c: CompanySeoInput,
  opts?: {
    ratingAvg?: number | null;
    ratingCount?: number;
    pageUrl?: string;
  }
): Record<string, unknown> {
  const name = companyDisplayName(c);
  const url = opts?.pageUrl || companyCanonicalUrl(c);
  const place = companyLocationLine(c);
  const verified = isCompanyVerified(c);
  const industry = String(c.industry || '').trim();
  const city = String(c.city || '').trim();
  const country = String(c.country || '').trim();
  const logo = c.logo_url
    ? c.logo_url.startsWith('http')
      ? c.logo_url
      : `${SITE_URL}${c.logo_url.startsWith('/') ? '' : '/'}${c.logo_url}`
    : undefined;

  const address: Record<string, unknown> = {
    '@type': 'PostalAddress',
  };
  if (c.city) address.addressLocality = c.city;
  if (c.province) address.addressRegion = c.province;
  if (c.country) address.addressCountry = c.country;

  const org: Record<string, unknown> = {
    '@type': ['Organization', 'LocalBusiness'],
    '@id': `${url}#organization`,
    name,
    legalName: c.legal_name || name,
    alternateName: c.legal_name && c.legal_name !== name ? [c.legal_name] : undefined,
    url,
    description: companySeoDescription(c, {
      ratingAvg: opts?.ratingAvg,
      ratingCount: opts?.ratingCount,
    }),
    ...(logo
      ? {
          logo: { '@type': 'ImageObject', url: logo },
          image: logo,
        }
      : {}),
    ...(c.website
      ? {
          sameAs: [
            c.website.startsWith('http')
              ? c.website
              : `https://${c.website}`,
          ],
        }
      : {}),
    ...(Object.keys(address).length > 1 ? { address } : {}),
    ...(place
      ? {
          areaServed: place,
          location: {
            '@type': 'Place',
            name: place,
            address,
          },
        }
      : {}),
    ...(industry
      ? {
          knowsAbout: industry,
          category: industry,
        }
      : {}),
    ...(c.registration_number
      ? {
          identifier: {
            '@type': 'PropertyValue',
            name: 'Company registration number',
            value: c.registration_number,
          },
          taxID: c.registration_number,
        }
      : {}),
    ...(verified
      ? {
          award: 'CIPC verified on SupplierAdvisor',
          hasCredential: {
            '@type': 'EducationalOccupationalCredential',
            name: 'SupplierAdvisor CIPC-verified identity',
            credentialCategory: 'verification',
          },
        }
      : {}),
    memberOf: {
      '@type': 'Organization',
      name: 'SupplierAdvisor',
      url: SITE_URL,
    },
    potentialAction: {
      '@type': 'TradeAction',
      target: `${SITE_URL}/login?next=${encodeURIComponent(
        `/dashboard?peerTrade=${c.id}&peerName=${encodeURIComponent(name)}`
      )}`,
      name: `Connect & trade with ${name}`,
    },
  };

  if (
    opts?.ratingAvg != null &&
    Number.isFinite(opts.ratingAvg) &&
    (opts.ratingCount || 0) > 0
  ) {
    org.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: opts.ratingAvg,
      bestRating: 5,
      worstRating: 1,
      ratingCount: opts.ratingCount,
    };
  }

  const crumbItems: Array<Record<string, unknown>> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'SupplierAdvisor',
      item: SITE_URL,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name,
      item: url,
    },
  ];

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: crumbItems,
  };

  const webPage = {
    '@type': 'ProfilePage',
    '@id': `${url}#webpage`,
    url,
    name: companySeoTitle(c),
    description: companySeoDescription(c, {
      ratingAvg: opts?.ratingAvg,
      ratingCount: opts?.ratingCount,
    }),
    isPartOf: { '@type': 'WebSite', name: 'SupplierAdvisor', url: SITE_URL },
    about: { '@id': `${url}#organization` },
    mainEntity: { '@id': `${url}#organization` },
    primaryImageOfPage: logo
      ? { '@type': 'ImageObject', url: logo }
      : undefined,
    inLanguage: 'en',
    dateModified: new Date().toISOString().slice(0, 10),
  };

  // FAQ rich results — unique per company for long-tail discovery
  const faqAnswers: Array<{ q: string; a: string }> = [
    {
      q: `Who is ${name}?`,
      a: companySeoDescription(c, {
        ratingAvg: opts?.ratingAvg,
        ratingCount: opts?.ratingCount,
      }),
    },
    {
      q: `Where is ${name} based?`,
      a: place
        ? `${name} is based in ${place} and listed on the SupplierAdvisor verified trade network.`
        : `${name} is listed on SupplierAdvisor — the B2B trade network for verified suppliers and buyers.`,
    },
    {
      q: `How do I connect with ${name} on SupplierAdvisor?`,
      a: `Open the public profile at ${url}, then use Connect & trade or Request to trade. You can also claim this listing if you own ${name}.`,
    },
  ];
  if (industry) {
    faqAnswers.push({
      q: `What industry is ${name} in?`,
      a: `${name} operates in ${industry}${
        city || country
          ? ` and serves buyers from ${[city, country].filter(Boolean).join(', ')}`
          : ''
      }.`,
    });
  }
  if (verified) {
    faqAnswers.push({
      q: `Is ${name} verified?`,
      a: `Yes — ${name} has CIPC-verified identity on SupplierAdvisor (paid verification with a 24-hour SLA).`,
    });
  }

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: faqAnswers.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [org, breadcrumb, webPage, faqPage],
  };
}
