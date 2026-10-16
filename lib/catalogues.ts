/**
 * Catalogue downloads. Public Blob URLs are linked, never uploaded.
 * The base URL is not a secret. Do not import chrome or nav modules here.
 */
import type { IndustrySlug } from '@/lib/marketing/industries';

export type CatalogueGroup =
  | 'platform'
  | 'supply-chain'
  | 'health-fitness'
  | 'retail-hire-public'
  | 'credit-recovery';

export type CatalogueEntry = {
  id: string;
  kind: 'system' | 'module';
  group: CatalogueGroup;
  status: 'available' | 'coming-soon';
  name: string;
  title: string;
  blurb: string;
  moduleId?: string;
  industrySlug?: IndustrySlug;
  inAppHref?: string;
  file?: {
    name: string;
    bytes: number;
    pages: number;
    updated: string;
    version: string;
  };
  cover?: { src: string; width: number; height: number };
};

export const CATALOGUE_FILE_BASE_URL =
  'https://fmsczg6npzkpslsh.public.blob.vercel-storage.com/catalogues';

export const CATALOGUES: readonly CatalogueEntry[] = [
  {
    id: 'system',
    kind: 'system',
    group: 'platform',
    status: 'coming-soon',
    name: 'SupplierAdvisor®',
    title: 'SupplierAdvisor® catalogue',
    blurb: 'The supply-chain OS with a verified trade and trust layer',
    inAppHref: '/dashboard',
  },
  {
    id: 'recover',
    kind: 'module',
    group: 'credit-recovery',
    status: 'coming-soon',
    name: 'RecoverAdvisor®',
    title: 'RecoverAdvisor® catalogue',
    blurb: 'Creditors, accounts and the collections book',
    moduleId: 'recovergraph',
    inAppHref: '/dashboard/recovergraph',
  },
  {
    id: 'trade',
    kind: 'module',
    group: 'supply-chain',
    status: 'available',
    name: 'TradeAdvisor®',
    title: 'TradeAdvisor® catalogue',
    blurb: 'Quotes, jobs, Gantt, variation orders, three apps',
    moduleId: 'tradegraph',
    industrySlug: 'trades',
    inAppHref: '/dashboard/tradegraph',
    file: {
      name: 'trade-advisor-catalogue.pdf',
      bytes: 11797579,
      pages: 44,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/trade-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'construction',
    kind: 'module',
    group: 'supply-chain',
    status: 'available',
    name: 'ConstructionAdvisor®',
    title: 'ConstructionAdvisor® catalogue',
    blurb: 'BOQ quotes, Gantt programme, owner, workers and client apps',
    moduleId: 'constructiongraph',
    industrySlug: 'construction-building',
    inAppHref: '/dashboard/constructiongraph',
    file: {
      name: 'construction-advisor-catalogue.pdf',
      bytes: 9763800,
      pages: 44,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: {
      src: '/catalogues/construction-advisor-catalogue-cover.webp',
      width: 800,
      height: 565,
    },
  },
  {
    id: 'fleet',
    kind: 'module',
    group: 'supply-chain',
    status: 'available',
    name: 'FleetAdvisor®',
    title: 'FleetAdvisor® catalogue',
    blurb: 'Vehicles and drivers, expiry dates, jobs and stops, and your own cost per kilometre',
    moduleId: 'fleetgraph',
    inAppHref: '/dashboard/fleetgraph',
    file: {
      name: 'fleet-advisor-catalogue.pdf',
      bytes: 10794695,
      pages: 44,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/fleet-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'crop',
    kind: 'module',
    group: 'supply-chain',
    status: 'available',
    name: 'CropAdvisor®',
    title: 'CropAdvisor® catalogue',
    blurb: 'Fields, harvest, inputs, fleet fuel and farm-to-buyer trade',
    moduleId: 'fieldgraph',
    industrySlug: 'agriculture',
    inAppHref: '/dashboard/fieldgraph',
    file: {
      name: 'crop-advisor-catalogue.pdf',
      bytes: 6800168,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/crop-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'quarry',
    kind: 'module',
    group: 'supply-chain',
    status: 'available',
    name: 'QuarryAdvisor®',
    title: 'QuarryAdvisor® catalogue',
    blurb: 'Sites, reserves, plant, weighbridge, fleet, QA and permits',
    moduleId: 'quarrygraph',
    industrySlug: 'quarry-aggregates',
    inAppHref: '/dashboard/quarrygraph',
    file: {
      name: 'quarry-advisor-catalogue.pdf',
      bytes: 7123964,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/quarry-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'apparel',
    kind: 'module',
    group: 'supply-chain',
    status: 'available',
    name: 'ApparelAdvisor®',
    title: 'ApparelAdvisor® catalogue',
    blurb: 'Range, landed costing, wholesale ATS, buyer PWA',
    moduleId: 'apparelgraph',
    industrySlug: 'apparel-clothing',
    inAppHref: '/dashboard/apparelgraph',
    file: {
      name: 'apparel-advisor-catalogue.pdf',
      bytes: 7391494,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/apparel-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'gym',
    kind: 'module',
    group: 'health-fitness',
    status: 'available',
    name: 'GymAdvisor®',
    title: 'GymAdvisor® catalogue',
    blurb: 'Coaches, rooms, classes, waitlist, member PWA',
    moduleId: 'fitgraph',
    industrySlug: 'fitness-gyms',
    inAppHref: '/dashboard/fitgraph',
    file: {
      name: 'gym-advisor-catalogue.pdf',
      bytes: 8326408,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/gym-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'physio',
    kind: 'module',
    group: 'health-fitness',
    status: 'available',
    name: 'PhysioAdvisor®',
    title: 'PhysioAdvisor® catalogue',
    blurb: 'Rooms, waitlist, treatment plans, Rehab PWA',
    moduleId: 'physiograph',
    industrySlug: 'physio-allied-health',
    inAppHref: '/dashboard/physiograph',
    file: {
      name: 'physio-advisor-catalogue.pdf',
      bytes: 8402390,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/physio-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'dental',
    kind: 'module',
    group: 'health-fitness',
    status: 'available',
    name: 'DentalAdvisor®',
    title: 'DentalAdvisor® catalogue',
    blurb: 'Chairs, waitlist, treatment plans, Chart PWA',
    moduleId: 'dentalgraph',
    industrySlug: 'dental',
    inAppHref: '/dashboard/dentalgraph',
    file: {
      name: 'dental-advisor-catalogue.pdf',
      bytes: 8366226,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/dental-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'psychiatry',
    kind: 'module',
    group: 'health-fitness',
    status: 'available',
    name: 'PsychiatryAdvisor®',
    title: 'PsychiatryAdvisor® catalogue',
    blurb: 'Diaries, waitlist, treatment plans, Records PWA',
    moduleId: 'psychiatrygraph',
    industrySlug: 'mental-health',
    inAppHref: '/dashboard/psychiatrygraph',
    file: {
      name: 'psychiatry-advisor-catalogue.pdf',
      bytes: 8453861,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: {
      src: '/catalogues/psychiatry-advisor-catalogue-cover.webp',
      width: 800,
      height: 565,
    },
  },
  {
    id: 'medical',
    kind: 'module',
    group: 'health-fitness',
    status: 'available',
    name: 'MedicalAdvisor®',
    title: 'MedicalAdvisor® catalogue',
    blurb: 'Rooms, waitlist, Rx on visits, Records PWA',
    moduleId: 'medicalgraph',
    industrySlug: 'medical-practices',
    inAppHref: '/dashboard/medicalgraph',
    file: {
      name: 'medical-advisor-catalogue.pdf',
      bytes: 8437227,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/medical-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'vet',
    kind: 'module',
    group: 'health-fitness',
    status: 'available',
    name: 'VetAdvisor®',
    title: 'VetAdvisor® catalogue',
    blurb: 'Vets, clients, vaccines, waitlist, Pets PWA',
    moduleId: 'vetgraph',
    industrySlug: 'veterinary-practices',
    inAppHref: '/dashboard/vetgraph',
    file: {
      name: 'vet-advisor-catalogue.pdf',
      bytes: 8394612,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/vet-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'retail',
    kind: 'module',
    group: 'retail-hire-public',
    status: 'available',
    name: 'RetailAdvisor®',
    title: 'RetailAdvisor® catalogue',
    blurb: 'Till with QR/NFC phone pay and a shopper PWA',
    moduleId: 'retailgraph',
    industrySlug: 'retail-shop',
    inAppHref: '/dashboard/retailgraph',
    file: {
      name: 'retail-advisor-catalogue.pdf',
      bytes: 7699221,
      pages: 37,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/retail-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'hire',
    kind: 'module',
    group: 'retail-hire-public',
    status: 'available',
    name: 'HireAdvisor®',
    title: 'HireAdvisor® catalogue',
    blurb: 'Hire marketplace: castles, plant and tools',
    moduleId: 'hiregraph',
    industrySlug: 'hire-rental',
    inAppHref: '/dashboard/hiregraph',
    file: {
      name: 'hire-advisor-catalogue.pdf',
      bytes: 8330429,
      pages: 38,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/hire-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
  {
    id: 'school',
    kind: 'module',
    group: 'retail-hire-public',
    status: 'available',
    name: 'SchoolAdvisor®',
    title: 'SchoolAdvisor® catalogue',
    blurb: 'The National School Nutrition Programme: department, schools and service providers',
    moduleId: 'schools',
    industrySlug: 'public-sector',
    inAppHref: '/dashboard/schools',
    file: {
      name: 'school-advisor-catalogue.pdf',
      bytes: 7685152,
      pages: 39,
      updated: '2026-10-15',
      version: '20261015',
    },
    cover: { src: '/catalogues/school-advisor-catalogue-cover.webp', width: 800, height: 565 },
  },
];

export function availableCatalogues(): CatalogueEntry[] {
  return CATALOGUES.filter((entry) => entry.status === 'available');
}

export function catalogueById(id: string): CatalogueEntry | undefined {
  return CATALOGUES.find((entry) => entry.id === id);
}

export function catalogueForModule(moduleId: string): CatalogueEntry | undefined {
  return CATALOGUES.find((entry) => entry.moduleId === moduleId);
}

export function catalogueForIndustry(slug: string): CatalogueEntry | undefined {
  return CATALOGUES.find((entry) => entry.industrySlug === slug);
}

export function catalogueDownloadHref(id: string): string {
  return `/catalogues/${id}/download`;
}

export function catalogueFileUrl(
  entry: CatalogueEntry,
  options?: { download?: boolean }
): string {
  if (!entry.file) return '';
  const url = `${CATALOGUE_FILE_BASE_URL}/${entry.file.name}`;
  if (!options?.download) return url;
  return `${url}?download=1&v=${entry.file.version}`;
}

/** Binary megabytes, one decimal, the way file managers show the size. */
export function formatCatalogueSize(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
