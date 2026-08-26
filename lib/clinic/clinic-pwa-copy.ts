/**
 * Industry-specific PWA wording for clinic Advisors.
 * Dock ids stay stable (mine / open / care / …); labels and care copy change.
 */
export type ClinicPwaModule =
  | 'physiograph'
  | 'dentalgraph'
  | 'medicalgraph'
  | 'psychiatrygraph'
  | 'vetgraph';

export type ClinicPwaCopy = {
  product: string;
  audience: string;
  audienceSingular: string;
  staffSingular: string;
  staffPlural: string;
  visitSingular: string;
  visitPlural: string;
  bookCta: string;
  joinHint: string;
  memberAppLabel: string;
  openingApp: string;
  signedOutHint: string;
  signInMember: string;
  signInStaff: string;
  dockBook: string;
  dockDiary: string;
  dockYou: string;
  dockCare: string;
  dockShare: string;
  dockInbox: string;
  careTitle: string;
  careHint: string;
  careHeading: string;
  historyTitle: string;
  historyHint: string;
  historyEmpty: string;
  bookHint: string;
  waitlistAnyClinician: string;
  photoKind: 'patient_photo';
  selfRole: 'patient';
  color: string;
  pwaEyebrow: string;
  pwaTabs: string[];
  pwaActiveTab: string;
  sampleTitle: string;
  sampleWhen: string;
  sampleHint: string;
  websiteCta: string;
  staffRole: string;
  staffEyebrow: string;
  staffTabs: string[];
  staffSample: string;
};

const SHARED_STAFF_TABS = ['Today', 'Diary', 'You', 'People', 'Inbox'];

const COPY: Record<ClinicPwaModule, ClinicPwaCopy> = {
  medicalgraph: {
    product: 'MedicalAdvisor®',
    audience: 'patients',
    audienceSingular: 'patient',
    staffSingular: 'practitioner',
    staffPlural: 'Practitioners',
    visitSingular: 'consult',
    visitPlural: 'consults',
    bookCta: 'Book a consult',
    joinHint:
      'Create your patient account for this practice — consults, scripts and records live here.',
    memberAppLabel: 'patient app',
    openingApp: 'Opening your patient app…',
    signedOutHint: 'Signed out. Sign in as a patient, or as a practitioner.',
    signInMember: 'Patient — name and email on your file',
    signInStaff: 'I work here — name and email on Practitioners',
    dockBook: 'Book',
    dockDiary: 'Diary',
    dockYou: 'You',
    dockCare: 'Records',
    dockShare: 'Share',
    dockInbox: 'Inbox',
    careTitle: 'My records',
    careHint: 'Scripts, ailments and notes this practice has shared with you.',
    careHeading: 'Prescribed scripts',
    historyTitle: 'Visit history',
    historyHint: 'Past consults and visit notes the practice has shared with you.',
    historyEmpty:
      'No past consults yet. After you attend, notes and scripts appear here.',
    bookHint:
      'Your next consults. Tap a card for details, cancel, or rate after the visit.',
    waitlistAnyClinician: 'any practitioner if needed',
    photoKind: 'patient_photo',
    selfRole: 'patient',
    color: '#059669',
    pwaEyebrow: 'Patient app · MedicalAdvisor®',
    pwaTabs: ['Book', 'Diary', 'You', 'Records', 'Share'],
    pwaActiveTab: 'Book',
    sampleTitle: 'GP consult',
    sampleWhen: 'Mon · 08:15',
    sampleHint: 'Book a consult, keep ailments current, and rate the visit after.',
    websiteCta: 'Book a consult',
    staffRole: 'contracted practitioner',
    staffEyebrow: 'Practitioner PWA · MedicalAdvisor®',
    staffTabs: SHARED_STAFF_TABS,
    staffSample: 'Today · 08:15 GP consult',
  },
  physiograph: {
    product: 'PhysioAdvisor®',
    audience: 'patients',
    audienceSingular: 'patient',
    staffSingular: 'physio',
    staffPlural: 'Practitioners',
    visitSingular: 'session',
    visitPlural: 'sessions',
    bookCta: 'Book a session',
    joinHint:
      'Create your patient account for this clinic — sessions, rehab and packs live here.',
    memberAppLabel: 'patient app',
    openingApp: 'Opening your patient app…',
    signedOutHint: 'Signed out. Sign in as a patient, or as a physio.',
    signInMember: 'Patient — name and email on your file',
    signInStaff: 'I work here — name and email on Practitioners',
    dockBook: 'Book',
    dockDiary: 'Diary',
    dockYou: 'You',
    dockCare: 'Rehab',
    dockShare: 'Share',
    dockInbox: 'Inbox',
    careTitle: 'My rehab',
    careHint: 'Treatment plan, movements and packs this clinic has shared with you.',
    careHeading: 'Rehab plan',
    historyTitle: 'Session history',
    historyHint: 'Past treatments and notes the clinic has shared with you.',
    historyEmpty:
      'No past sessions yet. After you attend, rehab notes appear here.',
    bookHint:
      'Your next sessions. Tap a card for details, cancel, or rate after treatment.',
    waitlistAnyClinician: 'any practitioner if needed',
    photoKind: 'patient_photo',
    selfRole: 'patient',
    color: '#0d9488',
    pwaEyebrow: 'Patient app · PhysioAdvisor®',
    pwaTabs: ['Book', 'Diary', 'You', 'Rehab', 'Share'],
    pwaActiveTab: 'Book',
    sampleTitle: 'Follow-up session',
    sampleWhen: 'Wed · 09:30',
    sampleHint: 'Book an open slot, see rehab, and message the clinic.',
    websiteCta: 'Book a session',
    staffRole: 'contracted practitioner',
    staffEyebrow: 'Practitioner PWA · PhysioAdvisor®',
    staffTabs: SHARED_STAFF_TABS,
    staffSample: 'Today · 09:30 Follow-up · 1 patient',
  },
  dentalgraph: {
    product: 'DentalAdvisor®',
    audience: 'patients',
    audienceSingular: 'patient',
    staffSingular: 'clinician',
    staffPlural: 'Staff',
    visitSingular: 'visit',
    visitPlural: 'visits',
    bookCta: 'Book a visit',
    joinHint:
      'Create your patient account for this practice — visits, chart and hygiene live here.',
    memberAppLabel: 'patient app',
    openingApp: 'Opening your patient app…',
    signedOutHint: 'Signed out. Sign in as a patient, or as a clinician.',
    signInMember: 'Patient — name and email on your file',
    signInStaff: 'I work here — name and email on Staff',
    dockBook: 'Book',
    dockDiary: 'Diary',
    dockYou: 'You',
    dockCare: 'Chart',
    dockShare: 'Share',
    dockInbox: 'Inbox',
    careTitle: 'My dental chart',
    careHint: 'Treatments, hygiene visits and notes this practice has shared with you.',
    careHeading: 'Chart & treatments',
    historyTitle: 'Visit history',
    historyHint: 'Past visits and notes the practice has shared with you.',
    historyEmpty:
      'No past visits yet. After you attend, chart notes appear here.',
    bookHint:
      'Your next visits. Tap a card for details, cancel, or rate after the appointment.',
    waitlistAnyClinician: 'any clinician if needed',
    photoKind: 'patient_photo',
    selfRole: 'patient',
    color: '#0284c7',
    pwaEyebrow: 'Patient app · DentalAdvisor®',
    pwaTabs: ['Book', 'Diary', 'You', 'Chart', 'Share'],
    pwaActiveTab: 'Book',
    sampleTitle: 'Hygiene visit',
    sampleWhen: 'Thu · 11:00',
    sampleHint: 'Book, see visit notes the practice shares, and pay.',
    websiteCta: 'Book a visit',
    staffRole: 'contracted clinician',
    staffEyebrow: 'Clinician PWA · DentalAdvisor®',
    staffTabs: SHARED_STAFF_TABS,
    staffSample: 'Today · 11:00 Hygiene · chair 2',
  },
  psychiatrygraph: {
    product: 'PsychiatryAdvisor®',
    audience: 'patients',
    audienceSingular: 'patient',
    staffSingular: 'practitioner',
    staffPlural: 'Practitioners',
    visitSingular: 'session',
    visitPlural: 'sessions',
    bookCta: 'Book a session',
    joinHint:
      'Create your patient account for this practice — sessions and records stay with this practice.',
    memberAppLabel: 'patient app',
    openingApp: 'Opening your patient app…',
    signedOutHint: 'Signed out. Sign in as a patient, or as a practitioner.',
    signInMember: 'Patient — name and email on your file',
    signInStaff: 'I work here — name and email on Practitioners',
    dockBook: 'Book',
    dockDiary: 'Diary',
    dockYou: 'You',
    dockCare: 'Records',
    dockShare: 'Share',
    dockInbox: 'Inbox',
    careTitle: 'My records',
    careHint: 'Care notes this practice has shared with you. They stay private to this practice.',
    careHeading: 'Shared notes',
    historyTitle: 'Session history',
    historyHint: 'Past sessions and notes the practice has shared with you.',
    historyEmpty:
      'No past sessions yet. After you attend, shared notes appear here.',
    bookHint:
      'Your next sessions. Tap a card for details, cancel, or rate after the session.',
    waitlistAnyClinician: 'any practitioner if needed',
    photoKind: 'patient_photo',
    selfRole: 'patient',
    color: '#6366f1',
    pwaEyebrow: 'Patient app · PsychiatryAdvisor®',
    pwaTabs: ['Book', 'Diary', 'You', 'Records', 'Share'],
    pwaActiveTab: 'Book',
    sampleTitle: 'Review session',
    sampleWhen: 'Fri · 14:00',
    sampleHint: 'Book a session. Care notes stay private to this practice.',
    websiteCta: 'Book a session',
    staffRole: 'contracted practitioner',
    staffEyebrow: 'Practitioner PWA · PsychiatryAdvisor®',
    staffTabs: SHARED_STAFF_TABS,
    staffSample: 'Today · 14:00 Review session',
  },
  vetgraph: {
    product: 'VetAdvisor®',
    audience: 'clients',
    audienceSingular: 'client',
    staffSingular: 'vet',
    staffPlural: 'Vets',
    visitSingular: 'consult',
    visitPlural: 'consults',
    bookCta: 'Book a consult',
    joinHint:
      'Create your client account for this practice — pets, consults and vaccinations live here.',
    memberAppLabel: 'client app',
    openingApp: 'Opening your client app…',
    signedOutHint: 'Signed out. Sign in as a client, or as a vet.',
    signInMember: 'Client — name and email on your file',
    signInStaff: 'I work here — name and email on Vets',
    dockBook: 'Book',
    dockDiary: 'Diary',
    dockYou: 'You',
    dockCare: 'Pets',
    dockShare: 'Share',
    dockInbox: 'Inbox',
    careTitle: 'My animals',
    careHint: 'Vaccinations, consults and notes this practice has shared with you.',
    careHeading: 'Shared clinical notes',
    historyTitle: 'Consult history',
    historyHint: 'Past consults and notes the practice has shared with you.',
    historyEmpty:
      'No past consults yet. After a visit, notes and vaccines appear here.',
    bookHint:
      'Your next consults. Tap a card for details, cancel, or rate after the visit.',
    waitlistAnyClinician: 'any vet if needed',
    photoKind: 'patient_photo',
    selfRole: 'patient',
    color: '#c2410c',
    pwaEyebrow: 'Client app · VetAdvisor®',
    pwaTabs: ['Book', 'Diary', 'You', 'Pets', 'Share'],
    pwaActiveTab: 'Book',
    sampleTitle: 'Wellness consult',
    sampleWhen: 'Tue · 10:00',
    sampleHint: 'Book for your animals, keep vaccines current, and message the practice.',
    websiteCta: 'Book a consult',
    staffRole: 'contracted veterinarian',
    staffEyebrow: 'Vet PWA · VetAdvisor®',
    staffTabs: SHARED_STAFF_TABS,
    staffSample: 'Today · 10:00 Wellness consult',
  },
};

export function isClinicPwaModule(raw: string | null | undefined): raw is ClinicPwaModule {
  return (
    raw === 'physiograph' ||
    raw === 'dentalgraph' ||
    raw === 'medicalgraph' ||
    raw === 'psychiatrygraph' ||
    raw === 'vetgraph'
  );
}

export function clinicPwaCopy(module: string | null | undefined): ClinicPwaCopy {
  if (isClinicPwaModule(module)) return COPY[module];
  return COPY.medicalgraph;
}
