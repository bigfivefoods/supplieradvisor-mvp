/**
 * Exhaustive company industry & sub-industry catalogue.
 * Organised by economic sector: primary → secondary → tertiary → quaternary → quinary.
 * Generated for SupplierAdvisor company identity — storage keys are industry names.
 */

export type EconomicSectorId =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'quaternary'
  | 'quinary';

export type EconomicSector = {
  id: EconomicSectorId;
  label: string;
  shortLabel: string;
  description: string;
  order: number;
};

export const ECONOMIC_SECTORS: readonly EconomicSector[] = [
  {
    id: 'primary',
    label: 'Primary sector',
    shortLabel: 'Primary',
    description:
      'Extraction and production of raw materials — farming, mining, fishing, forestry, quarrying.',
    order: 1,
  },
  {
    id: 'secondary',
    label: 'Secondary sector',
    shortLabel: 'Secondary',
    description:
      'Manufacturing, processing, utilities generation, and construction.',
    order: 2,
  },
  {
    id: 'tertiary',
    label: 'Tertiary sector',
    shortLabel: 'Tertiary',
    description:
      'Commercial services — trade, logistics, hospitality, finance, professional and personal services.',
    order: 3,
  },
  {
    id: 'quaternary',
    label: 'Quaternary sector',
    shortLabel: 'Quaternary',
    description:
      'Knowledge economy — software, data, R&D, advanced professional and technical services.',
    order: 4,
  },
  {
    id: 'quinary',
    label: 'Quinary sector',
    shortLabel: 'Quinary',
    description:
      'Highest-order services — government, education, health & care, culture, religion, NGOs.',
    order: 5,
  },
] as const;

export type IndustryDefinition = {
  name: string;
  sector: EconomicSectorId;
  blurb?: string;
};

export const INDUSTRY_CATALOGUE: readonly IndustryDefinition[] = [
  { name: 'Agriculture — field crops', sector: 'primary' },
  { name: 'Agriculture — horticulture', sector: 'primary' },
  { name: 'Agriculture — livestock', sector: 'primary' },
  { name: 'Aquaculture & fisheries', sector: 'primary' },
  { name: 'Forestry & logging', sector: 'primary' },
  { name: 'Mining — energy minerals', sector: 'primary' },
  { name: 'Mining — precious metals', sector: 'primary' },
  { name: 'Mining — base metals', sector: 'primary' },
  { name: 'Mining — industrial minerals', sector: 'primary' },
  { name: 'Oil & gas extraction', sector: 'primary' },
  { name: 'Quarrying & aggregates', sector: 'primary' },
  { name: 'Hunting, trapping & wildlife', sector: 'primary' },
  { name: 'Food manufacturing — meat & fish', sector: 'secondary' },
  { name: 'Food manufacturing — dairy', sector: 'secondary' },
  { name: 'Food manufacturing — bakery & milling', sector: 'secondary' },
  { name: 'Food manufacturing — beverages', sector: 'secondary' },
  { name: 'Food manufacturing — other', sector: 'secondary' },
  { name: 'Animal feed manufacturing', sector: 'secondary' },
  { name: 'Ingredients & food intermediates', sector: 'secondary' },
  { name: 'Tobacco products manufacturing', sector: 'secondary' },
  { name: 'Textiles manufacturing', sector: 'secondary' },
  { name: 'Apparel & clothing manufacturing', sector: 'secondary' },
  { name: 'Leather & footwear manufacturing', sector: 'secondary' },
  { name: 'Wood products manufacturing', sector: 'secondary' },
  { name: 'Paper & paper products', sector: 'secondary' },
  { name: 'Printing & related', sector: 'secondary' },
  { name: 'Coke & refined petroleum', sector: 'secondary' },
  { name: 'Chemicals — basic', sector: 'secondary' },
  { name: 'Chemicals — specialty', sector: 'secondary' },
  { name: 'Pharmaceuticals manufacturing', sector: 'secondary' },
  { name: 'Rubber & plastics products', sector: 'secondary' },
  { name: 'Non-metallic mineral products', sector: 'secondary' },
  { name: 'Basic metals', sector: 'secondary' },
  { name: 'Fabricated metal products', sector: 'secondary' },
  { name: 'Computer, electronic & optical', sector: 'secondary' },
  { name: 'Electrical equipment manufacturing', sector: 'secondary' },
  { name: 'Machinery & equipment manufacturing', sector: 'secondary' },
  { name: 'Motor vehicles & parts', sector: 'secondary' },
  { name: 'Other transport equipment', sector: 'secondary' },
  { name: 'Furniture manufacturing', sector: 'secondary' },
  { name: 'Other manufacturing', sector: 'secondary' },
  { name: 'Repair of machinery & equipment', sector: 'secondary' },
  { name: 'Electricity generation', sector: 'secondary' },
  { name: 'Electricity transmission & distribution', sector: 'secondary' },
  { name: 'Gas, steam & air conditioning supply', sector: 'secondary' },
  { name: 'Water collection, treatment & supply', sector: 'secondary' },
  { name: 'Sewerage & waste management', sector: 'secondary' },
  { name: 'Construction — buildings', sector: 'secondary' },
  { name: 'Construction — civil engineering', sector: 'secondary' },
  { name: 'Specialised construction activities', sector: 'secondary' },
  { name: 'Building materials wholesale manufacture link', sector: 'secondary' },
  { name: 'Wholesale trade — agri & food', sector: 'tertiary' },
  { name: 'Wholesale trade — non-food', sector: 'tertiary' },
  { name: 'Retail — food', sector: 'tertiary' },
  { name: 'Retail — non-food', sector: 'tertiary' },
  { name: 'Retail — online & marketplaces', sector: 'tertiary' },
  { name: 'Motor trade', sector: 'tertiary' },
  { name: 'Land transport — freight', sector: 'tertiary' },
  { name: 'Land transport — passengers', sector: 'tertiary' },
  { name: 'Water transport', sector: 'tertiary' },
  { name: 'Air transport', sector: 'tertiary' },
  { name: 'Warehousing & storage', sector: 'tertiary' },
  { name: 'Support activities for transport', sector: 'tertiary' },
  { name: 'Postal & courier activities', sector: 'tertiary' },
  { name: 'Accommodation', sector: 'tertiary' },
  { name: 'Food & beverage service', sector: 'tertiary' },
  { name: 'Travel agency & tour operators', sector: 'tertiary' },
  { name: 'Publishing (services)', sector: 'tertiary' },
  { name: 'Motion picture & sound', sector: 'tertiary' },
  { name: 'Broadcasting', sector: 'tertiary' },
  { name: 'Telecommunications', sector: 'tertiary' },
  { name: 'Computer programming & consultancy', sector: 'tertiary' },
  { name: 'Information service activities', sector: 'tertiary' },
  { name: 'Financial service activities', sector: 'tertiary' },
  { name: 'Insurance & pension funding', sector: 'tertiary' },
  { name: 'Activities auxiliary to finance', sector: 'tertiary' },
  { name: 'Real estate activities', sector: 'tertiary' },
  { name: 'Legal activities', sector: 'tertiary' },
  { name: 'Accounting, bookkeeping & auditing', sector: 'tertiary' },
  { name: 'Management consultancy', sector: 'tertiary' },
  { name: 'Architectural & engineering', sector: 'tertiary' },
  { name: 'Scientific research & development (commercial)', sector: 'tertiary' },
  { name: 'Advertising & market research', sector: 'tertiary' },
  { name: 'Other professional services', sector: 'tertiary' },
  { name: 'Veterinary activities', sector: 'tertiary' },
  { name: 'Rental & leasing', sector: 'tertiary' },
  { name: 'Employment activities', sector: 'tertiary' },
  { name: 'Travel support & reservation', sector: 'tertiary' },
  { name: 'Security & investigation', sector: 'tertiary' },
  { name: 'Services to buildings & landscape', sector: 'tertiary' },
  { name: 'Office administrative support', sector: 'tertiary' },
  { name: 'Business support NEC', sector: 'tertiary' },
  { name: 'Repair of computers & personal goods', sector: 'tertiary' },
  { name: 'Personal service activities', sector: 'tertiary' },
  { name: 'Fitness & wellness', sector: 'tertiary' },
  { name: 'Sports, gyms & recreation (commercial)', sector: 'tertiary' },
  { name: 'Import / export trading houses', sector: 'tertiary' },
  { name: 'Other / not elsewhere classified', sector: 'tertiary' },
  { name: 'Software product companies', sector: 'quaternary' },
  { name: 'Data & analytics services', sector: 'quaternary' },
  { name: 'Research institutions (private)', sector: 'quaternary' },
  { name: 'Biotechnology', sector: 'quaternary' },
  { name: 'Higher education (private providers)', sector: 'quaternary' },
  { name: 'Technical & vocational training', sector: 'quaternary' },
  { name: 'Media & content production (knowledge)', sector: 'quaternary' },
  { name: 'Design & creative knowledge services', sector: 'quaternary' },
  { name: 'Aerospace & defence engineering services', sector: 'quaternary' },
  { name: 'Professional scientific equipment services', sector: 'quaternary' },
  { name: 'Telecommunications technology', sector: 'quaternary' },
  { name: 'Intellectual property & standards', sector: 'quaternary' },
  { name: 'Central government', sector: 'quinary' },
  { name: 'Provincial government', sector: 'quinary' },
  { name: 'Local government', sector: 'quinary' },
  { name: 'Department of Basic Education (DBE)', sector: 'quinary' },
  { name: 'Department of Health (DoH)', sector: 'quinary' },
  { name: 'Other government departments', sector: 'quinary' },
  { name: 'State-owned enterprises', sector: 'quinary' },
  { name: 'Public schools', sector: 'quinary' },
  { name: 'Independent schools', sector: 'quinary' },
  { name: 'Early childhood development', sector: 'quinary' },
  { name: 'Public higher education', sector: 'quinary' },
  { name: 'Public hospitals', sector: 'quinary' },
  { name: 'Public primary healthcare', sector: 'quinary' },
  { name: 'Private hospitals & clinics', sector: 'quinary' },
  { name: 'Public health & community care programmes', sector: 'quinary' },
  { name: 'Social services & welfare', sector: 'quinary' },
  { name: 'Defence, police & emergency', sector: 'quinary' },
  { name: 'Judiciary & justice administration', sector: 'quinary' },
  { name: 'Culture, arts & heritage', sector: 'quinary' },
  { name: 'Religious organisations', sector: 'quinary' },
  { name: 'Non-profit & NGOs', sector: 'quinary' },
  { name: 'Membership organisations', sector: 'quinary' },
  { name: 'Sports & recreation (public interest)', sector: 'quinary' },
  { name: 'International organisations & embassies', sector: 'quinary' },
  { name: 'Household employers & domestic services', sector: 'quinary' },
  { name: 'Other public interest activities', sector: 'quinary' },
] as const;

/** Flat industry names (backward compatible). */
export const COMPANY_INDUSTRIES = INDUSTRY_CATALOGUE.map((i) => i.name);

export const COMPANY_SUB_INDUSTRIES: Record<string, string[]> = {
  'Agriculture — field crops': ['Cereals & grains', 'Maize', 'Wheat', 'Rice', 'Sorghum', 'Oilseeds', 'Soybeans', 'Sunflower', 'Cotton', 'Sugar cane', 'Tobacco', 'Tea', 'Coffee', 'Cocoa', 'Legumes', 'Root crops', 'Potatoes', 'Cassava', 'Other field crops'],
  'Agriculture — horticulture': ['Vegetables', 'Fruit orchards', 'Citrus', 'Deciduous fruit', 'Subtropical fruit', 'Berries', 'Nuts', 'Flowers & floriculture', 'Nurseries', 'Greenhouse production', 'Hydroponics', 'Herbs & spices (fresh)'],
  'Agriculture — livestock': ['Cattle beef', 'Cattle dairy', 'Sheep', 'Goats', 'Pigs', 'Poultry broilers', 'Poultry layers', 'Equine', 'Game farming', 'Beekeeping', 'Mixed livestock'],
  'Aquaculture & fisheries': ['Marine capture fishing', 'Inland fishing', 'Finfish farming', 'Shellfish farming', 'Ornamental fish', 'Hatcheries', 'Seafood primary processing'],
  'Forestry & logging': ['Plantation forestry', 'Indigenous timber', 'Logging', 'Sawmilling', 'Wood chips', 'Pulpwood supply', 'Silviculture services'],
  'Mining — energy minerals': ['Coal mining', 'Uranium', 'Oil sands / unconventional'],
  'Mining — precious metals': ['Gold', 'PGMs', 'Silver', 'Diamonds'],
  'Mining — base metals': ['Iron ore', 'Copper', 'Chrome', 'Manganese', 'Nickel', 'Zinc', 'Lead', 'Tin'],
  'Mining — industrial minerals': ['Limestone', 'Phosphate', 'Salt', 'Sand & aggregates', 'Clay', 'Dimension stone', 'Industrial minerals NEC'],
  'Oil & gas extraction': ['Upstream exploration', 'Oil production', 'Gas production', 'Well services', 'Offshore support'],
  'Quarrying & aggregates': ['Hard rock quarries', 'Sand pits', 'Crushed stone', 'Ready-mix feedstock'],
  'Hunting, trapping & wildlife': ['Game hunting operations', 'Wildlife management', 'Safari concessions', 'Taxidermy supply'],
  'Food manufacturing — meat & fish': ['Abattoirs', 'Meat processing', 'Poultry processing', 'Fish processing', 'Processed meats', 'Pet food'],
  'Food manufacturing — dairy': ['Milk processing', 'Cheese', 'Yoghurt & cultured', 'Ice cream', 'Milk powder', 'Butter & spreads'],
  'Food manufacturing — bakery & milling': ['Flour milling', 'Bakeries', 'Biscuits', 'Breakfast cereals', 'Pasta'],
  'Food manufacturing — beverages': ['Soft drinks', 'Fruit juices', 'Bottled water', 'Beer brewing', 'Wine making', 'Spirits & distilling', 'Coffee roasting', 'Tea packing'],
  'Food manufacturing — other': ['Confectionery', 'Snacks', 'Oils & fats refining', 'Sugar refining', 'Ready meals', 'Sauces & condiments', 'Baby food', 'Nutraceutical foods', 'Institutional / NSNP food manufacturing', 'Canning & preserves'],
  'Animal feed manufacturing': ['Stock feed', 'Pet nutrition', 'Aquafeed'],
  'Ingredients & food intermediates': ['Flours & starches', 'Oils & fats bulk', 'Spices & seasonings', 'Flavours & fragrances (food)', 'Additives & preservatives', 'Proteins & isolates', 'Sugar & sweeteners', 'Cocoa & chocolate intermediates'],
  'Tobacco products manufacturing': ['Cigarettes', 'Other tobacco products'],
  'Textiles manufacturing': ['Yarn spinning', 'Weaving', 'Knitting', 'Non-wovens', 'Textile finishing', 'Technical textiles'],
  'Apparel & clothing manufacturing': ['Garment CMT', 'Workwear', 'Uniforms', 'Fashion apparel', 'Knitwear'],
  'Leather & footwear manufacturing': ['Tanneries', 'Footwear', 'Leather goods', 'Saddlery'],
  'Wood products manufacturing': ['Sawn timber', 'Boards & panels', 'Joinery', 'Wooden packaging', 'Engineered wood'],
  'Paper & paper products': ['Pulp', 'Paper mills', 'Packaging paper', 'Tissue', 'Stationery manufacture'],
  'Printing & related': ['Commercial print', 'Packaging print', 'Labels printing', 'Security print', 'Book manufacturing', 'Digital print'],
  'Coke & refined petroleum': ['Oil refining', 'Lubricants', 'Bitumen', 'Fuel blending'],
  'Chemicals — basic': ['Industrial gases', 'Basic inorganic', 'Basic organic', 'Fertilisers', 'Petrochemicals'],
  'Chemicals — specialty': ['Paints & coatings', 'Adhesives', 'Agrochemicals', 'Cleaning chemicals', 'Water treatment chemicals', 'Specialty chemicals NEC'],
  'Pharmaceuticals manufacturing': ['Finished dosage forms', 'APIs', 'Generics', 'Vaccines manufacture', 'Medical consumables manufacture', 'Nutraceuticals manufacture'],
  'Rubber & plastics products': ['Tyres', 'Plastic packaging', 'Pipes & profiles', 'Injection moulding', 'Foam products'],
  'Non-metallic mineral products': ['Cement', 'Ready-mix concrete', 'Bricks & blocks', 'Glass', 'Ceramics', 'Insulation'],
  'Basic metals': ['Iron & steel', 'Ferroalloys', 'Aluminium', 'Non-ferrous smelting', 'Foundries'],
  'Fabricated metal products': ['Structural steel', 'Metal fabrication', 'Tanks & vessels', 'Fasteners', 'Wire products', 'Tools'],
  'Computer, electronic & optical': ['Electronic components', 'Consumer electronics assembly', 'Medical devices (electronic)', 'Optical instruments', 'PCBs'],
  'Electrical equipment manufacturing': ['Cables & wiring', 'Motors & generators', 'Transformers', 'Switchgear', 'Lighting', 'Batteries', 'Solar modules assembly'],
  'Machinery & equipment manufacturing': ['Agricultural machinery', 'Mining equipment', 'Industrial machinery', 'HVAC equipment', 'Pumps & compressors', 'Material handling equipment'],
  'Motor vehicles & parts': ['Vehicle assembly', 'Body building', 'Trailers', 'Auto components', 'Auto aftermarket parts'],
  'Other transport equipment': ['Ship building & repair', 'Rail rolling stock', 'Aircraft components', 'Bicycles & micromobility'],
  'Furniture manufacturing': ['Household furniture', 'Office furniture', 'Mattresses', 'Shopfitting'],
  'Other manufacturing': ['Jewellery', 'Sports goods', 'Toys', 'Medical instruments (non-electronic)', 'Miscellaneous manufacturing'],
  'Repair of machinery & equipment': ['Industrial repair shops', 'Electronics repair (wholesale scale)'],
  'Electricity generation': ['Coal-fired generation', 'Gas generation', 'Hydro', 'Solar PV generation', 'Wind generation', 'IPP developers', 'Embedded generation'],
  'Electricity transmission & distribution': ['Grid operator', 'Municipal electricity', 'Wheeling services'],
  'Gas, steam & air conditioning supply': ['Pipeline gas', 'Steam / heat networks'],
  'Water collection, treatment & supply': ['Bulk water', 'Municipal water', 'Desalination', 'Bottled water source ops'],
  'Sewerage & waste management': ['Sewerage', 'Solid waste collection', 'Landfill', 'Recycling', 'Hazardous waste', 'Waste-to-energy'],
  'Construction — buildings': ['Residential building', 'Commercial building', 'Industrial buildings', 'Renovation & refurbishment'],
  'Construction — civil engineering': ['Roads & highways', 'Bridges', 'Rail infrastructure', 'Airports', 'Ports & harbours', 'Water infrastructure', 'Energy infrastructure'],
  'Specialised construction activities': ['Electrical contracting', 'Plumbing', 'HVAC install', 'Roofing', 'Demolition', 'Scaffolding', 'Finishing trades'],
  'Building materials wholesale manufacture link': ['Cement merchant manufacturing', 'Prefabricated buildings'],
  'Wholesale trade — agri & food': ['Fresh produce wholesale', 'Meat wholesale', 'Dairy wholesale', 'Beverage wholesale', 'Cash & carry food', 'Institutional food wholesale'],
  'Wholesale trade — non-food': ['Industrial equipment wholesale', 'Building materials wholesale', 'Chemicals wholesale', 'Pharmaceutical wholesale', 'ICT wholesale', 'General merchandise wholesale'],
  'Retail — food': ['Supermarkets', 'Convenience stores', 'Specialty food retail', 'Butcheries', 'Bakeries retail', 'Liquor retail'],
  'Retail — non-food': ['Apparel retail', 'Home & DIY', 'Electronics retail', 'Pharmacies', 'Automotive retail', 'Furniture retail', 'Department stores', 'Discount retail'],
  'Retail — online & marketplaces': ['E-commerce pure-play', 'Marketplace platforms', 'Social commerce', 'Click & collect retail'],
  'Motor trade': ['New vehicle dealers', 'Used vehicles', 'Parts retailers', 'Fuel retail stations', 'Tyre retail'],
  'Land transport — freight': ['Road freight FTL', 'Road freight LTL', 'Last-mile courier', 'Cross-border trucking', 'Tanker transport', 'Abnormal loads'],
  'Land transport — passengers': ['Bus services', 'Minibus taxi', 'Coach tourism', 'Rail passenger', 'Metro rail ops'],
  'Water transport': ['Deep-sea shipping', 'Coastal shipping', 'Inland waterways', 'Port stevedoring', 'Ship agency'],
  'Air transport': ['Scheduled airlines', 'Charter aviation', 'Air cargo', 'Airport ground handling'],
  'Warehousing & storage': ['General warehousing', 'Bonded warehouses', 'Cold storage', 'Grain silos', '3PL warehousing', 'Fulfilment centres'],
  'Support activities for transport': ['Freight forwarding', 'Customs brokerage', 'Logistics coordination', '4PL', 'Packing & crating', 'Container depots'],
  'Postal & courier activities': ['National post', 'Express courier', 'Parcel lockers'],
  'Accommodation': ['Hotels', 'Guest houses & B&Bs', 'Resorts', 'Serviced apartments', 'Backpackers', 'Camping & caravan'],
  'Food & beverage service': ['Full-service restaurants', 'Quick service restaurants', 'Cafés & coffee shops', 'Contract catering', 'Institutional catering', 'School feeding (SP)', 'Hospital catering', 'Event catering', 'Bars & pubs', 'Mobile food'],
  'Travel agency & tour operators': ['Travel agencies', 'Tour operators', 'Destination management', 'Online travel agencies'],
  'Publishing (services)': ['Book publishing', 'Newspaper publishing', 'Magazine publishing', 'Digital content publishing'],
  'Motion picture & sound': ['Film production', 'TV production', 'Post-production', 'Music recording', 'Cinemas'],
  'Broadcasting': ['Radio broadcasting', 'Television broadcasting', 'Streaming platforms'],
  'Telecommunications': ['Mobile network operators', 'Fixed broadband', 'Satellite comms', 'Tower companies', 'MVNOs', 'Enterprise connectivity'],
  'Computer programming & consultancy': ['Custom software development', 'IT consulting', 'Managed IT services', 'Systems integration', 'Cybersecurity services'],
  'Information service activities': ['Data processing', 'Hosting & cloud resale', 'Web portals', 'News agencies', 'Credit bureaux'],
  'Financial service activities': ['Commercial banking', 'Retail banking', 'Investment banking', 'Development finance', 'Microfinance', 'Payment services', 'Fintech (licensed)'],
  'Insurance & pension funding': ['Life insurance', 'Short-term insurance', 'Medical schemes', 'Reinsurance', 'Pension funds', 'Insurance broking'],
  'Activities auxiliary to finance': ['Stock broking', 'Fund administration', 'Financial advisory', 'Forex services', 'Asset management'],
  'Real estate activities': ['Residential property development', 'Commercial property development', 'Industrial property', 'Property management', 'Estate agencies', 'REITs ops'],
  'Legal activities': ['Attorneys', 'Advocates', 'Notaries', 'Corporate legal', 'Legal process outsourcing'],
  'Accounting, bookkeeping & auditing': ['Audit firms', 'Accounting practices', 'Tax advisory', 'Bookkeeping bureaus', 'Payroll bureaus'],
  'Management consultancy': ['Strategy consulting', 'Operations consulting', 'HR consulting', 'ESG consulting', 'Change management'],
  'Architectural & engineering': ['Architecture', 'Civil engineering consulting', 'Structural engineering', 'Quantity surveying', 'Project management (AEC)', 'Town planning'],
  'Scientific research & development (commercial)': ['Contract research orgs', 'Product testing labs', 'Calibration services'],
  'Advertising & market research': ['Advertising agencies', 'Digital marketing agencies', 'Public relations', 'Market research', 'Media buying'],
  'Other professional services': ['Design agencies', 'Photography', 'Translation', 'Interior design', 'Industrial design'],
  'Veterinary activities': ['Companion animal vets', 'Livestock vets', 'Vet hospitals'],
  'Rental & leasing': ['Vehicle rental', 'Equipment rental', 'Construction plant hire', 'Container leasing', 'Office equipment lease'],
  'Employment activities': ['Recruitment agencies', 'Temporary staffing', 'Executive search', 'Labour brokers'],
  'Travel support & reservation': ['Call centres (travel)', 'Reservation systems'],
  'Security & investigation': ['Guarding services', 'Cash-in-transit', 'Electronic security', 'Private investigation', 'Cyber investigation'],
  'Services to buildings & landscape': ['Cleaning services', 'Facilities management', 'Landscaping', 'Pest control', 'Hygiene services'],
  'Office administrative support': ['Shared service centres', 'Call centres', 'Document management', 'Virtual assistance'],
  'Business support NEC': ['Packaging services', 'Trade show services', 'Credit management', 'Collections'],
  'Repair of computers & personal goods': ['IT device repair', 'Appliance repair', 'Watch & jewellery repair'],
  'Personal service activities': ['Hair & beauty salons', 'Spas', 'Dry cleaning', 'Funeral services', 'Pet services', 'Domestic service agencies'],
  'Fitness & wellness': [
    'Gym / health club',
    'Boutique fitness studio',
    'CrossFit / functional box',
    'Yoga / pilates studio',
    'Personal training studio',
    'Wellness centre / spa',
  ],
  'Sports, gyms & recreation (commercial)': [
    'Commercial gyms',
    'Sports clubs (membership)',
    'Recreation centres (private)',
    'Sports coaching academies',
    'Adventure / outdoor recreation operators',
  ],
  'Import / export trading houses': ['Import agents', 'Export trading', 'Commodity merchants', 'Indent agents', 'General trading companies'],
  'Other / not elsewhere classified': ['Multi-industry holding', 'Conglomerate', 'Unspecified', 'General trading NEC', 'Startup (pre-industry)'],
  'Software product companies': ['SaaS horizontal', 'SaaS vertical (industry)', 'ERP vendors', 'Supply chain software', 'EdTech software', 'HealthTech software', 'FinTech software products', 'AI / ML product companies', 'Mobile app publishers'],
  'Data & analytics services': ['Business intelligence', 'Data science consultancies', 'Big data platforms', 'Geospatial analytics'],
  'Research institutions (private)': ['Independent research institutes', 'Think tanks', 'Industrial R&D centres'],
  'Biotechnology': ['Agri-biotech', 'Medical biotech', 'Industrial biotech', 'Diagnostics R&D'],
  'Higher education (private providers)': ['Private universities', 'Private colleges', 'Distance learning providers', 'Corporate universities'],
  'Technical & vocational training': ['TVET private', 'Skills development providers', 'Artisan training', 'Corporate L&D'],
  'Media & content production (knowledge)': ['Digital media studios', 'Podcast networks', 'Educational content', 'Gaming studios'],
  'Design & creative knowledge services': ['UX/UI agencies', 'Product design studios', 'Brand strategy', 'Architecture design labs'],
  'Aerospace & defence engineering services': ['Aerospace engineering', 'Defence systems engineering', 'Avionics services'],
  'Professional scientific equipment services': ['Lab equipment specialists', 'Scientific distribution knowledge'],
  'Telecommunications technology': ['Network engineering firms', '5G specialists', 'IoT platforms'],
  'Intellectual property & standards': ['Patent agencies', 'Standards bodies (private)', 'Certification scheme owners'],
  'Central government': ['Presidency / cabinet support', 'National treasury', 'National departments NEC', 'Public procurement authorities', 'National regulators'],
  'Provincial government': ['Provincial premierships', 'Provincial treasuries', 'Provincial education (PEU)', 'Provincial health', 'Provincial departments NEC'],
  'Local government': ['Metropolitan municipalities', 'Local municipalities', 'District municipalities', 'Municipal entities'],
  'Department of Basic Education (DBE)': ['National DBE', 'Curriculum & assessment', 'NSNP programme office', 'School infrastructure (education)'],
  'Department of Health (DoH)': ['National DoH', 'Provincial health programmes', 'Public health programmes', 'EMS regulation'],
  'Other government departments': ['Agriculture department', 'Social development', 'Police services admin', 'Defence administration', 'Home affairs', 'Trade & industry', 'Transport department', 'Water & sanitation', 'Energy department', 'Environment department'],
  'State-owned enterprises': ['Power utilities (SOE)', 'Transport SOEs', 'Development finance SOEs', 'Broadcasting SOEs', 'Other SOEs'],
  'Public schools': ['Primary schools', 'Secondary schools', 'Combined schools', 'Special needs schools', 'Full-service schools'],
  'Independent schools': ['Independent primary', 'Independent secondary', 'International curriculum schools', 'Faith-based schools'],
  'Early childhood development': ['ECD centres', 'Crèches', 'Grade R centres', 'Playgroups'],
  'Public higher education': ['Public universities', 'Universities of technology', 'TVET colleges (public)'],
  'Public hospitals': ['Central hospitals', 'Tertiary hospitals', 'Regional hospitals', 'District hospitals', 'Specialised hospitals'],
  'Public primary healthcare': ['Clinics', 'Community health centres', 'Mobile clinics', 'Ward-based outreach teams'],
  'Private hospitals & clinics': ['Private hospital groups', 'Day hospitals', 'Specialist private clinics', 'Primary care private', 'Occupational health clinics'],
  'Public health & community care programmes': ['HIV/TB programmes', 'Maternal & child health', 'Vaccination programmes', 'Community health worker programmes', 'Home-based care'],
  'Social services & welfare': ['Child protection services', 'Elderly care homes', 'Shelters', 'Disability services', 'Social grants administration support'],
  'Defence, police & emergency': ['SANDF support services', 'SAPS support', 'Metro police', 'Fire & rescue', 'Ambulance / EMS providers'],
  'Judiciary & justice administration': ['Courts administration', 'Legal aid', 'Correctional services support'],
  'Culture, arts & heritage': ['Museums', 'Art galleries', 'Performing arts companies', 'Heritage sites', 'Libraries (public)', 'Cultural foundations'],
  'Religious organisations': ['Churches', 'Mosques', 'Temples', 'Faith-based charities', 'Religious schools support'],
  'Non-profit & NGOs': ['Development NGOs', 'Humanitarian NGOs', 'Environmental NGOs', 'Human rights NGOs', 'Foundations & grantmakers', 'Social enterprises (NPC)', 'Community-based organisations'],
  'Membership organisations': ['Industry associations', 'Professional bodies', 'Trade unions', 'Chambers of commerce', 'Cooperatives apex bodies'],
  'Sports & recreation (public interest)': ['Sports federations', 'Community sports clubs', 'Public recreation centres', 'Olympic / high performance'],
  'International organisations & embassies': ['UN agencies', 'Development partners', 'Diplomatic missions', 'Regional bodies (AU, SADC support)'],
  'Household employers & domestic services': ['Domestic employment', 'Household management services'],
  'Other public interest activities': ['Political parties admin', 'Advocacy campaigns', 'Public benefit activities NEC'],
};

export function industriesForSector(sectorId: EconomicSectorId): string[] {
  return INDUSTRY_CATALOGUE.filter((i) => i.sector === sectorId).map((i) => i.name);
}

export function sectorForIndustry(industryName: string): EconomicSector | null {
  const def = INDUSTRY_CATALOGUE.find((i) => i.name === industryName);
  if (!def) return null;
  return ECONOMIC_SECTORS.find((s) => s.id === def.sector) || null;
}

export function industriesGroupedBySector(): Array<{
  sector: EconomicSector;
  industries: IndustryDefinition[];
}> {
  return ECONOMIC_SECTORS.map((sector) => ({
    sector,
    industries: INDUSTRY_CATALOGUE.filter((i) => i.sector === sector.id) as IndustryDefinition[],
  }));
}

export function subIndustriesFor(selectedIndustries: string[]): string[] {
  const set = new Set<string>();
  for (const ind of selectedIndustries) {
    for (const s of COMPANY_SUB_INDUSTRIES[ind] || []) set.add(s);
  }
  if (set.size === 0) {
    // Prefer not flooding UI with entire catalogue when nothing selected
    return [];
  }
  return Array.from(set).sort();
}

export function searchIndustries(query: string, limit = 40): IndustryDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...INDUSTRY_CATALOGUE].slice(0, limit);
  const hits: IndustryDefinition[] = [];
  for (const ind of INDUSTRY_CATALOGUE) {
    if (ind.name.toLowerCase().includes(q)) {
      hits.push(ind);
      continue;
    }
    const subs = COMPANY_SUB_INDUSTRIES[ind.name] || [];
    if (subs.some((s) => s.toLowerCase().includes(q))) hits.push(ind);
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Organisation / entity form for company identity (profiles.business_type). */
export const BUSINESS_TYPE_OPTIONS = [
  'Private Company (Pty Ltd)',
  'Public Company (Ltd)',
  'Close Corporation (CC)',
  'Sole Proprietor',
  'Partnership',
  'Non-Profit Company (NPC)',
  'NPO / NPC (non-profit)',
  'Trust',
  'Cooperative',
  'Branch of foreign company',
  'State-owned company (SOC)',
  'Business / wholesaler',
  'Supplier / manufacturer',
  'Service Provider (SP)',
  'Distributor / 3PL',
  'Retailer',
  'Importer / exporter',
  'Government — national department',
  'Government — provincial department',
  'Government — local / municipal',
  'Government — DBE / PEU (education)',
  'Government — Department of Health',
  'Government entity / SOE',
  'Regulator / statutory body',
  'School (public)',
  'School (independent)',
  'ECD centre',
  'TVET / college',
  'University / higher education',
  'School / Education (other)',
  'Hospital (public)',
  'Hospital (private)',
  'Clinic / primary healthcare',
  'Healthcare facility (other)',
  'Association / industry body',
  'NGO / Impact organisation',
  'Faith-based organisation',
  'Community organisation',
  'Other',
] as const;

export type BusinessTypeOption = (typeof BUSINESS_TYPE_OPTIONS)[number];

export const BUSINESS_TYPE_GROUPS: Array<{
  label: string;
  options: readonly string[];
}> = [
  {
    label: 'Legal form',
    options: [
      'Private Company (Pty Ltd)',
      'Public Company (Ltd)',
      'Close Corporation (CC)',
      'Sole Proprietor',
      'Partnership',
      'Non-Profit Company (NPC)',
      'NPO / NPC (non-profit)',
      'Trust',
      'Cooperative',
      'Branch of foreign company',
      'State-owned company (SOC)',
    ],
  },
  {
    label: 'Trade role',
    options: [
      'Business / wholesaler',
      'Supplier / manufacturer',
      'Service Provider (SP)',
      'Distributor / 3PL',
      'Retailer',
      'Importer / exporter',
    ],
  },
  {
    label: 'Government & public sector',
    options: [
      'Government — national department',
      'Government — provincial department',
      'Government — local / municipal',
      'Government — DBE / PEU (education)',
      'Government — Department of Health',
      'Government entity / SOE',
      'Regulator / statutory body',
    ],
  },
  {
    label: 'Education',
    options: [
      'School (public)',
      'School (independent)',
      'ECD centre',
      'TVET / college',
      'University / higher education',
      'School / Education (other)',
    ],
  },
  {
    label: 'Health',
    options: [
      'Hospital (public)',
      'Hospital (private)',
      'Clinic / primary healthcare',
      'Healthcare facility (other)',
    ],
  },
  {
    label: 'Civil society',
    options: [
      'Association / industry body',
      'NGO / Impact organisation',
      'Faith-based organisation',
      'Community organisation',
    ],
  },
  { label: 'Other', options: ['Other'] },
];

