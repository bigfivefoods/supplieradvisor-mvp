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
  staffRole: string | null;
  staffEyebrow: string;
  staffTabs: string[];
  staffSample: string;
  /** GymAdvisor (and similar): week calendar members follow */
  showProgramme?: boolean;
  programmeName?: string;
  programmeHint?: string;
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
        pwaEyebrow: 'Member · GymAdvisor®',
        pwaTabs: ['Class', 'Progress', 'You', 'Shop', 'Share'],
        pwaActiveTab: 'Class',
        sampleTitle: 'Morning strength',
        sampleWhen: 'Tue · 06:00',
        sampleHint:
          'Class diary, programmes on Progress, shop, and You in the centre of the phone dock.',
        websiteCta: 'Book a class',
        showWeekDiary: true,
        color: '#E8E830',
        staffRole: 'contracted coach',
        staffEyebrow: 'Coach · GymAdvisor®',
        staffTabs: ['Today', 'Diary', 'People', 'Inbox', 'Me'],
        staffSample: '06:00 Morning strength · 12 booked',
        showProgramme: true,
        programmeName: 'Hyrox 6',
        programmeHint:
          'You build a week-by-week calendar of movements, sell or assign it, and members log feel and effort after each day.',
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
        staffRole: 'contracted practitioner',
        staffEyebrow: 'Practitioner PWA · PhysioAdvisor®',
        staffTabs: ['Today', 'Diary', 'People', 'Inbox', 'Me'],
        staffSample: 'Today · 09:30 Follow-up · 1 patient',
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
        staffRole: 'contracted clinician',
        staffEyebrow: 'Clinician PWA · DentalAdvisor®',
        staffTabs: ['Today', 'Diary', 'People', 'Inbox', 'Me'],
        staffSample: 'Today · 11:00 Hygiene · chair 2',
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
        staffRole: 'contracted practitioner',
        staffEyebrow: 'Practitioner PWA · PsychiatryAdvisor®',
        staffTabs: ['Today', 'Diary', 'People', 'Inbox', 'Me'],
        staffSample: 'Today · 14:00 Review session',
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
        staffRole: 'contracted practitioner',
        staffEyebrow: 'Practitioner PWA · MedicalAdvisor®',
        staffTabs: ['Today', 'Diary', 'People', 'Inbox', 'Me'],
        staffSample: 'Today · 08:15 GP consult',
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
        staffRole: null,
        staffEyebrow: '',
        staffTabs: [],
        staffSample: '',
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
        staffRole: null,
        staffEyebrow: '',
        staffTabs: [],
        staffSample: '',
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
        staffRole: null,
        staffEyebrow: '',
        staffTabs: [],
        staffSample: '',
      };
  }
}
