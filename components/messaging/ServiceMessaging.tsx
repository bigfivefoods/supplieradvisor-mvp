'use client';

/**
 * Inbox UI for GymAdvisor (gym) and clinic / dental / medical Advisors.
 * Colleagues, desk ↔ coach/practitioner, coach/practitioner ↔ member/patient.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  channelLabel,
  previewText,
  threadTitle,
  unreadInThread,
  type MsgChannel,
  type MsgParticipant,
  type MsgRole,
  type ServiceThread,
} from '@/lib/messaging/service-inbox';

export type MessagingPerson = {
  id: string;
  name: string;
  code?: string;
  /** When false, shown as inactive but still messageable */
  active?: boolean;
  subtitle?: string;
};

/** Class / group target for coach → whole class messaging (GymAdvisor) */
export type MessagingGroup = {
  /** Unique picker id (e.g. session:abc or type:xyz) */
  id: string;
  kind: 'session' | 'class_type';
  /** Underlying session or class_type id stored on the thread */
  ref_id: string;
  name: string;
  subtitle?: string;
  /** Member client ids booked into this group */
  member_ids: string[];
  coach_id?: string | null;
};

export type MessagingDirectory = {
  coachesOrPractitioners: MessagingPerson[];
  membersOrPatients: MessagingPerson[];
  /** Optional class/session groups (GymAdvisor) */
  groups?: MessagingGroup[];
};

function personLabel(p: MessagingPerson) {
  const bits = [
    p.code ? `${p.code} · ${p.name}` : p.name,
    p.active === false ? '(inactive)' : null,
    p.subtitle || null,
  ].filter(Boolean);
  return bits.join(' ');
}

function filterPeople(list: MessagingPerson[], q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((p) => {
    const hay = `${p.name} ${p.code || ''} ${p.subtitle || ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

function PersonPicker({
  label,
  value,
  onChange,
  people,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  people: MessagingPerson[];
  placeholder: string;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => filterPeople(people, q), [people, q]);
  const selected = people.find((p) => p.id === value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {label}
        </label>
        <span className="text-[10px] text-slate-400">
          {people.length} available
        </span>
      </div>
      {people.length === 0 ? (
        <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          No {label.toLowerCase()}s on the book yet. Add them under People first,
          then return here to message them.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              placeholder={`Search ${placeholder}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            size={Math.min(6, Math.max(3, filtered.length + 1))}
          >
            <option value="">{placeholder}…</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {personLabel(p)}
              </option>
            ))}
          </select>
          {filtered.length === 0 ? (
            <p className="text-[11px] text-rose-600">
              No match for “{q}”. Clear search or check spelling.
            </p>
          ) : null}
          {selected ? (
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              Selected: <span className="font-bold">{personLabel(selected)}</span>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export type ServiceMessagingProps = {
  variant:
    | 'fitgraph'
    | 'physiograph'
    | 'dentalgraph'
    | 'psychiatrygraph'
    | 'medicalgraph';
  threads: ServiceThread[];
  directory: MessagingDirectory;
  saving?: boolean;
  /** Post actions via parent (company API) */
  onAction: (body: Record<string, unknown>) => Promise<unknown>;
  /** Accent classes */
  accent?: 'violet' | 'teal' | 'sky' | 'emerald';
  /**
   * GymAdvisor: when false, hide desk-first modes and run coach–member messaging
   * (no front desk persona on new threads).
   */
  hasFrontDesk?: boolean;
};

type ComposeMode =
  | 'colleague'
  | 'desk_staff'
  | 'desk_client'
  | 'staff_client'
  | 'class_group';

export function ServiceMessaging({
  variant,
  threads,
  directory,
  saving,
  onAction,
  accent = variant === 'fitgraph'
    ? 'violet'
    : variant === 'dentalgraph'
      ? 'sky'
      : 'teal',
  hasFrontDesk = true,
}: ServiceMessagingProps) {
  const staffRole: MsgRole =
    variant === 'fitgraph' ? 'coach' : 'practitioner';
  const clientRole: MsgRole = variant === 'fitgraph' ? 'member' : 'patient';
  const staffLabel =
    variant === 'fitgraph'
      ? 'Coach'
      : variant === 'dentalgraph'
        ? 'Clinician'
        : 'Practitioner';
  const clientLabel =
    variant === 'fitgraph'
      ? 'Member'
      : variant === 'dentalgraph'
        ? 'Patient'
        : 'Patient';
  const groups = directory.groups || [];
  const supportsClassGroups = variant === 'fitgraph';
  /** Coach-led gym: no front-desk persona on new threads */
  const coachLed = variant === 'fitgraph' && hasFrontDesk === false;

  const deskAuthor: MsgParticipant = {
    role: 'desk',
    ref_id: 'desk',
    name: coachLed ? 'Gym owner' : 'Front desk',
  };

  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>(
    coachLed ? 'staff_client' : 'staff_client'
  );
  const [staffId, setStaffId] = useState('');
  const [peerId, setPeerId] = useState('');
  const [clientId, setClientId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [asStaff, setAsStaff] = useState(coachLed);

  const openThreads = useMemo(
    () =>
      [...threads]
        .filter((t) => !t.archived)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [threads]
  );

  const active = openThreads.find((t) => t.id === activeId) || openThreads[0] || null;

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id);
  }, [active, activeId]);

  useEffect(() => {
    if (!active) return;
    const staff = directory.coachesOrPractitioners[0];
    const markAs =
      coachLed && staff
        ? {
            author_role: 'coach' as const,
            author_ref_id: String(staff.id),
            author_name: staff.name || 'Coach',
          }
        : {
            author_role: 'desk' as const,
            author_ref_id: 'desk',
            author_name: coachLed ? 'Gym owner' : 'Front desk',
          };
    void onAction({
      action: 'message_mark_read',
      thread_id: active.id,
      ...markAs,
    }).catch(() => {
      /* soft — mark_read is best-effort */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, coachLed]);

  // Prefill single-option pickers so Start works without hunting
  useEffect(() => {
    const staff = directory.coachesOrPractitioners;
    const clients = directory.membersOrPatients;
    if (!staffId && staff.length === 1) setStaffId(String(staff[0].id));
    if (!clientId && clients.length === 1) setClientId(String(clients[0].id));
  }, [directory, staffId, clientId]);

  // If ops model flips to coach-led, leave desk-only compose modes
  useEffect(() => {
    if (!coachLed) return;
    if (composeMode === 'desk_staff' || composeMode === 'desk_client') {
      setComposeMode('staff_client');
    }
    setAsStaff(true);
  }, [coachLed, composeMode]);

  const border =
    accent === 'violet'
      ? 'border-violet-200 dark:border-violet-500/40'
      : accent === 'sky'
        ? 'border-sky-200 dark:border-sky-500/40'
        : 'border-teal-200 dark:border-teal-500/40';
  const chip =
    accent === 'violet'
      ? 'bg-violet-600 text-white'
      : accent === 'sky'
        ? 'bg-sky-600 text-white'
        : 'bg-teal-600 text-white';
  const soft =
    accent === 'violet'
      ? 'bg-violet-50 dark:bg-violet-950/50'
      : accent === 'sky'
        ? 'bg-sky-50 dark:bg-sky-950/50'
        : 'bg-teal-50 dark:bg-teal-950/50';
  const textAccent =
    accent === 'violet'
      ? 'text-violet-700 dark:text-violet-300'
      : accent === 'sky'
        ? 'text-sky-700 dark:text-sky-300'
        : 'text-teal-700 dark:text-teal-300';

  const authorForSend = (): MsgParticipant => {
    if ((coachLed || asStaff) && staffId) {
      const s = directory.coachesOrPractitioners.find(
        (x) => String(x.id) === String(staffId)
      );
      return {
        role: staffRole,
        ref_id: String(staffId),
        name: s?.name || staffLabel,
      };
    }
    if (coachLed) {
      const s = directory.coachesOrPractitioners[0];
      if (s) {
        return {
          role: staffRole,
          ref_id: String(s.id),
          name: s.name || staffLabel,
        };
      }
    }
    return deskAuthor;
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    const author = authorForSend();
    if (coachLed && author.role === 'desk') {
      toast.error('Pick a coach to reply (front desk is off)');
      return;
    }
    try {
      await onAction({
        action: 'message_post',
        thread_id: active.id,
        body: reply.trim(),
        author_role: author.role,
        author_ref_id: author.ref_id,
        author_name: author.name,
      });
      setReply('');
      toast.success('Message sent');
    } catch {
      /* toasted */
    }
  };

  const startThread = async () => {
    if (!body.trim()) {
      toast.error('Write a message');
      return;
    }
    // Class group posts as coach when selected; otherwise front desk
    let author = deskAuthor;
    let channel: MsgChannel = 'colleague';
    const participants: MsgParticipant[] = [];
    let groupPayload:
      | { kind: 'session' | 'class_type'; ref_id: string; label: string }
      | undefined;

    const staffList = directory.coachesOrPractitioners;
    const clientList = directory.membersOrPatients;
    const findStaff = (id: string) =>
      staffList.find((x) => String(x.id) === String(id));
    const findClient = (id: string) =>
      clientList.find((x) => String(x.id) === String(id));

    if (composeMode === 'class_group') {
      if (!groupId) {
        toast.error('Pick a class or session group');
        return;
      }
      const g = groups.find((x) => String(x.id) === String(groupId));
      if (!g) {
        toast.error('Class group not found — refresh the page');
        return;
      }
      const coachId = staffId || g.coach_id || '';
      const coach = coachId ? findStaff(coachId) : null;
      if (coach) {
        author = {
          role: 'coach',
          ref_id: String(coach.id),
          name: coach.name || 'Coach',
        };
        participants.push(author);
      } else if (coachLed) {
        toast.error('Pick a coach to send the class message');
        return;
      } else {
        author = deskAuthor;
        participants.push(author);
      }
      // Include desk only when the gym runs a front desk
      if (!coachLed && author.role !== 'desk') {
        participants.push(deskAuthor);
      }
      const members = g.member_ids
        .map((id) => findClient(id))
        .filter(Boolean) as MessagingPerson[];
      if (!members.length) {
        toast.error(
          'No booked members on this class yet — book members first, then message the group'
        );
        return;
      }
      for (const m of members) {
        participants.push({
          role: 'member',
          ref_id: String(m.id),
          name: m.name || 'Member',
        });
      }
      channel = g.kind === 'class_type' ? 'class_type' : 'class_session';
      groupPayload = {
        kind: g.kind,
        ref_id: String(g.ref_id || g.id),
        label: g.name,
      };
    } else if (composeMode === 'colleague') {
      if (!coachLed) {
        participants.push(deskAuthor);
        author = deskAuthor;
      }
      if (!staffId || !peerId || staffId === peerId) {
        toast.error(`Pick two different ${staffLabel.toLowerCase()}s`);
        return;
      }
      const a = findStaff(staffId);
      const b = findStaff(peerId);
      if (!a || !b) {
        toast.error(`${staffLabel}s not found in the directory — refresh the page`);
        return;
      }
      if (coachLed) {
        author = {
          role: staffRole,
          ref_id: String(a.id),
          name: a.name || staffLabel,
        };
      }
      participants.push(
        { role: staffRole, ref_id: String(a.id), name: a.name || staffLabel },
        { role: staffRole, ref_id: String(b.id), name: b.name || staffLabel }
      );
      channel =
        variant === 'fitgraph' ? 'colleague' : 'practitioner_colleague';
    } else if (composeMode === 'desk_staff') {
      if (coachLed) {
        toast.error('Front desk is off — use coach ↔ member or class group');
        return;
      }
      participants.push(deskAuthor);
      author = deskAuthor;
      if (!staffId) {
        toast.error(`Pick a ${staffLabel.toLowerCase()}`);
        return;
      }
      const s = findStaff(staffId);
      if (!s) {
        toast.error(`${staffLabel} not found — refresh the page`);
        return;
      }
      participants.push({
        role: staffRole,
        ref_id: String(s.id),
        name: s.name || staffLabel,
      });
      channel =
        variant === 'fitgraph' ? 'desk_coach' : 'desk_practitioner';
    } else if (composeMode === 'desk_client') {
      if (coachLed) {
        toast.error('Front desk is off — message members as a coach');
        return;
      }
      participants.push(deskAuthor);
      author = deskAuthor;
      if (!clientId) {
        toast.error(`Pick a ${clientLabel.toLowerCase()}`);
        return;
      }
      const c = findClient(clientId);
      if (!c) {
        toast.error(`${clientLabel} not found — refresh the page`);
        return;
      }
      participants.push({
        role: clientRole,
        ref_id: String(c.id),
        name: c.name || clientLabel,
      });
      channel = variant === 'fitgraph' ? 'desk_member' : 'desk_patient';
    } else {
      // staff_client — coach ↔ member (primary when no front desk)
      if (!staffId || !clientId) {
        toast.error(
          `Pick a ${staffLabel.toLowerCase()} and a ${clientLabel.toLowerCase()}`
        );
        return;
      }
      const s = findStaff(staffId);
      const c = findClient(clientId);
      if (!s || !c) {
        toast.error(
          'Could not resolve coach/member from the directory — try refreshing'
        );
        return;
      }
      if (coachLed) {
        author = {
          role: staffRole,
          ref_id: String(s.id),
          name: s.name || staffLabel,
        };
        participants.push(
          author,
          {
            role: clientRole,
            ref_id: String(c.id),
            name: c.name || clientLabel,
          }
        );
      } else {
        participants.push(deskAuthor);
        author = deskAuthor;
        participants.push(
          {
            role: staffRole,
            ref_id: String(s.id),
            name: s.name || staffLabel,
          },
          {
            role: clientRole,
            ref_id: String(c.id),
            name: c.name || clientLabel,
          }
        );
      }
      channel =
        variant === 'fitgraph' ? 'coach_member' : 'practitioner_patient';
    }

    try {
      const data = (await onAction({
        action: 'message_create_thread',
        channel,
        subject: subject.trim() || undefined,
        participants,
        body: body.trim(),
        author_role: author.role,
        author_ref_id: author.ref_id,
        author_name: author.name,
        ...(groupPayload ? { group: groupPayload } : {}),
      })) as { thread?: ServiceThread };
      setShowCompose(false);
      setBody('');
      setSubject('');
      setGroupId('');
      if (data?.thread?.id) setActiveId(data.thread.id);
      toast.success(
        composeMode === 'class_group'
          ? 'Class group conversation started'
          : 'Conversation started'
      );
    } catch {
      /* toasted */
    }
  };

  const archive = async (id: string) => {
    await onAction({
      action: 'message_archive',
      thread_id: id,
      archive: true,
    });
    toast.success('Conversation archived');
    setActiveId(null);
  };

  return (
    <div className={`rounded-3xl border overflow-hidden ${border} bg-white dark:bg-slate-950`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className={`w-4 h-4 ${textAccent}`} />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">
              Messages
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {coachLed
                ? `Coach-led · ${staffLabel.toLowerCase()}s · ${clientLabel.toLowerCase()}s · class groups`
                : `Colleagues · desk · ${staffLabel.toLowerCase()}s · ${clientLabel.toLowerCase()}s${
                    supportsClassGroups ? ' · class groups' : ''
                  }`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCompose((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black ${chip}`}
        >
          <Plus className="w-3.5 h-3.5" />
          New conversation
        </button>
      </div>

      {showCompose ? (
        <div className={`border-b border-slate-100 dark:border-slate-800 px-4 py-4 space-y-3 ${soft}`}>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Start conversation
            {coachLed ? ' · coach-led gym' : ''}
          </p>
          {coachLed ? (
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Front desk is off. New threads are coach ↔ member or class group
              (no desk persona). Change this under Website → Gym operations
              model.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['staff_client', `${staffLabel} ↔ ${clientLabel}`],
                ...(supportsClassGroups
                  ? ([['class_group', 'Coach → class / group']] as const)
                  : []),
                ...(!coachLed
                  ? ([
                      ['desk_client', `Desk ↔ ${clientLabel}`],
                      ['desk_staff', `Desk ↔ ${staffLabel}`],
                    ] as const)
                  : []),
                ['colleague', `${staffLabel} colleagues`],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setComposeMode(mode as ComposeMode)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  composeMode === mode
                    ? chip
                    : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {(composeMode === 'colleague' ||
            composeMode === 'desk_staff' ||
            composeMode === 'staff_client' ||
            composeMode === 'class_group') && (
            <PersonPicker
              label={
                composeMode === 'class_group'
                  ? `${staffLabel} (sender · optional)`
                  : staffLabel
              }
              value={staffId}
              onChange={setStaffId}
              people={directory.coachesOrPractitioners}
              placeholder={staffLabel}
            />
          )}
          {composeMode === 'colleague' && (
            <PersonPicker
              label={`Peer ${staffLabel.toLowerCase()}`}
              value={peerId}
              onChange={setPeerId}
              people={directory.coachesOrPractitioners.filter(
                (s) => s.id !== staffId
              )}
              placeholder={`Peer ${staffLabel.toLowerCase()}`}
            />
          )}
          {composeMode === 'class_group' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Class / group
                </label>
                <span className="text-[10px] text-slate-400">
                  {groups.length} available
                </span>
              </div>
              {groups.length === 0 ? (
                <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  No classes with booked members yet. Schedule a class, book
                  members, then message the whole group from here.
                </p>
              ) : (
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={groupId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setGroupId(id);
                    const g = groups.find((x) => x.id === id);
                    if (g?.coach_id && !staffId) {
                      setStaffId(String(g.coach_id));
                    }
                  }}
                  size={Math.min(8, Math.max(4, groups.length + 1))}
                >
                  <option value="">Select session or class type…</option>
                  {groups.map((g) => (
                    <option key={`${g.kind}-${g.id}`} value={g.id}>
                      {g.kind === 'session' ? 'Session' : 'Type'} · {g.name}
                      {g.subtitle ? ` · ${g.subtitle}` : ''} ·{' '}
                      {g.member_ids.length} member
                      {g.member_ids.length === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              )}
              {groupId ? (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Message goes to the coach, front desk, and every booked member
                  on this class (
                  {groups.find((g) => g.id === groupId)?.member_ids.length || 0}{' '}
                  people on roster).
                </p>
              ) : null}
            </div>
          )}
          {(composeMode === 'desk_client' || composeMode === 'staff_client') && (
            <PersonPicker
              label={clientLabel}
              value={clientId}
              onChange={setClientId}
              people={directory.membersOrPatients}
              placeholder={clientLabel}
            />
          )}
          <input
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[5rem] resize-y"
            placeholder="Write the first message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void startThread()}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black ${chip} disabled:opacity-50`}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Start
            </button>
            <button
              type="button"
              className="text-xs font-bold text-slate-500"
              onClick={() => setShowCompose(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[280px_1fr] min-h-[420px]">
        {/* Thread list */}
        <div className="border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 max-h-[50vh] lg:max-h-[560px] overflow-y-auto">
          {openThreads.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No conversations yet. Start one with a{' '}
              {staffLabel.toLowerCase()} or {clientLabel.toLowerCase()}.
            </div>
          ) : (
            openThreads.map((t) => {
              const unread = unreadInThread(t, 'desk', 'desk');
              const on = active?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-3 py-3 border-b border-slate-50 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                    on ? soft : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-50">
                        {threadTitle(t, 'desk', 'desk')}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {channelLabel(t.channel)}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {previewText(t, 60)}
                      </p>
                    </div>
                    {unread > 0 ? (
                      <span className="shrink-0 rounded-full bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5">
                        {unread}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Conversation */}
        <div className="flex flex-col min-h-[320px]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-6">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="text-sm font-black truncate">
                    {threadTitle(active, 'desk', 'desk')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {active.group?.label
                      ? `${active.group.label} · `
                      : ''}
                    {active.participants.length > 6
                      ? `${active.participants.length} people`
                      : active.participants.map((p) => p.name).join(' · ')}{' '}
                    · {channelLabel(active.channel)}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600"
                  onClick={() => void archive(active.id)}
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[360px]">
                {active.messages.map((m) => {
                  const mine =
                    m.author_role === 'desk' ||
                    (asStaff &&
                      m.author_role === staffRole &&
                      m.author_ref_id === staffId);
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? accent === 'violet'
                              ? 'bg-violet-600 text-white'
                              : accent === 'sky'
                                ? 'bg-sky-600 text-white'
                                : 'bg-teal-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <div
                          className={`text-[10px] font-bold mb-0.5 ${
                            mine ? 'opacity-80' : 'text-slate-500'
                          }`}
                        >
                          {m.author_name} ·{' '}
                          {new Date(m.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {m.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {coachLed ? (
                    <>
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        Reply as coach
                      </span>
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]"
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                      >
                        <option value="">Select coach…</option>
                        {directory.coachesOrPractitioners.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="inline-flex items-center gap-1.5 font-medium">
                        <input
                          type="checkbox"
                          checked={asStaff}
                          onChange={(e) => setAsStaff(e.target.checked)}
                        />
                        Reply as {staffLabel.toLowerCase()}
                      </label>
                      {asStaff ? (
                        <select
                          className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]"
                          value={staffId}
                          onChange={(e) => setStaffId(e.target.value)}
                        >
                          <option value="">Select…</option>
                          {directory.coachesOrPractitioners.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">
                          Replying as Front desk
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[2.75rem] max-h-28 resize-y"
                    placeholder="Write a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={saving || !reply.trim()}
                    onClick={() => void sendReply()}
                    className={`shrink-0 self-end rounded-xl px-3 py-2 ${chip} disabled:opacity-50`}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
