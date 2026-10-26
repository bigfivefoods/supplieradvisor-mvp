import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  publicInvalidationPaths,
  publicInvalidationTags,
  type PublicSurfaceInput,
} from '@/lib/seo/public-page-cache';

/**
 * Drop the edge/data cache for a company's public profile, store, and sitemap
 * after the company edits that profile (or its public catalogue).
 */
export function revalidatePublicCompanySurfaces(input: PublicSurfaceInput): void {
  for (const tag of publicInvalidationTags(input)) {
    revalidateTag(tag, { expire: 0 });
  }
  for (const path of publicInvalidationPaths(input)) {
    revalidatePath(path);
  }
}
