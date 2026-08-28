/**
 * Packaging prices and sector labels — safe for marketing/client bundles.
 * No server, Supabase, or advisor-unlock imports.
 */

export const CORE_OS_MONTHLY_ZAR = 299;
export const INDUSTRY_PACK_MONTHLY_ZAR = 199;

export const OS_SECTORS = [
  {
    id: 'primary',
    label: 'Primary',
    description: 'Agriculture, mining, fishing, forestry, extractives.',
  },
  {
    id: 'secondary',
    label: 'Secondary',
    description: 'Manufacturing, processing, construction, utilities.',
  },
  {
    id: 'tertiary',
    label: 'Tertiary / Services',
    description: 'Trade, logistics, professional services, hospitality.',
  },
  {
    id: 'quaternary',
    label: 'Quaternary',
    description: 'Knowledge, tech, R&D, education services, professional IQ.',
  },
  {
    id: 'public_sector',
    label: 'Public Sector',
    description:
      'Government and publicly funded programmes — National, Provincial, Municipal, and Local.',
  },
] as const;

export type OsSectorId = (typeof OS_SECTORS)[number]['id'];
