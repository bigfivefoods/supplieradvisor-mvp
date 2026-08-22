'use client';

import type { ReactNode } from 'react';
import {
  CalendarCheck,
  CalendarDays,
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
}: {
  messagesUnread?: number;
}): {
  tabs: MemberAdvisorTab<ClinicMemberTabId>[];
  mobileTabs: MemberAdvisorTab<ClinicMemberTabId>[];
} {
  const unread = messagesUnread || undefined;
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
      icon: <User />,
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
      hint="Send this practice to a friend on WhatsApp, socials, or copy the link."
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
