'use client';

/**
 * Inbox UI for FitAdvisor (gym) and PhysioAdvisor (clinic).
 * Colleagues, desk ↔ coach/practitioner, coach/practitioner ↔ member/patient.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Loader2,
  MessageSquare,
  Plus,
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

export type MessagingDirectory = {
  coachesOrPractitioners: Array<{ id: string; name: string; code?: string }>;
  membersOrPatients: Array<{ id: string; name: string; code?: string }>;
};

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
  accent?: 'violet' | 'teal' | 'sky';
};

type ComposeMode =
  | 'colleague'
  | 'desk_staff'
  | 'desk_client'
  | 'staff_client';

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

  const deskAuthor: MsgParticipant = {
    role: 'desk',
    ref_id: 'desk',
    name: 'Front desk',
  };

  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('staff_client');
  const [staffId, setStaffId] = useState('');
  const [peerId, setPeerId] = useState('');
  const [clientId, setClientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [asStaff, setAsStaff] = useState(false);

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
    void onAction({
      action: 'message_mark_read',
      thread_id: active.id,
      author_role: 'desk',
      author_ref_id: 'desk',
      author_name: 'Front desk',
    }).catch(() => {
      /* soft */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

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
    if (asStaff && staffId) {
      const s = directory.coachesOrPractitioners.find((x) => x.id === staffId);
      return {
        role: staffRole,
        ref_id: staffId,
        name: s?.name || staffLabel,
      };
    }
    return deskAuthor;
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    const author = authorForSend();
    // Ensure author is on thread for staff-as-persona
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
    const author = deskAuthor;
    let channel: MsgChannel = 'colleague';
    const participants: MsgParticipant[] = [author];

    if (composeMode === 'colleague') {
      if (!staffId || !peerId || staffId === peerId) {
        toast.error(`Pick two different ${staffLabel.toLowerCase()}s`);
        return;
      }
      const a = directory.coachesOrPractitioners.find((x) => x.id === staffId);
      const b = directory.coachesOrPractitioners.find((x) => x.id === peerId);
      participants.push(
        { role: staffRole, ref_id: staffId, name: a?.name || staffLabel },
        { role: staffRole, ref_id: peerId, name: b?.name || staffLabel }
      );
      channel =
        variant === 'fitgraph' ? 'colleague' : 'practitioner_colleague';
    } else if (composeMode === 'desk_staff') {
      if (!staffId) {
        toast.error(`Pick a ${staffLabel.toLowerCase()}`);
        return;
      }
      const s = directory.coachesOrPractitioners.find((x) => x.id === staffId);
      participants.push({
        role: staffRole,
        ref_id: staffId,
        name: s?.name || staffLabel,
      });
      channel =
        variant === 'fitgraph' ? 'desk_coach' : 'desk_practitioner';
    } else if (composeMode === 'desk_client') {
      if (!clientId) {
        toast.error(`Pick a ${clientLabel.toLowerCase()}`);
        return;
      }
      const c = directory.membersOrPatients.find((x) => x.id === clientId);
      participants.push({
        role: clientRole,
        ref_id: clientId,
        name: c?.name || clientLabel,
      });
      channel = variant === 'fitgraph' ? 'desk_member' : 'desk_patient';
    } else {
      // staff_client
      if (!staffId || !clientId) {
        toast.error(`Pick ${staffLabel.toLowerCase()} and ${clientLabel.toLowerCase()}`);
        return;
      }
      const s = directory.coachesOrPractitioners.find((x) => x.id === staffId);
      const c = directory.membersOrPatients.find((x) => x.id === clientId);
      participants.push(
        { role: staffRole, ref_id: staffId, name: s?.name || staffLabel },
        { role: clientRole, ref_id: clientId, name: c?.name || clientLabel }
      );
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
      })) as { thread?: ServiceThread };
      setShowCompose(false);
      setBody('');
      setSubject('');
      if (data?.thread?.id) setActiveId(data.thread.id);
      toast.success('Conversation started');
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
              Colleagues · desk · {staffLabel.toLowerCase()}s ·{' '}
              {clientLabel.toLowerCase()}s
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
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['staff_client', `${staffLabel} ↔ ${clientLabel}`],
                ['desk_client', `Desk ↔ ${clientLabel}`],
                ['desk_staff', `Desk ↔ ${staffLabel}`],
                ['colleague', `${staffLabel} colleagues`],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setComposeMode(mode)}
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
            composeMode === 'staff_client') && (
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">{staffLabel}…</option>
              {directory.coachesOrPractitioners.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} · ` : ''}
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {composeMode === 'colleague' && (
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
            >
              <option value="">Peer {staffLabel.toLowerCase()}…</option>
              {directory.coachesOrPractitioners
                .filter((s) => s.id !== staffId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          )}
          {(composeMode === 'desk_client' || composeMode === 'staff_client') && (
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">{clientLabel}…</option>
              {directory.membersOrPatients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} · ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
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
                    {active.participants.map((p) => p.name).join(' · ')} ·{' '}
                    {channelLabel(active.channel)}
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
                    <span className="text-slate-500">Replying as Front desk</span>
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
