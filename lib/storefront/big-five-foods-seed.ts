/**
 * Seed catalog matching bigfivegroup.africa/foods deep-link externalRefs.
 * Used as fallback when DB products are empty, and by seed script.
 */

import type { StoreChannel, StoreProduct } from './types';

type SeedDef = {
  externalRef: string;
  sku: string;
  name: string;
  description: string;
  packSize: string;
  category: string;
  channels: StoreChannel[];
  badges?: string[];
  quoteFirst?: boolean;
  /** Temporary marketing CDN image (optional) */
  imageUrl?: string | null;
  price?: number | null;
};

const CDN = 'https://bigfivegroup.africa';

/** 1 kg retail list on bigfivefoods.com (excl. VAT). Used when inventory has no sell price. */
const RETAIL_1KG_ZAR = 60;

const PORRIDGES: SeedDef[] = [
  {
    externalRef: 'porridge-original',
    sku: 'BFF-POR-ORI',
    name: 'Instant Porridge — Original',
    description: 'Creamy fortified instant porridge for home and foodservice.',
    packSize: '1 kg',
    category: 'Porridges',
    channels: ['retail', 'wholesale'],
    badges: ['Fortified'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'porridge-chocolate',
    sku: 'BFF-POR-CHO',
    name: 'Instant Porridge — Chocolate',
    description: 'Chocolate-flavoured fortified instant porridge.',
    packSize: '1 kg',
    category: 'Porridges',
    channels: ['retail', 'wholesale'],
    badges: ['Fortified'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'porridge-banana',
    sku: 'BFF-POR-BAN',
    name: 'Instant Porridge — Banana',
    description: 'Banana-flavoured fortified instant porridge.',
    packSize: '1 kg',
    category: 'Porridges',
    channels: ['retail', 'wholesale'],
    badges: ['Fortified'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'porridge-strawberry',
    sku: 'BFF-POR-STR',
    name: 'Instant Porridge — Strawberry',
    description: 'Strawberry-flavoured fortified instant porridge.',
    packSize: '1 kg',
    category: 'Porridges',
    channels: ['retail', 'wholesale'],
    badges: ['Fortified'],
    price: RETAIL_1KG_ZAR,
  },
];

const SOYA: SeedDef[] = [
  {
    externalRef: 'soya-beef',
    sku: 'BFF-SOY-BEF',
    name: 'Textured Soya Mince — Beef',
    description: 'Plant-based soya mince with classic beef seasoning.',
    packSize: '1 kg',
    category: 'Soya',
    channels: ['retail', 'wholesale'],
    badges: ['Plant-based'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'soya-chilli-beef',
    sku: 'BFF-SOY-CHB',
    name: 'Textured Soya Mince — Chilli Beef',
    description: 'Soya mince with chilli-beef seasoning.',
    packSize: '1 kg',
    category: 'Soya',
    channels: ['retail', 'wholesale'],
    badges: ['Plant-based'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'soya-beef-onion',
    sku: 'BFF-SOY-BON',
    name: 'Textured Soya Mince — Beef & Onion',
    description: 'Soya mince with beef and onion seasoning.',
    packSize: '1 kg',
    category: 'Soya',
    channels: ['retail', 'wholesale'],
    badges: ['Plant-based'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'soya-mutton',
    sku: 'BFF-SOY-MUT',
    name: 'Textured Soya Mince — Mutton',
    description: 'Soya mince with mutton seasoning.',
    packSize: '1 kg',
    category: 'Soya',
    channels: ['retail', 'wholesale'],
    badges: ['Plant-based'],
    price: RETAIL_1KG_ZAR,
  },
];

const ONEPOTS: SeedDef[] = [
  {
    externalRef: 'onepot-chicken',
    sku: 'BFF-OP-CHK',
    name: 'One-Pot Meal — Chicken',
    description: 'Complete one-pot meal mix with chicken flavour.',
    packSize: '1 kg',
    category: 'One-pots',
    channels: ['retail', 'wholesale'],
    badges: ['One-pot'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'onepot-beef',
    sku: 'BFF-OP-BEF',
    name: 'One-Pot Meal — Beef',
    description: 'Complete one-pot meal mix with beef flavour.',
    packSize: '1 kg',
    category: 'One-pots',
    channels: ['retail', 'wholesale'],
    badges: ['One-pot'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'onepot-chilli-beef',
    sku: 'BFF-OP-CHB',
    name: 'One-Pot Meal — Chilli Beef',
    description: 'One-pot meal mix with chilli-beef flavour.',
    packSize: '1 kg',
    category: 'One-pots',
    channels: ['retail', 'wholesale'],
    badges: ['One-pot'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'onepot-chakalaka',
    sku: 'BFF-OP-CHA',
    name: 'One-Pot Meal — Chakalaka',
    description: 'One-pot meal mix with chakalaka-style seasoning.',
    packSize: '1 kg',
    category: 'One-pots',
    channels: ['retail', 'wholesale'],
    badges: ['One-pot'],
    price: RETAIL_1KG_ZAR,
  },
];

const SOUPS: SeedDef[] = [
  {
    externalRef: 'soup-chicken',
    sku: 'BFF-SP-CHK',
    name: 'Soup Mix — Chicken',
    description: 'Seasoned soup base for institutional and retail kitchens.',
    packSize: '1 kg',
    category: 'Soups',
    channels: ['retail', 'wholesale'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'soup-brown-onion',
    sku: 'BFF-SP-BON',
    name: 'Soup Mix — Brown Onion',
    description: 'Brown onion soup mix.',
    packSize: '1 kg',
    category: 'Soups',
    channels: ['retail', 'wholesale'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'soup-oxtail',
    sku: 'BFF-SP-OXT',
    name: 'Soup Mix — Oxtail',
    description: 'Oxtail-flavoured soup mix.',
    packSize: '1 kg',
    category: 'Soups',
    channels: ['retail', 'wholesale'],
    price: RETAIL_1KG_ZAR,
  },
  {
    externalRef: 'soup-minestrone',
    sku: 'BFF-SP-MIN',
    name: 'Soup Mix — Minestrone',
    description: 'Minestrone-style soup mix.',
    packSize: '1 kg',
    category: 'Soups',
    channels: ['retail', 'wholesale'],
    price: RETAIL_1KG_ZAR,
  },
];

const NSNP: SeedDef[] = [
  {
    externalRef: 'nsnp-beef-soya-5kg',
    sku: 'BFF-NSNP-SOY-5',
    name: 'NSNP Textured Soya — Beef (5 kg)',
    description:
      'Institutional soya mince for National School Nutrition Programme kitchens. Quote-first trade.',
    packSize: '5 kg',
    category: 'NSNP Institutional',
    channels: ['institutional'],
    badges: ['NSNP approved'],
    quoteFirst: true,
    price: null,
  },
  {
    externalRef: 'nsnp-enriched-porridge-5kg',
    sku: 'BFF-NSNP-POR-5',
    name: 'NSNP Enriched Porridge (5 kg)',
    description:
      'Fortified porridge for school feeding programmes. Quote-first — not instant public checkout.',
    packSize: '5 kg',
    category: 'NSNP Institutional',
    channels: ['institutional'],
    badges: ['NSNP approved'],
    quoteFirst: true,
    price: null,
  },
  {
    externalRef: 'nsnp-onepot-chicken-biryani-5kg',
    sku: 'BFF-NSNP-OP-5',
    name: 'NSNP One-Pot Chicken Biryani (5 kg)',
    description:
      'Institutional one-pot meal for NSNP. Quote and programme terms apply.',
    packSize: '5 kg',
    category: 'NSNP Institutional',
    channels: ['institutional'],
    badges: ['NSNP approved'],
    quoteFirst: true,
    price: null,
  },
];

export const BIG_FIVE_FOODS_SEED: SeedDef[] = [
  ...PORRIDGES,
  ...SOYA,
  ...ONEPOTS,
  ...SOUPS,
  ...NSNP,
];

export const BIG_FIVE_FOODS_SLUG = 'big-five-foods';
export const BIG_FIVE_FOODS_TRADING_NAMES = [
  'Big Five Foods',
  'Big Five Food',
  'BigFive Foods',
];

export function seedDefsAsStoreProducts(): StoreProduct[] {
  return BIG_FIVE_FOODS_SEED.map((s) => {
    const quoteFirst = Boolean(s.quoteFirst);
    const priceOnRequest = s.price == null;
    return {
      id: s.externalRef,
      sku: s.sku,
      name: s.name,
      shortName: s.name.split('—')[0].trim(),
      description: s.description,
      packSize: s.packSize,
      pack: s.packSize,
      uom: 'unit',
      imageUrl: s.imageUrl || null,
      images: s.imageUrl ? [s.imageUrl] : [],
      badges: s.badges || [],
      channels: s.channels,
      channelFlags: s.channels,
      channel: s.channels[0] || null,
      price: s.price ?? null,
      currency: 'ZAR',
      priceOnRequest,
      inStock: !quoteFirst,
      externalRef: s.externalRef,
      quoteFirst,
      active: true,
      category: s.category,
    };
  });
}

/** Marketing CDN base (optional image paths if used later) */
export function marketingCdnBase() {
  return CDN;
}
