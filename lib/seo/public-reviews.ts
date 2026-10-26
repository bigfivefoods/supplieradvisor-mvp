/**
 * Public review schema helpers.
 * Ratings and reviews are emitted only from rows that already exist.
 * Nothing here invents a score, a count, or an author.
 */

export type RealPublicReview = {
  rating: number;
  body: string | null;
  authorName: string | null;
  publishedAt: string | null;
};

const EMAIL_LIKE = /@/;

export function sanitizeRealReviews(
  rows: Array<{
    rating?: unknown;
    body?: unknown;
    authorName?: unknown;
    publishedAt?: unknown;
  }> | null | undefined
): RealPublicReview[] {
  if (!rows?.length) return [];
  const out: RealPublicReview[] = [];
  for (const row of rows) {
    const rating = Number(row?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue;
    const bodyRaw = typeof row.body === 'string' ? row.body.replace(/\s+/g, ' ').trim() : '';
    const authorRaw =
      typeof row.authorName === 'string' ? row.authorName.replace(/\s+/g, ' ').trim() : '';
    const authorName =
      authorRaw && !EMAIL_LIKE.test(authorRaw) && authorRaw.length <= 80 ? authorRaw : '';
    const published =
      typeof row.publishedAt === 'string' && row.publishedAt.trim()
        ? row.publishedAt.trim()
        : null;
    out.push({
      rating: Math.round(rating * 10) / 10,
      body: bodyRaw ? bodyRaw.slice(0, 500) : null,
      authorName: authorName || null,
      publishedAt: published,
    });
  }
  return out;
}

export function aggregateFromReviews(reviews: RealPublicReview[]): {
  avg: number | null;
  count: number;
} {
  if (!reviews.length) return { avg: null, count: 0 };
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return {
    avg: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length,
  };
}

/**
 * Schema.org Review nodes. A review is included only when the row has a
 * real author name and written body. Star-only rows stay in the aggregate.
 */
export function schemaReviews(reviews: RealPublicReview[]): Array<Record<string, unknown>> {
  return reviews
    .filter((review) => review.authorName && review.body)
    .map((review) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: review.authorName },
      reviewBody: review.body,
      ...(review.publishedAt
        ? { datePublished: review.publishedAt.slice(0, 10) }
        : {}),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    }));
}
