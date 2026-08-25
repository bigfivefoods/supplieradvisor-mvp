'use client';

/**
 * Coach portal — week calendar of planned classes, create bespoke/repeat
 * sessions, plan roster (who is coming) + actual (who came / no-show).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  Loader2,
  Medal,
  MessageSquare,
  Plus,
  Repeat,
  Send,
  Share2,
  User,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { addDaysIso } from '@/lib/fitness/fitgraph';
import {
  SESSION_KIND_OPTIONS,
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
  durationFromStartEnd,
  endFromStartDuration,
  patchFormForSessionKind,
  resolveSessionTimes,
  sessionKindFromRecord,
  type FitSessionKind,
} from '@/lib/fitness/session-times';
import { FitClassFeedbackForm } from '@/components/fitness/FitClassFeedbackForm';
import { MemberSpecialDatesPanel } from '@/components/fitness/MemberSpecialDatesPanel';
import type { MemberSpecialDate } from '@/lib/fitness/member-special-dates';
import { PersonQualificationsEditor } from '@/components/services/PersonQualificationsEditor';
import type { PersonQualification } from '@/lib/services/person-qualifications';
import type { PersonHealthProfile } from '@/lib/health/body-map';
import { PortalIdentityVerify } from '@/components/identity/PortalIdentityVerify';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';
import { CoachMovementStudio } from '@/components/fitness/CoachMovementStudio';
import {
  AdvisorWorkPwaChrome,
  type AdvisorWorkTab,
} from '@/components/services/AdvisorWorkPwaChrome';
import { ProgrammeView } from '@/components/fitness/ProgrammeView';
import { ClassSubscriptionReport } from '@/components/fitness/ClassSubscriptionReport';
import { MemberPortalWeekCalendar } from '@/components/advisors/MemberPortalWeekCalendar';
import type { MemberCalendarEvent } from '@/lib/advisors/member-week-calendar';
import { OwnerWorkspaceCta } from '@/components/advisors/OwnerWorkspaceCta';
import {
  GymExpandSection,
  GymSectionTitle,
} from '@/components/fitness/GymMemberPwaUi';
import { isoDateInZone } from '@/lib/fitness/gym-local-time';
import { hourBounds, type WorkingHours } from '@/lib/schedule/working-hours';
import { AdvisorPwaMemberBinder } from '@/components/advisors/AdvisorPwaMemberBinder';
import { AdvisorPwaSignOutButton } from '@/components/advisors/AdvisorPwaSignOutButton';
import { GymProfileFolds } from '@/components/fitness/GymProfileFolds';
import { GymClassChallengeBoard } from '@/components/fitness/GymClassChallengeBoard';
import type {
  ChallengeView,
  CoachClassLeaderboard,
} from '@/lib/fitness/class-challenges';
import { GymClassLeaderboards } from '@/components/fitness/GymClassLeaderboards';
import {
  injuriesForPerson,
  parsePersonalBests,
} from '@/lib/fitness/person-records';
import type {
  FitHydratedProgramme,
  FitMovement,
  FitProgramme,
} from '@/lib/fitness/movements';

type RosterRow = {
  booking_id: string;
  client_id: string;
  status: string;
  plan: boolean;
  actual: 'pending' | 'attended' | 'no_show' | 'cancelled';
  name: string;
  email?: string;
  phone?: string;
  health?: PersonHealthProfile;
  injured?: boolean;
  health_label?: string;
  coach_feedback?: string | null;
  coach_member_feeling?: number | null;
  coach_member_rating?: number | null;
  rsvp?: 'coming' | 'not_coming' | null;
};

type PortalSession = {
  scheduled_by?: 'owner' | 'coach';
  session: {
    id: string;
    class_type_id?: string;
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    location?: string;
    capacity?: number | null;
    public?: boolean;
    status: string;
    series_id?: string | null;
    session_kind?: import('@/lib/fitness/session-times').FitSessionKind;
    coach_id?: string | null;
    origin?: string | null;
    notes?: string;
    class_plan?: string;
    public_notes?: string;
    programme_id?: string | null;
    shared_coach_ids?: string[] | null;
  };
  programme?: FitHydratedProgramme | null;
  class_name?: string;
  capacity: number;
  planned: number;
  waitlist: number;
  attended: number;
  no_show: number;
  pending: number;
  roster: RosterRow[];
  feedback_summary?: {
    member_count: number;
    coach_count: number;
    avg_feeling: number | null;
    avg_intensity: number | null;
    avg_enjoyment: number | null;
  };
  my_feedback?: {
    id: string;
    feeling: number;
    intensity: number;
    enjoyment?: number;
    would_return?: number;
    comment?: string;
    tags?: string[];
  } | null;
  member_feedback?: Array<{
    id: string;
    author_name?: string;
    feeling: number;
    intensity: number;
    enjoyment?: number;
    comment?: string;
  }>;
  subscribed?: Array<{
    client_id: string;
    name: string;
    code: string;
    plan_name: string;
    booked: boolean;
  }>;
  subscribed_not_booked?: Array<{
    client_id: string;
    name: string;
    code: string;
    plan_name: string;
    booked: boolean;
  }>;
  challenge?: ChallengeView | null;
};

type SessionEditForm = {
  session_kind: import('@/lib/fitness/session-times').FitSessionKind;
  class_type_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: string;
  status: string;
  public: boolean;
  class_plan: string;
  notes: string;
  programme_id: string;
  shared_coach_id: string;
};

type Portal = {
  coach: {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    specialties?: string[];
    bio?: string;
    public_bio?: string;
    photo_url?: string;
    qualifications?: import('@/lib/services/person-qualifications').PersonQualification[];
    color?: string;
    can_manage_classes?: boolean;
    engagement?: string;
    start_date?: string;
    end_date?: string;
    rate_zar?: number | null;
    rate_basis?: string;
    rate_note?: string;
    active?: boolean;
    identity?: {
      status?: string;
      provider?: string | null;
      verified_at?: string | null;
      verified_name?: string | null;
      status_text?: string | null;
      is_verified?: boolean;
    };
    history?: Array<{
      id: string;
      start_date: string;
      end_date: string;
      note?: string;
      ended_reason?: string;
      rate_zar?: number | null;
      rate_basis?: string;
    }>;
    personal_bests?: import('@/lib/fitness/person-records').FitPersonalBest[];
    injuries?: import('@/lib/fitness/person-records').FitInjuryEntry[];
    health?: PersonHealthProfile | null;
  };
  profile_feedback?: Array<{
    id: string;
    title: string;
    date: string;
    feeling?: number | null;
    intensity?: number | null;
    enjoyment?: number | null;
    comment?: string | null;
    source?: string;
  }>;
  specialty_options?: string[];
  from: string;
  to: string;
  working_hours?: WorkingHours | null;
  sessions: PortalSession[];
  by_date: Record<string, PortalSession[]>;
  members: Array<{
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    emergency_contact?: string;
    notes?: string;
    membership_status?: string;
    coach_id?: string | null;
    health?: PersonHealthProfile;
    plan_names?: string[];
    monthly_zar?: number;
    in_classes?: boolean;
    is_client?: boolean;
    class_names?: string[];
  }>;
  sees_all_people?: boolean;
  leaderboards?: CoachClassLeaderboard[];
  special_dates?: MemberSpecialDate[];
  class_report?: import('@/lib/fitness/vuka-class-catalog').ClassSubscriptionReport;
  class_types: Array<{
    id: string;
    code: string;
    name: string;
    capacity?: number | null;
  }>;
  movements?: FitMovement[];
  programmes?: FitProgramme[];
  programme_follows?: Array<{
    enrollment_id: string;
    programme_id: string;
    programme_name: string;
    client_id: string;
    client_name: string;
    start_date: string;
    status: string;
    source: string;
    progress: {
      done: number;
      total: number;
      pct: number;
      avg_feeling: number | null;
      avg_rpe: number | null;
    };
    last_log: {
      date: string;
      status: string;
      feeling?: number | null;
      rpe?: number | null;
      comment?: string;
      coach_comment?: string;
    } | null;
  }>;
  threads?: Array<{
    id: string;
    channel: string;
    subject: string;
    updated_at: string;
    preview: string;
    unread: number;
    participants: Array<{ role: string; ref_id: string; name: string }>;
    messages: Array<{
      id: string;
      body: string;
      author_role: string;
      author_ref_id: string;
      author_name: string;
      created_at: string;
    }>;
    group?: { kind?: string; ref_id?: string; label?: string } | null;
  }>;
  messages_unread?: number;
  peer_coaches?: Array<{ id: string; code: string; name: string }>;
};

const WEEKDAYS = [
  { v: 1, l: 'M' },
  { v: 2, l: 'T' },
  { v: 3, l: 'W' },
  { v: 4, l: 'T' },
  { v: 5, l: 'F' },
  { v: 6, l: 'S' },
  { v: 0, l: 'S' },
];

function mondayOf(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + monOffset);
  return d.toISOString().slice(0, 10);
}

type CoachLaneId = 'workouts' | 'classes' | 'clients';

function laneOf(card: PortalSession): CoachLaneId {
  const kind = card.session.session_kind;
  if (kind === 'coach_personal') return 'workouts';
  if (kind === 'private_pt') return 'clients';
  return 'classes';
}

function programmesForLane(
  programmes: FitProgramme[],
  kind: FitSessionKind
) {
  return programmes.filter((p) => {
    if (kind === 'class') {
      return (
        (p.kind === 'class' || p.kind === 'both') &&
        p.personal_for_coach !== true
      );
    }
    if (kind === 'private_pt') {
      return p.kind === 'personal_pt' || p.kind === 'both';
    }
    return (
      p.kind === 'personal_pt' ||
      p.kind === 'both' ||
      p.personal_for_coach === true
    );
  });
}

export default function CoachFitgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [brand, setBrand] = useState('Gym');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attendOverride, setAttendOverride] = useState<
    Record<string, 'attended' | 'no_show' | 'pending'>
  >({});
  const attendChain = useRef(Promise.resolve());
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(new Date().toISOString().slice(0, 10))
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySessionId, setLibrarySessionId] = useState<string | null>(null);
  const [guestFor, setGuestFor] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [memberFor, setMemberFor] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(
    {}
  );
  const [feelingDrafts, setFeelingDrafts] = useState<Record<string, string>>(
    {}
  );
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, string>>({});
  const [create, setCreate] = useState({
    session_kind: 'class' as FitSessionKind,
    class_type_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    end_time: '06:45',
    location: '',
    capacity: '',
    class_plan: '',
    notes: '',
    repeat: 'none' as 'none' | 'weekly',
    count: '8',
    weekdays: [] as number[],
    public: false,
    programme_id: '',
    shared_coach_id: '',
  });
  const [classPlanDraft, setClassPlanDraft] = useState('');
  const [sessionEdit, setSessionEdit] = useState<SessionEditForm | null>(null);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    id_number: '',
    bio: '',
    public_bio: '',
    photo_url: '',
    specialties: [] as string[],
    qualifications: [] as import('@/lib/services/person-qualifications').PersonQualification[],
  });
  const [enrollClientId, setEnrollClientId] = useState('');
  const [enrollProgrammeId, setEnrollProgrammeId] = useState('');
  const [enrollStart, setEnrollStart] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [workTab, setWorkTab] = useState<AdvisorWorkTab>('today');
  const [peopleClassOpen, setPeopleClassOpen] = useState(true);
  const [peopleClientOpen, setPeopleClientOpen] = useState(true);
  const [peopleGymOpen, setPeopleGymOpen] = useState(true);
  const [peopleBoardOpen, setPeopleBoardOpen] = useState(true);
  const [recordBusy, setRecordBusy] = useState<string | null>(null);
  const [peopleClassGroupOpen, setPeopleClassGroupOpen] = useState<
    Record<string, boolean>
  >({});
  const [focusDate, setFocusDate] = useState(() =>
    isoDateInZone('Africa/Johannesburg')
  );
  const [bookWith, setBookWith] = useState<{
    client_id: string;
    date: string;
    start_time: string;
    end_time: string;
    notes: string;
  } | null>(null);
  const [msgThreadId, setMsgThreadId] = useState<string | null>(null);
  const [msgReply, setMsgReply] = useState('');
  const [msgCompose, setMsgCompose] = useState(false);
  const [msgTo, setMsgTo] = useState<'member' | 'desk' | 'coach'>('member');
  const [msgTargetId, setMsgTargetId] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [classMsg, setClassMsg] = useState('');

  const weekEnd = useMemo(() => addDaysIso(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        token,
        from: weekStart,
        to: weekEnd,
      });
      const res = await fetch(`/api/public/fitgraph/coach?${q}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPortal(data.portal);
      setBrand(data.brand || 'Gym');
      setLogoUrl(data.logo_url || null);
      setCompanyId(
        Number.isFinite(Number(data.company_id)) ? Number(data.company_id) : null
      );
      setPublicToken(data.public_token);
      const c = data.portal?.coach;
      if (c) {
        setProfile({
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          id_number: c.id_number || '',
          bio: c.bio || '',
          public_bio: c.public_bio || '',
          photo_url: c.photo_url || '',
          specialties: Array.isArray(c.specialties)
            ? [...c.specialties]
            : [],
          qualifications: Array.isArray(c.qualifications)
            ? c.qualifications
            : [],
        });
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (
    body: Record<string, unknown>,
    opts?: { quiet?: boolean }
  ) => {
    if (!opts?.quiet) setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/fitgraph/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      if (data.portal) setPortal(data.portal);
      if (data.public_token) setPublicToken(data.public_token);
      return data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      throw e;
    } finally {
      if (!opts?.quiet) setBusy(false);
    }
  };

  const markAttendance = (
    bookingId: string,
    status: 'attended' | 'no_show' | 'booked',
    clientId?: string,
    sessionId?: string
  ) => {
    setAttendOverride((prev) => ({
      ...prev,
      [bookingId]: status === 'booked' ? 'pending' : status,
    }));
    attendChain.current = attendChain.current.then(() =>
      post(
        {
          action: 'mark_attendance',
          booking_id: bookingId,
          status,
          session_id: sessionId,
          client_id: clientId,
        },
        { quiet: true }
      )
        .then(() => {
          setAttendOverride((prev) => {
            const next = { ...prev };
            if (next[bookingId] === (status === 'booked' ? 'pending' : status)) {
              delete next[bookingId];
            }
            return next;
          });
        })
        .catch(() => {
          setAttendOverride((prev) => {
            const next = { ...prev };
            if (next[bookingId] === (status === 'booked' ? 'pending' : status)) {
              delete next[bookingId];
            }
            return next;
          });
        })
    );
  };

  const openCard = portal?.sessions.find((s) => s.session.id === openId);

  useEffect(() => {
    if (openCard) {
      setClassPlanDraft(openCard.session.class_plan || '');
      const kind = sessionKindFromRecord({
        session_kind: openCard.session.session_kind,
        class_code: portal?.class_types.find(
          (c) => c.id === openCard.session.class_type_id
        )?.code,
      });
      const times = resolveSessionTimes({
        start_time: String(openCard.session.start_time || '06:00').slice(0, 5),
        end_time: openCard.session.end_time,
        duration_min: openCard.session.duration_min,
      });
      setSessionEdit({
        session_kind: kind,
        class_type_id: openCard.session.class_type_id || '',
        date: openCard.session.date || '',
        start_time: times.start_time,
        end_time: times.end_time,
        location: openCard.session.location || '',
        capacity:
          openCard.session.capacity != null
            ? String(openCard.session.capacity)
            : openCard.capacity
              ? String(openCard.capacity)
              : '',
        status: openCard.session.status || 'scheduled',
        public: kind === 'class' && openCard.session.public === true,
        class_plan: openCard.session.class_plan || '',
        notes: openCard.session.notes || '',
        programme_id: openCard.session.programme_id || '',
        shared_coach_id: (openCard.session.shared_coach_ids || [])[0] || '',
      });
    } else {
      setSessionEdit(null);
    }
  }, [
    openCard?.session.id,
    openCard?.session.class_plan,
    openCard?.session.date,
    openCard?.session.start_time,
    openCard?.session.location,
    openCard?.session.capacity,
    openCard?.session.status,
    openCard?.session.public,
    openCard?.session.class_type_id,
    openCard?.session.end_time,
    openCard?.session.session_kind,
    openCard?.session.notes,
    openCard?.session.programme_id,
    openCard?.session.shared_coach_ids,
    openCard?.capacity,
    portal?.class_types,
  ]);

  const saveSessionEdit = async () => {
    if (!openCard || !sessionEdit) return;
    if (sessionEdit.session_kind === 'class' && !sessionEdit.class_type_id) {
      setError('Pick a class type');
      return;
    }
    if (!sessionEdit.date || !sessionEdit.start_time) {
      setError('Set date and start time');
      return;
    }
    const times = resolveSessionTimes({
      start_time: sessionEdit.start_time,
      end_time: sessionEdit.end_time,
    });
    await post({
      action: 'update_session',
      session_id: openCard.session.id,
      class_type_id: sessionEdit.class_type_id,
      session_kind: sessionEdit.session_kind,
      date: sessionEdit.date,
      start_time: times.start_time,
      end_time: times.end_time,
      duration_min: times.duration_min,
      location: sessionEdit.location || '',
      capacity: sessionEdit.capacity ? Number(sessionEdit.capacity) : null,
      status: sessionEdit.status,
      public: sessionEdit.session_kind === 'class' && sessionEdit.public,
      class_plan: sessionEdit.class_plan,
      notes: sessionEdit.notes,
      programme_id: sessionEdit.programme_id || null,
      shared_coach_ids:
        sessionEdit.session_kind === 'coach_personal' &&
        sessionEdit.shared_coach_id
          ? [sessionEdit.shared_coach_id]
          : [],
    });
    setClassPlanDraft(sessionEdit.class_plan);
    void load();
  };

  const deleteOpenSession = async () => {
    if (!openCard || !portal) return;
    const s = openCard.session;
    if (
      !confirm(
        `Delete this class on ${s.date} at ${String(s.start_time).slice(0, 5)}? Bookings on it will be removed.`
      )
    ) {
      return;
    }
    let deleteSeries = false;
    if (s.series_id) {
      const seriesCount = portal.sessions.filter(
        (c) => c.session.series_id === s.series_id
      ).length;
      // series may span weeks — always offer series delete when series_id is set
      deleteSeries = confirm(
        seriesCount > 1
          ? `This class is part of a series (${seriesCount} visible this week). OK = delete the entire series, Cancel = delete only this date.`
          : `This class is part of a series. OK = delete the entire series, Cancel = delete only this date.`
      );
    }
    try {
      await post({
        action: 'delete_session',
        session_id: s.id,
        delete_series: deleteSeries,
      });
      setOpenId(null);
      void load();
    } catch {
      /* error already set by post */
    }
  };

  if (loading && !portal) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-yellow-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      </div>
    );
  }

  if (!portal) return null;

  const todayIso = isoDateInZone('Africa/Johannesburg');
  const slotSource = (card: PortalSession) =>
    card.scheduled_by === 'coach' || card.session.origin === 'coach'
      ? 'mine'
      : 'owner';
  const viewDate = workTab === 'today' ? focusDate : todayIso;
  const todayCards = portal.sessions
    .filter((s) => s.session.date === viewDate)
    .slice()
    .sort((a, b) =>
      String(a.session.start_time).localeCompare(String(b.session.start_time))
    );
  const slotBadge = (card: PortalSession) => {
    if (card.session.session_kind === 'coach_personal') return 'Personal';
    if (slotSource(card) === 'owner') return 'Gym booked';
    if (card.session.session_kind === 'private_pt') return 'Your PT';
    return 'Your class';
  };
  const toCalEvent = (card: PortalSession): MemberCalendarEvent => {
    const lane = laneOf(card);
    const kind: MemberCalendarEvent['kind'] =
      lane === 'workouts' ? 'workout' : lane === 'clients' ? 'client' : 'class';
    return {
      id: card.session.id,
      date: card.session.date,
      start_time: String(card.session.start_time).slice(0, 5),
      end_time: card.session.end_time
        ? String(card.session.end_time).slice(0, 5)
        : null,
      title:
        card.session.session_kind === 'coach_personal'
          ? card.session.notes?.split('\n')[0] || 'Workout'
          : card.session.session_kind === 'private_pt'
            ? `PT · ${card.class_name || 'Client'}`
            : card.class_name || 'Class',
      person:
        kind === 'workout' ? 'Workout' : kind === 'client' ? 'Client' : 'Class',
      kind,
    };
  };
  const gymHours = (() => {
    if (!portal.working_hours) return { start: 5, end: 21 };
    const b = hourBounds(portal.working_hours);
    return {
      start: b.startHour,
      end: Math.max(b.startHour + 1, Math.ceil(b.endMinute / 60)),
    };
  })();
  return (
    <>
    <AdvisorPwaMemberBinder
      module="fitgraph"
      memberToken={token}
      publicToken={publicToken}
      brandName={brand}
      themeColor="#E8E830"
      iconUrl={logoUrl}
    />
    <AdvisorWorkPwaChrome
      brand={brand}
      name={portal.coach.name}
      photoUrl={portal.coach.photo_url}
      eyebrow="Coach · GymAdvisor®"
      unread={portal.messages_unread || 0}
      tab={workTab}
      onTab={(t) => {
        setWorkTab(t);
        if (t === 'today') {
          const t0 = isoDateInZone('Africa/Johannesburg');
          setFocusDate(t0);
          setWeekStart(mondayOf(t0));
        }
      }}
      surface="light"
      logoUrl={logoUrl}
      appHref={`/me?link=${encodeURIComponent(token)}`}
    >
      {workTab === 'today' ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <GymSectionTitle hint="Gym open to close. Class · workout · client.">
              {focusDate === todayIso
                ? 'Today'
                : new Date(`${focusDate}T12:00:00`).toLocaleDateString(
                    undefined,
                    { weekday: 'short', day: 'numeric', month: 'short' }
                  )}
            </GymSectionTitle>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() =>
                  setBookWith({
                    client_id: '',
                    date: focusDate,
                    start_time: '09:00',
                    end_time: '10:00',
                    notes: '',
                  })
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-neutral-900 dark:text-slate-200"
              >
                Book
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreate((f) => ({
                    ...patchFormForSessionKind(
                      f,
                      'coach_personal',
                      portal.class_types
                    ),
                    date: focusDate,
                    shared_coach_id: '',
                  }));
                  setShowCreate(true);
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-neutral-900 dark:text-slate-200"
              >
                Workout
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="rounded-full bg-[#E8E830] px-3 py-1.5 text-[11px] font-black text-slate-950"
              >
                Add
              </button>
            </div>
          </div>

          <MemberPortalWeekCalendar
            theme="light"
            color="#E8E830"
            columns="day"
            selectedDay={focusDate}
            onSelectedDay={(iso) => {
              setFocusDate(iso);
              setWeekStart(mondayOf(iso));
            }}
            weekStart={mondayOf(focusDate)}
            onWeekChange={setWeekStart}
            hourStart={gymHours.start}
            hourEnd={gymHours.end}
            kindLegend
            hidePeek
            events={todayCards.map(toCalEvent)}
            onSelect={(ev) => setOpenId(ev.id)}
            emptyLabel={
              focusDate === todayIso
                ? 'Nothing on the floor today.'
                : 'Nothing on the floor this day.'
            }
          />

          <MemberSpecialDatesPanel
            tone="coach"
            title="Your clients"
            description="Birthdays and gym anniversaries this week."
            rows={portal.special_dates || []}
          />
        </div>
      ) : null}

      {workTab === 'people' ? (
        <div className="space-y-5">
          <GymSectionTitle
            hint={
              portal.sees_all_people
                ? 'Whole gym — you own this studio. They update their own details in the member app.'
                : 'Your class members and private clients. They update their own details in the member app.'
            }
          >
            People
          </GymSectionTitle>
          {(() => {
            const care = portal.members.filter(
              (m) =>
                m.health?.injured ||
                (m.health?.injury_areas || []).length > 0 ||
                (portal.special_dates || []).some(
                  (d) => d.client_id === m.id && d.days_until <= 7
                )
            );
            if (!care.length) return null;
            return (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Needs care
                </p>
                {care.map((m) => (
                  <div
                    key={`care-${m.id}`}
                    className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left dark:border-rose-500/30 dark:bg-rose-950/30"
                  >
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {m.name}
                    </p>
                    <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                      {m.health?.injured || (m.health?.injury_areas || []).length
                        ? 'Injury / modification — they update this in their app'
                        : 'Birthday or anniversary this week'}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}
          <GymExpandSection
            title="Leaderboard"
            hint={
              (portal.leaderboards || []).length
                ? `${(portal.leaderboards || []).length} class${
                    (portal.leaderboards || []).length === 1 ? '' : 'es'
                  } with a test`
                : 'Set a test on a class from Today or Diary to rank the pack'
            }
            icon={<Medal className="h-4 w-4" />}
            badge={
              (portal.leaderboards || []).length ? (
                <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-white dark:bg-white dark:text-slate-900">
                  {(portal.leaderboards || []).length}
                </span>
              ) : undefined
            }
            open={peopleBoardOpen}
            onToggle={() => setPeopleBoardOpen((v) => !v)}
          >
            {(portal.leaderboards || []).length ? (
              <GymClassLeaderboards
                groups={portal.leaderboards}
                color="#E8E830"
                ink="#0f172a"
              />
            ) : (
              <p className="text-xs text-slate-500">
                Open a group class and set a test. Rankings for each class show
                here.
              </p>
            )}
          </GymExpandSection>
          {(portal.programmes || []).length ? (
            <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Assign a programme
              </p>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950"
                value={enrollClientId}
                onChange={(e) => setEnrollClientId(e.target.value)}
              >
                <option value="">Your member…</option>
                {portal.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950"
                value={enrollProgrammeId}
                onChange={(e) => setEnrollProgrammeId(e.target.value)}
              >
                <option value="">Programme…</option>
                {(portal.programmes || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950"
                value={enrollStart}
                onChange={(e) => setEnrollStart(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !enrollClientId || !enrollProgrammeId}
                onClick={() =>
                  void post({
                    action: 'enroll_programme',
                    client_id: enrollClientId,
                    programme_id: enrollProgrammeId,
                    start_date: enrollStart,
                  })
                }
                className="w-full rounded-xl bg-[#E8E830] py-2 text-[11px] font-black text-slate-950"
              >
                Start them on this plan
              </button>
            </div>
          ) : null}
          {(portal.programme_follows || []).length ? (
            <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Programme follow
              </p>
              {(portal.programme_follows || []).slice(0, 12).map((r) => (
                <div
                  key={r.enrollment_id}
                  className="rounded-xl border border-slate-100 px-3 py-2 dark:border-white/10"
                >
                  <p className="text-sm font-bold">
                    {r.client_name}
                    <span className="ml-1 text-[11px] font-semibold text-slate-400">
                      · {r.programme_name}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {r.progress.pct}% · {r.progress.done}/{r.progress.total} days
                    {r.progress.avg_feeling != null
                      ? ` · feel ${r.progress.avg_feeling}/5`
                      : ''}
                    {r.progress.avg_rpe != null
                      ? ` · RPE ${r.progress.avg_rpe}`
                      : ''}
                  </p>
                  {r.last_log?.comment ? (
                    <p className="mt-0.5 text-xs text-slate-300">
                      “{r.last_log.comment}”
                    </p>
                  ) : null}
                  {r.last_log?.coach_comment ? (
                    <p className="text-[11px] text-amber-200">
                      You: {r.last_log.coach_comment}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {portal.class_report ? (
            <ClassSubscriptionReport
              report={portal.class_report}
              tone="member"
              title="Your class subscriptions"
            />
          ) : null}
          {(() => {
            const classMembers = portal.members.filter((m) => m.in_classes);
            const clients = portal.members.filter((m) => m.is_client);
            const gymMembers = portal.sees_all_people
              ? portal.members.filter((m) => !m.in_classes && !m.is_client)
              : [];
            const classGroups = (() => {
              const map = new Map<string, typeof classMembers>();
              for (const m of classMembers) {
                const names = (m.class_names || []).filter((n) => n.trim());
                const keys = names.length ? names : ['Class'];
                for (const name of keys) {
                  const list = map.get(name) || [];
                  if (!list.some((x) => x.id === m.id)) list.push(m);
                  map.set(name, list);
                }
              }
              return [...map.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([name, members]) => ({ name, members }));
            })();
            const personCard = (
              m: (typeof portal.members)[number],
              keyPrefix = ''
            ) => (
              <div
                key={`${keyPrefix}${m.id}`}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-900"
              >
                <p className="font-bold text-slate-900 dark:text-white">
                  {m.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {m.plan_names?.length
                    ? m.plan_names.join(' · ')
                    : m.membership_status || 'Member'}
                  {m.health?.injured ? ' · injured' : ''}
                  {(() => {
                    const hit = (portal.special_dates || []).find(
                      (d) => d.client_id === m.id && d.days_until <= 7
                    );
                    return hit ? ` · ${hit.label}` : '';
                  })()}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setBookWith({
                      client_id: m.id,
                      date: todayIso,
                      start_time: '09:00',
                      end_time: '10:00',
                      notes: '',
                    })
                  }
                  className="mt-2 w-full rounded-xl bg-[#E8E830] py-2 text-[11px] font-black text-slate-950"
                >
                  Schedule with me
                </button>
              </div>
            );
            return (
              <>
                <GymExpandSection
                  title="Classes"
                  hint={
                    portal.sees_all_people
                      ? 'Everyone booked on group classes'
                      : 'People booked on your group classes'
                  }
                  icon={<Users className="h-4 w-4" />}
                  badge={
                    <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-white dark:bg-white dark:text-slate-900">
                      {classMembers.length}
                    </span>
                  }
                  open={peopleClassOpen}
                  onToggle={() => setPeopleClassOpen((v) => !v)}
                >
                  {classGroups.length ? (
                    classGroups.map((g, i) => {
                      const open = peopleClassGroupOpen[g.name] ?? i === 0;
                      return (
                        <GymExpandSection
                          key={g.name}
                          nested
                          title={g.name}
                          badge={
                            <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-800 dark:bg-white/15 dark:text-white">
                              {g.members.length}
                            </span>
                          }
                          open={open}
                          onToggle={() =>
                            setPeopleClassGroupOpen((prev) => ({
                              ...prev,
                              [g.name]: !open,
                            }))
                          }
                        >
                          {g.members.map((m) => personCard(m, `${g.name}-`))}
                        </GymExpandSection>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">
                      {portal.sees_all_people
                        ? 'No class bookings on the gym file yet.'
                        : 'No class members on your sessions yet.'}
                    </p>
                  )}
                </GymExpandSection>
                <GymExpandSection
                  title="Clients"
                  hint={
                    portal.sees_all_people
                      ? 'Private PT clients across the gym'
                      : 'Your private PT clients'
                  }
                  icon={<User className="h-4 w-4" />}
                  badge={
                    <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-white dark:bg-white dark:text-slate-900">
                      {clients.length}
                    </span>
                  }
                  open={peopleClientOpen}
                  onToggle={() => setPeopleClientOpen((v) => !v)}
                >
                  {clients.length ? (
                    clients.map((m) => personCard(m, 'client-'))
                  ) : (
                    <p className="text-xs text-slate-500">
                      {portal.sees_all_people
                        ? 'No private clients on the gym file yet.'
                        : 'No private clients assigned to you yet.'}
                    </p>
                  )}
                </GymExpandSection>
                {portal.sees_all_people ? (
                  <GymExpandSection
                    title="Members"
                    hint="Gym members not on a class or private client list"
                    icon={<UserPlus className="h-4 w-4" />}
                    badge={
                      <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-white dark:bg-white dark:text-slate-900">
                        {gymMembers.length}
                      </span>
                    }
                    open={peopleGymOpen}
                    onToggle={() => setPeopleGymOpen((v) => !v)}
                  >
                    {gymMembers.length ? (
                      gymMembers.map((m) => personCard(m, 'gym-'))
                    ) : (
                      <p className="text-xs text-slate-500">
                        Everyone on the gym file is already in Classes or Clients.
                      </p>
                    )}
                  </GymExpandSection>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}

      {workTab === 'diary' ? (
      <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <GymSectionTitle hint="Full week, gym open to close. Class · workout · client.">
          Diary
        </GymSectionTitle>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowLibrary(true)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-neutral-900 dark:text-slate-200"
          >
            Library
          </button>
          <button
            type="button"
            onClick={() => {
              setCreate((f) => ({
                ...patchFormForSessionKind(
                  f,
                  'coach_personal',
                  portal.class_types
                ),
                date: weekStart,
                shared_coach_id: '',
              }));
              setShowCreate(true);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-neutral-900 dark:text-slate-200"
          >
            Workout
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-full bg-[#E8E830] px-3 py-1.5 text-[11px] font-black text-slate-950"
          >
            Add
          </button>
        </div>
      </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        <MemberPortalWeekCalendar
          theme="light"
          color="#E8E830"
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          selectedDay={days.includes(todayIso) ? todayIso : undefined}
          hourStart={gymHours.start}
          hourEnd={gymHours.end}
          kindLegend
          hidePeek
          events={days
            .flatMap((d) => portal.by_date?.[d] || [])
            .map(toCalEvent)}
          onSelect={(ev) => setOpenId(ev.id)}
          emptyLabel="Nothing this week. Tap Add for a class, PT, or Workout."
        />
      </div>
      ) : null}

      {/* Session detail */}
      {openCard && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-white/10 dark:bg-neutral-950 dark:text-white">
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {openCard.session.date} · {openCard.session.start_time}
                  {openCard.session.end_time
                    ? `–${openCard.session.end_time}`
                    : ''}
                  {openCard.session.series_id ? ' · series' : ' · bespoke'}
                </p>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {openCard.session.session_kind === 'coach_personal'
                    ? openCard.session.notes?.split('\n')[0] ||
                      'Your workout'
                    : openCard.class_name || 'Class'}
                </h3>
                {openCard.session.session_kind === 'coach_personal' &&
                (openCard.session.shared_coach_ids || []).length ? (
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {openCard.session.coach_id === portal.coach.id
                      ? `Shared with ${
                          (portal.peer_coaches || []).find(
                            (c) =>
                              c.id ===
                              (openCard.session.shared_coach_ids || [])[0]
                          )?.name || 'another coach'
                        } — you can both do it`
                      : `Shared workout from ${
                          (portal.peer_coaches || []).find(
                            (c) => c.id === openCard.session.coach_id
                          )?.name || 'a coach'
                        }`}
                  </p>
                ) : null}
                <p className="text-xs text-slate-400">
                  {openCard.session.location || '—'} · Plan {openCard.planned}/
                  {openCard.capacity} · Actual attended {openCard.attended} ·
                  no-show {openCard.no_show}
                </p>
                {openCard.programme ? (
                  <div className="mt-3">
                    <ProgrammeView programme={openCard.programme} compact />
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={() => setOpenId(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {sessionEdit?.session_kind !== 'coach_personal' ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold"
                    onClick={() =>
                      void post({
                        action: 'share_session',
                        session_id: openCard.session.id,
                        public: !openCard.session.public,
                      }).then(() => {
                        setSessionEdit((f) =>
                          f ? { ...f, public: !openCard.session.public } : f
                        );
                      })
                    }
                  >
                    <Share2 className="w-3 h-3" />
                    {openCard.session.public ? 'Unshare' : 'Share publicly'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-xl bg-yellow-600 px-2.5 py-1.5 text-[11px] font-bold"
                    onClick={() => {
                      setGuestFor(openCard.session.id);
                      setGuestName('');
                    }}
                  >
                    <UserPlus className="w-3 h-3" /> Walk-in guest
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-200"
                    onClick={() =>
                      void post({
                        action: 'issue_class_invite',
                        session_id: openCard.session.id,
                      }).then(async (data) => {
                        const inv = data.invite as
                          | { path?: string; text?: string }
                          | undefined;
                        if (!inv?.path) return;
                        const url = `${window.location.origin}${inv.path}`;
                        await navigator.clipboard.writeText(
                          `${inv.text || 'Join class'}\n${url}`
                        );
                      })
                    }
                  >
                    <Share2 className="w-3 h-3" /> Copy join link
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/50 bg-rose-950/40 px-2.5 py-1.5 text-[11px] font-bold text-rose-200"
                onClick={() => void deleteOpenSession()}
              >
                Delete
              </button>
            </div>

            {sessionEdit ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {sessionEdit.session_kind === 'coach_personal'
                    ? 'Your workout'
                    : sessionEdit.session_kind === 'private_pt'
                      ? 'Client workout'
                      : 'Class programme · members see this'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {sessionEdit.session_kind === 'coach_personal'
                    ? 'Attach a programme, write the session, then mark it done and log how you felt.'
                    : sessionEdit.session_kind === 'private_pt'
                      ? 'The workout this private client follows with you.'
                      : 'Update the programme and plan members see on this class.'}
                </p>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950"
                  value={sessionEdit.programme_id}
                  onChange={(e) =>
                    setSessionEdit((f) =>
                      f ? { ...f, programme_id: e.target.value } : f
                    )
                  }
                >
                  <option value="">
                    {sessionEdit.session_kind === 'coach_personal'
                      ? 'No workout programme'
                      : sessionEdit.session_kind === 'private_pt'
                        ? 'No client workout programme'
                        : 'No programme on this class'}
                  </option>
                  {programmesForLane(
                    portal.programmes || [],
                    sessionEdit.session_kind
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <textarea
                  className="min-h-[4.5rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950"
                  placeholder={
                    sessionEdit.session_kind === 'coach_personal'
                      ? 'Workout for you, e.g.\n• Warm-up\n• Strength\n• Conditioning'
                      : sessionEdit.session_kind === 'private_pt'
                        ? 'Client workout, e.g.\n• Warm-up\n• Strength\n• Finisher'
                        : 'Class plan members see, e.g.\n• Warm-up\n• Strength\n• Finisher'
                  }
                  value={sessionEdit.class_plan}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSessionEdit((f) =>
                      f ? { ...f, class_plan: v } : f
                    );
                    setClassPlanDraft(v);
                  }}
                />
                {sessionEdit.session_kind === 'coach_personal' ? (
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950"
                    value={sessionEdit.shared_coach_id}
                    onChange={(e) =>
                      setSessionEdit((f) =>
                        f ? { ...f, shared_coach_id: e.target.value } : f
                      )
                    }
                  >
                    <option value="">Keep this workout to yourself</option>
                    {(portal.peer_coaches || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        Share with {c.name} — you can both do it
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-10 flex-1 rounded-xl bg-[#E8E830] text-[11px] font-black text-slate-950 disabled:opacity-50"
                    onClick={() => void saveSessionEdit()}
                  >
                    {sessionEdit.session_kind === 'coach_personal'
                      ? 'Save workout'
                      : sessionEdit.session_kind === 'private_pt'
                        ? 'Save client workout'
                        : 'Save for members'}
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded-xl border border-slate-200 px-3 text-[11px] font-black dark:border-white/10"
                    onClick={() => {
                      setLibrarySessionId(openCard.session.id);
                      setShowLibrary(true);
                    }}
                  >
                    Movements
                  </button>
                </div>
                {sessionEdit.session_kind === 'coach_personal' &&
                sessionEdit.status !== 'completed' ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-10 w-full rounded-xl bg-slate-900 text-[11px] font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                    onClick={() => {
                      setSessionEdit((f) =>
                        f ? { ...f, status: 'completed' } : f
                      );
                      void post({
                        action: 'update_session',
                        session_id: openCard.session.id,
                        status: 'completed',
                      }).then(() => void load());
                    }}
                  >
                    Mark workout complete
                  </button>
                ) : null}
                {sessionEdit.session_kind === 'coach_personal' &&
                sessionEdit.status === 'completed' ? (
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    Completed — log how you felt below.
                  </p>
                ) : null}
              </div>
            ) : null}

            {sessionEdit && (
              <details className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Edit class
                </summary>
                <div className="mt-2 space-y-2">
                <p className="text-[10px] text-slate-500">
                  Change type, date, time, room, capacity or status. Save to
                  update this class on the gym calendar.
                </p>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={sessionEdit.session_kind}
                  onChange={(e) =>
                    setSessionEdit((f) =>
                      f
                        ? patchFormForSessionKind(
                            f,
                            e.target.value as FitSessionKind,
                            portal.class_types
                          )
                        : f
                    )
                  }
                >
                  {SESSION_KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {sessionEdit.session_kind !== 'coach_personal' ? (
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={sessionEdit.class_type_id}
                    onChange={(e) =>
                      setSessionEdit((f) =>
                        f ? { ...f, class_type_id: e.target.value } : f
                      )
                    }
                  >
                    <option value="">Class type…</option>
                    {portal.class_types
                      .filter((c) =>
                        sessionEdit.session_kind === 'private_pt'
                          ? c.code !== SYS_COACH_TIME_CODE
                          : c.code !== SYS_PT_CODE &&
                            c.code !== SYS_COACH_TIME_CODE
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="text-[10px] text-slate-500">
                    Your own training or blocked time — members cannot book it.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={sessionEdit.date}
                    onChange={(e) =>
                      setSessionEdit((f) =>
                        f ? { ...f, date: e.target.value } : f
                      )
                    }
                  />
                  <input
                    type="time"
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={sessionEdit.start_time}
                    onChange={(e) =>
                      setSessionEdit((f) => {
                        if (!f) return f;
                        const next = e.target.value;
                        const dur = f.end_time
                          ? durationFromStartEnd(f.start_time, f.end_time)
                          : 45;
                        return {
                          ...f,
                          start_time: next,
                          end_time: endFromStartDuration(next, dur),
                        };
                      })
                    }
                  />
                  <input
                    type="time"
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={sessionEdit.end_time}
                    onChange={(e) =>
                      setSessionEdit((f) =>
                        f ? { ...f, end_time: e.target.value } : f
                      )
                    }
                    aria-label="End time"
                  />
                </div>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Room / location"
                  value={sessionEdit.location}
                  onChange={(e) =>
                    setSessionEdit((f) =>
                      f ? { ...f, location: e.target.value } : f
                    )
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Capacity"
                    value={sessionEdit.capacity}
                    onChange={(e) =>
                      setSessionEdit((f) =>
                        f ? { ...f, capacity: e.target.value } : f
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={sessionEdit.status}
                    onChange={(e) =>
                      setSessionEdit((f) =>
                        f ? { ...f, status: e.target.value } : f
                      )
                    }
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                {sessionEdit.session_kind === 'class' ? (
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={sessionEdit.public}
                      onChange={(e) =>
                        setSessionEdit((f) =>
                          f ? { ...f, public: e.target.checked } : f
                        )
                      }
                    />
                    Publish on website calendar
                  </label>
                ) : (
                  <p className="text-[10px] text-slate-500">
                    {sessionEdit.session_kind === 'private_pt'
                      ? 'Private PT stays off the public website.'
                      : 'Personal time is private and not member-bookable.'}
                  </p>
                )}
                {sessionEdit.session_kind === 'coach_personal' ? (
                  <textarea
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem] resize-y"
                    placeholder="What this time is for (own training, admin…)"
                    value={sessionEdit.notes}
                    onChange={(e) =>
                      setSessionEdit((f) =>
                        f ? { ...f, notes: e.target.value } : f
                      )
                    }
                  />
                ) : null}
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={sessionEdit.programme_id}
                  onChange={(e) =>
                    setSessionEdit((f) =>
                      f ? { ...f, programme_id: e.target.value } : f
                    )
                  }
                >
                  <option value="">Class movements / programme…</option>
                  {(portal.programmes || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="w-full rounded-xl border border-amber-500/40 px-3 py-2 text-[11px] font-black text-amber-200"
                  onClick={() => {
                    setLibrarySessionId(openCard.session.id);
                    setShowLibrary(true);
                  }}
                >
                  Add movements for this class
                </button>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1">
                    Class plan · activities
                  </p>
                  <textarea
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[5rem] resize-y"
                    placeholder={
                      'e.g.\n• Warm-up 5 min\n• Strength circuit\n• HIIT finisher\n• Stretch'
                    }
                    value={sessionEdit.class_plan}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSessionEdit((f) =>
                        f ? { ...f, class_plan: v } : f
                      );
                      setClassPlanDraft(v);
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="w-full rounded-xl bg-amber-500 text-amber-950 px-3 py-2 text-xs font-black disabled:opacity-50"
                  onClick={() => void saveSessionEdit()}
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                  ) : null}{' '}
                  Save calendar entry
                </button>
                </div>
              </details>
            )}

            {openCard.session.session_kind !== 'coach_personal' &&
            openCard.session.session_kind !== 'private_pt' ? (
              <GymClassChallengeBoard
                key={`${openCard.session.id}-${openCard.challenge?.id || 'new'}`}
                challenge={openCard.challenge || null}
                color="#E8E830"
                ink="#0f172a"
                busy={busy}
                canEdit
                pinSessionDefault={Boolean(openCard.challenge?.session_id)}
                onSave={(patch) =>
                  post({
                    action: 'upsert_class_challenge',
                    session_id: openCard.session.id,
                    class_type_id: openCard.session.class_type_id,
                    title: patch.title,
                    unit: patch.unit,
                    win: patch.win,
                    target: patch.target,
                    notes: patch.notes,
                    pin_session: patch.pin_session,
                  })
                }
                onClose={() =>
                  openCard.challenge
                    ? post({
                        action: 'close_class_challenge',
                        id: openCard.challenge.id,
                      })
                    : undefined
                }
              />
            ) : null}

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Who is coming · update actual
              </h4>
              {openCard.roster.length === 0 &&
              !(openCard.subscribed || []).length ? (
                <p className="text-sm text-slate-500">Nobody on the plan yet.</p>
              ) : (
                <ul className="space-y-2">
                  {[
                    ...openCard.roster,
                    ...(openCard.subscribed || [])
                      .filter(
                        (s) =>
                          !openCard.roster.some((r) => r.client_id === s.client_id)
                      )
                      .map(
                        (s): RosterRow => ({
                          booking_id: `alloc_${openCard.session.id}_${s.client_id}`,
                          client_id: s.client_id,
                          status: 'booked',
                          plan: true,
                          actual: 'pending',
                          name: s.name,
                        })
                      ),
                  ].map((r) => {
                    const member = portal.members.find(
                      (m) => m.id === r.client_id
                    );
                    const actual = attendOverride[r.booking_id] || r.actual;
                    return (
                    <li
                      key={r.booking_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{r.name}</p>
                        <div className="text-[10px] uppercase text-slate-500">
                          Plan {r.status} · Actual{' '}
                          {actual === 'pending' ? '—' : actual}
                          {r.rsvp === 'coming'
                            ? ' · will attend'
                            : r.rsvp === 'not_coming'
                              ? ' · won’t attend'
                              : ''}
                        </div>
                        {(r.injured || r.health_label) && (
                          <div
                            className="mt-0.5 text-[10px] font-bold text-rose-300/90"
                            title={
                              r.health?.training_modifications ||
                              r.health?.injury_notes ||
                              ''
                            }
                          >
                            ⚠ {r.health_label || 'Injured'}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={`inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                            actual === 'attended'
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-600'
                          }`}
                          title="Attended — tap once to save"
                          onClick={() =>
                            markAttendance(
                              r.booking_id,
                              'attended',
                              r.client_id,
                              openCard.session.id
                            )
                          }
                        >
                          <Check className="w-4 h-4" />
                          Came
                        </button>
                        <button
                          type="button"
                          className={`inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                            actual === 'no_show'
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'border-slate-600'
                          }`}
                          title="Did not attend — tap once to save"
                          onClick={() =>
                            markAttendance(
                              r.booking_id,
                              'no_show',
                              r.client_id,
                              openCard.session.id
                            )
                          }
                        >
                          <UserX className="w-4 h-4" />
                          Didn’t
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-lg border border-slate-600 text-[10px] font-bold"
                          onClick={() =>
                            markAttendance(
                              r.booking_id,
                              'booked',
                              r.client_id,
                              openCard.session.id
                            )
                          }
                        >
                          Plan
                        </button>
                      </div>
                      {actual === 'attended' || actual === 'pending' ? (
                        <details className="w-full pt-1">
                          <summary className="cursor-pointer text-[10px] font-black uppercase text-slate-400">
                            Note for this member
                          </summary>
                        <div className="space-y-1 pt-1">
                          {r.coach_feedback ||
                          r.coach_member_feeling != null ||
                          r.coach_member_rating != null ? (
                            <p className="text-[11px] text-amber-200/90">
                              {r.coach_member_feeling != null
                                ? `Felt ${r.coach_member_feeling}/5`
                                : ''}
                              {r.coach_member_rating != null
                                ? `${r.coach_member_feeling != null ? ' · ' : ''}Rated ${r.coach_member_rating}/5`
                                : ''}
                              {r.coach_feedback
                                ? `${r.coach_member_feeling != null || r.coach_member_rating != null ? ' — ' : ''}${r.coach_feedback}`
                                : ''}
                            </p>
                          ) : null}
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[10px] font-bold text-slate-400">
                              How they felt
                              <select
                                className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
                                value={
                                  feelingDrafts[r.booking_id] ??
                                  (r.coach_member_feeling != null
                                    ? String(r.coach_member_feeling)
                                    : '')
                                }
                                onChange={(e) =>
                                  setFeelingDrafts((cur) => ({
                                    ...cur,
                                    [r.booking_id]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">—</option>
                                <option value="1">1 tired</option>
                                <option value="2">2 low</option>
                                <option value="3">3 ok</option>
                                <option value="4">4 good</option>
                                <option value="5">5 strong</option>
                              </select>
                            </label>
                            <label className="text-[10px] font-bold text-slate-400">
                              Rate member
                              <select
                                className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
                                value={
                                  ratingDrafts[r.booking_id] ??
                                  (r.coach_member_rating != null
                                    ? String(r.coach_member_rating)
                                    : '')
                                }
                                onChange={(e) =>
                                  setRatingDrafts((cur) => ({
                                    ...cur,
                                    [r.booking_id]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">—</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5 excellent</option>
                              </select>
                            </label>
                          </div>
                          <textarea
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] min-h-[2.5rem]"
                            placeholder="Note for this member (saved on their profile)"
                            value={
                              feedbackDrafts[r.booking_id] ??
                              r.coach_feedback ??
                              ''
                            }
                            onChange={(e) =>
                              setFeedbackDrafts((cur) => ({
                                ...cur,
                                [r.booking_id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg bg-amber-500/90 px-2 py-1 text-[10px] font-black text-amber-950 disabled:opacity-50"
                            onClick={() =>
                              void post({
                                action: 'member_coach_feedback',
                                booking_id: r.booking_id,
                                comment:
                                  feedbackDrafts[r.booking_id] ??
                                  r.coach_feedback ??
                                  '',
                                feeling:
                                  feelingDrafts[r.booking_id] ||
                                  r.coach_member_feeling ||
                                  undefined,
                                rating:
                                  ratingDrafts[r.booking_id] ||
                                  r.coach_member_rating ||
                                  undefined,
                              })
                            }
                          >
                            Save to member profile
                          </button>
                        </div>
                        </details>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Coach post-class feedback + member pulse */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              {openCard.feedback_summary &&
                openCard.feedback_summary.member_count > 0 && (
                  <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-300">
                    <span className="font-bold text-amber-300">
                      Member feedback
                    </span>
                    : {openCard.feedback_summary.member_count} · avg feel{' '}
                    {openCard.feedback_summary.avg_feeling ?? '—'} · intensity{' '}
                    {openCard.feedback_summary.avg_intensity ?? '—'}
                    {(openCard.member_feedback || []).length > 0 && (
                      <ul className="mt-1.5 space-y-1 text-slate-400">
                        {(openCard.member_feedback || []).slice(0, 5).map((f) => (
                          <li key={f.id}>
                            {f.author_name || 'Member'}: feel {f.feeling}/5 · RPE{' '}
                            {f.intensity}
                            {f.comment ? ` — ${f.comment}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              <FitClassFeedbackForm
                key={openCard.session.id + (openCard.my_feedback?.id || 'new')}
                role="coach"
                initial={openCard.my_feedback}
                busy={busy}
                title={
                  sessionEdit?.session_kind === 'coach_personal'
                    ? openCard.my_feedback
                      ? 'Update how this workout felt'
                      : 'How did this workout feel?'
                    : openCard.my_feedback
                      ? 'Update your coach check-in'
                      : 'After you trained this class'
                }
                description={
                  sessionEdit?.session_kind === 'coach_personal'
                    ? 'How you felt after the session, then rate it. Saving also marks it complete.'
                    : 'How you feel after teaching, and how intense the session was. Owner sees this with member scores.'
                }
                enjoymentLabel={
                  sessionEdit?.session_kind === 'coach_personal'
                    ? 'Rate this workout'
                    : 'Enjoyment'
                }
                againLabel={
                  sessionEdit?.session_kind === 'coach_personal'
                    ? 'Would do this workout again'
                    : undefined
                }
                commentPlaceholder={
                  sessionEdit?.session_kind === 'coach_personal'
                    ? 'What went well, what to change next time…'
                    : undefined
                }
                onSubmit={async (v) => {
                  await post({
                    action: 'coach_feedback',
                    session_id: openCard.session.id,
                    feeling: v.feeling,
                    intensity: v.intensity,
                    enjoyment: v.enjoyment,
                    would_return: v.would_return,
                    comment: v.comment || undefined,
                    tags: v.tags,
                  });
                  void load();
                }}
              />
            </div>

            {sessionEdit?.session_kind !== 'coach_personal' ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Message this class
              </p>
              <p className="text-[11px] text-slate-500">
                Goes to everyone booked or subscribed on this session
                {(openCard.roster.length || 0) +
                  (openCard.subscribed_not_booked || []).length
                  ? ` · ${
                      new Set([
                        ...openCard.roster
                          .filter((r) => r.status !== 'cancelled')
                          .map((r) => r.client_id),
                        ...(openCard.subscribed || []).map((s) => s.client_id),
                      ]).size
                    } people`
                  : ''}
                .
              </p>
              {(() => {
                const thr = (portal.threads || []).find(
                  (t) =>
                    t.group?.kind === 'session' &&
                    t.group?.ref_id === openCard.session.id
                );
                if (!thr?.messages?.length) return null;
                return (
                  <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2 dark:border-white/10 dark:bg-neutral-950">
                    {thr.messages.slice(-6).map((m) => (
                      <p key={m.id} className="text-[11px] text-slate-700 dark:text-slate-200">
                        <span className="font-bold">{m.author_name}: </span>
                        {m.body}
                      </p>
                    ))}
                  </div>
                );
              })()}
              <textarea
                className="min-h-[4rem] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950"
                placeholder="e.g. Bring bands. We’ll follow the programme on the card."
                value={classMsg}
                onChange={(e) => setClassMsg(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !classMsg.trim()}
                className="min-h-10 w-full rounded-xl bg-sky-600 text-[11px] font-black text-white disabled:opacity-50"
                onClick={() => {
                  void post({
                    action: 'create_thread',
                    to_class: true,
                    session_id: openCard.session.id,
                    channel: 'class_session',
                    body: classMsg.trim(),
                    from: weekStart,
                    to: weekEnd,
                  }).then(() => {
                    setClassMsg('');
                    void load();
                  });
                }}
              >
                <Send className="mr-1 inline h-3.5 w-3.5" /> Send to class
              </button>
            </div>
            ) : null}

            {sessionEdit?.session_kind !== 'coach_personal' ? (
            <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Add a booked member
              </p>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Search members to book on this class…"
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value);
                  setMemberFor('');
                }}
              />
              {memberSearch.trim().length >= 2 ? (
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={memberFor}
                  onChange={(e) => setMemberFor(e.target.value)}
                >
                  <option value="">Pick a search match…</option>
                  {portal.members
                    .filter((m) => {
                      const booked = openCard.roster.some(
                        (r) => r.client_id === m.id && r.status !== 'cancelled'
                      );
                      if (booked) return false;
                      const q = memberSearch.trim().toLowerCase();
                      return (
                        m.name.toLowerCase().includes(q) ||
                        String(m.code || '')
                          .toLowerCase()
                          .includes(q)
                      );
                    })
                    .slice(0, 20)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                </select>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Roster shows booked members only. Type 2+ letters to add
                  someone.
                </p>
              )}
              <button
                type="button"
                disabled={busy || !memberFor}
                className="rounded-xl bg-amber-500 text-amber-950 px-3 py-2 text-xs font-black disabled:opacity-50"
                onClick={() =>
                  void post({
                    action: 'book_member',
                    session_id: openCard.session.id,
                    client_id: memberFor,
                  }).then(() => {
                    setMemberFor('');
                    setMemberSearch('');
                  })
                }
              >
                Book onto class
              </button>
            </div>
            ) : (
              <p className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
                Personal time cannot take members.
              </p>
            )}
          </div>
        </div>
      )}

      {workTab === 'me' ? (
        <div className="space-y-3">
            <GymSectionTitle hint="What members see in Shop, plus your work details.">
              You
            </GymSectionTitle>
            <p className="text-[11px] text-slate-500">
              Public bio and photo appear on the member shop. Rate and tenure are
              set by the gym owner.
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
              {portal.coach.engagement === 'employed'
                ? 'Employed — this work app is your diary. Only the gym owner opens SupplierAdvisor.'
                : 'Contractor — this work app is your diary. Gym-booked slots and your private PT live here.'}
            </p>
            <OwnerWorkspaceCta companyId={companyId} brand={brand} />
            <GymProfileFolds
              pbs={parsePersonalBests(portal.coach.personal_bests)}
              injuries={injuriesForPerson({
                injuries: portal.coach.injuries,
                health: portal.coach.health,
              })}
              feedback={(portal.profile_feedback || []).map((f) => ({
                id: f.id,
                title: f.title,
                date: f.date,
                feeling: f.feeling,
                intensity: f.intensity,
                enjoyment: f.enjoyment,
                comment: f.comment,
                source: f.source,
              }))}
              busyId={recordBusy}
              color="#E8E830"
              ink="#0f172a"
              onSavePb={async (row) => {
                setRecordBusy('pb');
                try {
                  await post({ action: 'upsert_personal_best', ...row });
                } finally {
                  setRecordBusy(null);
                }
              }}
              onDeletePb={async (id) => {
                setRecordBusy('pb');
                try {
                  await post({ action: 'delete_personal_best', id });
                } finally {
                  setRecordBusy(null);
                }
              }}
              onSaveInjury={async (row) => {
                setRecordBusy('injury');
                try {
                  await post({ action: 'upsert_injury', ...row });
                } finally {
                  setRecordBusy(null);
                }
              }}
              onDeleteInjury={async (id) => {
                setRecordBusy('injury');
                try {
                  await post({ action: 'delete_injury', id });
                } finally {
                  setRecordBusy(null);
                }
              }}
              admin={
            <>
            {(portal.coach.start_date ||
              portal.coach.end_date ||
              portal.coach.rate_zar != null ||
              (portal.coach.history || []).length > 0) && (
              <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Engagement & rate (owner-set)
                </div>
                <div>
                  Current:{' '}
                  {portal.coach.start_date || '—'}
                  {portal.coach.end_date
                    ? ` → ${portal.coach.end_date}`
                    : ' → present'}
                </div>
                {portal.coach.rate_zar != null && (
                  <div>
                    Rate: R{Number(portal.coach.rate_zar).toLocaleString('en-ZA')}
                    {portal.coach.rate_basis
                      ? ` / ${String(portal.coach.rate_basis).replace(/_/g, ' ')}`
                      : ''}
                    {portal.coach.rate_note
                      ? ` · ${portal.coach.rate_note}`
                      : ''}
                  </div>
                )}
                {(portal.coach.history || []).length > 0 && (
                  <ul className="space-y-0.5 text-slate-400">
                    {(portal.coach.history || []).map((h) => (
                      <li key={h.id}>
                        Prior: {h.start_date} → {h.end_date}
                        {h.rate_zar != null
                          ? ` · R${Number(h.rate_zar).toLocaleString('en-ZA')}${
                              h.rate_basis
                                ? ` / ${String(h.rate_basis).replace(/_/g, ' ')}`
                                : ''
                            }`
                          : ''}
                        {h.note ? ` — ${h.note}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Display name"
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
            />
            <input
              type="email"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Email"
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Phone"
              value={profile.phone}
              onChange={(e) =>
                setProfile((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="SA ID / passport number"
              value={profile.id_number}
              onChange={(e) =>
                setProfile((p) => ({ ...p, id_number: e.target.value }))
              }
            />
            <ProfilePhotoField
              value={profile.photo_url}
              kind="coach_photo"
              label="Your photo"
              description="Shown on the member shop and your coach app."
              accentClass="border-amber-300"
              disabled={busy}
              uploadFile={async (file) => {
                const fd = new FormData();
                fd.set('token', token);
                fd.set('action', 'upload_photo');
                fd.set('file', file);
                const res = await fetch('/api/public/fitgraph/coach', {
                  method: 'POST',
                  body: fd,
                });
                const data = await res.json();
                if (!res.ok || !data.url) {
                  throw new Error(data.error || 'Could not upload photo');
                }
                if (data.portal) setPortal(data.portal);
                return { url: String(data.url) };
              }}
              onChange={(url) => {
                setProfile((p) => ({ ...p, photo_url: url }));
                if (!url) {
                  void post(
                    { action: 'update_profile', photo_url: null },
                    { quiet: true }
                  );
                }
              }}
            />
            <PortalIdentityVerify
              module="fitgraph"
              role="coach"
              token={token}
              idNumber={profile.id_number}
              onIdNumberChange={(v) =>
                setProfile((p) => ({ ...p, id_number: v }))
              }
              identity={portal.coach.identity}
              onIdentityChange={(id) =>
                setPortal((p) =>
                  p
                    ? { ...p, coach: { ...p.coach, identity: id } }
                    : p
                )
              }
              accentClass="border-amber-500/40"
              buttonClass="bg-amber-500 hover:bg-amber-400 text-amber-950"
            />
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400 mb-1.5">
                Specialties
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(portal.specialty_options || []).map((s) => {
                  const on = profile.specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        on
                          ? 'bg-amber-500 text-amber-950 border-amber-500'
                          : 'border-slate-600 text-slate-300'
                      }`}
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          specialties: on
                            ? p.specialties.filter((x) => x !== s)
                            : [...p.specialties, s],
                        }))
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400 mb-1">
                Public bio (website & members)
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4.5rem] resize-y"
                placeholder="Short bio members see on the public calendar…"
                value={profile.public_bio}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, public_bio: e.target.value }))
                }
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400 mb-1">
                Full bio / notes (for gym office)
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[3.5rem] resize-y"
                placeholder="Certifications, experience, availability notes…"
                value={profile.bio}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, bio: e.target.value }))
                }
              />
            </div>
            <PersonQualificationsEditor
              qualifications={profile.qualifications}
              onChange={async (next) => {
                setProfile((p) => ({ ...p, qualifications: next }));
                await post({
                  action: 'update_profile',
                  qualifications: next,
                });
              }}
              uploadFile={async (file) => {
                const fd = new FormData();
                fd.set('token', token);
                fd.set('action', 'upload_certificate');
                fd.set('file', file);
                const res = await fetch('/api/public/fitgraph/coach', {
                  method: 'POST',
                  body: fd,
                });
                const data = await res.json();
                if (!res.ok || !data.url) {
                  throw new Error(data.error || 'Upload failed');
                }
                return { url: String(data.url), fileName: String(data.fileName || file.name) };
              }}
              disabled={busy}
              toneClass="border-slate-700 bg-slate-950/60"
            />
            <button
              type="button"
              disabled={busy || !profile.name.trim()}
              className="w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 text-sm font-black disabled:opacity-50"
              onClick={() =>
                void post({
                  action: 'update_profile',
                  name: profile.name.trim(),
                  email: profile.email.trim() || null,
                  phone: profile.phone.trim() || null,
                  id_number: profile.id_number.trim() || null,
                  bio: profile.bio,
                  public_bio: profile.public_bio,
                  qualifications: profile.qualifications,
                  photo_url: profile.photo_url.trim() || null,
                  specialties: profile.specialties.length
                    ? profile.specialties
                    : ['General'],
                }).then(() => {
                  void load();
                })
              }
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : null}{' '}
              Save profile
            </button>
            </>
              }
            />
            <AdvisorPwaSignOutButton
              module="fitgraph"
              publicToken={publicToken}
              hint="Sign in again as a coach, or as a member."
            />
        </div>
      ) : null}

      {workTab === 'inbox' ? (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <GymSectionTitle hint="Members, desk, and other coaches.">
                Inbox
              </GymSectionTitle>
                <button
                  type="button"
                  className="rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-black text-sky-950"
                  onClick={() => setMsgCompose((v) => !v)}
                >
                  <Plus className="inline h-3 w-3" /> New
                </button>
            </div>

            {msgCompose ? (
              <div className="p-4 space-y-2 border-b border-slate-800 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ['member', 'Member'],
                      ['desk', 'Front desk'],
                      ['coach', 'Coach colleague'],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setMsgTo(k);
                        setMsgTargetId('');
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                        msgTo === k
                          ? 'bg-sky-500 text-sky-950 border-sky-500'
                          : 'border-slate-600 text-slate-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {msgTo === 'member' && (
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={msgTargetId}
                    onChange={(e) => setMsgTargetId(e.target.value)}
                  >
                    <option value="">Your member…</option>
                    {portal.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                  </select>
                )}
                {msgTo === 'coach' && (
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={msgTargetId}
                    onChange={(e) => setMsgTargetId(e.target.value)}
                  >
                    <option value="">Coach…</option>
                    {(portal.peer_coaches || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem]"
                  placeholder="Message…"
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                />
                <button
                  type="button"
                  disabled={
                    busy ||
                    !msgBody.trim() ||
                    (msgTo !== 'desk' && !msgTargetId)
                  }
                  className="w-full rounded-xl bg-sky-500 text-sky-950 py-2 text-sm font-black disabled:opacity-50"
                  onClick={() => {
                    const payload: Record<string, unknown> = {
                      action: 'message_create_thread',
                      body: msgBody.trim(),
                      from: weekStart,
                      to: weekEnd,
                    };
                    if (msgTo === 'member') {
                      payload.client_id = msgTargetId;
                      payload.channel = 'coach_member';
                    } else if (msgTo === 'desk') {
                      payload.to_desk = true;
                      payload.channel = 'desk_coach';
                    } else {
                      payload.coach_id = msgTargetId;
                      payload.channel = 'colleague';
                    }
                    void post(payload).then((data) => {
                      setMsgCompose(false);
                      setMsgBody('');
                      setMsgTargetId('');
                      if (data?.thread?.id) setMsgThreadId(String(data.thread.id));
                      void load();
                    });
                  }}
                >
                  <Send className="w-3.5 h-3.5 inline" /> Send
                </button>
              </div>
            ) : null}

            <div className="min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-900 sm:grid sm:grid-cols-[200px_1fr]">
              <div className="max-h-40 overflow-y-auto border-b border-slate-100 sm:max-h-none sm:border-b-0 sm:border-r dark:border-white/10">
                {(portal.threads || []).length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-500">
                    No threads yet. Message a member or the desk.
                  </p>
                ) : (
                  (portal.threads || []).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setMsgThreadId(t.id);
                        void post({
                          action: 'message_mark_read',
                          thread_id: t.id,
                          from: weekStart,
                          to: weekEnd,
                        }).then(() => void load());
                      }}
                      className={`w-full border-b border-slate-100 px-3 py-2.5 text-left dark:border-white/10 ${
                        msgThreadId === t.id
                          ? 'bg-slate-50 dark:bg-white/10'
                          : ''
                      }`}
                    >
                      <div className="text-[12px] font-bold truncate">
                        {t.subject}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {t.preview}
                      </div>
                      {t.unread > 0 ? (
                        <span className="text-[9px] font-black text-rose-400">
                          {t.unread} new
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <div className="flex flex-col min-h-[220px] max-h-[50vh]">
                {(() => {
                  const thr =
                    (portal.threads || []).find((t) => t.id === msgThreadId) ||
                    (portal.threads || [])[0];
                  if (!thr) {
                    return (
                      <p className="p-4 text-sm text-slate-500">
                        Select a conversation
                      </p>
                    );
                  }
                  return (
                    <>
                      <div className="px-3 py-2 border-b border-slate-800 text-xs font-bold">
                        {thr.subject}
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {thr.messages.map((m) => {
                          const mine = m.author_ref_id === portal.coach.id;
                          return (
                            <div
                              key={m.id}
                              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[90%] rounded-2xl px-2.5 py-1.5 text-[12px] ${
                                  mine
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-slate-800 text-slate-100'
                                }`}
                              >
                                <div className="text-[9px] opacity-70 mb-0.5">
                                  {m.author_name}
                                </div>
                                <div className="whitespace-pre-wrap">
                                  {m.body}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-slate-800 flex gap-2">
                        <input
                          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                          placeholder="Reply…"
                          value={msgReply}
                          onChange={(e) => setMsgReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && msgReply.trim()) {
                              void post({
                                action: 'message_post',
                                thread_id: thr.id,
                                body: msgReply.trim(),
                                from: weekStart,
                                to: weekEnd,
                              }).then(() => {
                                setMsgReply('');
                                void load();
                              });
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={busy || !msgReply.trim()}
                          className="rounded-xl bg-sky-500 text-sky-950 px-3 py-2 disabled:opacity-50"
                          onClick={() =>
                            void post({
                              action: 'message_post',
                              thread_id: thr.id,
                              body: msgReply.trim(),
                              from: weekStart,
                              to: weekEnd,
                            }).then(() => {
                              setMsgReply('');
                              void load();
                            })
                          }
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
        </div>
      ) : null}

      {/* Create class */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex justify-between">
              <h3 className="font-black">
                {create.session_kind === 'coach_personal'
                  ? 'Plan workout'
                  : create.session_kind === 'private_pt'
                    ? 'Private client session'
                    : 'New class'}
              </h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={create.session_kind}
              onChange={(e) =>
                setCreate((f) =>
                  patchFormForSessionKind(
                    f,
                    e.target.value as FitSessionKind,
                    portal.class_types
                  )
                )
              }
            >
              {SESSION_KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {create.session_kind !== 'coach_personal' ? (
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.class_type_id}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, class_type_id: e.target.value }))
                }
              >
                <option value="">
                  {create.session_kind === 'private_pt'
                    ? 'PT type (optional)…'
                    : 'Class type…'}
                </option>
                {portal.class_types
                  .filter((c) =>
                    create.session_kind === 'private_pt'
                      ? c.code !== SYS_COACH_TIME_CODE
                      : c.code !== SYS_PT_CODE && c.code !== SYS_COACH_TIME_CODE
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            ) : (
              <p className="text-[10px] text-slate-400">
                Plan a workout for you. Mark it complete afterwards and log how
                you felt.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.date}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, date: e.target.value }))
                }
              />
              <input
                type="time"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.start_time}
                onChange={(e) =>
                  setCreate((f) => {
                    const next = e.target.value;
                    const dur = f.end_time
                      ? durationFromStartEnd(f.start_time, f.end_time)
                      : 45;
                    return {
                      ...f,
                      start_time: next,
                      end_time: endFromStartDuration(next, dur),
                    };
                  })
                }
              />
              <input
                type="time"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.end_time}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, end_time: e.target.value }))
                }
                aria-label="End time"
              />
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Room"
              value={create.location}
              onChange={(e) =>
                setCreate((f) => ({ ...f, location: e.target.value }))
              }
            />
            {create.session_kind === 'coach_personal' ? (
              <>
                <textarea
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem] resize-y"
                  placeholder="Workout for you, e.g. warm-up, strength, engine…"
                  value={create.notes}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, notes: e.target.value }))
                  }
                />
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={create.shared_coach_id}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, shared_coach_id: e.target.value }))
                  }
                >
                  <option value="">Keep this workout to yourself</option>
                  {(portal.peer_coaches || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      Share with {c.name} — you can both do it
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem] resize-y"
                placeholder="Class plan / activities (members & coaches see this)"
                value={create.class_plan}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, class_plan: e.target.value }))
                }
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-xl py-2 text-xs font-bold border ${
                  create.repeat === 'none'
                    ? 'bg-amber-500 text-amber-950 border-amber-500'
                    : 'border-slate-600'
                }`}
                onClick={() => setCreate((f) => ({ ...f, repeat: 'none' }))}
              >
                Bespoke
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl py-2 text-xs font-bold border inline-flex items-center justify-center gap-1 ${
                  create.repeat === 'weekly'
                    ? 'bg-amber-500 text-amber-950 border-amber-500'
                    : 'border-slate-600'
                }`}
                onClick={() => setCreate((f) => ({ ...f, repeat: 'weekly' }))}
              >
                <Repeat className="w-3 h-3" /> Weekly
              </button>
            </div>
            {create.repeat === 'weekly' && (
              <>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((w) => {
                    const on = create.weekdays.includes(w.v);
                    return (
                      <button
                        key={w.v}
                        type="button"
                        className={`w-8 h-8 rounded-lg text-[10px] font-bold border ${
                          on
                            ? 'bg-amber-500 text-amber-950 border-amber-500'
                            : 'border-slate-600'
                        }`}
                        onClick={() =>
                          setCreate((f) => ({
                            ...f,
                            weekdays: on
                              ? f.weekdays.filter((x) => x !== w.v)
                              : [...f.weekdays, w.v],
                          }))
                        }
                      >
                        {w.l}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number"
                  min={1}
                  max={52}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Weeks"
                  value={create.count}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, count: e.target.value }))
                  }
                />
              </>
            )}
            {create.session_kind === 'class' ? (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={create.public}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, public: e.target.checked }))
                  }
                />
                Publish on public calendar
              </label>
            ) : (
              <p className="text-[10px] text-slate-400">
                {create.session_kind === 'private_pt'
                  ? 'Private PT stays off the public calendar.'
                  : 'Personal time stays private on your diary.'}
              </p>
            )}
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={create.programme_id}
              onChange={(e) =>
                setCreate((f) => ({ ...f, programme_id: e.target.value }))
              }
            >
              <option value="">
                {create.session_kind === 'coach_personal'
                  ? 'Workout programme (optional)…'
                  : create.session_kind === 'private_pt'
                    ? 'Client workout programme (optional)…'
                    : 'Class programme (optional)…'}
              </option>
              {programmesForLane(
                portal.programmes || [],
                create.session_kind
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">
              Other coaches can schedule at the same time — the gym is large
              enough for parallel sessions.
            </p>
            <button
              type="button"
              disabled={
                busy ||
                (create.session_kind === 'class' && !create.class_type_id)
              }
              className="w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 text-sm font-black"
              onClick={() => {
                const times = resolveSessionTimes({
                  start_time: create.start_time,
                  end_time: create.end_time,
                });
                void post({
                  action:
                    create.repeat === 'weekly'
                      ? 'create_series'
                      : 'create_session',
                  class_type_id: create.class_type_id,
                  session_kind: create.session_kind,
                  programme_id: create.programme_id || null,
                  shared_coach_ids:
                    create.session_kind === 'coach_personal' &&
                    create.shared_coach_id
                      ? [create.shared_coach_id]
                      : [],
                  date: create.date,
                  start_time: times.start_time,
                  end_time: times.end_time,
                  duration_min: times.duration_min,
                  location: create.location || undefined,
                  capacity: create.capacity
                    ? Number(create.capacity)
                    : undefined,
                  class_plan: create.class_plan.trim() || undefined,
                  notes: create.notes.trim() || undefined,
                  public: create.session_kind === 'class' && create.public,
                  count: Number(create.count) || 8,
                  weekdays:
                    create.weekdays.length > 0
                      ? create.weekdays
                      : [new Date(create.date + 'T12:00:00').getDay()],
                }).then(() => {
                  setShowCreate(false);
                  setCreate((f) => ({ ...f, class_plan: '', notes: '' }));
                  void load();
                });
              }}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : null}{' '}
              Create
            </button>
          </div>
        </div>
      )}

      {bookWith && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-black">Book a member with you</h3>
            <p className="text-[11px] text-slate-400">
              Creates a private PT slot on your diary and puts the member on it.
            </p>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={bookWith.client_id}
              onChange={(e) =>
                setBookWith((f) =>
                  f ? { ...f, client_id: e.target.value } : f
                )
              }
            >
              <option value="">Your member…</option>
              {portal.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} · {m.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={bookWith.date}
                onChange={(e) =>
                  setBookWith((f) => (f ? { ...f, date: e.target.value } : f))
                }
              />
              <input
                type="time"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={bookWith.start_time}
                onChange={(e) =>
                  setBookWith((f) =>
                    f ? { ...f, start_time: e.target.value } : f
                  )
                }
              />
            </div>
            <input
              type="time"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={bookWith.end_time}
              onChange={(e) =>
                setBookWith((f) => (f ? { ...f, end_time: e.target.value } : f))
              }
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Notes (optional)"
              value={bookWith.notes}
              onChange={(e) =>
                setBookWith((f) => (f ? { ...f, notes: e.target.value } : f))
              }
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-bold"
                onClick={() => setBookWith(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !bookWith.client_id}
                className="flex-1 rounded-xl bg-[#E8E830] py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
                onClick={() => {
                  const times = resolveSessionTimes({
                    start_time: bookWith.start_time,
                    end_time: bookWith.end_time,
                  });
                  void post({
                    action: 'schedule_member',
                    client_id: bookWith.client_id,
                    date: bookWith.date,
                    start_time: times.start_time,
                    end_time: times.end_time,
                    duration_min: times.duration_min,
                    notes: bookWith.notes.trim() || undefined,
                  }).then(() => {
                    setBookWith(null);
                    setWorkTab('diary');
                  });
                }}
              >
                Book
              </button>
            </div>
          </div>
        </div>
      )}

      {guestFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-black">Walk-in / guest on plan</h3>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Name *"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-bold"
                onClick={() => setGuestFor(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !guestName.trim()}
                className="flex-1 rounded-xl bg-yellow-600 py-2.5 text-sm font-bold"
                onClick={() =>
                  void post({
                    action: 'book_guest',
                    session_id: guestFor,
                    name: guestName.trim(),
                  }).then(() => setGuestFor(null))
                }
              >
                Book
              </button>
            </div>
          </div>
        </div>
      )}

      {showLibrary ? (
        <CoachMovementStudio
          token={token}
          coachId={portal.coach.id}
          movements={portal.movements || []}
          programmes={portal.programmes || []}
          classTypes={portal.class_types}
          sessions={portal.sessions.map((c) => ({
            id: c.session.id,
            date: c.session.date,
            start_time: c.session.start_time,
            class_type_id: c.session.class_type_id,
          }))}
          focusSessionId={librarySessionId}
          onClose={() => {
            setShowLibrary(false);
            setLibrarySessionId(null);
          }}
          onChanged={() => void load()}
        />
      ) : null}
    </AdvisorWorkPwaChrome>
    </>
  );
}
