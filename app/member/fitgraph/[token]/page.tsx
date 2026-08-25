'use client';

/**
 * GymAdvisor® member portal — registered clients book open classes,
 * see vacancies, join waitlist when full, manage their bookings.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Loader2,
  MessageSquareHeart,
  Send,
  Share2,
  ShoppingBag,
  User,
} from 'lucide-react';
import { GymShopPay } from '@/components/fitness/GymShopPay';

import {
  emptyDebitBankForm,
  MemberDebitBankFields,
  type DebitBankForm,
} from '@/components/fitness/MemberDebitBankFields';
import type { GymShopCoach, GymShopItem } from '@/lib/fitness/gym-shop';
import type { GymInventoryShopItem } from '@/lib/fitness/gym-inventory-shop';
import { sessionHasEnded } from '@/lib/services/booking-feedback';
import { sessionIsUpcoming } from '@/lib/fitness/gym-local-time';
import type { MemberRelationshipPayload } from '@/components/services/MemberRelationshipSection';
import { MemberGoalsPanel } from '@/components/fitness/MemberGoalsPanel';
import { MemberProgressCharts } from '@/components/fitness/MemberProgressCharts';
import { MemberProgrammeFollow } from '@/components/fitness/MemberProgrammeFollow';
import type { MemberProgrammeFollowView } from '@/lib/fitness/programme-follow';
import { MemberOpenDiaryWeek } from '@/components/fitness/MemberOpenDiaryWeek';
import type { MemberGoalView } from '@/lib/fitness/member-goals';
import {
  ProfilePhotoField,
  uploadPortalPersonPhoto,
} from '@/components/chrome/ProfilePhotoField';
import { PortalIdentityVerify } from '@/components/identity/PortalIdentityVerify';
import { PortalFamilyMembers } from '@/components/identity/PortalFamilyMembers';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';
import { MemberAnnouncementsFeed } from '@/components/services/MemberAnnouncementsFeed';
import { MemberPortalBrandLockup } from '@/components/brand/PortalBrandLogo';
import { MemberAdvisorShell } from '@/components/advisors/MemberAdvisorShell';
import {
  MemberPortalInvoices,
  mergePortalInvoices,
  type MemberPortalInvoice,
} from '@/components/advisors/MemberPortalInvoices';
import { gymBrandColor } from '@/lib/fitness/fitgraph';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import type { MemberAnnouncementPublic } from '@/lib/services/member-announcements';
import {
  GymCheckinPass,
  GymClassRateCard,
  GymExpandSection,
  GymFlash,
  GymNextUpCard,
  GymSectionTitle,
  GymSharePanel,
  GymStat,
  gymFormatDay,
} from '@/components/fitness/GymMemberPwaUi';
import { AdvisorPwaMemberBinder } from '@/components/advisors/AdvisorPwaMemberBinder';
import { AdvisorPwaSignOutButton } from '@/components/advisors/AdvisorPwaSignOutButton';

const MEMBER_TOKEN_KEY = 'sa_fitgraph_member_token';

type MemberTab =
  | 'checkin'
  | 'history'
  | 'join'
  | 'open'
  | 'mine'
  | 'progress'
  | 'messages'
  | 'profile'
  | 'share';

type OpenClass = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number;
  class_name: string;
  coach_name?: string;
  location?: string;
  capacity: number;
  spots_left: number;
  full: boolean;
  public_notes?: string;
  class_plan?: string;
  my_status?: string | null;
  my_booking_id?: string | null;
  my_rsvp?: 'coming' | 'not_coming' | null;
  programme?: import('@/lib/fitness/movements').FitHydratedProgramme | null;
  can_book?: boolean;
  need_plan?: boolean;
  need_debit_bank?: boolean;
  book_hint?: string | null;
};

type MyBooking = {
  booking_id: string;
  status: string;
  session_id: string;
  date: string;
  start_time: string;
  class_name: string;
  coach_name?: string;
  location?: string;
  upcoming?: boolean;
  feedback_token?: string | null;
  feedback_submitted_at?: string | null;
  coach_feedback?: string | null;
  coach_member_feeling?: number | null;
  coach_member_rating?: number | null;
  rsvp?: 'coming' | 'not_coming' | null;
  class_plan?: string;
  programme?: import('@/lib/fitness/movements').FitHydratedProgramme | null;
};

type Portal = {
  brand: string;
  bio?: string;
  timezone?: string;
  allow_booking: boolean;
  contact_email?: string;
  contact_phone?: string;
  primary_color?: string;
  logo_url?: string | null;
  from: string;
  to: string;
  client: {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    photo_url?: string;
    membership_status?: string;
    plan_name?: string;
    coach_name?: string;
    identity?: {
      status?: string;
      provider?: string | null;
      verified_at?: string | null;
      verified_name?: string | null;
      status_text?: string | null;
      is_verified?: boolean;
    };
    family?: Array<{
      id: string;
      name: string;
      relationship: string;
      date_of_birth?: string | null;
      id_number?: string;
      phone?: string;
      notes?: string;
      is_minor?: boolean;
      active?: boolean;
    }>;
  };
  open_classes: OpenClass[];
  vacancies: OpenClass[];
  my_bookings: MyBooking[];
  upcoming_count?: number;
  open_count: number;
  full_count: number;
  progress?: {
    attended_count?: number;
    no_show_count?: number;
    attended_30d?: number;
    check_ins_30d?: number;
    last_attended?: string | null;
    health?: {
      summary?: string | null;
      injury_status?: string | null;
      injury_areas?: string[];
      training_modifications?: string | null;
      goals?: string | null;
      pain_score?: number | null;
    } | null;
    coach_notes?: Array<{
      id: string;
      at: string;
      title: string;
      body?: string | null;
    }>;
    my_feedback?: Array<{
      id: string;
      booking_id?: string | null;
      session_id?: string;
      at: string;
      class_name: string;
      date: string;
      feeling: number;
      intensity: number;
      enjoyment?: number | null;
      comment?: string | null;
      tags?: string[];
    }>;
    pending_feedback?: Array<{
      booking_id: string;
      date: string;
      class_name: string;
      feedback_token: string;
    }>;
  };
  programme_follows?: MemberProgrammeFollowView[];
  relationship?: MemberRelationshipPayload | null;
  announcements?: MemberAnnouncementPublic[];
  messages_unread?: number;
  packs?: Array<{
    id: string;
    label?: string;
    remaining: number;
    sessions_total: number;
    expires_at?: string | null;
  }>;
  gym_checkin?: {
    public_token: string;
    path: string;
    brand: string;
  } | null;
  access?: {
    level: string;
    payment_ok: boolean;
    membership_status: string;
    subscription_status: string | null;
    plan_name: string | null;
    alert: string | null;
    member_message: string;
  };
  shop?: GymShopItem[];
  shop_coaches?: GymShopCoach[];
  inventory_products?: GymInventoryShopItem[];
  inventory_services?: GymInventoryShopItem[];
  purchase_history?: Array<{
    id: string;
    kind: string;
    label: string;
    amount_zar: number;
    at: string;
  }>;
  check_ins?: Array<{
    id: string;
    date: string;
    time?: string | null;
    method?: string | null;
    class_name?: string | null;
    session_id?: string | null;
    notes?: string | null;
    created_at: string;
  }>;
  require_paid_membership?: boolean;
  paid_access?: boolean;
  payout_ready?: boolean;
  subscriptions?: Array<{
    id: string;
    plan_id?: string;
    plan_name: string;
    price_zar: number;
    billing: string;
    schedule_label?: string;
    addon?: boolean;
    status: string;
    current_period_end?: string | null;
  }>;
  class_report?: import('@/lib/fitness/vuka-class-catalog').ClassSubscriptionReport;
  joining?: { fee_zar: number; waived?: boolean; note?: string } | null;
  class_subscribe?: boolean;
  grow?: {
    public_token: string;
    join_member: string;
    join_private: string;
    join_both: string;
    classes: Array<{
      id: string;
      share_code: string;
      class_name: string;
      date: string;
      start_time: string;
      coach_name?: string;
      location?: string;
    }>;
  } | null;
  collect_debit_bank?: boolean;
  require_debit_bank?: boolean;
  bank?: {
    complete: boolean;
    account_holder: string;
    bank_name: string;
    account_number: string;
    account_number_masked: string;
    branch_code: string;
    account_type: string;
    debit_order_authorised: boolean;
  } | null;
  threads?: Array<{
    id: string;
    title?: string;
    subject?: string;
    preview?: string;
    updated_at?: string;
    unread?: number;
    participants?: Array<{ role: string; ref_id: string; name: string }>;
    messages?: Array<{
      id: string;
      body: string;
      author_role: string;
      author_name: string;
      created_at: string;
    }>;
  }>;
  invoices?: MemberPortalInvoice[];
  goals?: MemberGoalView[];
  wearable?: {
    garmin_available?: boolean;
    garmin_connected?: boolean;
    last_sync_at?: string | null;
  } | null;
  watch_sessions?: Array<{
    id: string;
    source: string;
    started_at: string;
    duration_min?: number | null;
    distance_km?: number | null;
    calories?: number | null;
    avg_hr?: number | null;
    activity_type?: string | null;
  }>;
  diary_open?: boolean;
};

export default function MemberFitgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<MemberTab>('mine');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinScan, setCheckinScan] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bookForFamilyId, setBookForFamilyId] = useState('');
  const [msgThreadId, setMsgThreadId] = useState<string | null>(null);
  const [msgReply, setMsgReply] = useState('');
  const [debitBank, setDebitBank] = useState<DebitBankForm>(emptyDebitBankForm);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [rsvpOverride, setRsvpOverride] = useState<
    Record<string, 'coming' | 'not_coming'>
  >({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/fitgraph/member?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal not found');
      setPortal(data.portal);
      if (
        data.portal?.require_paid_membership &&
        data.portal?.paid_access === false
      ) {
        setTab((t) => (t === 'open' || t === 'mine' ? 'join' : t));
      } else if (
        data.portal?.require_debit_bank &&
        data.portal?.bank &&
        !data.portal.bank.complete &&
        (data.portal.paid_access ||
          (data.portal.subscriptions || []).length > 0)
      ) {
        setTab((t) => (t === 'open' ? 'profile' : t));
      }
      const c = data.portal?.client;
      if (c) {
        setName(c.name || '');
        setEmail(c.email || '');
        setPhone(c.phone || '');
        setIdNumber(c.id_number || '');
        setPhotoUrl(c.photo_url || '');
      }
      const bank = data.portal?.bank;
      if (bank) {
        setDebitBank({
          account_holder: bank.account_holder || '',
          bank_name: bank.bank_name || '',
          account_number: bank.account_number || '',
          branch_code: bank.branch_code || '',
          account_type: bank.account_type || 'cheque',
          debit_order_authorised: bank.debit_order_authorised === true,
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4500);
    return () => window.clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    if (tab === 'progress' && (portal?.progress?.pending_feedback || []).length) {
      setFeedbackOpen(true);
    }
  }, [tab, portal?.progress?.pending_feedback?.length]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get('tab');
    if (raw === 'plans' || raw === 'join' || raw === 'shop') {
      setTab('join');
    } else if (raw === 'class' || raw === 'classes') {
      setTab('mine');
    } else if (raw === 'checkin' || raw === 'history') {
      setTab('history');
    } else if (
      raw === 'open' ||
      raw === 'mine' ||
      raw === 'progress' ||
      raw === 'messages' ||
      raw === 'profile' ||
      raw === 'share'
    ) {
      setTab(raw);
    }
    if (raw === 'progress' || q.get('rate') === '1') {
      setFeedbackOpen(true);
      if (raw !== 'progress' && q.get('rate') === '1') setTab('progress');
    }
    const garmin = new URLSearchParams(window.location.search).get('garmin');
    if (garmin === 'connected') {
      setMsg('Garmin connected — import after class or wait for auto-sync');
      setTab('progress');
    } else if (garmin === 'error') {
      setError('Garmin connect did not finish. You can still log watch stats.');
      setTab('progress');
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const q = new URLSearchParams(window.location.search);
    const ref = q.get('ref') || q.get('reference') || q.get('trxref');
    if (
      !ref ||
      (q.get('pay') !== '1' && !String(ref).startsWith('gym-sale-'))
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/public/fitgraph/member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            action: 'verify_sale',
            reference: ref,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not confirm payment');
        if (cancelled) return;
        if (data.portal) setPortal((prev) => mergePortalInvoices(data.portal, prev));
        setMsg(data.message || 'Payment recorded — membership is active');
        setTab('join');
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete('pay');
          u.searchParams.delete('ref');
          u.searchParams.delete('reference');
          u.searchParams.delete('trxref');
          u.searchParams.set('tab', 'join');
          window.history.replaceState({}, '', `${u.pathname}${u.search}`);
        } catch {
          /* ignore */
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Payment check failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectTab = (id: MemberTab) => {
    setTab(id);
    setError(null);
    setMsg(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('tab', id);
      window.history.replaceState({}, '', `${u.pathname}${u.search}`);
    } catch {
      /* ignore */
    }
  };

  // Remember portal token for gym QR check-in page + branded PWA
  useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem(MEMBER_TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  }, [token]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/fitgraph/member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.need_membership) {
        if (Array.isArray(data.shop) && portal) {
          setPortal({ ...portal, shop: data.shop });
        }
        selectTab('join');
      } else if (data.need_debit_bank) {
        selectTab('profile');
      }
      throw new Error(data.error || 'Request failed');
    }
    if (data.portal) {
      setPortal((prev) =>
        mergePortalInvoices(
          {
            ...data.portal,
            inventory_products:
              data.portal.inventory_products || prev?.inventory_products,
            inventory_services:
              data.portal.inventory_services || prev?.inventory_services,
            shop_coaches: data.portal.shop_coaches || prev?.shop_coaches,
          },
          prev
        )
      );
    }
    return data;
  };

  const book = async (sessionId: string, requestJoin = false) => {
    setBusyId(sessionId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: requestJoin ? 'request_join' : 'book',
        session_id: sessionId,
        family_member_id: bookForFamilyId || null,
      });
      setMsg(data.booking?.message || data.message || 'Done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBusyId(null);
    }
  };

  const buy = async (item: { kind: string; id: string }) => {
    setBuyingId(`${item.kind}:${item.id}`);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'checkout',
        kind: item.kind,
        item_id: item.id,
        name: name.trim() || portal?.client.name,
        email: email.trim() || portal?.client.email,
        phone: phone.trim() || portal?.client.phone,
      });
      if (data.authorization_url) {
        window.location.href = String(data.authorization_url);
        return;
      }
      throw new Error('Paystack did not return a checkout link');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBuyingId(null);
    }
  };

  const rsvp = async (
    bookingId: string,
    coming: boolean,
    sessionId?: string | null
  ) => {
    if (
      !coming &&
      !confirm(
        'Won’t be attending? Your coach will be notified and the spot may go to the waitlist.'
      )
    ) {
      return;
    }
    const stamp = coming ? ('coming' as const) : ('not_coming' as const);
    const keys = [bookingId, sessionId].filter(Boolean) as string[];
    setRsvpOverride((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = stamp;
      return next;
    });
    setBusyId(bookingId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'rsvp',
        booking_id: bookingId,
        session_id: sessionId || undefined,
        coming,
      });
      setMsg(
        data.message ||
          (coming ? 'Will be attending' : 'Won’t be attending')
      );
    } catch (e: unknown) {
      setRsvpOverride((prev) => {
        const next = { ...prev };
        for (const k of keys) delete next[k];
        return next;
      });
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (bookingId: string) => {
    await rsvp(bookingId, false);
  };

  const completeClass = async (bookingId: string) => {
    setBusyId(bookingId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'complete_class',
        booking_id: bookingId,
      });
      setMsg(data.message || 'Class marked complete');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not complete class');
    } finally {
      setBusyId(null);
    }
  };

  const rateClass = async (
    bookingId: string,
    v: {
      feeling: number;
      intensity: number;
      enjoyment: number;
      comment: string;
    }
  ) => {
    setBusyId(`rate:${bookingId}`);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'submit_feedback',
        booking_id: bookingId,
        feeling: v.feeling,
        intensity: v.intensity,
        enjoyment: v.enjoyment,
        comment: v.comment,
      });
      setMsg(data.message || 'Feedback sent to your coach and the gym');
      selectTab('progress');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send rating');
    } finally {
      setBusyId(null);
    }
  };

  const saveProfile = async () => {
    setBusyId('profile');
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'update_profile',
        name,
        email,
        phone,
        id_number: idNumber,
        photo_url: photoUrl,
        ...(portal?.collect_debit_bank
          ? {
              debit_bank: {
                ...debitBank,
                debit_order_authorised: debitBank.debit_order_authorised,
              },
            }
          : {}),
      });
      setMsg(data.message || 'Profile saved');
      const c = data.portal?.client;
      if (c) {
        setEmail(c.email || '');
        setIdNumber(c.id_number || '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusyId(null);
    }
  };

  /** Check in at the door — optional gym QR token for physical presence */
  const doCheckIn = async (withGymToken?: string) => {
    setCheckinBusy(true);
    setMsg(null);
    setError(null);
    try {
      let gymToken = (withGymToken || checkinScan || '').trim();
      // Accept full check-in URL pasted from camera / QR apps
      const m = gymToken.match(/checkin\/fitgraph\/([^/?#]+)/i);
      if (m) gymToken = decodeURIComponent(m[1]);
      const data = await post({
        action: 'checkin',
        gym_token: gymToken || undefined,
      });
      setMsg(data.message || 'Checked in');
      if (data.portal) setPortal((prev) => mergePortalInvoices(data.portal, prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      setCheckinBusy(false);
    }
  };

  const color = gymBrandColor(portal?.primary_color);
  const ink = advisorBrandInk(color);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-yellow-50 to-slate-100 dark:from-slate-950 dark:to-black">
        <div className="h-36 animate-pulse bg-yellow-300/80" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 dark:bg-black">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-6 text-center dark:border-rose-500/40 dark:bg-neutral-900">
          <p className="font-black text-slate-900 dark:text-white">
            Member portal unavailable
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!portal) return null;

  const formatDay = gymFormatDay;
  const needBank = Boolean(portal.require_debit_bank && !portal.bank?.complete);
  const gymTz = portal.timezone || 'Africa/Johannesburg';
  const bookedUpcoming = (portal.my_bookings || [])
    .filter(
      (b) =>
        sessionIsUpcoming(b.date, b.start_time, { timeZone: gymTz }) &&
        (b.status !== 'cancelled' || b.rsvp === 'not_coming')
    )
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? String(a.start_time).localeCompare(String(b.start_time))
        : a.date.localeCompare(b.date)
    );
  const nextClass = bookedUpcoming[0];
  const rsvpOf = (b: MyBooking) =>
    rsvpOverride[b.session_id] || rsvpOverride[b.booking_id] || b.rsvp || null;
  const feedbackOf = (b: MyBooking) =>
    (portal.progress?.my_feedback || []).find(
      (f) =>
        (f.booking_id && f.booking_id === b.booking_id) ||
        (f.session_id && f.session_id === b.session_id) ||
        (f.date === b.date && f.class_name === b.class_name)
    ) || null;
  const pendingRateOf = (b: MyBooking) =>
    (portal.progress?.pending_feedback || []).some(
      (f) => f.booking_id === b.booking_id
    ) ||
    (Boolean(b.feedback_token) && !b.feedback_submitted_at) ||
    (sessionHasEnded(b.date, b.start_time) &&
      b.status !== 'cancelled' &&
      b.status !== 'no_show' &&
      !b.feedback_submitted_at &&
      !feedbackOf(b));
  const recentDone = (portal.my_bookings || [])
    .filter(
      (b) =>
        !sessionIsUpcoming(b.date, b.start_time, { timeZone: gymTz }) &&
        b.status !== 'cancelled' &&
        rsvpOf(b) !== 'not_coming'
    )
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? String(b.start_time).localeCompare(String(a.start_time))
        : b.date.localeCompare(a.date)
    );
  const completedPending = (portal.my_bookings || [])
    .filter(
      (b) =>
        b.status !== 'cancelled' &&
        sessionHasEnded(b.date, b.start_time) &&
        b.status !== 'attended'
    )
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? String(b.start_time).localeCompare(String(a.start_time))
        : b.date.localeCompare(a.date)
    );
  const youTab =
    tab === 'messages' || tab === 'profile' || tab === 'history';

  return (
    <>
    <AdvisorPwaMemberBinder
      module="fitgraph"
      memberToken={token}
      publicToken={portal.grow?.public_token}
      brandName={portal.brand}
      themeColor={color}
      iconUrl={portal.logo_url}
    />
    <MemberAdvisorShell
      color={color}
      fromClass="from-yellow-50"
      tab={tab}
      onTab={selectTab}
      mobileNav="bottom"
      appHref={`/me?link=${encodeURIComponent(token)}`}
      tabs={[
        { id: 'mine', label: 'Class', icon: <Dumbbell /> },
        { id: 'progress', label: 'Progress', icon: <Activity /> },
        {
          id: 'profile',
          label: 'You',
          icon: <User />,
          badge:
            (portal.messages_unread || 0) + (needBank ? 1 : 0) || undefined,
          covers: ['profile', 'messages', 'history'],
        },
        { id: 'join', label: 'Shop', icon: <ShoppingBag /> },
        { id: 'share', label: 'Share', icon: <Share2 /> },
        { id: 'open', label: 'Book', icon: <CalendarDays /> },
      ]}
      mobileTabs={[
        { id: 'mine', label: 'Class', icon: <Dumbbell /> },
        { id: 'progress', label: 'Progress', icon: <Activity /> },
        {
          id: 'profile',
          label: 'You',
          icon: portal.client.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portal.client.photo_url}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <User />
          ),
          badge:
            (portal.messages_unread || 0) + (needBank ? 1 : 0) || undefined,
          covers: ['profile', 'messages', 'history'],
          emphasis: true,
        },
        { id: 'join', label: 'Shop', icon: <ShoppingBag /> },
        { id: 'share', label: 'Share', icon: <Share2 /> },
      ]}
      header={
        <MemberPortalBrandLockup
          logoUrl={portal.logo_url}
          brand={portal.brand}
          eyebrow="Member · GymAdvisor®"
        />
      }
    >
        <GymFlash error={error} msg={msg} />

        {youTab ? (
          <div className="space-y-3">
            <MemberAnnouncementsFeed
              items={portal.announcements}
              brand={portal.brand}
              tone="yellow"
            />
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-neutral-900">
              {(
                [
                  ['profile', 'Profile'],
                  ['messages', 'Inbox'],
                  ['history', 'History'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  className="min-h-9 flex-1 rounded-xl px-2 text-[11px] font-black"
                  style={
                    tab === id ? { backgroundColor: color, color: ink } : undefined
                  }
                >
                  {label}
                  {id === 'messages' && portal.messages_unread
                    ? ` (${portal.messages_unread})`
                    : ''}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {tab === 'share' && (
          <GymSharePanel
            brand={portal.brand}
            bio={portal.bio}
            phone={portal.contact_phone}
            email={portal.contact_email}
            color={color}
            grow={portal.grow}
          />
        )}

        {tab === 'join' && (
          <div className="space-y-4">
            <GymSectionTitle hint="Open a section, pick a card, then pay with Apple Pay or card.">
              Shop
            </GymSectionTitle>
            <GymShopPay
              items={(() => {
                const shop = portal.shop || [];
                const seen = new Set(shop.map((i) => i.id));
                const asItem = (
                  p: GymInventoryShopItem,
                  group: 'goods' | 'service'
                ) => ({
                  kind: 'product' as const,
                  id: p.id,
                  name: p.name,
                  description: p.description,
                  price_zar: p.price_zar,
                  billing: 'once' as const,
                  image_url: p.image_url,
                  group,
                  code: p.sku || undefined,
                  category: p.category || undefined,
                });
                return [
                  ...(portal.inventory_products || [])
                    .filter((p) => !seen.has(p.id))
                    .map((p) => asItem(p, 'goods')),
                  ...shop,
                  ...(portal.inventory_services || [])
                    .filter((p) => !seen.has(p.id))
                    .map((p) => asItem(p, 'service')),
                ];
              })()}
              color={color}
              payoutReady={portal.payout_ready !== false}
              requirePaid={portal.require_paid_membership}
              name={name}
              email={email}
              phone={phone}
              onName={setName}
              onEmail={setEmail}
              onPhone={setPhone}
              onBuy={(item) => void buy(item)}
              buyingId={buyingId}
              classSubscribe={portal.class_subscribe === true}
              hideIntro
              hideIdentity
              coaches={portal.shop_coaches || []}
              joinPrivateHref={portal.grow?.join_private || null}
              contactBusy={busyId === 'coach-msg'}
              onContactCoach={async (coach, body) => {
                setBusyId('coach-msg');
                setError(null);
                try {
                  const data = await post({
                    action: 'create_thread',
                    coach_id: coach.id,
                    body,
                  });
                  setMsg(
                    (data.message as string) ||
                      `Message sent to ${coach.name}`
                  );
                  selectTab('messages');
                } catch (e: unknown) {
                  setError(
                    e instanceof Error ? e.message : 'Could not message coach'
                  );
                } finally {
                  setBusyId(null);
                }
              }}
              subscribedIds={(portal.subscriptions || [])
                .map((s) => s.plan_id)
                .filter((id): id is string => Boolean(id))}
            />
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-4">
            <GymSectionTitle hint="Check-ins, completed classes, and ratings.">
              History
            </GymSectionTitle>
            {(portal.progress?.pending_feedback || []).length ? (
              <div className="space-y-2">
                {(portal.progress?.pending_feedback || []).map((f) => (
                  <GymClassRateCard
                    key={`ci-rate-${f.booking_id}`}
                    className={f.class_name}
                    date={f.date}
                    busy={busyId === `rate:${f.booking_id}`}
                    onSubmit={(v) => void rateClass(f.booking_id, v)}
                  />
                ))}
              </div>
            ) : null}
            {completedPending.length ? (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  After class
                </p>
                {completedPending.map((b) => (
                  <div
                    key={b.booking_id}
                    className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
                  >
                    <p className="font-black text-slate-900 dark:text-white">
                      {b.class_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDay(b.date, b.start_time)}
                      {b.coach_name ? ` · ${b.coach_name}` : ''}
                    </p>
                    <button
                      type="button"
                      disabled={busyId === b.booking_id}
                      onClick={() => void completeClass(b.booking_id)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[11px] font-black text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> I completed this class
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {(portal.check_ins || []).length ? (
              <ul className="space-y-2">
                {(portal.check_ins || []).map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-900"
                  >
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {c.class_name ||
                        (c.method === 'front_desk'
                          ? 'Coach / desk check-in'
                          : c.method === 'class'
                            ? 'Class completed'
                            : 'Gym check-in')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.date}
                      {c.time ? ` · ${c.time}` : ''}
                      {c.method
                        ? ` · ${
                            c.method === 'front_desk'
                              ? 'coach checked you in'
                              : c.method === 'class'
                                ? 'you ticked complete'
                                : c.method === 'qr_phone' || c.method === 'app'
                                  ? 'you checked in'
                                  : c.method
                          }`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-neutral-900">
                No check-ins yet. After your coach checks you in, or after you
                tick a completed class, it shows here.
              </p>
            )}
            <details className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
              <summary className="cursor-pointer text-sm font-black text-slate-900 dark:text-white">
                I&apos;m at the gym
              </summary>
              <div className="mt-3">
                <GymCheckinPass
                  brand={portal.brand}
                  membership={portal.access?.membership_status}
                  plan={portal.access?.plan_name || portal.client.plan_name}
                  paymentOk={portal.access?.payment_ok}
                  blocked={portal.access?.level === 'blocked'}
                  alert={portal.access?.alert}
                  scan={checkinScan}
                  onScan={setCheckinScan}
                  onCheckin={() => void doCheckIn()}
                  busy={checkinBusy}
                  color={color}
                />
              </div>
            </details>
          </div>
        )}

        {tab === 'messages' && (
          <div className="space-y-3">
            <GymSectionTitle hint="When your coach writes, it shows here — and we email you if a profile address is on file.">
              Messages with your coaches
            </GymSectionTitle>
            {(portal.threads || []).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-neutral-900">
                No messages yet. Your coaches will appear here.
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {(portal.threads || []).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMsgThreadId(t.id);
                          void post({
                            action: 'message_mark_read',
                            thread_id: t.id,
                          }).then(() => void load());
                        }}
                        className={`w-full rounded-2xl border px-3 py-3 text-left ${
                          msgThreadId === t.id
                            ? 'border-slate-900 bg-slate-50 dark:border-white dark:bg-white/10'
                            : 'border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-900'
                        }`}
                      >
                        <p className="text-sm font-black text-slate-900 truncate">
                          {t.title || t.subject || 'Conversation'}
                          {(t.unread || 0) > 0 ? (
                            <span className="ml-2 text-[10px] font-black uppercase text-amber-700">
                              {t.unread} new
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {t.preview || '—'}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
                {(() => {
                  const thr =
                    (portal.threads || []).find((t) => t.id === msgThreadId) ||
                    (portal.threads || [])[0];
                  if (!thr) return null;
                  return (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
                      <p className="text-xs font-bold text-slate-500">
                        {thr.title || thr.subject || 'Conversation'}
                      </p>
                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {(thr.messages || []).map((m) => {
                          const mine = m.author_role === 'member';
                          return (
                            <div
                              key={m.id}
                              className={`rounded-xl px-3 py-2 text-sm ${
                                mine
                                  ? 'bg-yellow-100 text-yellow-950 ml-6'
                                  : 'bg-slate-100 text-slate-900 mr-6'
                              }`}
                            >
                              <p className="text-[10px] font-bold opacity-70 mb-0.5">
                                {m.author_name}
                                {' · '}
                                {m.created_at?.slice(0, 16).replace('T', ' ')}
                              </p>
                              <p className="whitespace-pre-wrap">{m.body}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950"
                          placeholder="Reply…"
                          value={msgReply}
                          onChange={(e) => setMsgReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && msgReply.trim()) {
                              void post({
                                action: 'message_post',
                                thread_id: thr.id,
                                body: msgReply.trim(),
                              }).then(() => {
                                setMsgReply('');
                                void load();
                              });
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={busyId === thr.id || !msgReply.trim()}
                          onClick={() => {
                            setBusyId(thr.id);
                            void post({
                              action: 'message_post',
                              thread_id: thr.id,
                              body: msgReply.trim(),
                            })
                              .then(() => {
                                setMsgReply('');
                                void load();
                              })
                              .finally(() => setBusyId(null));
                          }}
                          className="rounded-xl px-3 py-2 disabled:opacity-50"
                          style={{ backgroundColor: color, color: ink }}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {(portal.client?.family || []).filter((m) => m.active !== false).length > 0 &&
        (tab === 'open') ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Book for
            </label>
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-white/10 dark:bg-neutral-950"
              value={bookForFamilyId}
              onChange={(e) => setBookForFamilyId(e.target.value)}
            >
              <option value="">Myself (account holder)</option>
              {(portal.client?.family || [])
                .filter((m) => m.active !== false)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.relationship ? ` · ${m.relationship}` : ''}
                    {m.is_minor ? ' (child)' : ''}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        {!portal.allow_booking && tab === 'open' ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            Online booking is paused by the gym. You can still view your
            classes.
          </p>
        ) : null}

        {tab === 'open' && (
          <div className="space-y-3">
            {nextClass ? (
              <GymNextUpCard
                className={nextClass.class_name}
                date={nextClass.date}
                startTime={nextClass.start_time}
                location={nextClass.location}
                coach={nextClass.coach_name}
                rsvp={rsvpOf(nextClass)}
                bookingId={nextClass.booking_id}
                busy={busyId === nextClass.booking_id}
                color={color}
                plan={nextClass.class_plan}
                programme={nextClass.programme}
                onRsvp={(coming) =>
                  void rsvp(
                    nextClass.booking_id,
                    coming,
                    nextClass.session_id
                  )
                }
              />
            ) : null}
            <GymSectionTitle hint="Pick a day, then book or join the waitlist. Your booked classes are highlighted.">
              Class diary
            </GymSectionTitle>
            <MemberOpenDiaryWeek
              slots={portal.open_classes}
              allowBooking={portal.allow_booking}
              diaryOpen={portal.diary_open !== false}
              busyId={busyId}
              color={color}
              onBook={(id, waitlist) => void book(id, waitlist)}
              onCancel={(id) => void cancel(id)}
              onRsvp={(id, coming) => {
                const slot = (portal.open_classes || []).find(
                  (c) => c.my_booking_id === id || c.id === id
                );
                void rsvp(id, coming, slot?.id);
              }}
              onNeedSubscribe={(needBank) =>
                selectTab(needBank ? 'profile' : 'join')
              }
            />
          </div>
        )}

        {tab === 'mine' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <GymSectionTitle hint="Your next classes. Tell your coach if you will be attending.">
                Next up
              </GymSectionTitle>
              <button
                type="button"
                onClick={() => selectTab('open')}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-neutral-900 dark:text-slate-200"
              >
                Book
              </button>
            </div>
            {bookedUpcoming.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-neutral-900">
                Nothing on the diary yet.{' '}
                <button
                  type="button"
                  className="font-black text-slate-900 underline dark:text-white"
                  onClick={() => selectTab('open')}
                >
                  Book a class
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookedUpcoming.map((b, i) => (
                  <GymNextUpCard
                    key={b.booking_id}
                    className={b.class_name}
                    date={b.date}
                    startTime={b.start_time}
                    location={b.location}
                    coach={b.coach_name}
                    rsvp={rsvpOf(b)}
                    bookingId={b.booking_id}
                    busy={busyId === b.booking_id}
                    color={color}
                    kicker={i === 0 ? 'Next up' : 'Coming up'}
                    featured={i === 0}
                    plan={b.class_plan}
                    programme={b.programme}
                    onRsvp={(coming) =>
                      void rsvp(b.booking_id, coming, b.session_id)
                    }
                  />
                ))}
              </div>
            )}
            {recentDone.length ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  After class
                </p>
                {recentDone.slice(0, 6).map((b) => (
                  <GymNextUpCard
                    key={`done-${b.booking_id}`}
                    className={b.class_name}
                    date={b.date}
                    startTime={b.start_time}
                    location={b.location}
                    coach={b.coach_name}
                    rsvp={rsvpOf(b)}
                    bookingId={b.booking_id}
                    busy={
                      busyId === b.booking_id ||
                      busyId === `rate:${b.booking_id}`
                    }
                    color={color}
                    featured={false}
                    ended
                    attended={b.status === 'attended'}
                    pendingRate={pendingRateOf(b)}
                    feedback={feedbackOf(b)}
                    plan={b.class_plan}
                    programme={b.programme}
                    onRate={(v) => void rateClass(b.booking_id, v)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}

        {tab === 'progress' && (
          <div className="space-y-6">
            <MemberGoalsPanel
              goals={portal.goals || []}
              wearable={portal.wearable}
              watchSessions={portal.watch_sessions}
              pastClasses={portal.my_bookings
                .filter((b) => b.upcoming === false || b.status === 'attended')
                .slice(0, 12)
                .map((b) => ({
                  booking_id: b.booking_id,
                  class_name: b.class_name,
                  date: b.date,
                  start_time: b.start_time,
                }))}
              busy={busyId === 'goals'}
              onSaveGoal={async (v) => {
                setBusyId('goals');
                setError(null);
                try {
                  const data = await post({
                    action: 'upsert_goal',
                    kind: v.kind,
                    title: v.title,
                    category: v.category,
                    start_value: v.start_value,
                    target_value: v.target_value,
                    target_date: v.target_date,
                    unit: v.unit,
                    direction: v.direction,
                  });
                  setMsg(data.message || 'Goal saved');
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Could not save goal');
                  throw e;
                } finally {
                  setBusyId(null);
                }
              }}
              onHideGoal={async (goalId) => {
                setBusyId('goals');
                setError(null);
                try {
                  const data = await post({
                    action: 'hide_goal',
                    goal_id: goalId,
                  });
                  setMsg(data.message || 'Goal hidden');
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Could not hide goal');
                } finally {
                  setBusyId(null);
                }
              }}
              onLogActual={async (goalId, value) => {
                setBusyId('goals');
                setError(null);
                try {
                  const data = await post({
                    action: 'log_goal',
                    goal_id: goalId,
                    value,
                  });
                  setMsg(data.message || 'Actual saved');
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Could not log actual');
                  throw e;
                } finally {
                  setBusyId(null);
                }
              }}
              onWatchLog={async (v) => {
                setBusyId('goals');
                setError(null);
                try {
                  const data = await post({
                    action: 'watch_log',
                    booking_id: v.booking_id,
                    source: v.source,
                    duration_min: v.duration_min,
                    distance_km: v.distance_km,
                    calories: v.calories,
                    avg_hr: v.avg_hr,
                  });
                  setMsg(data.message || 'Watch session saved');
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Could not save watch');
                } finally {
                  setBusyId(null);
                }
              }}
              onGarminConnect={async () => {
                setBusyId('goals');
                setError(null);
                try {
                  const data = await post({ action: 'garmin_start' });
                  if (data.authorize_url) {
                    window.location.href = String(data.authorize_url);
                    return;
                  }
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Garmin connect failed');
                } finally {
                  setBusyId(null);
                }
              }}
              onGarminImport={async () => {
                setBusyId('goals');
                setError(null);
                try {
                  const data = await post({ action: 'garmin_import' });
                  setMsg(data.message || 'Garmin import done');
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Garmin import failed');
                } finally {
                  setBusyId(null);
                }
              }}
              onGarminDisconnect={async () => {
                setBusyId('goals');
                try {
                  const data = await post({ action: 'garmin_disconnect' });
                  setMsg(data.message || 'Garmin disconnected');
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Could not disconnect');
                } finally {
                  setBusyId(null);
                }
              }}
              color={color}
              showHeading={false}
            />

            <MemberProgressCharts
              feedback={portal.progress?.my_feedback || []}
              goals={portal.goals || []}
              color={color}
            />

            <GymExpandSection
              title="Journey"
              hint={
                journeyOpen
                  ? 'Tap a class to open the session and your rating.'
                  : recentDone.length
                    ? `${Math.min(recentDone.length, 16)} class${
                        recentDone.length === 1 ? '' : 'es'
                      } · ${portal.progress?.attended_30d ?? 0} in 30 days`
                    : 'Classes you complete land here'
              }
              icon={<CheckCircle2 className="h-4 w-4" />}
              open={journeyOpen}
              onToggle={() => setJourneyOpen((v) => !v)}
            >
              <div className="grid grid-cols-3 gap-2">
                <GymStat
                  value={portal.progress?.attended_30d ?? 0}
                  label="Classes · 30d"
                />
                <GymStat
                  value={portal.progress?.attended_count ?? 0}
                  label="Attended"
                />
                <GymStat
                  value={portal.progress?.check_ins_30d ?? 0}
                  label="Check-ins"
                />
              </div>
              {recentDone.length ? (
                <div className="space-y-3">
                  {recentDone.slice(0, 16).map((b) => (
                    <GymNextUpCard
                      key={`journey-${b.booking_id}`}
                      className={b.class_name}
                      date={b.date}
                      startTime={b.start_time}
                      location={b.location}
                      coach={b.coach_name}
                      rsvp={rsvpOf(b)}
                      bookingId={b.booking_id}
                      busy={
                        busyId === b.booking_id ||
                        busyId === `rate:${b.booking_id}`
                      }
                      color={color}
                      featured={false}
                      ended
                      attended={b.status === 'attended'}
                      pendingRate={pendingRateOf(b)}
                      feedback={feedbackOf(b)}
                      plan={b.class_plan}
                      programme={b.programme}
                      onRate={(v) => void rateClass(b.booking_id, v)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Classes you complete land here — tap one to see the session
                  and your rating.
                </p>
              )}
              <MemberProgrammeFollow
                follows={portal.programme_follows || []}
                busyId={busyId}
                onLog={async (v) => {
                  setBusyId(v.enrollment_id);
                  setError(null);
                  try {
                    const data = await post({
                      action: 'log_programme',
                      ...v,
                    });
                    setMsg(data.message || 'Session logged');
                  } catch (e: unknown) {
                    setError(
                      e instanceof Error ? e.message : 'Could not log session'
                    );
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
            </GymExpandSection>

            <GymExpandSection
              title="Training notes"
              hint={
                notesOpen
                  ? undefined
                  : (portal.progress?.coach_notes || []).length
                    ? `${(portal.progress?.coach_notes || []).length} note${
                        (portal.progress?.coach_notes || []).length === 1
                          ? ''
                          : 's'
                      } from your coach`
                    : 'Coach notes and modifications'
              }
              icon={<Activity className="h-4 w-4" />}
              open={notesOpen}
              onToggle={() => setNotesOpen((v) => !v)}
            >
              {portal.progress?.health?.summary ? (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {portal.progress.health.summary}
                </p>
              ) : null}
              {portal.progress?.health?.goals ? (
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  <span className="font-bold">Goals: </span>
                  {portal.progress.health.goals}
                </p>
              ) : null}
              {portal.progress?.health?.training_modifications ? (
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  <span className="font-bold">Modifications: </span>
                  {portal.progress.health.training_modifications}
                </p>
              ) : null}
              {(portal.progress?.coach_notes || []).length ? (
                <ul className="space-y-2">
                  {(portal.progress?.coach_notes || []).map((n) => (
                    <li
                      key={n.id}
                      className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/5"
                    >
                      <p className="text-[10px] font-bold text-slate-400">
                        {n.at.slice(0, 10)}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
                          {n.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!portal.progress?.health?.summary &&
              !portal.progress?.health?.goals &&
              !portal.progress?.health?.training_modifications &&
              !(portal.progress?.coach_notes || []).length ? (
                <p className="text-sm text-slate-500">
                  Your coach has not left training notes yet.
                </p>
              ) : null}
            </GymExpandSection>

            <GymExpandSection
              title="Class feedback"
              hint={
                (portal.progress?.pending_feedback || []).length
                  ? `${(portal.progress?.pending_feedback || []).length} to rate`
                  : (portal.progress?.my_feedback || []).length
                    ? `${(portal.progress?.my_feedback || []).length} ratings`
                    : 'Rate a class after you complete it'
              }
              icon={<MessageSquareHeart className="h-4 w-4" />}
              open={feedbackOpen}
              onToggle={() => setFeedbackOpen((v) => !v)}
            >
              {(portal.progress?.pending_feedback || []).length ? (
                <div className="space-y-2">
                  {(portal.progress?.pending_feedback || []).map((f) => (
                    <GymClassRateCard
                      key={f.booking_id}
                      className={f.class_name}
                      date={f.date}
                      busy={busyId === `rate:${f.booking_id}`}
                      onSubmit={(v) => void rateClass(f.booking_id, v)}
                    />
                  ))}
                </div>
              ) : null}
              {(portal.progress?.my_feedback || []).length ? (
                <ul className="space-y-2">
                  {[...(portal.progress?.my_feedback || [])]
                    .sort((a, b) =>
                      String(b.at || b.date).localeCompare(String(a.at || a.date))
                    )
                    .map((f) => (
                      <li
                        key={f.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
                      >
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {f.class_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {f.date} · feel {f.feeling}/5 · RPE {f.intensity}/10
                          {f.enjoyment != null
                            ? ` · enjoy ${f.enjoyment}/5`
                            : ''}
                        </p>
                        {f.comment ? (
                          <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                            {f.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                </ul>
              ) : !(portal.progress?.pending_feedback || []).length ? (
                <p className="text-sm text-slate-500">
                  After a class, tick complete under You → History, then rate it
                  here.
                </p>
              ) : null}
            </GymExpandSection>
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
            <ProfilePhotoField
              value={photoUrl}
              kind="client_photo"
              label="Your photo"
              disabled={busyId === 'profile'}
              accentClass="border-yellow-300"
              uploadFile={(file) =>
                uploadPortalPersonPhoto(
                  '/api/public/fitgraph/member',
                  token,
                  file
                )
              }
              onChange={(url) => {
                setPhotoUrl(url);
                void post({ action: 'update_profile', photo_url: url })
                  .then((data) => {
                    setError(null);
                    setMsg((data.message as string) || 'Photo saved');
                  })
                  .catch((e: unknown) => {
                    setError(
                      e instanceof Error ? e.message : 'Could not save photo'
                    );
                  });
              }}
            />
            {(portal.packs || []).length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <p className="mb-1 text-[10px] font-black uppercase text-slate-500">
                  Session packs
                </p>
                <ul className="space-y-1">
                  {(portal.packs || []).map((p) => (
                    <li
                      key={p.id}
                      className="text-xs font-semibold text-slate-700"
                    >
                      {p.label || 'Pack'}: <strong>{p.remaining}</strong> left
                      {p.expires_at ? ` · exp ${p.expires_at.slice(0, 10)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Name
              </span>
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Email
              </span>
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Care messages and invites follow this address.
              </span>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Phone
              </span>
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                ID number
              </span>
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950"
                inputMode="numeric"
                autoComplete="off"
                placeholder="SA ID / passport"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Saved on your gym member record for desk staff.
              </span>
            </label>
            {portal.collect_debit_bank ? (
              <MemberDebitBankFields
                value={debitBank}
                onChange={setDebitBank}
                required={portal.require_debit_bank}
                complete={portal.bank?.complete}
                showCompleteHint={false}
              />
            ) : null}
            <PortalFamilyMembers
              family={portal.client.family || []}
              busy={busyId === 'family'}
              context="gym"
              accentClass="border-yellow-200"
              buttonClass="bg-yellow-600 hover:bg-yellow-700"
              onSave={async (member) => {
                setBusyId('family');
                try {
                  const data = await post({
                    action: 'family_upsert',
                    member,
                  });
                  if (data.portal) setPortal((prev) => mergePortalInvoices(data.portal, prev));
                  setMsg(data.message || 'Family member saved');
                } finally {
                  setBusyId(null);
                }
              }}
              onRemove={async (id) => {
                setBusyId('family');
                try {
                  const data = await post({
                    action: 'family_remove',
                    member_id: id,
                  });
                  if (data.portal) setPortal((prev) => mergePortalInvoices(data.portal, prev));
                  setMsg(data.message || 'Removed');
                } finally {
                  setBusyId(null);
                }
              }}
            />
            <PortalIdentityVerify
              module="fitgraph"
              role="member"
              token={token}
              idNumber={idNumber}
              onIdNumberChange={setIdNumber}
              identity={portal.client.identity}
              onIdentityChange={(id) =>
                setPortal((p) =>
                  p
                    ? {
                        ...p,
                        client: { ...p.client, identity: id },
                      }
                    : p
                )
              }
              accentClass="border-yellow-200"
              buttonClass="bg-yellow-600 hover:bg-yellow-700"
            />
            <button
              type="button"
              disabled={busyId === 'profile'}
              onClick={() => void saveProfile()}
              className="min-h-12 w-full rounded-2xl text-sm font-black disabled:opacity-50"
              style={{ backgroundColor: color, color: ink }}
            >
              {busyId === 'profile' ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        )}
        {tab === 'profile' ? (
          <MemberPortalInvoices invoices={portal.invoices} />
        ) : null}
        {tab === 'profile' ? (
          <AdvisorPwaSignOutButton
            module="fitgraph"
            publicToken={portal.grow?.public_token}
            hint="Sign in again as a member, or as a coach."
          />
        ) : null}

        <PopiaConsentNotice brand={portal.brand} />
        <p className="pb-4 text-center text-[10px] text-slate-400">
          Powered by GymAdvisor® · SupplierAdvisor
        </p>
    </MemberAdvisorShell>
    </>
  );
}
