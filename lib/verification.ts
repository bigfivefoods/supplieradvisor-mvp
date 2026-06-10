// lib/verification.ts
// Company registration verification authorities and workflows

export interface VerificationAuthority {
  name: string;
  fullName: string;
  country: string;
  url: string;
  lookupUrl?: string;
  description: string;
  requiredDocs: string[];
  registrationNumberLabel: string;
  registrationNumberExample: string;
  verificationSteps: string[];
  applicableBusinessTypes?: string[]; // if empty/undefined → applies to ALL types
}

export const VERIFICATION_AUTHORITIES: Record<string, VerificationAuthority> = {
  'South Africa': {
    name: 'CIPC',
    fullName: 'Companies and Intellectual Property Commission',
    country: 'South Africa',
    url: 'https://bizportal.cipc.co.za/',
    lookupUrl: 'https://iportal.cipc.co.za/CompanySearch.aspx',
    description: 'South Africa\'s official registrar for companies, co-operatives, and intellectual property.',
    requiredDocs: [
      'Company Registration Certificate (CoR15.1A / CoR15.1B)',
      'Memorandum of Incorporation (MOI)',
      'CIPC Certificate of Incorporation',
      'Valid ID / Passport of Directors',
    ],
    registrationNumberLabel: 'CIPC Registration Number',
    registrationNumberExample: 'e.g. 2020/123456/07',
    verificationSteps: [
      'Enter your CIPC registration number below',
      'Upload your CoR15.1A or CoR15.1B certificate',
      'Our system cross-checks against CIPC public records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Nigeria': {
    name: 'CAC',
    fullName: 'Corporate Affairs Commission',
    country: 'Nigeria',
    url: 'https://www.cac.gov.ng/',
    lookupUrl: 'https://search.cac.gov.ng/home',
    description: 'Nigeria\'s official body responsible for company incorporation and regulation.',
    requiredDocs: [
      'Certificate of Incorporation (RC Number)',
      'CAC Form CAC/BN/1 (for Business Names)',
      'Memorandum & Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'CAC Registration Number',
    registrationNumberExample: 'e.g. RC123456',
    verificationSteps: [
      'Enter your CAC RC or BN registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against the CAC public register',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Kenya': {
    name: 'BRS',
    fullName: 'Business Registration Service',
    country: 'Kenya',
    url: 'https://brs.go.ke/',
    lookupUrl: 'https://brs.go.ke/services/search-company',
    description: 'Kenya\'s Business Registration Service under the Attorney-General\'s office.',
    requiredDocs: [
      'Certificate of Incorporation / Business Registration Certificate',
      'Articles of Association',
      'Director / Partner ID documents',
    ],
    registrationNumberLabel: 'BRS Registration Number',
    registrationNumberExample: 'e.g. CPR/2020/12345',
    verificationSteps: [
      'Enter your BRS registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against BRS public records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Ghana': {
    name: 'RGD',
    fullName: 'Registrar General\'s Department',
    country: 'Ghana',
    url: 'https://www.rgd.gov.gh/',
    lookupUrl: 'https://www.rgd.gov.gh/company-search',
    description: 'Ghana\'s Registrar General\'s Department handles all business registrations.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Regulations / Articles of Incorporation',
      'Form 3 (Return of Particulars)',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'RGD Registration Number',
    registrationNumberExample: 'e.g. CS-123456789',
    verificationSteps: [
      'Enter your RGD registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against RGD public records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Tanzania': {
    name: 'BRELA',
    fullName: 'Business Registrations and Licensing Agency',
    country: 'Tanzania',
    url: 'https://www.brela.go.tz/',
    description: 'Tanzania\'s agency responsible for business registrations and licensing.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Memorandum & Articles of Association',
      'Particulars of Directors',
    ],
    registrationNumberLabel: 'BRELA Registration Number',
    registrationNumberExample: 'e.g. 12345',
    verificationSteps: [
      'Enter your BRELA registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against BRELA records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Uganda': {
    name: 'URSB',
    fullName: 'Uganda Registration Services Bureau',
    country: 'Uganda',
    url: 'https://ursb.go.ug/',
    description: 'Uganda\'s bureau for company and business name registrations.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Memorandum & Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'URSB Registration Number',
    registrationNumberExample: 'e.g. 80020001234567',
    verificationSteps: [
      'Enter your URSB registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against URSB records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Ethiopia': {
    name: 'MoT',
    fullName: 'Ministry of Trade and Regional Integration',
    country: 'Ethiopia',
    url: 'https://www.mot.gov.et/',
    description: 'Ethiopia\'s Ministry of Trade oversees business registration.',
    requiredDocs: [
      'Trade Name Registration Certificate',
      'Business License',
      'TIN Certificate',
    ],
    registrationNumberLabel: 'Trade Registration Number',
    registrationNumberExample: 'e.g. AA/12345',
    verificationSteps: [
      'Enter your trade registration number',
      'Upload your registration certificate and business license',
      'Our system verifies against Ministry of Trade records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Rwanda': {
    name: 'RDB',
    fullName: 'Rwanda Development Board',
    country: 'Rwanda',
    url: 'https://org.rdb.rw/',
    description: 'Rwanda Development Board handles all business registrations in Rwanda.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'RDB Registration Number',
    registrationNumberExample: 'e.g. 103234567',
    verificationSteps: [
      'Enter your RDB registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against RDB records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Zambia': {
    name: 'PACRA',
    fullName: 'Patents and Companies Registration Agency',
    country: 'Zambia',
    url: 'https://www.pacra.org.zm/',
    description: 'PACRA registers companies, business names, and intellectual property in Zambia.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Articles and Memorandum of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'PACRA Registration Number',
    registrationNumberExample: 'e.g. 120100000001',
    verificationSteps: [
      'Enter your PACRA registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against PACRA records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Zimbabwe': {
    name: 'ZIMRA / CROCO',
    fullName: 'Companies and Other Business Entities (COBE) Registrar',
    country: 'Zimbabwe',
    url: 'https://www.cobe.co.zw/',
    description: 'Zimbabwe\'s registrar for companies under the COBE Act.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Articles of Association',
      'CR6 – Particulars of Directors',
    ],
    registrationNumberLabel: 'COBE Registration Number',
    registrationNumberExample: 'e.g. 1234/2020',
    verificationSteps: [
      'Enter your COBE registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against the Registrar\'s records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Botswana': {
    name: 'CIPA',
    fullName: 'Companies and Intellectual Property Authority',
    country: 'Botswana',
    url: 'https://www.cipa.co.bw/',
    description: 'Botswana\'s authority for company and intellectual property registrations.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'CIPA Registration Number',
    registrationNumberExample: 'e.g. BW00001234567',
    verificationSteps: [
      'Enter your CIPA registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against CIPA records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Mozambique': {
    name: 'CREL',
    fullName: 'Conservatória do Registo das Entidades Legais',
    country: 'Mozambique',
    url: 'https://www.minjusdh.gov.mz/',
    description: 'Mozambique\'s legal entity registry under the Ministry of Justice.',
    requiredDocs: [
      'Commercial Registration Certificate',
      'Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'CREL Registration Number',
    registrationNumberExample: 'e.g. 40/2020',
    verificationSteps: [
      'Enter your CREL registration number',
      'Upload your registration certificate',
      'Our system verifies against CREL records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'United Kingdom': {
    name: 'Companies House',
    fullName: 'Companies House',
    country: 'United Kingdom',
    url: 'https://www.gov.uk/get-information-about-a-company',
    lookupUrl: 'https://find-and-update.company-information.service.gov.uk/',
    description: 'The UK\'s official registrar of companies.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Memorandum & Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'Companies House Number',
    registrationNumberExample: 'e.g. 12345678',
    verificationSteps: [
      'Enter your Companies House registration number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against Companies House public records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Germany': {
    name: 'Handelsregister',
    fullName: 'Handelsregister (Commercial Register)',
    country: 'Germany',
    url: 'https://www.handelsregister.de/',
    description: 'Germany\'s official commercial register.',
    requiredDocs: [
      'Handelsregisterauszug (Commercial Register Extract)',
      'Articles of Association (Satzung)',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'Handelsregister Number',
    registrationNumberExample: 'e.g. HRB 12345',
    verificationSteps: [
      'Enter your Handelsregister number',
      'Upload your current Handelsregisterauszug',
      'Our system verifies against German commercial register records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'France': {
    name: 'SIREN/SIRENE',
    fullName: 'Registre du Commerce et des Sociétés (RCS)',
    country: 'France',
    url: 'https://www.infogreffe.fr/',
    description: 'France\'s official commercial and companies register.',
    requiredDocs: [
      'Kbis Extract (less than 3 months old)',
      'Articles of Association (Statuts)',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'SIREN Number',
    registrationNumberExample: 'e.g. 123 456 789',
    verificationSteps: [
      'Enter your SIREN number',
      'Upload your Kbis extract',
      'Our system verifies against SIRENE/RCS records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'United States': {
    name: 'State SOS',
    fullName: 'State Secretary of State / Business Registry',
    country: 'United States',
    url: 'https://www.sos.state/',
    description: 'US companies are registered at the state level with the Secretary of State.',
    requiredDocs: [
      'Articles of Incorporation / Organization',
      'Certificate of Good Standing',
      'EIN Confirmation Letter (SS-4)',
      'Director / Member Identification Documents',
    ],
    registrationNumberLabel: 'State Registration / EIN Number',
    registrationNumberExample: 'e.g. EIN 12-3456789',
    verificationSteps: [
      'Enter your state registration number or EIN',
      'Upload your Articles of Incorporation and Certificate of Good Standing',
      'Our system verifies against your state\'s business registry',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Canada': {
    name: 'Corporations Canada',
    fullName: 'Corporations Canada / Provincial Registrar',
    country: 'Canada',
    url: 'https://corporationscanada.ic.gc.ca/',
    description: 'Federal and provincial company registrations in Canada.',
    requiredDocs: [
      'Certificate of Incorporation',
      'Articles of Incorporation',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'Corporation Number',
    registrationNumberExample: 'e.g. 1234567-8',
    verificationSteps: [
      'Enter your federal or provincial corporation number',
      'Upload your Certificate of Incorporation',
      'Our system verifies against Corporations Canada records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'India': {
    name: 'MCA / ROC',
    fullName: 'Ministry of Corporate Affairs – Registrar of Companies',
    country: 'India',
    url: 'https://www.mca.gov.in/',
    lookupUrl: 'https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do',
    description: 'India\'s Ministry of Corporate Affairs oversees company registration.',
    requiredDocs: [
      'Certificate of Incorporation (CoI)',
      'Memorandum of Association (MoA)',
      'Articles of Association (AoA)',
      'PAN Card of the Company',
      'Director DIN / Identification Documents',
    ],
    registrationNumberLabel: 'CIN (Corporate Identity Number)',
    registrationNumberExample: 'e.g. U74999MH2020PTC123456',
    verificationSteps: [
      'Enter your CIN',
      'Upload your Certificate of Incorporation',
      'Our system verifies against MCA21 records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Brazil': {
    name: 'CNPJ / JUCESP',
    fullName: 'Cadastro Nacional da Pessoa Jurídica',
    country: 'Brazil',
    url: 'https://www.receita.fazenda.gov.br/',
    description: 'Brazil\'s Federal Revenue Service CNPJ register.',
    requiredDocs: [
      'CNPJ Registration Certificate',
      'Contrato Social / Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'CNPJ Number',
    registrationNumberExample: 'e.g. 12.345.678/0001-90',
    verificationSteps: [
      'Enter your CNPJ number',
      'Upload your registration certificate',
      'Our system verifies against the Receita Federal records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
  'Australia': {
    name: 'ASIC',
    fullName: 'Australian Securities & Investments Commission',
    country: 'Australia',
    url: 'https://asic.gov.au/',
    lookupUrl: 'https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx',
    description: 'Australia\'s corporate regulator ASIC.',
    requiredDocs: [
      'Certificate of Registration (ACN)',
      'Constitution / Articles of Association',
      'Director Identification Documents',
    ],
    registrationNumberLabel: 'ACN / ABN Number',
    registrationNumberExample: 'e.g. ACN 123 456 789',
    verificationSteps: [
      'Enter your ACN or ABN',
      'Upload your ASIC Certificate of Registration',
      'Our system verifies against ASIC records',
      'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
    ],
  },
};

/** Default / fallback authority for countries not explicitly mapped. */
export const DEFAULT_AUTHORITY: VerificationAuthority = {
  name: 'National Registrar',
  fullName: 'National Business Registration Authority',
  country: 'International',
  url: '',
  description: 'Your country\'s official business registration authority.',
  requiredDocs: [
    'Certificate of Incorporation or Business Registration Certificate',
    'Articles / Memorandum of Association',
    'Director / Owner Identification Documents',
  ],
  registrationNumberLabel: 'Registration Number',
  registrationNumberExample: 'As shown on your registration certificate',
  verificationSteps: [
    'Enter your official registration number',
    'Upload your certificate of incorporation or business registration',
    'Our team verifies the documents against official records',
    'Approved profiles receive an on-chain Verified Badge (SBT) on Polygon',
  ],
};

/**
 * Returns the appropriate verification authority for a given country.
 * Falls back to DEFAULT_AUTHORITY if no specific entry is found.
 */
export function getVerificationAuthority(country: string): VerificationAuthority {
  return VERIFICATION_AUTHORITIES[country] ?? DEFAULT_AUTHORITY;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  authority?: string;
}

// --- Country-specific stubs ---
// These perform format validation client-side.
// Server-side deep verification against the authority's API is handled separately.

function verifyCIPC(registrationNumber: string): VerificationResult {
  const clean = registrationNumber.trim();
  const cipcPattern = /^\d{4}\/\d+\/\d{2}$/;
  if (!cipcPattern.test(clean)) {
    return { success: false, message: 'Invalid CIPC format. Expected format: YYYY/NNNNNN/NN (e.g. 2020/123456/07).' };
  }
  return { success: true, message: 'CIPC number format is valid. Submitting for verification…', authority: 'CIPC' };
}

function verifyCAC(registrationNumber: string): VerificationResult {
  const clean = registrationNumber.trim().toUpperCase();
  if (!clean.startsWith('RC') && !clean.startsWith('BN') && !clean.startsWith('IT') && !clean.startsWith('LP')) {
    return { success: false, message: 'Invalid CAC format. Number should start with RC, BN, IT, or LP.' };
  }
  return { success: true, message: 'CAC number format is valid. Submitting for verification…', authority: 'CAC' };
}

function verifyCompaniesHouse(registrationNumber: string): VerificationResult {
  const clean = registrationNumber.trim();
  if (clean.length < 8 || !/^[0-9A-Z]{6,8}$/.test(clean)) {
    return { success: false, message: 'Invalid Companies House number. Must be 8 alphanumeric characters.' };
  }
  return { success: true, message: 'Companies House number format is valid. Submitting for verification…', authority: 'Companies House' };
}

function verifyASIC(registrationNumber: string): VerificationResult {
  const clean = registrationNumber.replace(/\s/g, '');
  if (!/^\d{9,11}$/.test(clean)) {
    return { success: false, message: 'Invalid ACN/ABN. Must be 9–11 digits.' };
  }
  return { success: true, message: 'ACN/ABN format is valid. Submitting for verification…', authority: 'ASIC' };
}

function verifyMCA(registrationNumber: string): VerificationResult {
  const clean = registrationNumber.trim().toUpperCase();
  if (clean.length < 21) {
    return { success: false, message: 'Invalid CIN. Must be 21 characters (e.g. U74999MH2020PTC123456).' };
  }
  return { success: true, message: 'CIN format is valid. Submitting for verification…', authority: 'MCA / ROC' };
}

function verifyGeneric(registrationNumber: string, country: string): VerificationResult {
  if (!registrationNumber.trim()) {
    return { success: false, message: 'Please enter your registration number.' };
  }
  const authority = getVerificationAuthority(country);
  return { success: true, message: `Registration number accepted. Submitting for verification with ${authority.name}…`, authority: authority.name };
}

/**
 * Client-side validation of a registration number for the given country.
 * Returns success=true when the format looks correct and the record should be
 * submitted for deeper verification.
 */
export function verifyCompanyRegistration(
  registrationNumber: string,
  country: string,
): VerificationResult {
  switch (country) {
    case 'South Africa':
      return verifyCIPC(registrationNumber);
    case 'Nigeria':
      return verifyCAC(registrationNumber);
    case 'United Kingdom':
      return verifyCompaniesHouse(registrationNumber);
    case 'Australia':
      return verifyASIC(registrationNumber);
    case 'India':
      return verifyMCA(registrationNumber);
    default:
      return verifyGeneric(registrationNumber, country);
  }
}
