/**
 * Service vertical messaging (FitAdvisor · PhysioAdvisor).
 * Threads between desk, coaches/practitioners, and members/patients.
 * Stored on the vertical store (fitgraph.threads / physiograph.threads).
 */

export type MsgRole =
  | 'desk'
  | 'coach'
  | 'member'
  | 'practitioner'
  | 'patient';

export type MsgChannel =
  | 'colleague'
  | 'desk_coach'
  | 'desk_member'
  | 'coach_member'
  | 'desk_practitioner'
  | 'desk_patient'
  | 'practitioner_patient'
  | 'practitioner_colleague'
  /** FitAdvisor: coach/desk → everyone booked on a session */
  | 'class_session'
  /** FitAdvisor: coach/desk → members of a class type (roster across recent/upcoming sessions) */
  | 'class_type';

export type MsgParticipant = {
  role: MsgRole;
  /** Entity id, or "desk" for front-office staff */
  ref_id: string;
  name: string;
};

/** Optional class/group anchor for multi-member threads */
export type MsgGroupRef = {
  kind: 'session' | 'class_type';
  ref_id: string;
  label: string;
};

export type ServiceMessage = {
  id: string;
  body: string;
  author_role: MsgRole;
  author_ref_id: string;
  author_name: string;
  created_at: string;
  /** Keys `role:ref_id` that have read this message */
  read_by?: string[];
};

export type ServiceThread = {
  id: string;
  channel: MsgChannel;
  subject: string;
  participants: MsgParticipant[];
  messages: ServiceMessage[];
  created_at: string;
  updated_at: string;
  archived?: boolean;
  /** When set, thread is a class/group chat (reuse by group key, not exact roster) */
  group?: MsgGroupRef | null;
};

export function newMsgId(prefix = 'msg'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function participantKey(p: Pick<MsgParticipant, 'role' | 'ref_id'>): string {
  return `${p.role}:${p.ref_id}`;
}

export function parseParticipantKey(key: string): { role: MsgRole; ref_id: string } {
  const i = key.indexOf(':');
  if (i < 0) return { role: 'desk', ref_id: key || 'desk' };
  return {
    role: key.slice(0, i) as MsgRole,
    ref_id: key.slice(i + 1) || 'desk',
  };
}

export function normalizeThreads(raw: unknown): ServiceThread[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === 'object' && (t as ServiceThread).id)
    .map((t) => {
      const th = t as ServiceThread;
      const g = th.group;
      const group: MsgGroupRef | null =
        g && typeof g === 'object' && (g as MsgGroupRef).ref_id
          ? {
              kind:
                (g as MsgGroupRef).kind === 'class_type'
                  ? 'class_type'
                  : 'session',
              ref_id: String((g as MsgGroupRef).ref_id),
              label: String((g as MsgGroupRef).label || 'Class'),
            }
          : null;
      return {
        id: String(th.id),
        channel: (th.channel || 'colleague') as MsgChannel,
        subject: String(th.subject || 'Conversation'),
        participants: Array.isArray(th.participants)
          ? th.participants.map((p) => ({
              role: p.role,
              ref_id: String(p.ref_id || 'desk'),
              name: String(p.name || p.role),
            }))
          : [],
        messages: Array.isArray(th.messages)
          ? th.messages.map((m) => ({
              id: String(m.id || newMsgId()),
              body: String(m.body || ''),
              author_role: m.author_role,
              author_ref_id: String(m.author_ref_id || ''),
              author_name: String(m.author_name || ''),
              created_at: String(m.created_at || new Date().toISOString()),
              read_by: Array.isArray(m.read_by)
                ? m.read_by.map(String)
                : [],
            }))
          : [],
        created_at: String(th.created_at || new Date().toISOString()),
        updated_at: String(th.updated_at || th.created_at || new Date().toISOString()),
        archived: th.archived === true,
        group,
      };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function isParticipant(
  thread: ServiceThread,
  role: MsgRole,
  refId: string
): boolean {
  const key = participantKey({ role, ref_id: refId });
  return thread.participants.some((p) => participantKey(p) === key);
}

/** Unread messages for a participant (not authored by them, not in read_by) */
export function unreadInThread(
  thread: ServiceThread,
  role: MsgRole,
  refId: string
): number {
  const key = participantKey({ role, ref_id: refId });
  if (!isParticipant(thread, role, refId)) return 0;
  return (thread.messages || []).filter((m) => {
    if (participantKey({ role: m.author_role, ref_id: m.author_ref_id }) === key)
      return false;
    return !(m.read_by || []).includes(key);
  }).length;
}

export function totalUnread(
  threads: ServiceThread[],
  role: MsgRole,
  refId: string
): number {
  return threads
    .filter((t) => !t.archived)
    .reduce((n, t) => n + unreadInThread(t, role, refId), 0);
}

export function threadsForParticipant(
  threads: ServiceThread[],
  role: MsgRole,
  refId: string,
  opts?: { includeArchived?: boolean }
): ServiceThread[] {
  return normalizeThreads(threads).filter((t) => {
    if (!opts?.includeArchived && t.archived) return false;
    return isParticipant(t, role, refId);
  });
}

/** Desk sees all non-archived threads in the vertical */
export function threadsForDesk(
  threads: ServiceThread[],
  opts?: { includeArchived?: boolean }
): ServiceThread[] {
  return normalizeThreads(threads).filter(
    (t) => opts?.includeArchived || !t.archived
  );
}

export function previewText(thread: ServiceThread, max = 80): string {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return 'No messages yet';
  const body = last.body.replace(/\s+/g, ' ').trim();
  if (body.length <= max) return body;
  return body.slice(0, max - 1) + '…';
}

export function otherParticipants(
  thread: ServiceThread,
  role: MsgRole,
  refId: string
): MsgParticipant[] {
  const key = participantKey({ role, ref_id: refId });
  return thread.participants.filter((p) => participantKey(p) !== key);
}

export function threadTitle(
  thread: ServiceThread,
  viewerRole: MsgRole,
  viewerRef: string
): string {
  if (thread.subject && thread.subject !== 'Conversation') return thread.subject;
  const others = otherParticipants(thread, viewerRole, viewerRef);
  if (others.length) return others.map((p) => p.name).join(' · ');
  return thread.subject || 'Conversation';
}

export type CreateThreadInput = {
  channel: MsgChannel;
  subject?: string;
  participants: MsgParticipant[];
  body: string;
  author: MsgParticipant;
  now?: string;
  group?: MsgGroupRef | null;
};

export function createThread(input: CreateThreadInput): ServiceThread {
  const now = input.now || new Date().toISOString();
  const participants = dedupeParticipants([
    ...input.participants,
    input.author,
  ]);
  if (participants.length < 2) {
    throw new Error('Thread needs at least two participants');
  }
  const body = String(input.body || '').trim();
  if (!body) throw new Error('Message body required');

  const authorKey = participantKey(input.author);
  const msg: ServiceMessage = {
    id: newMsgId('msg'),
    body,
    author_role: input.author.role,
    author_ref_id: input.author.ref_id,
    author_name: input.author.name,
    created_at: now,
    read_by: [authorKey],
  };

  const subject =
    String(input.subject || '').trim() ||
    defaultSubject(input.channel, participants, input.author, input.group);

  return {
    id: newMsgId('thr'),
    channel: input.channel,
    subject,
    participants,
    messages: [msg],
    created_at: now,
    updated_at: now,
    group: input.group || null,
  };
}

function defaultSubject(
  channel: MsgChannel,
  participants: MsgParticipant[],
  author: MsgParticipant,
  group?: MsgGroupRef | null
): string {
  if (group?.label) {
    if (channel === 'class_session') return `Class · ${group.label}`;
    if (channel === 'class_type') return `Group · ${group.label}`;
  }
  const others = participants.filter(
    (p) => participantKey(p) !== participantKey(author)
  );
  const names = others.map((p) => p.name).join(' · ') || 'Team';
  switch (channel) {
    case 'coach_member':
    case 'practitioner_patient':
      return `Check-in · ${names}`;
    case 'colleague':
    case 'practitioner_colleague':
      return `Team · ${names}`;
    case 'desk_coach':
    case 'desk_practitioner':
      return `Desk · ${names}`;
    case 'desk_member':
    case 'desk_patient':
      return `Member care · ${names}`;
    case 'class_session':
      return `Class · ${names}`;
    case 'class_type':
      return `Group · ${names}`;
    default:
      return `Message · ${names}`;
  }
}

export function appendMessage(
  thread: ServiceThread,
  body: string,
  author: MsgParticipant,
  now = new Date().toISOString()
): ServiceThread {
  const text = String(body || '').trim();
  if (!text) throw new Error('Message body required');
  if (!isParticipant(thread, author.role, author.ref_id)) {
    // Auto-add author if desk posting into any thread
    if (author.role === 'desk') {
      thread = {
        ...thread,
        participants: dedupeParticipants([
          ...thread.participants,
          { role: 'desk', ref_id: 'desk', name: author.name || 'Desk' },
        ]),
      };
    } else {
      throw new Error('Author is not a participant on this thread');
    }
  }
  const authorKey = participantKey(author);
  const msg: ServiceMessage = {
    id: newMsgId('msg'),
    body: text,
    author_role: author.role,
    author_ref_id: author.ref_id,
    author_name: author.name,
    created_at: now,
    read_by: [authorKey],
  };
  return {
    ...thread,
    messages: [...(thread.messages || []), msg],
    updated_at: now,
    participants: dedupeParticipants([...thread.participants, author]),
  };
}

export function markThreadRead(
  thread: ServiceThread,
  role: MsgRole,
  refId: string
): ServiceThread {
  const key = participantKey({ role, ref_id: refId });
  return {
    ...thread,
    messages: (thread.messages || []).map((m) => {
      const read = new Set(m.read_by || []);
      read.add(key);
      return { ...m, read_by: [...read] };
    }),
  };
}

function dedupeParticipants(list: MsgParticipant[]): MsgParticipant[] {
  const map = new Map<string, MsgParticipant>();
  for (const p of list) {
    if (!p?.role) continue;
    const ref = String(p.ref_id || (p.role === 'desk' ? 'desk' : '')).trim();
    if (!ref && p.role !== 'desk') continue;
    const row: MsgParticipant = {
      role: p.role,
      ref_id: ref || 'desk',
      name: String(p.name || p.role).trim() || p.role,
    };
    map.set(participantKey(row), row);
  }
  return [...map.values()];
}

export function channelLabel(channel: MsgChannel): string {
  const labels: Record<MsgChannel, string> = {
    colleague: 'Colleagues',
    desk_coach: 'Desk ↔ Coach',
    desk_member: 'Desk ↔ Member',
    coach_member: 'Coach ↔ Member',
    desk_practitioner: 'Desk ↔ Practitioner',
    desk_patient: 'Desk ↔ Patient',
    practitioner_patient: 'Practitioner ↔ Patient',
    practitioner_colleague: 'Practitioners',
    class_session: 'Class group',
    class_type: 'Class type group',
  };
  return labels[channel] || channel;
}

/** Find existing open thread: group threads by group key; others by participant set */
export function findOpenThread(
  threads: ServiceThread[],
  channel: MsgChannel,
  participants: MsgParticipant[],
  group?: MsgGroupRef | null
): ServiceThread | undefined {
  const list = normalizeThreads(threads);
  if (
    group?.ref_id &&
    (channel === 'class_session' || channel === 'class_type')
  ) {
    return list.find(
      (t) =>
        !t.archived &&
        t.channel === channel &&
        t.group?.kind === group.kind &&
        t.group?.ref_id === group.ref_id
    );
  }
  const keys = new Set(
    dedupeParticipants(participants).map((p) => participantKey(p))
  );
  return list.find((t) => {
    if (t.archived || t.channel !== channel) return false;
    if (t.group?.ref_id) return false;
    if (t.participants.length !== keys.size) return false;
    return t.participants.every((p) => keys.has(participantKey(p)));
  });
}

export function upsertThreadInList(
  threads: ServiceThread[],
  thread: ServiceThread
): ServiceThread[] {
  const list = normalizeThreads(threads);
  const i = list.findIndex((t) => t.id === thread.id);
  if (i >= 0) {
    const next = [...list];
    next[i] = thread;
    return next.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  return [thread, ...list].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
}

export type MessagingSummary = {
  threadCount: number;
  openThreads: number;
  unreadDesk: number;
};

export function summariseMessaging(threads: ServiceThread[]): MessagingSummary {
  const list = normalizeThreads(threads);
  const open = list.filter((t) => !t.archived);
  return {
    threadCount: list.length,
    openThreads: open.length,
    unreadDesk: totalUnread(open, 'desk', 'desk'),
  };
}

export type MessageActionResult = {
  threads: ServiceThread[];
  thread?: ServiceThread;
  error?: string;
};

/**
 * Apply create / post / mark_read / archive on a threads array.
 * Body fields:
 *  - action: message_create_thread | message_post | message_mark_read | message_archive
 *  - channel, subject, participants, body, author_{role,ref_id,name}
 *  - thread_id, archive
 */
export function applyMessageAction(
  threadsIn: ServiceThread[] | undefined,
  body: Record<string, unknown>,
  now = new Date().toISOString()
): MessageActionResult {
  let threads = normalizeThreads(threadsIn);
  const action = String(body.action || '');

  const authorFromBody = (): MsgParticipant => {
    const role = String(body.author_role || body.as_role || 'desk') as MsgRole;
    const ref_id = String(
      body.author_ref_id || body.as_ref_id || (role === 'desk' ? 'desk' : '')
    ).trim();
    const name = String(
      body.author_name || body.as_name || (role === 'desk' ? 'Desk' : role)
    ).trim();
    if (!ref_id) throw new Error('author_ref_id required');
    return { role, ref_id, name };
  };

  try {
    if (
      action === 'message_create_thread' ||
      action === 'create_thread' ||
      action === 'message_start'
    ) {
      const author = authorFromBody();
      const channel = String(body.channel || 'colleague') as MsgChannel;
      const participantsRaw = Array.isArray(body.participants)
        ? (body.participants as MsgParticipant[])
        : [];
      const participants = participantsRaw
        .map((p) => ({
          role: (p.role || 'desk') as MsgRole,
          ref_id: String(p.ref_id ?? '').trim(),
          name: String(p.name || p.role || 'Person').trim() || 'Person',
        }))
        .filter((p) => p.ref_id);

      // Optional convenience fields for 1:1
      if (body.with_role && body.with_ref_id) {
        participants.push({
          role: String(body.with_role) as MsgRole,
          ref_id: String(body.with_ref_id).trim(),
          name: String(body.with_name || body.with_role),
        });
      }

      const all = dedupeParticipants([...participants, author]);
      if (all.length < 2) {
        return {
          threads,
          error:
            'Pick who to message — add a coach/practitioner and/or member/patient, or a class group with booked members.',
        };
      }

      let group: MsgGroupRef | null = null;
      if (body.group && typeof body.group === 'object') {
        const g = body.group as Record<string, unknown>;
        if (g.ref_id) {
          group = {
            kind: g.kind === 'class_type' ? 'class_type' : 'session',
            ref_id: String(g.ref_id),
            label: String(g.label || 'Class'),
          };
        }
      } else if (body.group_ref_id) {
        group = {
          kind: body.group_kind === 'class_type' ? 'class_type' : 'session',
          ref_id: String(body.group_ref_id),
          label: String(body.group_label || 'Class'),
        };
      }

      const existing = findOpenThread(threads, channel, all, group);
      if (existing && body.reuse !== false) {
        // Merge any new roster members into an existing class thread
        let base = existing;
        if (group && all.length > existing.participants.length) {
          base = {
            ...existing,
            participants: dedupeParticipants([
              ...existing.participants,
              ...all,
            ]),
            group: existing.group || group,
          };
        }
        const updated = appendMessage(
          base,
          String(body.body || body.message || ''),
          author,
          now
        );
        threads = upsertThreadInList(threads, updated);
        return { threads, thread: updated };
      }

      const thread = createThread({
        channel,
        subject: body.subject != null ? String(body.subject) : undefined,
        participants: all,
        body: String(body.body || body.message || ''),
        author,
        now,
        group,
      });
      threads = upsertThreadInList(threads, thread);
      return { threads, thread };
    }

    if (
      action === 'message_post' ||
      action === 'post_message' ||
      action === 'message_reply'
    ) {
      const threadId = String(body.thread_id || body.id || '');
      if (!threadId) return { threads, error: 'thread_id required' };
      const idx = threads.findIndex((t) => t.id === threadId);
      if (idx < 0) return { threads, error: 'Thread not found' };
      const author = authorFromBody();
      const updated = appendMessage(
        threads[idx],
        String(body.body || body.message || ''),
        author,
        now
      );
      threads = upsertThreadInList(threads, updated);
      return { threads, thread: updated };
    }

    if (action === 'message_mark_read' || action === 'mark_read') {
      const threadId = String(body.thread_id || body.id || '');
      if (!threadId) return { threads }; // soft no-op
      const idx = threads.findIndex((t) => t.id === threadId);
      // Soft no-op when thread is gone (e.g. race after archive) — do not 400
      if (idx < 0) return { threads };
      const role = String(body.author_role || body.as_role || 'desk') as MsgRole;
      const ref_id = String(
        body.author_ref_id || body.as_ref_id || (role === 'desk' ? 'desk' : '')
      );
      if (!ref_id) return { threads };
      const updated = markThreadRead(threads[idx], role, ref_id);
      threads = upsertThreadInList(threads, updated);
      return { threads, thread: updated };
    }

    if (action === 'message_archive' || action === 'archive_thread') {
      const threadId = String(body.thread_id || body.id || '');
      if (!threadId) return { threads, error: 'thread_id required' };
      const idx = threads.findIndex((t) => t.id === threadId);
      if (idx < 0) return { threads, error: 'Thread not found' };
      const updated: ServiceThread = {
        ...threads[idx],
        archived: body.archive === false ? false : true,
        updated_at: now,
      };
      threads = upsertThreadInList(threads, updated);
      return { threads, thread: updated };
    }

    return { threads, error: 'Unknown message action' };
  } catch (e: unknown) {
    return {
      threads,
      error: e instanceof Error ? e.message : 'Message action failed',
    };
  }
}
