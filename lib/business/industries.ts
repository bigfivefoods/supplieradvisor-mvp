/** Industry + sub-industry options for company profile multi-select. */

export const COMPANY_INDUSTRIES = [
  'Agriculture & Farming',
  'Food & Beverage Processing',
  'Ingredients & Raw Materials',
  'Packaging & Materials',
  'Logistics & Distribution',
  'Cold chain & Storage',
  'Retail & Wholesale',
  'Manufacturing',
  'Chemicals',
  'Technology & Software',
  'Professional services',
  'Construction & Infrastructure',
  'Energy & Utilities',
  'Healthcare & Pharma',
  'Mining & Resources',
  'Hospitality & Tourism',
  'Other',
] as const;

export const COMPANY_SUB_INDUSTRIES: Record<string, string[]> = {
  'Agriculture & Farming': [
    'Crop production',
    'Livestock',
    'Aquaculture',
    'Agri-tech',
    'Horticulture',
  ],
  'Food & Beverage Processing': [
    'Dairy',
    'Meat & poultry',
    'Bakery',
    'Beverages',
    'Confectionery',
    'Ready meals',
  ],
  'Ingredients & Raw Materials': [
    'Flours & grains',
    'Oils & fats',
    'Spices & flavours',
    'Additives',
  ],
  'Packaging & Materials': [
    'Flexible packaging',
    'Rigid packaging',
    'Labels',
    'Sustainable packaging',
  ],
  'Logistics & Distribution': [
    'Freight',
    'Last mile',
    'Warehousing',
    '3PL',
    'Customs brokerage',
  ],
  'Cold chain & Storage': ['Refrigerated transport', 'Cold storage', 'Frozen logistics'],
  'Retail & Wholesale': ['Wholesale', 'Grocery retail', 'E-commerce', 'Cash & carry'],
  Manufacturing: [
    'Contract manufacturing',
    'OEM',
    'Assembly',
    'Industrial equipment',
  ],
  Chemicals: ['Industrial chemicals', 'Agrochemicals', 'Specialty chemicals'],
  'Technology & Software': ['SaaS', 'IoT', 'ERP / supply chain software', 'Data services'],
  'Professional services': ['Consulting', 'Legal', 'Accounting', 'Training'],
  'Construction & Infrastructure': ['Building materials', 'Contracting', 'Civil works'],
  'Energy & Utilities': ['Renewables', 'Fuel', 'Utilities'],
  'Healthcare & Pharma': ['Pharma', 'Medical devices', 'Nutraceuticals'],
  'Mining & Resources': ['Mining services', 'Minerals trading'],
  'Hospitality & Tourism': ['Hotels', 'Catering', 'Tour operators'],
  Other: ['General'],
};

export function subIndustriesFor(selectedIndustries: string[]): string[] {
  const set = new Set<string>();
  for (const ind of selectedIndustries) {
    for (const s of COMPANY_SUB_INDUSTRIES[ind] || []) set.add(s);
  }
  // If nothing selected, offer a flat union of common options
  if (set.size === 0) {
    for (const list of Object.values(COMPANY_SUB_INDUSTRIES)) {
      for (const s of list) set.add(s);
    }
  }
  return Array.from(set).sort();
}
