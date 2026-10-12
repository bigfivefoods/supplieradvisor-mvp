import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';
import {
  DIARY_CALENDAR_NAME,
  DIARY_TIMEZONE,
  endAfter,
  eventUid,
  johannesburgIso,
  partsInJohannesburg,
  saKeyFromText,
  stripSaKey,
  type DiaryStamp,
  type RemoteEvent,
} from '@/lib/sales/calendar-sync';

const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/userinfo.email';

export type CalendarClient = {
  listEvents(from: string, to: string): Promise<RemoteEvent[]>;
  upsertEvent(item: DiaryStamp, remoteId?: string): Promise<{ remoteId: string; etag: string | null }>;
  deleteEvent(remoteId: string): Promise<void>;
};

function clientId(): string {
  return String(process.env.GOOGLE_CALENDAR_CLIENT_ID || '').trim();
}

function clientSecret(): string {
  return String(process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
}

export function googleRedirectUri(): string {
  return `${appBaseUrl()}/api/sales/calendar/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string; error_description?: string };
    if (typeof body.error === 'string') return `${res.status} ${body.error_description || body.error}`;
    if (body.error?.message) return `${res.status} ${body.error.message}`;
  } catch {
    /* ignore */
  }
  return `${res.status} Google Calendar returned ${res.status}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ refreshToken: string; accessToken: string; email: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { refresh_token?: string; access_token?: string };
  if (!body.refresh_token || !body.access_token) throw new Error('Google did not return a refresh token');
  const email = await googleEmail(body.access_token);
  return { refreshToken: body.refresh_token, accessToken: body.access_token, email };
}

export async function refreshGoogleAccess(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('Google did not return an access token');
  return body.access_token;
}

async function googleEmail(access: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) return '';
  const body = (await res.json()) as { email?: string };
  return String(body.email || '');
}

async function googleJson(access: string, url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${access}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await readError(res));
  const text = await res.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export async function ensureGoogleCalendar(access: string, existingId?: string | null): Promise<string> {
  if (existingId) return existingId;
  const list = await googleJson(access, 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250');
  const items = (list.items as { id?: string; summary?: string }[] | undefined) || [];
  const found = items.find((item) => item.summary === DIARY_CALENDAR_NAME && item.id);
  if (found?.id) return found.id;
  const created = await googleJson(access, 'https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: DIARY_CALENDAR_NAME, timeZone: DIARY_TIMEZONE }),
  });
  const id = String(created.id || '');
  if (!id) throw new Error('Google did not create the SupplierAdvisor calendar');
  return id;
}

function googleEventBody(profileId: number, item: DiaryStamp, includeUid: boolean) {
  const start = item.start || '09:00';
  const end = endAfter(start, item.end);
  return {
    summary: item.title.slice(0, 200),
    description: item.notes.slice(0, 800),
    ...(includeUid ? { iCalUID: eventUid(profileId, item.key) } : {}),
    status: item.status === 'done' ? 'cancelled' : 'confirmed',
    start: { dateTime: johannesburgIso(item.date, start), timeZone: DIARY_TIMEZONE },
    end: { dateTime: johannesburgIso(item.date, end), timeZone: DIARY_TIMEZONE },
    extendedProperties: { private: { saKey: item.key } },
  };
}

function mapGoogleEvent(row: Record<string, unknown>): RemoteEvent | null {
  const startRaw = row.start as { dateTime?: string; date?: string } | undefined;
  const endRaw = row.end as { dateTime?: string; date?: string } | undefined;
  const start = partsInJohannesburg(startRaw?.dateTime || startRaw?.date || '');
  if (!start) return null;
  const end = partsInJohannesburg(endRaw?.dateTime || endRaw?.date || '') || start;
  const props = row.extendedProperties as { private?: { saKey?: string } } | undefined;
  const key = props?.private?.saKey || saKeyFromText(String(row.iCalUID || ''));
  return {
    remoteId: String(row.id || ''),
    etag: row.etag ? String(row.etag) : null,
    key,
    title: String(row.summary || 'Busy'),
    date: start.date,
    start: start.time,
    end: end.time,
    notes: stripSaKey(String(row.description || '')),
    status: String(row.status || '') === 'cancelled' ? 'done' : 'open',
    updatedAt: String(row.updated || ''),
  };
}

export function googleClient(access: string, calendarId: string, profileId: number): CalendarClient {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;
  return {
    async listEvents(from, to) {
      const events: RemoteEvent[] = [];
      let page: string | null = null;
      for (let i = 0; i < 4; i++) {
        const params = new URLSearchParams({
          singleEvents: 'true',
          showDeleted: 'true',
          maxResults: '250',
          timeMin: johannesburgIso(from, '00:00'),
          timeMax: johannesburgIso(to, '23:59'),
          orderBy: 'startTime',
        });
        if (page) params.set('pageToken', page);
        const body = await googleJson(access, `${base}/events?${params.toString()}`);
        for (const row of (body.items as Record<string, unknown>[] | undefined) || []) {
          const mapped = mapGoogleEvent(row);
          if (mapped?.remoteId) events.push(mapped);
        }
        page = body.nextPageToken ? String(body.nextPageToken) : null;
        if (!page) break;
      }
      return events;
    },
    async upsertEvent(item, remoteId) {
      const created = JSON.stringify(googleEventBody(profileId, item, true));
      if (remoteId) {
        try {
          const saved = await googleJson(access, `${base}/events/${encodeURIComponent(remoteId)}`, {
            method: 'PATCH',
            body: JSON.stringify(googleEventBody(profileId, item, false)),
          });
          return { remoteId: String(saved.id || remoteId), etag: saved.etag ? String(saved.etag) : null };
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!/\b(404|410)\b/i.test(message)) throw error;
        }
      }
      const saved = await googleJson(access, `${base}/events`, { method: 'POST', body: created });
      return { remoteId: String(saved.id || ''), etag: saved.etag ? String(saved.etag) : null };
    },
    async deleteEvent(remoteId) {
      const res = await fetch(`${base}/events/${encodeURIComponent(remoteId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(await readError(res));
    },
  };
}
