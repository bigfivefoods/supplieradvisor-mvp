/**
 * Owner-published ads / notices shown to every member on the Advisor portal.
 * Stored on the vertical metadata store (`announcements`).
 */

export const ANNOUNCEMENT_KINDS = ['notice', 'ad', 'offer', 'alert'] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

export const ANNOUNCEMENT_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_ACTIONS = [
  'upsert_announcement',
  'publish_announcement',
  'unpublish_announcement',
  'archive_announcement',
  'delete_announcement',
] as const;
export type AnnouncementAction = (typeof ANNOUNCEMENT_ACTIONS)[number];

export const ANNOUNCEMENT_STORE_CAP = 60;
export const ANNOUNCEMENT_MEMBER_LIMIT = 12;

export type MemberAnnouncement = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  image_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  status: AnnouncementStatus;
  pinned?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  author_name?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

export type MemberAnnouncementPublic = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  image_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  pinned?: boolean;
  published_at?: string | null;
};

export function isAnnouncementAction(action: string): action is AnnouncementAction {
  return (ANNOUNCEMENT_ACTIONS as readonly string[]).includes(action);
}

export function newAnnouncementId(): string {
  return `an_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAnnouncements(raw: unknown): MemberAnnouncement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === 'object' && (row as { id?: string }).id)
    .map((row) => normalizeAnnouncement(row as Record<string, unknown>))
    .filter((row) => row.title || row.body);
}

function asKind(raw: unknown): AnnouncementKind {
  const s = String(raw || 'notice').toLowerCase();
  return (ANNOUNCEMENT_KINDS as readonly string[]).includes(s)
    ? (s as AnnouncementKind)
    : 'notice';
}

function asStatus(raw: unknown): AnnouncementStatus {
  const s = String(raw || 'draft').toLowerCase();
  return (ANNOUNCEMENT_STATUSES as readonly string[]).includes(s)
    ? (s as AnnouncementStatus)
    : 'draft';
}

export function safeAnnouncementHref(raw: unknown): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 500);
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.toString().slice(0, 500);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clip(raw: unknown, max: number): string {
  return String(raw || '').trim().slice(0, max);
}

export function normalizeAnnouncement(
  row: Record<string, unknown>
): MemberAnnouncement {
  const now = new Date().toISOString();
  return {
    id: String(row.id || newAnnouncementId()),
    kind: asKind(row.kind),
    title: clip(row.title, 120),
    body: clip(row.body, 2000),
    image_url: safeAnnouncementHref(row.image_url),
    cta_label: clip(row.cta_label, 40) || null,
    cta_href: safeAnnouncementHref(row.cta_href),
    status: asStatus(row.status),
    pinned: row.pinned === true,
    starts_at: row.starts_at ? String(row.starts_at).slice(0, 30) : null,
    ends_at: row.ends_at ? String(row.ends_at).slice(0, 30) : null,
    author_name: clip(row.author_name, 80) || null,
    created_at: String(row.created_at || now),
    updated_at: String(row.updated_at || now),
    published_at: row.published_at ? String(row.published_at) : null,
  };
}

export function announcementIsLive(
  row: MemberAnnouncement,
  now = new Date()
): boolean {
  if (row.status !== 'published') return false;
  if (row.starts_at) {
    const start = new Date(row.starts_at);
    if (Number.isFinite(start.getTime()) && start > now) return false;
  }
  if (row.ends_at) {
    const end = new Date(row.ends_at);
    if (Number.isFinite(end.getTime()) && end < now) return false;
  }
  return true;
}

export function publishedAnnouncements(
  raw: unknown,
  limit = ANNOUNCEMENT_MEMBER_LIMIT
): MemberAnnouncementPublic[] {
  const now = new Date();
  return normalizeAnnouncements(raw)
    .filter((row) => announcementIsLive(row, now))
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return String(b.published_at || b.updated_at).localeCompare(
        String(a.published_at || a.updated_at)
      );
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      image_url: row.image_url || null,
      cta_label: row.cta_label || null,
      cta_href: row.cta_href || null,
      pinned: row.pinned === true,
      published_at: row.published_at || row.updated_at,
    }));
}

export function applyAnnouncementAction(
  list: MemberAnnouncement[] | undefined,
  action: string,
  body: Record<string, unknown>
): { list: MemberAnnouncement[]; message: string } {
  const now = new Date().toISOString();
  let next = normalizeAnnouncements(list);

  if (action === 'delete_announcement') {
    const id = String(body.id || body.announcement_id || '');
    if (!id) throw new Error('Announcement id required');
    next = next.filter((row) => row.id !== id);
    return { list: next, message: 'Announcement deleted' };
  }

  if (action === 'archive_announcement') {
    const id = String(body.id || body.announcement_id || '');
    const row = next.find((r) => r.id === id);
    if (!row) throw new Error('Announcement not found');
    row.status = 'archived';
    row.pinned = false;
    row.updated_at = now;
    return { list: next, message: 'Announcement archived' };
  }

  if (action === 'unpublish_announcement') {
    const id = String(body.id || body.announcement_id || '');
    const row = next.find((r) => r.id === id);
    if (!row) throw new Error('Announcement not found');
    row.status = 'draft';
    row.updated_at = now;
    return { list: next, message: 'Announcement unpublished' };
  }

  if (action === 'publish_announcement') {
    const id = String(body.id || body.announcement_id || '');
    const row = next.find((r) => r.id === id);
    if (!row) throw new Error('Announcement not found');
    if (!row.title.trim()) throw new Error('Add a title before publishing');
    row.status = 'published';
    row.published_at = row.published_at || now;
    row.updated_at = now;
    return { list: next, message: 'Published to all members' };
  }

  const incoming = (body.announcement || body.record || body) as Record<
    string,
    unknown
  >;
  const id = String(incoming.id || body.id || '');
  const existing = id ? next.find((r) => r.id === id) : undefined;
  const publishNow =
    incoming.status === 'published' ||
    body.publish === true ||
    action === 'publish_announcement';

  const row = normalizeAnnouncement({
    ...(existing || {}),
    ...incoming,
    id: existing?.id || id || newAnnouncementId(),
    created_at: existing?.created_at || now,
    updated_at: now,
    author_name:
      incoming.author_name || existing?.author_name || body.author_name || null,
    status: publishNow ? 'published' : incoming.status || existing?.status || 'draft',
    published_at: publishNow
      ? existing?.published_at || now
      : existing?.published_at || null,
  });
  if (!row.title.trim() && !row.body.trim()) {
    throw new Error('Title or message required');
  }
  if (existing) {
    next = next.map((r) => (r.id === existing.id ? row : r));
  } else {
    next = [row, ...next];
  }
  if (next.length > ANNOUNCEMENT_STORE_CAP) {
    next = next.slice(0, ANNOUNCEMENT_STORE_CAP);
  }
  return {
    list: next,
    message: row.status === 'published'
      ? 'Published to all members'
      : existing
        ? 'Announcement saved'
        : 'Draft saved',
  };
}
