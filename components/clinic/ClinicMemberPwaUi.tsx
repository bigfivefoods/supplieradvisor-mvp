'use client';

import { useState, type ReactNode } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  HeartPulse,
  MessageSquare,
  Share2,
  User,
} from 'lucide-react';
import type { MemberAdvisorTab } from '@/components/advisors/MemberAdvisorShell';
import { AdvisorSharePanel } from '@/components/advisors/AdvisorSharePanel';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import type { ClinicPortalCarePack } from '@/lib/clinic/clinic-portal-shop';
import type { ClinicMemberTabId } from '@/lib/clinic/clinic-member-tabs';

export type { ClinicMemberTabId } from '@/lib/clinic/clinic-member-tabs';
export {
  isClinicYouTab,
  parseClinicMemberTab,
  writeClinicTabToUrl,
} from '@/lib/clinic/clinic-member-tabs';

export function clinicMemberDockTabs({
  messagesUnread,
  photoUrl,
}: {
  messagesUnread?: number;
  photoUrl?: string | null;
}): {
  tabs: MemberAdvisorTab<ClinicMemberTabId>[];
  mobileTabs: MemberAdvisorTab<ClinicMemberTabId>[];
} {
  const unread = messagesUnread || undefined;
  const youIcon = photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      className="h-14 w-14 rounded-full object-cover"
    />
  ) : (
    <User />
  );
  const tabs: MemberAdvisorTab<ClinicMemberTabId>[] = [
    { id: 'mine', label: 'Book', icon: <CalendarCheck /> },
    { id: 'open', label: 'Schedule', icon: <CalendarDays /> },
    {
      id: 'profile',
      label: 'You',
      icon: <User />,
      covers: ['history'] as ClinicMemberTabId[],
    },
    { id: 'care', label: 'Care', icon: <HeartPulse /> },
    { id: 'share', label: 'Share', icon: <Share2 /> },
    {
      id: 'messages',
      label: 'Inbox',
      icon: <MessageSquare />,
      badge: unread,
    },
  ];
  const mobileTabs: MemberAdvisorTab<ClinicMemberTabId>[] = [
    { id: 'mine', label: 'Book', icon: <CalendarCheck /> },
    { id: 'open', label: 'Schedule', icon: <CalendarDays /> },
    {
      id: 'profile',
      label: 'You',
      icon: youIcon,
      badge: unread,
      covers: ['profile', 'messages', 'history'] as ClinicMemberTabId[],
      emphasis: true,
    },
    { id: 'care', label: 'Care', icon: <HeartPulse /> },
    { id: 'share', label: 'Share', icon: <Share2 /> },
  ];
  return { tabs, mobileTabs };
}

export function ClinicFlash({
  error,
  msg,
}: {
  error?: string | null;
  msg?: string | null;
}) {
  if (!error && !msg) return null;
  return (
    <div
      role="status"
      className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold ${
        error
          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100'
      }`}
    >
      {error || msg}
    </div>
  );
}

export function ClinicExpandSection({
  title,
  hint,
  icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
      >
        {icon ? (
          <span className="shrink-0 text-slate-800 dark:text-white">{icon}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </h2>
          {hint && !open ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {hint}
            </p>
          ) : null}
        </div>
        {badge}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180 text-slate-700 dark:text-white' : ''
          }`}
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-4 py-4 dark:border-white/10">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function ClinicWaitlistJoin({
  position,
  busy,
  onJoin,
  onLeave,
}: {
  position?: number | null;
  busy?: boolean;
  onJoin: () => void;
  onLeave?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
      <p className="text-xs font-bold text-amber-950">
        Need the next available slot?
      </p>
      {position ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-amber-900">
            You are #{position} in the practice queue
          </span>
          {onLeave ? (
            <button
              type="button"
              disabled={busy}
              onClick={onLeave}
              className="text-xs font-bold text-rose-700 underline"
            >
              Leave queue
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onJoin}
          className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Join next-available waitlist'}
        </button>
      )}
      <p className="text-[11px] text-amber-900/80">
        Notifies the practice you want the next free slot (any clinician if
        needed).
      </p>
    </div>
  );
}

export function ClinicSectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-black text-slate-900 dark:text-white">
        {children}
      </h2>
      {hint ? (
        <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ClinicYouSubnav({
  tab,
  onTab,
  color,
  messagesUnread,
  showHistory,
}: {
  tab: ClinicMemberTabId;
  onTab: (id: ClinicMemberTabId) => void;
  color: string;
  messagesUnread?: number;
  showHistory?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const chips: Array<[ClinicMemberTabId, string]> = [
    ['profile', 'Profile'],
    ['messages', 'Inbox'],
    ...(showHistory ? ([['history', 'History']] as Array<[ClinicMemberTabId, string]>) : []),
  ];
  return (
    <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-neutral-900">
      {chips.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onTab(id)}
          className="min-h-9 flex-1 rounded-xl px-2 text-[11px] font-black"
          style={tab === id ? { backgroundColor: color, color: ink } : undefined}
        >
          {label}
          {id === 'messages' && messagesUnread ? ` (${messagesUnread})` : ''}
        </button>
      ))}
    </div>
  );
}

export function ClinicSharePanel({
  brand,
  bio,
  phone,
  email,
  color,
  productLine,
}: {
  brand: string;
  bio?: string;
  phone?: string;
  email?: string;
  color: string;
  productLine: string;
}) {
  return (
    <AdvisorSharePanel
      brand={brand}
      bio={bio}
      phone={phone}
      email={email}
      color={color}
      productLine={productLine}
      lead={`See ${brand} on ${productLine}`}
      emailSubject={`See ${brand}`}
      copiedOk="Practice details copied"
    />
  );
}

export function ClinicCarePacks({
  packs,
}: {
  packs?: ClinicPortalCarePack[] | null;
}) {
  const packList = (packs || []).filter(
    (p) => p.status !== 'cancelled' && p.status !== 'expired'
  );
  if (!packList.length) return null;
  return (
    <ul className="space-y-2">
      {packList.map((p) => (
        <li
          key={p.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Care pack
          </p>
          <p className="mt-0.5 font-black text-slate-900 dark:text-white">
            {p.label || 'Care pack'}
          </p>
          <p className="text-xs text-slate-500">
            {p.remaining} remaining
            {p.sessions_total != null ? ` of ${p.sessions_total}` : ''}
            {p.expires_at ? ` · expires ${p.expires_at}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
