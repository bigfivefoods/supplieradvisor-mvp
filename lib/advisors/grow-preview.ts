import {
  PORTAL_SECTIONS,
  type AdvisorPortalModule,
} from '@/lib/advisors/portal-sections';
import { clinicPwaCopy } from '@/lib/clinic/clinic-pwa-copy';

export type GrowPreviewSettings = {
  enabled?: boolean;
  brand_name?: string;
  public_bio?: string;
  website_url?: string;
  embed_primary_color?: string;
  primary_color?: string;
  company_logo_url?: string | null;
  public_token?: string;
  pwa_enabled?: boolean;
  pwa_name?: string;
  pwa_short_name?: string;
  pwa_description?: string;
  pwa_theme_color?: string;
  pwa_background_color?: string;
  pwa_icon_url?: string | null;
};

export type GrowPreviewCopy = {
  audience: string;
  audienceSingular: string;
  pwaEyebrow: string;
  pwaTabs: string[];
  pwaActiveTab: string;
  /** Desk preview slider — every customer PWA screen (HireAdvisor). */
  pwaPreviewScreens?: Array<{ id: string; title: string }>;
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
        staffTabs: ['Today', 'Diary', 'You', 'People', 'Inbox'],
        staffSample: '06:00 Morning strength · 12 booked',
        showProgramme: true,
        programmeName: 'Hyrox 6',
        programmeHint:
          'You build a week-by-week calendar of movements, sell or assign it, and members log feel and effort after each day.',
      };
    case 'medicalgraph':
    case 'physiograph':
    case 'dentalgraph':
    case 'psychiatrygraph':
    case 'vetgraph': {
      const clinic = clinicPwaCopy(module);
      return {
        audience: clinic.audience,
        audienceSingular: clinic.audienceSingular,
        pwaEyebrow: clinic.pwaEyebrow,
        pwaTabs: clinic.pwaTabs,
        pwaActiveTab: clinic.pwaActiveTab,
        sampleTitle: clinic.sampleTitle,
        sampleWhen: clinic.sampleWhen,
        sampleHint: clinic.sampleHint,
        websiteCta: clinic.websiteCta,
        showWeekDiary: true,
        color: clinic.color,
        staffRole: clinic.staffRole,
        staffEyebrow: clinic.staffEyebrow,
        staffTabs: clinic.staffTabs,
        staffSample: clinic.staffSample,
      };
    }
    case 'hiregraph':
      return {
        audience: 'customers',
        audienceSingular: 'customer',
        pwaEyebrow: 'Customer app · HireAdvisor®',
        pwaTabs: ['Search', 'Hire', 'You', 'Track', 'Nearby'],
        pwaActiveTab: 'Search',
        pwaPreviewScreens: [
          { id: 'search', title: 'Search' },
          { id: 'hire', title: 'Hire' },
          { id: 'you', title: 'You' },
          { id: 'docs', title: 'Docs' },
          { id: 'calendar', title: 'Calendar' },
          { id: 'track', title: 'Track' },
          { id: 'history', title: 'History' },
          { id: 'nearby', title: 'Nearby' },
        ],
        sampleTitle: 'Acme Plant',
        sampleWhen: '2 items · from R950 / day',
        sampleHint: 'Search suppliers, hire kit, and track when it is coming.',
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
