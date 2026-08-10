/**
 * Shared patient/member messaging for clinic + Fit portals (pure — no email).
 */
import {
  applyMessageAction,
  previewText,
  threadTitle,
  threadsForParticipant,
  totalUnread,
  type MsgRole,
  type ServiceThread,
} from '@/lib/messaging/service-inbox';

export function portalThreadsForPerson(
  threads: ServiceThread[] | undefined,
  role: MsgRole,
  personId: string
) {
  return threadsForParticipant(threads || [], role, personId).map((t) => ({
    id: t.id,
    subject: t.subject,
    channel: t.channel,
    title: threadTitle(t, role, personId),
    preview: previewText(t),
    updated_at: t.updated_at,
    unread: totalUnread([t], role, personId),
    participants: t.participants,
    messages: t.messages,
  }));
}

export function portalMessagesUnread(
  threads: ServiceThread[] | undefined,
  role: MsgRole,
  personId: string
): number {
  return totalUnread(threads || [], role, personId);
}

export type PortalMessageActionResult =
  | {
      ok: true;
      threads: ServiceThread[];
      thread?: ServiceThread;
      unread: number;
    }
  | { ok: false; error: string; status?: number };

export function handlePortalMessageAction(opts: {
  action: string;
  body: Record<string, unknown>;
  threads: ServiceThread[] | undefined;
  personRole: 'member' | 'patient';
  personId: string;
  personName: string;
  now?: string;
}): PortalMessageActionResult {
  const action = opts.action;
  const now = opts.now || new Date().toISOString();
  const role = opts.personRole;
  const author = {
    role,
    ref_id: opts.personId,
    name: opts.personName,
  };
  const bodyWithAuthor: Record<string, unknown> = {
    ...opts.body,
    author_role: role,
    author_ref_id: opts.personId,
    author_name: opts.personName,
    participants: Array.isArray(opts.body.participants)
      ? [
          ...(opts.body.participants as Array<Record<string, unknown>>),
          author,
        ]
      : [author],
  };

  if (
    action === 'message_post' ||
    action === 'post_message' ||
    action === 'message_reply' ||
    action === 'message_mark_read' ||
    action === 'mark_read'
  ) {
    const threadId = String(opts.body.thread_id || opts.body.id || '');
    const thr = (opts.threads || []).find((t) => t.id === threadId);
    const allowed = thr?.participants?.some(
      (p) => p.role === role && p.ref_id === opts.personId
    );
    if (!allowed) {
      return { ok: false, error: 'Thread not found', status: 404 };
    }
  }

  const result = applyMessageAction(opts.threads, bodyWithAuthor, now);
  if (result.error) {
    return { ok: false, error: result.error, status: 400 };
  }
  return {
    ok: true,
    threads: result.threads,
    thread: result.thread,
    unread: totalUnread(result.threads || [], role, opts.personId),
  };
}
