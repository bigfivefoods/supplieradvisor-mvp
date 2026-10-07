export type FooterLink = {
  label: string;
  href: string;
};

export type FooterLinkGroup = {
  label: string;
  links: FooterLink[];
};

export const FOOTER_TAGLINE =
  "The world's most trusted supplier advice and supply-chain OS — B2B, B2G, and B2C on one verified network.";
export const FOOTER_MOTTO = 'Built for operators who measure trust.';

export const FOOTER_SOCIALS = [
  {
    label: 'SupplierAdvisor on X',
    href: 'https://x.com/supplieradvisa',
    iconPath:
      'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z',
  },
] as const;

export const FOOTER_CONTACT = {
  email: {
    label: 'hello@supplieradvisor.com',
    href: 'mailto:hello@supplieradvisor.com',
  },
  phone: {
    label: '+27 (0) 82 581 4215',
    href: 'tel:+27825814215',
  },
  whatsapp: {
    label: 'WhatsApp',
    href: 'https://wa.me/27825814215?text=Hi%20SupplierAdvisor%2C%20I%27d%20like%20to%20enquire%20about%3A%20',
  },
  country: 'South Africa',
} as const;

export const FOOTER_EXPLORE_GROUPS: FooterLinkGroup[] = [
  {
    label: 'Product',
    links: [
      { label: 'Product', href: '/#video' },
      { label: 'SA Member', href: '/#member-app' },
      { label: 'Why SA', href: '/#why-join' },
      { label: 'Modules', href: '/#modules' },
      { label: 'How it fits', href: '/#packaging' },
      { label: 'Compare platforms', href: '/#compare' },
      { label: 'Security', href: '/#security' },
    ],
  },
  {
    label: 'Get started',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'ROI calculator', href: '/#roi' },
      { label: 'Interactive demo', href: '/demo' },
      { label: 'Start free trial', href: '/onboarding?lane=b2b' },
      { label: 'Join as business', href: '/join' },
      { label: 'Log in', href: '/login' },
    ],
  },
];

export const FOOTER_INDUSTRY_GROUPS: FooterLinkGroup[] = [
  {
    label: 'Supply chain',
    links: [
      { label: 'Food & beverage', href: '/industries/food-beverage' },
      { label: 'Agriculture & inputs', href: '/industries/agriculture' },
      { label: 'Quarry & aggregates', href: '/industries/quarry-aggregates' },
      { label: 'Manufacturing', href: '/industries/manufacturing' },
      { label: 'Apparel & clothing', href: '/industries/apparel-clothing' },
      { label: 'Building & construction', href: '/industries/construction-building' },
      { label: 'Distribution & logistics', href: '/industries/distribution' },
      { label: 'Container last-mile', href: '/industries/containers' },
    ],
  },
  {
    label: 'Health & fitness',
    links: [
      { label: 'Fitness & gyms', href: '/industries/fitness-gyms' },
      { label: 'Physio & allied health', href: '/industries/physio-allied-health' },
      { label: 'Dental practices', href: '/industries/dental' },
      { label: 'Mental health', href: '/industries/mental-health' },
      { label: 'Medical practices', href: '/industries/medical-practices' },
      { label: 'Veterinary practices', href: '/industries/veterinary-practices' },
    ],
  },
  {
    label: 'Retail, hire & public',
    links: [
      { label: 'Retail till', href: '/industries/retail-shop' },
      { label: 'Hire & rental', href: '/industries/hire-rental' },
      { label: 'Public sector (B2G)', href: '/industries/public-sector' },
      { label: 'Groups & brands', href: '/industries/multi-entity' },
      { label: 'All industries', href: '/industries' },
    ],
  },
];

export const FOOTER_RESOURCE_GROUPS: FooterLinkGroup[] = [
  {
    label: 'Network',
    links: [
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Find an advisor', href: '/marketplace/advisors' },
    ],
  },
  {
    label: 'Trust',
    links: [{ label: 'CIPC verification SLA', href: '/verification-sla' }],
  },
  {
    label: 'Apps',
    links: [
      { label: 'SA Member sign-up', href: '/me' },
      { label: 'Install the app', href: '/install' },
    ],
  },
];

export const FOOTER_LEGAL_LINKS: FooterLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Cancellation & refunds', href: '/cancellation-refund' },
];

export const FOOTER_FOUNDING = {
  title: 'Founding list',
  blurb: 'Founding-member updates and new-slot alerts from SupplierAdvisor®.',
} as const;
