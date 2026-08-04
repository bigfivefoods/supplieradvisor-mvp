/**
 * Storefront category grouping — shared by server pages and client UI.
 * Keep this module free of 'use client' so Server Components can import it.
 */
import type { StoreProduct } from './types';

/** Preferred category order for Big Five Foods (and similar food catalogs). */
export const STORE_CATEGORY_ORDER = [
  'Porridges',
  'Soya',
  'One-pots',
  'Soups',
  'NSNP Institutional',
] as const;

export const CATEGORY_BLURBS: Record<string, string> = {
  Porridges: 'Fortified instant porridge for home, catering, and foodservice.',
  Soya: 'Plant-based textured soya mince — retail and wholesale packs.',
  'One-pots': 'Complete one-pot meal mixes for kitchens that move fast.',
  Soups: 'Seasoned soup bases for institutional and retail kitchens.',
  'NSNP Institutional':
    'Quote-first institutional lines for school nutrition programmes.',
};

export function categoryAnchorId(category: string): string {
  return `cat-${category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

export function groupProductsByCategory(
  products: StoreProduct[]
): { category: string; products: StoreProduct[] }[] {
  const map = new Map<string, StoreProduct[]>();
  for (const p of products) {
    const cat = (p.category || 'Other').trim() || 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(p);
  }

  const orderIndex = (name: string) => {
    const i = STORE_CATEGORY_ORDER.findIndex(
      (c) => c.toLowerCase() === name.toLowerCase()
    );
    return i === -1 ? 1000 : i;
  };

  return Array.from(map.entries())
    .map(([category, items]) => ({ category, products: items }))
    .sort((a, b) => {
      const d = orderIndex(a.category) - orderIndex(b.category);
      if (d !== 0) return d;
      return a.category.localeCompare(b.category);
    });
}
