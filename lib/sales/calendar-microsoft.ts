import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';
import {
  DIARY_CALENDAR_NAME,
  DIARY_TIMEZONE,
  endAfter,
  johannesburgIso,
  partsInJohannesburg,
  saKeyFromText,
  stripSaKey,
  type DiaryStamp,
  type RemoteEvent,
} from '@/lib/sales/calendar-sync';
import type { CalendarClient } from '@/lib/sales/calendar-google';

const SCOPE = 'offline_access Calendars.ReadWrite User.Read';
const SA_PROP = 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name saKey';

function clientId(): string {
  return String(process.env.MICROSOFT_CALENDAR_CLIENT_ID || '').trim();
}

function clientSecret(): string {
  return String(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || '').trim();
}

export function outlookRedirectUri(): string {
  return `${appBaseUrl()}/api/sales/calendar/outlook/callback`;
}

export function outlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: outlookRedirectUri(),
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPE,
    prompt: 'consent',
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { error_description?: string; error?: { message?: string } | string };
    if (typeof body.error === 'string') return `${res.status} ${body.error_description || body.error}`;
    if (body.error?.message) return `${res.status} ${body.error.message}`;
  } catch {
    /* ignore */
  }
  return `${res.status} Outlook returned ${res.status}`;
}

async function tokenRequest(body: URLSearchParams): Promise<{ access: string; refresh: string | null }> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token) throw new Error('Outlook did not return an access token');
  return { access: json.access_token, refresh: json.refresh_token || null };
}

export async function exchangeOutlookCode(code: string): Promise<{ refreshToken: string; accessToken: string; email: string }> {
  const tokens = await tokenRequest(
    new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: outlookRedirectUri(),
      grant_type: 'authorization_code',
      scope: SCOPE,
    })
  );
  if (!tokens.refresh) throw new Error('Outlook did not return a refresh token');
  const email = await outlookEmail(tokens.access);
  return { refreshToken: tokens.refresh, accessToken: tokens.access, email };
}

export async function refreshOutlookAccess(refreshToken: string): Promise<{ accessToken: string; refreshToken: string | null }> {
  const tokens = await tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
      scope: SCOPE,
    })
  );
  return { accessToken: tokens.access, refreshToken: tokens.refresh };
}

async function outlookEmail(access: string): Promise<string> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) return '';
  const body = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return String(body.mail || body.userPrincipalName || '');
}

async function graph(access: string, url: string, init?: RequestInit): Promise<Record<string, unknown>> {
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

export async function ensureOutlookCalendar(access: string, existingId?: string | null): Promise<string> {
  if (existingId) return existingId;
  const list = await graph(access, 'https://graph.microsoft.com/v1.0/me/calendars?$top=100');
  const items = (list.value as { id?: string; name?: string }[] | undefined) || [];
  const found = items.find((item) => item.name === DIARY_CALENDAR_NAME && item.id);
  if (found?.id) return found.id;
  const created = await graph(access, 'https://graph.microsoft.com/v1.0/me/calendars', {
    method: 'POST',
    body: JSON.stringify({ name: DIARY_CALENDAR_NAME }),
  });
  const id = String(created.id || '');
  if (!id) throw new Error('Outlook did not create the SupplierAdvisor calendar');
  return id;
}

function wallParts(value: string): { date: string; time: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return partsInJohannesburg(value);
  return { date: match[1], time: match[2] };
}

function mapOutlookEvent(row: Record<string, unknown>): RemoteEvent | null {
  const startRaw = row.start as { dateTime?: string } | undefined;
  const endRaw = row.end as { dateTime?: string } | undefined;
  const start = wallParts(startRaw?.dateTime || '');
  if (!start) return null;
  const end = wallParts(endRaw?.dateTime || '') || start;
  const props = (row.singleValueExtendedProperties as { id?: string; value?: string }[] | undefined) || [];
  const tagged = props.find((prop) => String(prop.id || '').includes('Name saKey'))?.value;
  const body = row.body as { content?: string } | undefined;
  const notes = String(body?.content || '');
  return {
    remoteId: String(row.id || ''),
    etag: row['@odata.etag'] ? String(row['@odata.etag']) : null,
    key: tagged || saKeyFromText(notes),
    title: String(row.subject || 'Busy'),
    date: start.date,
    start: start.time,
    end: end.time,
    notes: stripSaKey(notes),
    status: row.isCancelled ? 'done' : 'open',
    updatedAt: String(row.lastModifiedDateTime || ''),
  };
}

function outlookBody(item: DiaryStamp) {
  const start = item.start || '09:00';
  const end = endAfter(start, item.end);
  return {
    subject: item.title.slice(0, 200),
    body: { contentType: 'text', content: item.notes.slice(0, 800) },
    start: { dateTime: `${item.date.slice(0, 10)}T${start}:00`, timeZone: DIARY_TIMEZONE },
    end: { dateTime: `${item.date.slice(0, 10)}T${end}:00`, timeZone: DIARY_TIMEZONE },
    singleValueExtendedProperties: [{ id: SA_PROP, value: item.key }],
  };
}

export function outlookClient(access: string, calendarId: string): CalendarClient {
  const base = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}`;
  const expand = encodeURIComponent(`singleValueExtendedProperties($filter=id eq '${SA_PROP}')`);
  return {
    async listEvents(from, to) {
      const params = new URLSearchParams({
        $top: '200',
        startDateTime: johannesburgIso(from, '00:00'),
        endDateTime: johannesburgIso(to, '23:59'),
      });
      const headers = { Prefer: `outlook.timezone="${DIARY_TIMEZONE}"` };
      let next: string | null = `${base}/calendarView?${params.toString()}`;
      let useExpand = true;
      const events: RemoteEvent[] = [];
      for (let page = 0; page < 4 && next; page++) {
        const url = useExpand && !next.includes('$expand=') ? `${next}&$expand=${expand}` : next;
        let body: Record<string, unknown>;
        try {
          body = await graph(access, url, { headers });
        } catch (error) {
          if (page !== 0 || !useExpand) throw error;
          useExpand = false;
          body = await graph(access, next, { headers });
        }
        for (const row of (body.value as Record<string, unknown>[] | undefined) || []) {
          const mapped = mapOutlookEvent(row);
          if (mapped?.remoteId) events.push(mapped);
        }
        next = body['@odata.nextLink'] ? String(body['@odata.nextLink']) : null;
      }
      return events;
    },
    async upsertEvent(item, remoteId) {
      if (item.status === 'done' && remoteId) {
        await this.deleteEvent(remoteId);
        return { remoteId, etag: null };
      }
      if (item.status === 'done') return { remoteId: '', etag: null };
      const payload = JSON.stringify(outlookBody(item));
      if (remoteId) {
        try {
          const saved = await graph(access, `${base}/events/${encodeURIComponent(remoteId)}`, {
            method: 'PATCH',
            body: payload,
          });
          return {
            remoteId: String(saved.id || remoteId),
            etag: saved['@odata.etag'] ? String(saved['@odata.etag']) : null,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!/\b(404|410)\b/i.test(message)) throw error;
        }
      }
      const saved = await graph(access, `${base}/events`, { method: 'POST', body: payload });
      return {
        remoteId: String(saved.id || ''),
        etag: saved['@odata.etag'] ? String(saved['@odata.etag']) : null,
      };
    },
    async deleteEvent(remoteId) {
      const res = await fetch(`${base}/events/${encodeURIComponent(remoteId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!res.ok && res.status !== 404) throw new Error(await readError(res));
    },
  };
}
