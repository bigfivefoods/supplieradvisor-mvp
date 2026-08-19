import {
  PORTAL_SECTIONS,
  type AdvisorPortalModule,
} from '@/lib/advisors/portal-sections';

export type GrowPreviewSettings = {
  enabled?: boolean;
  brand_name?: string;
  public_bio?: string;
  website_url?: string;
  embed_primary_color?: string;
  primary_color?: string;
  company_logo_url?: string | null;
};

export type GrowPreviewCopy = {
  audience: string;
  audienceSingular: string;
  pwaEyebrow: string;
  pwaTabs: string[];
  pwaActiveTab: string;
  sampleTitle: string;
  sampleWhen: string;
  sampleHint: string;
  websiteCta: string;
  showWeekDiary: boolean;
  color: string;
};

export function growWebsiteNav(module: AdvisorPortalModule): string[] {
  return (PORTAL_SECTIONS[module] || []).map((s) => s.label);
}

export function growPreviewCopy(module: AdvisorPortalModule): GrowPreviewCopy {
  switch (module) {
    case 'fitgraph':
      return {
        audience: 'members',
        audienceSingular: 'member',
        pwaEyebrow: 'Member portal · GymAdvisor®',
        pwaTabs: ['Check in', 'Book', 'My classes', 'Progress', 'Messages'],
        pwaActiveTab: 'Book',
        sampleTitle: 'Morning strength',
        sampleWhen: 'Tue · 06:00',
        sampleHint: 'Book a class, check in at the door, and track goals.',
        websiteCta: 'Book a class',
        showWeekDiary: true,
        color: '#E8E830',
      };
    case 'physiograph':
      return {
        audience: 'patients',
        audienceSingular: 'patient',
        pwaEyebrow: 'Patient portal · PhysioAdvisor®',
        pwaTabs: ['Open diary', 'My bookings', 'My care', 'Messages', 'My profile'],
        pwaActiveTab: 'Open diary',
        sampleTitle: 'Follow-up consult',
        sampleWhen: 'Wed · 09:30',
        sampleHint: 'Book an open slot, see rehab, and message the clinic.',
        websiteCta: 'Book a visit',
        showWeekDiary: true,
        color: '#0d9488',
      };
    case 'dentalgraph':
      return {
        audience: 'patients',
        audienceSingular: 'patient',
        pwaEyebrow: 'Patient portal · DentalAdvisor®',
        pwaTabs: ['Open diary', 'My bookings', 'My care', 'Messages', 'My profile'],
        pwaActiveTab: 'Open diary',
        sampleTitle: 'Hygiene visit',
        sampleWhen: 'Thu · 11:00',
        sampleHint: 'Book, see visit notes the practice shares, and pay.',
        websiteCta: 'Book a visit',
        showWeekDiary: true,
        color: '#0284c7',
      };
    case 'psychiatrygraph':
      return {
        audience: 'patients',
        audienceSingular: 'patient',
        pwaEyebrow: 'Patient portal · PsychiatryAdvisor®',
        pwaTabs: ['Book', 'My bookings', 'My records', 'Messages', 'My profile'],
        pwaActiveTab: 'Book',
        sampleTitle: 'Review session',
        sampleWhen: 'Fri · 14:00',
        sampleHint: 'Book, keep care notes private to this practice.',
        websiteCta: 'Book a session',
        showWeekDiary: true,
        color: '#6366f1',
      };
    case 'medicalgraph':
      return {
        audience: 'patients',
        audienceSingular: 'patient',
        pwaEyebrow: 'Patient portal · MedicalAdvisor®',
        pwaTabs: ['Book', 'My bookings', 'Visit history', 'My records', 'Messages'],
        pwaActiveTab: 'Book',
        sampleTitle: 'GP consult',
        sampleWhen: 'Mon · 08:15',
        sampleHint: 'Book, update ailments, and rate the visit after.',
        websiteCta: 'Book a consult',
        showWeekDiary: true,
        color: '#059669',
      };
    case 'hiregraph':
      return {
        audience: 'hirers',
        audienceSingular: 'hirer',
        pwaEyebrow: 'HireAdvisor® · customer portal',
        pwaTabs: ['Browse', 'My hires', 'Calendar', 'Docs', 'Account'],
        pwaActiveTab: 'Browse',
        sampleTitle: 'Mini excavator',
        sampleWhen: 'Available today',
        sampleHint: 'Browse kit, request a hire, and track the job.',
        websiteCta: 'Browse catalogue',
        showWeekDiary: false,
        color: '#0891b2',
      };
    case 'retailgraph':
      return {
        audience: 'shoppers',
        audienceSingular: 'shopper',
        pwaEyebrow: 'Shopper portal · RetailAdvisor®',
        pwaTabs: ['Shop', 'Orders', 'Messages', 'Account'],
        pwaActiveTab: 'Shop',
        sampleTitle: 'House blend 250g',
        sampleWhen: 'In stock',
        sampleHint: 'Shop, pay, and see orders on their phone.',
        websiteCta: 'Shop now',
        showWeekDiary: false,
        color: '#ea580c',
      };
    default:
      return {
        audience: 'clients',
        audienceSingular: 'client',
        pwaEyebrow: 'Client portal',
        pwaTabs: ['Home', 'Book', 'Messages', 'Profile'],
        pwaActiveTab: 'Book',
        sampleTitle: 'Next visit',
        sampleWhen: 'This week',
        sampleHint: 'Book and message from their phone.',
        websiteCta: 'Visit site',
        showWeekDiary: true,
        color: '#0f172a',
      };
  }
}
