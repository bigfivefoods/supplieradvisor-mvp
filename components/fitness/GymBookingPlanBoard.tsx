'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Copy, Share2 } from 'lucide-react';
import type { GymPlanClass, GymPlanDay, GymPlanMember } from '@/lib/fitness/gym-booking-plan';

function toggleKey(
  map: Record<string, boolean>,
  id: string,
  fallback: boolean
): Record<string, boolean> {
  return { ...map, [id]: !(id in map ? map[id] : fallback) };
}

function ExpandRow({
  open,
  onToggle,
  title,
  hint,
  compact,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  hint?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-yellow-100 bg-white dark:border-yellow-800/40 dark:bg-yellow-950/30">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex w-full items-center gap-2 text-left ${
          compact ? 'px-2 py-1.5' : 'px-3 py-2'
        }`}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-yellow-700 transition-transform ${
            open ? '' : '-rotate-90'
          }`}
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block font-black text-slate-900 dark:text-yellow-50 ${
              compact ? 'text-[12px]' : 'text-sm'
            }`}
          >
            {title}
          </span>
          {hint ? (
            <span className="block text-[10px] text-slate-500 dark:text-yellow-100/70">
              {hint}
            </span>
          ) : null}
        </span>
      </button>
      {open && children ? (
        <div
          className={`border-t border-yellow-100 dark:border-yellow-800/40 ${
            compact ? 'px-2 py-1.5' : 'px-3 py-2'
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  compact,
  onMark,
  onRemove,
  onCopyFeedback,
}: {
  member: GymPlanMember;
  compact?: boolean;
  onMark: (member: GymPlanMember, status: 'attended' | 'no_show') => void;
  onRemove: (member: GymPlanMember) => void;
  onCopyFeedback: (token: string) => void;
}) {
  const canMark = member.status === 'booked' || member.status === 'waitlist';
  const realId = !String(member.booking_id || '').startsWith('alloc_');
  return (
    <li className="flex flex-wrap items-center justify-between gap-1.5 py-1.5">
      <div className="min-w-0">
        <p
          className={`font-bold text-slate-900 dark:text-yellow-50 ${
            compact ? 'text-[12px]' : 'text-sm'
          }`}
        >
          {member.name}
        </p>
        <p className="text-[10px] uppercase font-bold text-slate-500">
          {member.code ? `${member.code} · ` : ''}
          {member.status.replace(/_/g, ' ')}
          {member.rsvp === 'coming'
            ? ' · will attend'
            : member.rsvp === 'not_coming'
              ? ' · won’t attend'
              : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {canMark ? (
          <>
            <button
              type="button"
              className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white"
              onClick={() => onMark(member, 'attended')}
            >
              Attended
            </button>
            <button
              type="button"
              className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white"
              onClick={() => onMark(member, 'no_show')}
            >
              No-show
            </button>
          </>
        ) : null}
        {member.status === 'attended' &&
        member.feedback_token &&
        !member.feedback_submitted_at ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-yellow-300 px-2 py-0.5 text-[10px] font-bold text-yellow-800"
            onClick={() => onCopyFeedback(member.feedback_token!)}
          >
            <Copy className="h-3 w-3" /> Feedback
          </button>
        ) : null}
        {realId ? (
          <button
            type="button"
            className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500"
            onClick={() => onRemove(member)}
          >
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}

function PlanClassCard({
  card,
  compact,
  defaultOpen,
  onSelectSession,
  onCopyInvite,
  onMark,
  onRemove,
  onCopyFeedback,
}: {
  card: GymPlanClass;
  compact?: boolean;
  defaultOpen: boolean;
  onSelectSession: (sessionId: string) => void;
  onCopyInvite: (sessionId: string) => void;
  onMark: (
    member: GymPlanMember,
    status: 'attended' | 'no_show',
    sessionId: string
  ) => void;
  onRemove: (member: GymPlanMember) => void;
  onCopyFeedback: (token: string) => void;
}) {
  const [over, setOver] = useState<Record<string, boolean>>({});
  const id = card.session.id;
  const classOpen = id in over ? over[id] : defaultOpen;
  const coachOpen = `h:${id}` in over ? over[`h:${id}`] : classOpen;
  const membersOpen = `m:${id}` in over ? over[`m:${id}`] : classOpen;
  const time = String(card.session.start_time || '').slice(0, 5);
  const fill =
    card.cap > 0 ? `${card.booked}/${card.cap}` : String(card.members.length);
  const full = card.cap > 0 && card.booked >= card.cap;

  return (
    <div className="overflow-hidden rounded-2xl border border-yellow-200 bg-white shadow-sm dark:border-yellow-600/40 dark:bg-yellow-950/20">
      <button
        type="button"
        aria-expanded={classOpen}
        onClick={() => {
          setOver((m) => toggleKey(m, id, defaultOpen));
          if (!classOpen) onSelectSession(id);
        }}
        className={`flex w-full items-center gap-2 text-left ${
          compact ? 'px-2 py-2' : 'px-3.5 py-3'
        }`}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-yellow-700 transition-transform ${
            classOpen ? '' : '-rotate-90'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`font-black text-slate-900 dark:text-yellow-50 ${
              compact ? 'text-[12px] leading-tight' : 'text-sm'
            }`}
          >
            {time} · {card.className}
          </p>
          {card.session.location ? (
            <p className="text-[10px] text-slate-500">{card.session.location}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
            full
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100'
              : 'bg-yellow-100 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-100'
          }`}
        >
          {fill}
        </span>
      </button>
      {classOpen ? (
        <div
          className={`space-y-1.5 border-t border-yellow-100 dark:border-yellow-700/30 ${
            compact ? 'p-1.5' : 'p-2.5'
          }`}
        >
          <ExpandRow
            compact={compact}
            open={coachOpen}
            onToggle={() =>
              setOver((m) => toggleKey(m, `h:${id}`, classOpen))
            }
            title={`Coach · ${card.coachName}`}
            hint={card.coachId ? 'Assigned on the calendar' : 'No coach yet'}
          >
            <p className="text-[12px] font-semibold text-slate-700 dark:text-yellow-100">
              {card.coachName}
            </p>
          </ExpandRow>
          <ExpandRow
            compact={compact}
            open={membersOpen}
            onToggle={() =>
              setOver((m) => toggleKey(m, `m:${id}`, classOpen))
            }
            title={`Members planned · ${card.members.length}`}
            hint={
              card.members.length
                ? 'Booked + class subscribers'
                : 'Nobody planned yet'
            }
          >
            {card.members.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Nobody on this class yet. Add a member below.
              </p>
            ) : (
              <ul className="divide-y divide-yellow-100 dark:divide-yellow-800/40">
                {card.members.map((member) => (
                  <MemberRow
                    key={`${member.client_id}:${member.booking_id}`}
                    member={member}
                    compact={compact}
                    onMark={(m, status) => onMark(m, status, id)}
                    onRemove={onRemove}
                    onCopyFeedback={onCopyFeedback}
                  />
                ))}
              </ul>
            )}
          </ExpandRow>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-white px-2.5 py-1 text-[10px] font-bold text-yellow-900"
              onClick={() => {
                onSelectSession(id);
                onCopyInvite(id);
              }}
            >
              <Share2 className="h-3 w-3" /> Join link
            </button>
            <a
              href="/dashboard/fitgraph/calendar"
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600"
            >
              Open on calendar
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GymBookingPlanBoard({
  days,
  mode,
  today,
  onSelectSession,
  onCopyInvite,
  onMark,
  onRemove,
  onCopyFeedback,
}: {
  days: GymPlanDay[];
  mode: 'day' | 'week';
  today: string;
  onSelectSession: (sessionId: string) => void;
  onCopyInvite: (sessionId: string) => void;
  onMark: (
    member: GymPlanMember,
    status: 'attended' | 'no_show',
    sessionId: string
  ) => void;
  onRemove: (member: GymPlanMember) => void;
  onCopyFeedback: (token: string) => void;
}) {
  if (mode === 'day') {
    const day = days[0];
    if (!day) {
      return (
        <p className="rounded-2xl border border-dashed border-yellow-200 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-yellow-700/40">
          No day selected.
        </p>
      );
    }
    if (!day.classes.length) {
      return (
        <p className="rounded-2xl border border-dashed border-yellow-200 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-yellow-700/40">
          No classes planned on {day.label} {day.dateLabel}. Schedule on
          Calendar.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-wide text-yellow-800 dark:text-yellow-200">
          {day.label} {day.dateLabel}
          {day.hoursLabel ? ` · ${day.hoursLabel}` : ''}
        </p>
        {day.classes.map((card) => (
          <PlanClassCard
            key={card.session.id}
            card={card}
            defaultOpen
            onSelectSession={onSelectSession}
            onCopyInvite={onCopyInvite}
            onMark={onMark}
            onRemove={onRemove}
            onCopyFeedback={onCopyFeedback}
          />
        ))}
      </div>
    );
  }

  if (!days.length) {
    return (
      <p className="rounded-2xl border border-dashed border-yellow-200 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-yellow-700/40">
        No working days this week. Set gym hours on Website & apps.
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        className="grid min-w-max gap-2"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(13rem, 1fr))`,
        }}
      >
        {days.map((day) => {
          const isToday = day.date === today;
          return (
            <section
              key={day.date}
              className={`min-w-[13rem] rounded-2xl border p-2 ${
                isToday
                  ? 'border-yellow-500 bg-yellow-50/80 ring-1 ring-yellow-400 dark:border-yellow-400 dark:bg-yellow-950/50'
                  : day.closed
                    ? 'border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/40'
                    : 'border-yellow-200 bg-yellow-50/40 dark:border-yellow-700/40 dark:bg-yellow-950/20'
              }`}
            >
              <header className="mb-2 border-b border-yellow-100 px-1 pb-2 dark:border-yellow-800/40">
                <p className="text-[11px] font-black uppercase tracking-wide text-yellow-900 dark:text-yellow-100">
                  {day.label}
                </p>
                <p className="text-sm font-black text-slate-900 dark:text-yellow-50">
                  {day.dateLabel}
                </p>
                <p className="text-[10px] font-bold text-slate-500">
                  {day.hoursLabel}
                </p>
              </header>
              {day.classes.length === 0 ? (
                <p className="px-1 py-6 text-center text-[11px] font-semibold text-slate-400">
                  No classes
                </p>
              ) : (
                <div className="space-y-2">
                  {day.classes.map((card) => (
                    <PlanClassCard
                      key={card.session.id}
                      card={card}
                      compact
                      defaultOpen={isToday}
                      onSelectSession={onSelectSession}
                      onCopyInvite={onCopyInvite}
                      onMark={onMark}
                      onRemove={onRemove}
                      onCopyFeedback={onCopyFeedback}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
