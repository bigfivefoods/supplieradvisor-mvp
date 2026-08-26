'use client';

/**
 * DentalAdvisor® patient portal — registered patients book open diary slots.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { HeartPulse, Loader2 } from 'lucide-react';
import {
  ProfilePhotoField,
  uploadPortalPersonPhoto,
} from '@/components/chrome/ProfilePhotoField';
import { PortalIdentityVerify } from '@/components/identity/PortalIdentityVerify';
import { PortalFamilyMembers } from '@/components/identity/PortalFamilyMembers';
import { PortalMessagesPanel } from '@/components/services/PortalMessagesPanel';
import { PortalWaitlistReschedule } from '@/components/services/PortalWaitlistReschedule';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';
import { MemberAnnouncementsFeed } from '@/components/services/MemberAnnouncementsFeed';
import { MemberPortalBrandLockup } from '@/components/brand/PortalBrandLogo';
import { MemberAdvisorShell } from '@/components/advisors/MemberAdvisorShell';
import { AdvisorPwaMemberBinder } from '@/components/advisors/AdvisorPwaMemberBinder';
import { AdvisorPwaSignOutButton } from '@/components/advisors/AdvisorPwaSignOutButton';
import { ClinicMemberDiary } from '@/components/clinic/ClinicMemberDiary';
import {
  MemberPortalInvoices,
  mergePortalInvoices,
  type MemberPortalInvoice,
} from '@/components/advisors/MemberPortalInvoices';
import { MemberPortalClaims, type MemberPortalClaim } from '@/components/advisors/MemberPortalClaims';
import { MemberMedicalShare } from '@/components/services/MemberMedicalShare';
import { ClinicMemberBookList } from '@/components/clinic/ClinicVisitCard';
import type {
  SharedAdviceNote,
  SharedTreatmentPlan,
} from '@/lib/clinic/medical-share';
import type {
  ClinicPortalCarePack,
  ClinicPortalShopItem,
} from '@/lib/clinic/clinic-portal-shop';
import {
  ClinicCarePacks,
  ClinicExpandSection,
  ClinicFlash,
  ClinicSectionTitle,
  ClinicSharePanel,
  ClinicWaitlistJoin,
  ClinicYouSubnav,
  clinicMemberDockTabs,
  isClinicYouTab,
  parseClinicMemberTab,
  writeClinicTabToUrl,
  type ClinicMemberTabId,
} from '@/components/clinic/ClinicMemberPwaUi';
import { clinicPwaCopy } from '@/lib/clinic/clinic-pwa-copy';

type Slot = {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  clinician_name?: string;
  is_preferred_clinician?: boolean;
  location?: string;
  spots_left: number;
  full: boolean;
  my_status?: string | null;
  my_booking_id?: string | null;
  waitlist_position?: number | null;
};

type Portal = {
  brand: string;
  public_token?: string;
  allow_booking: boolean;
  can_book_other_clinicians?: boolean;
  primary_color?: string;
  logo_url?: string | null;
  bio?: string;
  contact_phone?: string;
  contact_email?: string;
  shop?: ClinicPortalShopItem[];
  patient: {
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    photo_url?: string;
    status?: string;
    preferred_clinician_id?: string | null;
    preferred_clinician_name?: string | null;
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
  shares?: { schedule?: boolean; feedback?: boolean; medical?: boolean };
  medical_share?: Record<string, unknown> | null;
  announcements?: import('@/lib/services/member-announcements').MemberAnnouncementPublic[];
  shared_advice?: SharedAdviceNote[];
  follow_ups?: Array<{
    id: string;
    remind_on: string;
    title?: string;
    advice: string;
    status: string;
  }>;
  treatment_plans?: SharedTreatmentPlan[];
  open_slots: Slot[];
  waitlist_queue?: Array<{
    id: string;
    position: number;
    accept_any_clinician?: boolean;
    service_name?: string | null;
  }>;
  my_bookings: Array<{
    waitlist_offered_at?: string | null;
    waitlist_accepted_at?: string | null;
    booking_id: string;
    status: string;
    date: string;
    start_time: string;
    service_name: string;
    clinician_name?: string;
    feedback_token?: string | null;
    feedback_submitted_at?: string | null;
  }>;
  open_count: number;
  messages_unread?: number;
  threads?: import('@/components/services/PortalMessagesPanel').PortalThread[];
  care_packs?: ClinicPortalCarePack[];
  invoices?: MemberPortalInvoice[];
  claims?: MemberPortalClaim[];
};

export default function MemberDentalgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<ClinicMemberTabId>('mine');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bookForFamilyId, setBookForFamilyId] = useState('');
  /** all | preferred | other */
  const [slotFilter, setSlotFilter] = useState<'all' | 'preferred' | 'other'>(
    'all'
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/dentalgraph/patient?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal not found');
      setPortal(data.portal);
      setCompanyId(data.companyId ?? null);
      const p = data.portal?.patient;
      if (p) {
        setName(p.name || '');
        setEmail(p.email || '');
        setPhone(p.phone || '');
        setIdNumber(p.id_number || '');
        setPhotoUrl(p.photo_url || '');
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
    const next = parseClinicMemberTab(
      new URLSearchParams(window.location.search).get('tab')
    );
    if (next) setTab(next);
  }, []);

  const selectTab = (id: ClinicMemberTabId) => {
    setTab(id);
    setError(null);
    setMsg(null);
    writeClinicTabToUrl(id);
  };

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/dentalgraph/patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.portal) setPortal((prev) => mergePortalInvoices(data.portal, prev));
    return data;
  };

  const book = async (appointmentId: string, requestJoin = false) => {
    setBusyId(appointmentId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: requestJoin ? 'request_join' : 'book',
        appointment_id: appointmentId,
        family_member_id: bookForFamilyId || null,
      });
      setMsg(data.booking?.message || data.message || 'Booked');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBusyId(null);
    }
  };

  const joinQueue = async () => {
    setBusyId('queue');
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'join_queue',
        accept_any_clinician: true,
      });
      setMsg(data.queue?.message || data.message || 'Joined waitlist');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not join queue');
    } finally {
      setBusyId(null);
    }
  };

  const leaveQueue = async (queueId?: string) => {
    setBusyId('queue');
    try {
      const data = await post({
        action: 'leave_queue',
        queue_id: queueId,
      });
      setMsg(data.message || 'Left waitlist');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not leave queue');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (bookingId: string) => {
    if (!confirm('Cancel this appointment?')) return;
    setBusyId(bookingId);
    try {
      const data = await post({ action: 'cancel', booking_id: bookingId });
      setMsg(data.message || 'Cancelled');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  const saveProfile = async () => {
    setBusyId('profile');
    try {
      const data = await post({
        action: 'update_profile',
        name,
        email,
        phone,
        id_number: idNumber,
        photo_url: photoUrl,
      });
      setMsg(data.message || 'Saved');
      const p = data.portal?.patient;
      if (p) {
        setEmail(p.email || '');
        setIdNumber(p.id_number || '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusyId(null);
    }
  };

  const color = portal?.primary_color || '#0284c7';
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }
  if (error && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <p className="font-black">Patient portal unavailable</p>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }
  if (!portal) return null;

  const copy = clinicPwaCopy('dentalgraph');
  const dock = clinicMemberDockTabs({
    module: 'dentalgraph',
    messagesUnread: portal.messages_unread,
    photoUrl: portal.patient.photo_url,
  });
  const youTab = isClinicYouTab(tab);

  return (
    <>
    <AdvisorPwaMemberBinder
      module="dentalgraph"
      memberToken={token}
      publicToken={portal.public_token}
      brandName={portal.brand}
      themeColor={color}
      iconUrl={portal.logo_url}
    />
    <MemberAdvisorShell
      color={color}
      appHref={`/me?link=${encodeURIComponent(token)}`}
      fromClass="from-sky-50"
      tab={tab}
      onTab={(id) => selectTab(id as ClinicMemberTabId)}
      mobileNav="bottom"
      tabs={dock.tabs}
      mobileTabs={dock.mobileTabs}
      header={
        <MemberPortalBrandLockup
          logoUrl={portal.logo_url}
          brand={portal.brand}
          eyebrow="Patient · DentalAdvisor®"
        />
      }
    >
        <ClinicFlash error={error} msg={msg} />
        {youTab ? (
          <div className="space-y-3">
            <MemberAnnouncementsFeed
              items={portal.announcements}
              brand={portal.brand}
              tone="sky"
            />
            <ClinicYouSubnav
              tab={tab}
              onTab={selectTab}
              color={color}
              messagesUnread={portal.messages_unread}
              showHistory
            />
          </div>
        ) : null}

        {tab === 'share' && (
          <ClinicSharePanel
            brand={portal.brand}
            bio={portal.bio}
            phone={portal.contact_phone}
            email={portal.contact_email}
            color={color}
            productLine="DentalAdvisor®"
          />
        )}

        {tab === 'care' && (
          <ClinicExpandSection
            title={copy.careTitle}
            hint={copy.careHint}
            icon={<HeartPulse className="h-4 w-4" />}
            defaultOpen
          >
            <ClinicCarePacks packs={portal.care_packs} />
            <MemberMedicalShare
              share={portal.medical_share}
              plans={portal.treatment_plans}
              advice={portal.shared_advice}
              followUps={portal.follow_ups}
              tone="sky"
              heading={copy.careHeading}
            />
          </ClinicExpandSection>
        )}

        {(portal.patient?.family || []).filter((m: { active?: boolean }) => m.active !== false).length >
          0 && tab === 'open' ? (
          <div className="rounded-2xl border border-sky-200 bg-white p-3">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Book for
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              value={bookForFamilyId}
              onChange={(e) => setBookForFamilyId(e.target.value)}
            >
              <option value="">Myself (account holder)</option>
              {(portal.patient?.family || [])
                .filter((m: { active?: boolean }) => m.active !== false)
                .map((m: { id: string; name: string; relationship?: string; is_minor?: boolean }) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.relationship ? ` · ${m.relationship}` : ''}
                    {m.is_minor ? ' (child)' : ''}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        {tab === 'open' && (
          <div className="space-y-3">
            <ClinicSectionTitle hint="Look at the practice calendar to book a session or join the waitlist.">
              Schedule
            </ClinicSectionTitle>
            <p className="text-sm text-slate-600">
              Book your regular clinician when free — or any other open
              dentist at the practice. Full slots: join the waitlist (we notify
              the desk).
            </p>
            {portal.patient.preferred_clinician_name ? (
              <p className="text-xs text-slate-500 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                Your regular clinician:{' '}
                <strong>{portal.patient.preferred_clinician_name}</strong>
                {portal.can_book_other_clinicians !== false
                  ? ' · You can also book other clinicians when they have open times.'
                  : ''}
              </p>
            ) : null}

            {portal.allow_booking ? (
              <ClinicWaitlistJoin
                position={(portal.waitlist_queue || [])[0]?.position}
                busy={busyId === 'queue'}
                onJoin={() => void joinQueue()}
                onLeave={() =>
                  void leaveQueue((portal.waitlist_queue || [])[0]?.id)
                }
              />
            ) : null}

            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', 'All clinicians'],
                  ['preferred', 'My clinician'],
                  ['other', 'Other clinicians'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSlotFilter(id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold border ${
                    slotFilter === id
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'border-slate-200 text-slate-600 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <ClinicMemberDiary
              slots={portal.open_slots.filter((s) => {
                if (slotFilter === 'preferred') return s.is_preferred_clinician;
                if (slotFilter === 'other') return !s.is_preferred_clinician;
                return true;
              })}
              bookings={portal.my_bookings}
              color={color}
              allowBooking={portal.allow_booking}
              busyId={busyId}
              onBook={(id, waitlist) => void book(id, waitlist)}
              emptyLabel={
                slotFilter === 'preferred'
                  ? 'No open times with your regular clinician this week — try Other clinicians or the waitlist.'
                  : 'No public diary slots this week. Ask the practice to publish open slots, or join the waitlist.'
              }
            />
          </div>
        )}

        {tab === 'messages' && (
          <PortalMessagesPanel
            threads={portal.threads || []}
            messagesUnread={portal.messages_unread || 0}
            selfRole="patient"
            post={async (body) => {
              const data = await post(body);
              return data;
            }}
            onRefresh={() => void load()}
          />
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            <ClinicSectionTitle hint="Invoices, claims and account history for this practice.">
              Appointment & account history
            </ClinicSectionTitle>
            <MemberPortalInvoices invoices={portal.invoices} />
            <MemberPortalClaims claims={portal.claims} />
          </div>
        )}

        
        {tab === 'mine' && (
          <PortalWaitlistReschedule
            bookings={portal.my_bookings || []}
            openSlots={(portal.open_slots || []).map((s) => ({
              id: s.id,
              date: s.date,
              start_time: s.start_time,
              service_name: s.service_name,
              full: s.full,
              my_status: s.my_status,
            }))}
            accent={color}
            post={async (body) => {
              const res = await fetch('/api/public/dentalgraph/patient', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, ...body }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed');
              if (data.portal) setPortal((prev) => mergePortalInvoices(data.portal, prev));
              return data;
            }}
            onDone={() => void load()}
          />
        )}

        {tab === 'mine' && (
          <div className="space-y-3">
            <ClinicSectionTitle hint={copy.bookHint}>
              {copy.dockBook}
            </ClinicSectionTitle>
            <ClinicMemberBookList
              bookings={portal.my_bookings}
              module="dentalgraph"
              companyId={companyId}
              color={color}
              busyId={busyId}
              onCancel={(id) => void cancel(id)}
            />
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <ProfilePhotoField
              value={photoUrl}
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
              uploadFile={(file) =>
                uploadPortalPersonPhoto(
                  '/api/public/dentalgraph/patient',
                  token,
                  file
                )
              }
              kind="patient_photo"
              label="Your photo"
              disabled={busyId === 'profile'}
              accentClass="border-sky-300"
            />
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Name
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Email
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Usually the parent/guardian contact for messages and invites.
              </span>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Phone
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                ID number
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                inputMode="numeric"
                autoComplete="off"
                placeholder="SA ID / passport"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Saved on your medical chart for the practice.
              </span>
            </label>

            <PortalFamilyMembers
              family={portal.patient.family || []}
              busy={busyId === 'family'}
              context="practice"
              accentClass="border-sky-200"
              buttonClass="bg-sky-600 hover:bg-sky-700"
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
              module="dentalgraph"
              role="patient"
              token={token}
              idNumber={idNumber}
              onIdNumberChange={setIdNumber}
              identity={portal.patient.identity}
              onIdentityChange={(id) =>
                setPortal((p) =>
                  p
                    ? {
                        ...p,
                        patient: { ...p.patient, identity: id },
                      }
                    : p
                )
              }
              accentClass="border-sky-200"
              buttonClass="bg-sky-600 hover:bg-sky-700"
            />
            <button
              type="button"
              disabled={busyId === 'profile'}
              onClick={() => void saveProfile()}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white"
            >
              Save profile
            </button>
          </div>
          </div>
        )}

        {tab === 'profile' ? (
          <AdvisorPwaSignOutButton
            module="dentalgraph"
            publicToken={portal.public_token}
            hint="Sign in again as a patient, or as a clinician."
          />
        ) : null}

        <PopiaConsentNotice brand={portal.brand} />
        <p className="text-center text-[10px] text-slate-400 pb-8">
          Powered by DentalAdvisor® · SupplierAdvisor
        </p>
    </MemberAdvisorShell>
    </>
  );
}
