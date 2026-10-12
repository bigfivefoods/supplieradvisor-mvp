import { buildIcsCalendar } from '@/lib/schedule/advisor-ics';
import type { CalendarClient } from '@/lib/sales/calendar-google';
import {
  DIARY_CALENDAR_NAME,
  calendarHrefs,
  endAfter,
  eventUid,
  firstXmlHref,
  parseIcsEvents,
  xmlPropHref,
  type DiaryStamp,
} from '@/lib/sales/calendar-sync';

const ICLOUD = 'https://caldav.icloud.com/';

function basicAuth(appleId: string, appPassword: string): string {
  const password = normalizeApplePassword(appPassword);
  return `Basic ${Buffer.from(`${appleId}:${password}`).toString('base64')}`;
}

function resolveHref(base: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, base).toString();
}

function ensureSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

async function caldav(
  url: string,
  auth: string,
  method: string,
  depth: number | undefined,
  body?: string,
  extra?: Record<string, string>
): Promise<{ status: number; text: string; url: string; etag: string | null }> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const headers: Record<string, string> = {
      Authorization: auth,
      'User-Agent': 'SupplierAdvisor/1.0',
      ...(extra || {}),
    };
    if (body) {
      headers['Content-Type'] = method === 'PUT' ? 'text/calendar; charset=utf-8' : 'application/xml; charset=utf-8';
    }
    if (depth != null) headers.Depth = String(depth);
    const res = await fetch(current, { method, headers, body, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      current = resolveHref(current, location);
      continue;
    }
    return {
      status: res.status,
      text: await res.text(),
      url: current,
      etag: res.headers.get('etag'),
    };
  }
  throw new Error('Apple calendar redirect did not finish');
}

function propfind(inner: string, caldavNs = false): string {
  const ns = caldavNs ? ' xmlns:c="urn:ietf:params:xml:ns:caldav"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:"${ns}><d:prop>${inner}</d:prop></d:propfind>`;
}

/** Apple app-specific passwords are 16 letters. Dashes, spaces, and the surrounding dialog text are ignored. */
export function normalizeApplePassword(raw: string): string {
  const text = String(raw || '').toLowerCase();
  const grouped = text.match(/[a-z0-9]{4}(?:[^a-z0-9]+[a-z0-9]{4}){3}/);
  if (grouped) {
    const code = grouped[0].replace(/[^a-z0-9]/g, '');
    if (code.length === 16) return code;
  }
  return text.replace(/[^a-z0-9]/g, '');
}

export function appleConnectError(appleId: string, appPassword: string): string | null {
  if (!appleId.includes('@')) {
    return 'Use the email address for the Apple ID.';
  }
  if (appPassword.length < 16) {
    return 'Paste the 16-character app-specific password from appleid.apple.com, under Sign-In and Security. It looks like abcd-efgh-ijkl-mnop. Your normal Apple ID password will not connect.';
  }
  return null;
}

export async function connectAppleCalendar(appleId: string, appPassword: string): Promise<{ calendarHref: string }> {
  const auth = basicAuth(appleId, appPassword);
  const principal = await caldav(ICLOUD, auth, 'PROPFIND', 0, propfind('<d:current-user-principal/>'));
  if (principal.status === 401 || principal.status === 403) {
    throw new Error('Apple rejected that Apple ID or app-specific password');
  }
  if (principal.status >= 400) throw new Error('Apple calendar service did not answer');
  const principalHref = xmlPropHref(principal.text, 'current-user-principal');
  if (!principalHref) throw new Error('Apple did not return a calendar principal');
  const principalUrl = resolveHref(principal.url, principalHref);
  const home = await caldav(
    principalUrl,
    auth,
    'PROPFIND',
    0,
    propfind('<c:calendar-home-set/>', true)
  );
  if (home.status === 401 || home.status === 403) {
    throw new Error('Apple rejected that Apple ID or app-specific password');
  }
  const homeHref = xmlPropHref(home.text, 'calendar-home-set');
  if (home.status >= 400 || !homeHref) throw new Error('Apple did not return a calendar home');
  const homeUrl = ensureSlash(resolveHref(home.url, homeHref));
  const listed = await caldav(
    homeUrl,
    auth,
    'PROPFIND',
    1,
    propfind('<d:displayname/><d:resourcetype/>')
  );
  if (listed.status === 401 || listed.status === 403) {
    throw new Error('Apple rejected that Apple ID or app-specific password');
  }
  if (listed.status >= 400) throw new Error('Apple could not list calendars');
  const wanted = DIARY_CALENDAR_NAME.toLowerCase();
  const found = calendarHrefs(listed.text).find((row) => row.name.trim().toLowerCase() === wanted);
  if (found) return { calendarHref: ensureSlash(resolveHref(listed.url, found.href)) };

  const created = new URL(`${crypto.randomUUID()}/`, homeUrl).toString();
  const mkBody =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">' +
    '<d:set><d:prop>' +
    `<d:displayname>${DIARY_CALENDAR_NAME}</d:displayname>` +
    '<c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>' +
    '<a:calendar-color>#0A84FF</a:calendar-color>' +
    '</d:prop></d:set></c:mkcalendar>';
  const made = await caldav(created, auth, 'MKCALENDAR', undefined, mkBody);
  if (made.status !== 201 && made.status !== 204) {
    throw new Error(`Apple could not create the SupplierAdvisor calendar (HTTP ${made.status})`);
  }
  return { calendarHref: ensureSlash(created) };
}

function reportBody(from: string, to: string): string {
  const start = from.replace(/-/g, '') + 'T000000Z';
  const end = to.replace(/-/g, '') + 'T235959Z';
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop>' +
    '<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
    `<c:time-range start="${start}" end="${end}"/>` +
    '</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>'
  );
}

function tagInner(xml: string, tag: string): string {
  const match = new RegExp(`<(?:[A-Za-z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${tag}>`, 'i').exec(xml);
  return match ? match[1].trim() : '';
}

function eventHref(calendarHref: string, uid: string): string {
  return new URL(`${encodeURIComponent(uid)}.ics`, ensureSlash(calendarHref)).toString();
}

export function appleClient(appleId: string, appPassword: string, calendarHref: string, profileId: number): CalendarClient {
  const auth = basicAuth(appleId, appPassword);
  const href = ensureSlash(calendarHref);
  return {
    async listEvents(from, to) {
      const report = await caldav(href, auth, 'REPORT', 1, reportBody(from, to));
      if (report.status === 401 || report.status === 403) {
        throw new Error('Apple rejected that Apple ID or app-specific password');
      }
      if (report.status >= 400) throw new Error('Apple could not list the SupplierAdvisor calendar');
      const chunks = report.text.split(/<(?:[A-Za-z0-9]+:)?response\b/i).slice(1);
      const events = [];
      for (const chunk of chunks) {
        const remoteId = firstXmlHref(chunk);
        const ics = tagInner(chunk, 'calendar-data');
        const parsed = parseIcsEvents(ics)[0];
        if (!remoteId || !parsed) continue;
        const etag = tagInner(chunk, 'getetag') || null;
        events.push({
          remoteId: resolveHref(report.url, remoteId),
          etag,
          key: parsed.key,
          title: parsed.title,
          date: parsed.date,
          start: parsed.start,
          end: parsed.end,
          notes: parsed.notes,
          status: parsed.status,
          updatedAt: parsed.updatedAt,
        });
      }
      return events;
    },
    async upsertEvent(item, remoteId) {
      const start = item.start || '09:00';
      const uid = eventUid(profileId, item.key);
      const target = remoteId || eventHref(href, uid);
      const body = buildIcsCalendar(
        [
          {
            id: `sa-${profileId}-${item.key}`,
            title: item.title,
            description: item.notes,
            date: item.date,
            start_time: start,
            end_time: endAfter(start, item.end),
            status: item.status === 'done' ? 'CANCELLED' : 'CONFIRMED',
            xProps: { 'X-SA-KEY': item.key },
            tzid: 'Africa/Johannesburg',
          },
        ],
        { calName: DIARY_CALENDAR_NAME, prodId: '-//SupplierAdvisor//Sales Diary//EN' }
      );
      const saved = await caldav(target, auth, 'PUT', undefined, body);
      if (saved.status === 401 || saved.status === 403) {
        throw new Error('Apple rejected that Apple ID or app-specific password');
      }
      if (saved.status >= 400) throw new Error('Apple could not save the diary event');
      return { remoteId: target, etag: saved.etag };
    },
    async deleteEvent(remoteId) {
      const saved = await caldav(remoteId, auth, 'DELETE', undefined);
      if (saved.status === 404 || saved.status === 204 || saved.status === 200) return;
      if (saved.status >= 400) throw new Error('Apple could not remove the diary event');
    },
  };
}
