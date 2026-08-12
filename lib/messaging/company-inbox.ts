/**
 * Platform company messaging — colleagues (internal) and connected
 * suppliers / customers / network peers (cross-company).
 *
 * Stored on profiles.metadata.company_inbox per company.
 * Cross-company threads are dual-written to both profiles so each side
 * can read without a shared table migration.
 */

export const COMPANY_INBOX_META_KEY = 'company_inbox' as const;

export type CompanyMsgChannel =
  | 'colleague'
  | 'supplier'
  | 'customer'
  | 'connection'
  /** Care message from a service business (gym, clinic, dental, etc.) */
  | 'service';

export type CompanyMsgParticipant = {
  /** desk | user | company */
  kind: 'desk' | 'user' | 'company';
  ref_id: string;
  company_id: number;
  name: string;
  role_label?: string;
};

export type CompanyMessage = {
  id: string;
  body: string;
  author: CompanyMsgParticipant;
  created_at: string;
  /** Keys kind:ref_id that have read this message */
  read_by?: string[];
};

export type CompanyThread = {
  id: string;
  channel: CompanyMsgChannel;
  subject: string;
  /** Companies that hold a copy of this thread */
  company_ids: number[];
  participants: CompanyMsgParticipant[];
  /** business_connections.id when known */
  connection_id?: string | null;
  /** Other company on trade threads */
  peer_company_id?: number | null;
  peer_company_name?: string | null;
  /** supplier | customer | peer — how we relate to peer */
  peer_relation?: 'supplier' | 'customer' | 'peer' | null;
  /**
   * Service-module care thread (GymAdvisor / clinic) mirrored into this inbox.
   * Lets a member see coach messages on their own company dashboard.
   */
  service_module?: string | null;
  service_thread_id?: string | null;
  messages: CompanyMessage[];
  created_at: string;
  updated_at: string;
  archived?: boolean;
};

export type CompanyInboxStore = {
  threads: CompanyThread[];
  updated_at?: string;
};

export function newMsgId(prefix = 'cmsg'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function participantKey(
  p: Pick<CompanyMsgParticipant, 'kind' | 'ref_id'>
): string {
  return `${p.kind}:${p.ref_id}`;
}

export function emptyInbox(): CompanyInboxStore {
  return { threads: [] };
}

export function readCompanyInbox(
  meta: Record<string, unknown> | null | undefined
): CompanyInboxStore {
  if (!meta || typeof meta !== 'object') return emptyInbox();
  const raw = meta[COMPANY_INBOX_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyInbox();
  const s = raw as Partial<CompanyInboxStore>;
  return {
    threads: normalizeThreads(s.threads),
    updated_at: s.updated_at ? String(s.updated_at) : undefined,
  };
}

export function writeCompanyInbox(
  meta: Record<string, unknown>,
  store: CompanyInboxStore
): Record<string, unknown> {
  return {
    ...meta,
    [COMPANY_INBOX_META_KEY]: {
      threads: normalizeThreads(store.threads),
      updated_at: new Date().toISOString(),
    },
  };
}

export function normalizeThreads(raw: unknown): CompanyThread[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === 'object' && (t as CompanyThread).id)
    .map((t) => {
      const th = t as CompanyThread;
      return {
        id: String(th.id),
        channel: (th.channel || 'colleague') as CompanyMsgChannel,
        subject: String(th.subject || 'Conversation'),
        company_ids: Array.isArray(th.company_ids)
          ? th.company_ids.map(Number).filter((n) => Number.isFinite(n))
          : [],
        participants: Array.isArray(th.participants)
          ? th.participants.map((p) => ({
              kind: p.kind || 'desk',
              ref_id: String(p.ref_id || 'desk'),
              company_id: Number(p.company_id) || 0,
              name: String(p.name || p.kind || 'User'),
              role_label: p.role_label ? String(p.role_label) : undefined,
            }))
          : [],
        connection_id: th.connection_id != null ? String(th.connection_id) : null,
        peer_company_id:
          th.peer_company_id != null && Number.isFinite(Number(th.peer_company_id))
            ? Number(th.peer_company_id)
            : null,
        peer_company_name: th.peer_company_name
          ? String(th.peer_company_name)
          : null,
        peer_relation: th.peer_relation || null,
        service_module: th.service_module
          ? String(th.service_module)
          : null,
        service_thread_id: th.service_thread_id
          ? String(th.service_thread_id)
          : null,
        messages: Array.isArray(th.messages)
          ? th.messages.map((m) => ({
              id: String(m.id || newMsgId()),
              body: String(m.body || ''),
              author: {
                kind: m.author?.kind || 'desk',
                ref_id: String(m.author?.ref_id || 'desk'),
                company_id: Number(m.author?.company_id) || 0,
                name: String(m.author?.name || 'User'),
                role_label: m.author?.role_label
                  ? String(m.author.role_label)
                  : undefined,
              },
              created_at: String(m.created_at || new Date().toISOString()),
              read_by: Array.isArray(m.read_by) ? m.read_by.map(String) : [],
            }))
          : [],
        created_at: String(th.created_at || new Date().toISOString()),
        updated_at: String(th.updated_at || th.created_at || new Date().toISOString()),
        archived: th.archived === true,
      };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function upsertThread(
  threads: CompanyThread[],
  thread: CompanyThread
): CompanyThread[] {
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

export function unreadForViewer(
  thread: CompanyThread,
  viewer: Pick<CompanyMsgParticipant, 'kind' | 'ref_id'>
): number {
  const key = participantKey(viewer);
  return (thread.messages || []).filter((m) => {
    if (participantKey(m.author) === key) return false;
    // Also count company-level desk as same company reads
    return !(m.read_by || []).includes(key);
  }).length;
}

export function totalUnread(
  threads: CompanyThread[],
  viewer: Pick<CompanyMsgParticipant, 'kind' | 'ref_id'>
): number {
  return threads
    .filter((t) => !t.archived)
    .reduce((n, t) => n + unreadForViewer(t, viewer), 0);
}

export function markThreadRead(
  thread: CompanyThread,
  viewer: Pick<CompanyMsgParticipant, 'kind' | 'ref_id'>,
  now = new Date().toISOString()
): CompanyThread {
  const key = participantKey(viewer);
  return {
    ...thread,
    updated_at: thread.updated_at || now,
    messages: (thread.messages || []).map((m) => {
      const read = new Set(m.read_by || []);
      read.add(key);
      return { ...m, read_by: [...read] };
    }),
  };
}

export function appendCompanyMessage(
  thread: CompanyThread,
  body: string,
  author: CompanyMsgParticipant,
  now = new Date().toISOString()
): CompanyThread {
  const text = String(body || '').trim();
  if (!text) throw new Error('Message body required');
  const msg: CompanyMessage = {
    id: newMsgId('cmsg'),
    body: text,
    author,
    created_at: now,
    read_by: [participantKey(author)],
  };
  const participants = dedupeParticipants([...thread.participants, author]);
  return {
    ...thread,
    participants,
    messages: [...(thread.messages || []), msg],
    updated_at: now,
  };
}

export function createCompanyThread(input: {
  channel: CompanyMsgChannel;
  subject?: string;
  company_ids: number[];
  participants: CompanyMsgParticipant[];
  body: string;
  author: CompanyMsgParticipant;
  connection_id?: string | null;
  peer_company_id?: number | null;
  peer_company_name?: string | null;
  peer_relation?: 'supplier' | 'customer' | 'peer' | null;
  service_module?: string | null;
  service_thread_id?: string | null;
  /** Stable id for dual-write / service mirrors */
  id?: string;
  now?: string;
}): CompanyThread {
  const now = input.now || new Date().toISOString();
  const body = String(input.body || '').trim();
  if (!body) throw new Error('Message body required');
  const participants = dedupeParticipants([
    ...input.participants,
    input.author,
  ]);
  if (participants.length < 1) throw new Error('Participants required');

  const subject =
    String(input.subject || '').trim() ||
    defaultSubject(input.channel, participants, input.author, input.peer_company_name);

  return {
    id: input.id || newMsgId('cthr'),
    channel: input.channel,
    subject,
    company_ids: [...new Set(input.company_ids.filter((n) => Number.isFinite(n)))],
    participants,
    connection_id: input.connection_id ?? null,
    peer_company_id: input.peer_company_id ?? null,
    peer_company_name: input.peer_company_name ?? null,
    peer_relation: input.peer_relation ?? null,
    service_module: input.service_module ?? null,
    service_thread_id: input.service_thread_id ?? null,
    messages: [
      {
        id: newMsgId('cmsg'),
        body,
        author: input.author,
        created_at: now,
        read_by: [participantKey(input.author)],
      },
    ],
    created_at: now,
    updated_at: now,
  };
}

function defaultSubject(
  channel: CompanyMsgChannel,
  participants: CompanyMsgParticipant[],
  author: CompanyMsgParticipant,
  peerName?: string | null
): string {
  if (channel === 'colleague') {
    const others = participants.filter(
      (p) => participantKey(p) !== participantKey(author)
    );
    return others.length
      ? `Team · ${others.map((p) => p.name).join(', ')}`
      : 'Team conversation';
  }
  if (channel === 'service') {
    return peerName ? `Care · ${peerName}` : 'Care message';
  }
  return peerName ? `Trade · ${peerName}` : 'Network conversation';
}

function dedupeParticipants(
  list: CompanyMsgParticipant[]
): CompanyMsgParticipant[] {
  const map = new Map<string, CompanyMsgParticipant>();
  for (const p of list) {
    if (!p) continue;
    const row: CompanyMsgParticipant = {
      kind: p.kind || 'desk',
      ref_id: String(p.ref_id || (p.kind === 'desk' ? 'desk' : '')).trim() || 'desk',
      company_id: Number(p.company_id) || 0,
      name: String(p.name || p.kind || 'User').trim() || 'User',
      role_label: p.role_label,
    };
    map.set(participantKey(row), row);
  }
  return [...map.values()];
}

export function previewText(thread: CompanyThread, max = 80): string {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return 'No messages yet';
  const body = last.body.replace(/\s+/g, ' ').trim();
  if (body.length <= max) return body;
  return body.slice(0, max - 1) + '…';
}

export function channelLabel(channel: CompanyMsgChannel): string {
  const map: Record<CompanyMsgChannel, string> = {
    colleague: 'Colleagues',
    supplier: 'Supplier',
    customer: 'Customer',
    connection: 'Network',
    service: 'Care / services',
  };
  return map[channel] || channel;
}

export function threadTitleForCompany(
  thread: CompanyThread,
  companyId: number
): string {
  if (thread.subject && !thread.subject.startsWith('Conversation')) {
    return thread.subject;
  }
  if (thread.channel === 'colleague') {
    return (
      thread.participants
        .filter((p) => p.company_id === companyId)
        .map((p) => p.name)
        .join(' · ') || 'Team'
    );
  }
  if (thread.channel === 'service') {
    return thread.peer_company_name
      ? `Care · ${thread.peer_company_name}`
      : 'Care message';
  }
  return thread.peer_company_name || 'Trade partner';
}

export type ApplyCompanyMessageResult = {
  thread?: CompanyThread;
  /** Full thread list for the acting company after update */
  threads: CompanyThread[];
  error?: string;
  /** When set, dual-write this thread onto the peer company inbox */
  dualWriteThread?: CompanyThread;
  dualWriteCompanyId?: number;
};

/**
 * Apply create / post / mark_read / archive on one company's thread list.
 */
export function applyCompanyMessageAction(
  threadsIn: CompanyThread[] | undefined,
  body: Record<string, unknown>,
  ctx: {
    companyId: number;
    author: CompanyMsgParticipant;
    now?: string;
  }
): ApplyCompanyMessageResult {
  let threads = normalizeThreads(threadsIn);
  const action = String(body.action || '');
  const now = ctx.now || new Date().toISOString();
  const author = ctx.author;

  try {
    if (
      action === 'message_create_thread' ||
      action === 'create_thread' ||
      action === 'message_start'
    ) {
      const channel = String(body.channel || 'colleague') as CompanyMsgChannel;
      const peerCompanyId =
        body.peer_company_id != null
          ? Number(body.peer_company_id)
          : body.with_company_id != null
            ? Number(body.with_company_id)
            : null;

      const participantsRaw = Array.isArray(body.participants)
        ? (body.participants as CompanyMsgParticipant[])
        : [];

      // Colleague: optional teammate user
      if (channel === 'colleague' && body.with_user_id) {
        participantsRaw.push({
          kind: 'user',
          ref_id: String(body.with_user_id),
          company_id: ctx.companyId,
          name: String(body.with_user_name || 'Colleague'),
          role_label: body.with_user_role
            ? String(body.with_user_role)
            : undefined,
        });
      }

      // Peer company participant
      if (peerCompanyId && Number.isFinite(peerCompanyId)) {
        participantsRaw.push({
          kind: 'company',
          ref_id: String(peerCompanyId),
          company_id: peerCompanyId,
          name: String(body.peer_company_name || body.with_company_name || 'Partner'),
        });
      }

      // Always include acting company desk
      participantsRaw.push({
        kind: 'desk',
        ref_id: 'desk',
        company_id: ctx.companyId,
        name: String(body.company_name || 'Our company'),
      });
      participantsRaw.push(author);

      const company_ids =
        channel === 'colleague' || !peerCompanyId
          ? [ctx.companyId]
          : [ctx.companyId, peerCompanyId];

      // Reuse open thread with same peer when not colleague
      if (channel !== 'colleague' && peerCompanyId) {
        const existing = threads.find(
          (t) =>
            !t.archived &&
            t.channel === channel &&
            t.peer_company_id === peerCompanyId
        );
        if (existing && body.reuse !== false) {
          const updated = appendCompanyMessage(
            existing,
            String(body.body || body.message || ''),
            author,
            now
          );
          threads = upsertThread(threads, updated);
          return {
            threads,
            thread: updated,
            dualWriteThread: updated,
            dualWriteCompanyId: peerCompanyId,
          };
        }
      }

      const thread = createCompanyThread({
        channel,
        subject: body.subject != null ? String(body.subject) : undefined,
        company_ids,
        participants: participantsRaw,
        body: String(body.body || body.message || ''),
        author,
        connection_id:
          body.connection_id != null ? String(body.connection_id) : null,
        peer_company_id: peerCompanyId,
        peer_company_name:
          body.peer_company_name != null
            ? String(body.peer_company_name)
            : body.with_company_name != null
              ? String(body.with_company_name)
              : null,
        peer_relation:
          (body.peer_relation as CompanyThread['peer_relation']) ||
          (channel === 'supplier'
            ? 'supplier'
            : channel === 'customer'
              ? 'customer'
              : channel === 'connection'
                ? 'peer'
                : null),
        now,
      });
      threads = upsertThread(threads, thread);
      return {
        threads,
        thread,
        dualWriteThread:
          peerCompanyId && channel !== 'colleague' ? thread : undefined,
        dualWriteCompanyId:
          peerCompanyId && channel !== 'colleague' ? peerCompanyId : undefined,
      };
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
      const updated = appendCompanyMessage(
        threads[idx],
        String(body.body || body.message || ''),
        author,
        now
      );
      threads = upsertThread(threads, updated);
      const peer =
        updated.peer_company_id &&
        updated.peer_company_id !== ctx.companyId
          ? updated.peer_company_id
          : updated.company_ids.find((id) => id !== ctx.companyId);
      return {
        threads,
        thread: updated,
        dualWriteThread: peer ? updated : undefined,
        dualWriteCompanyId: peer || undefined,
      };
    }

    if (action === 'message_mark_read' || action === 'mark_read') {
      const threadId = String(body.thread_id || body.id || '');
      if (!threadId) return { threads, error: 'thread_id required' };
      const idx = threads.findIndex((t) => t.id === threadId);
      if (idx < 0) return { threads, error: 'Thread not found' };
      const updated = markThreadRead(threads[idx], author, now);
      threads = upsertThread(threads, updated);
      return { threads, thread: updated };
    }

    if (action === 'message_archive' || action === 'archive_thread') {
      const threadId = String(body.thread_id || body.id || '');
      if (!threadId) return { threads, error: 'thread_id required' };
      const idx = threads.findIndex((t) => t.id === threadId);
      if (idx < 0) return { threads, error: 'Thread not found' };
      const updated: CompanyThread = {
        ...threads[idx],
        archived: body.archive === false ? false : true,
        updated_at: now,
      };
      threads = upsertThread(threads, updated);
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

export function summariseCompanyInbox(
  threads: CompanyThread[],
  viewer: Pick<CompanyMsgParticipant, 'kind' | 'ref_id'>
) {
  const open = normalizeThreads(threads).filter((t) => !t.archived);
  return {
    threadCount: open.length,
    unreadMessages: totalUnread(open, viewer),
    colleagueThreads: open.filter((t) => t.channel === 'colleague').length,
    tradeThreads: open.filter(
      (t) =>
        t.channel === 'supplier' ||
        t.channel === 'customer' ||
        t.channel === 'connection'
    ).length,
    serviceThreads: open.filter((t) => t.channel === 'service').length,
  };
}
