/**
 * Pure two-way diary reconcile. Network providers live beside this file.
 * A connected account gets a calendar named SupplierAdvisor. That calendar writes both ways.
 * Other Apple calendars are copied onto the connected user's diary only.
 */

export const DIARY_TIMEZONE = 'Africa/Johannesburg';
export const DIARY_CALENDAR_NAME = 'SupplierAdvisor';

export type DiaryStamp = {
  key: string;
  title: string;
  date: string;
  start: string;
  end: string;
  notes: string;
  status: 'open' | 'done';
  updatedAt: string;
};

export type RemoteEvent = {
  remoteId: string;
  etag: string | null;
  key: string | null;
  title: string;
  date: string;
  start: string;
  end: string;
  notes: string;
  status: 'open' | 'done';
  updatedAt: string;
};

export type BindingRow = {
  localKey: string;
  remoteId: string;
  snapshot: string;
  etag: string | null;
};

export type SyncAction =
  | { op: 'push'; item: DiaryStamp; remoteId?: string; etag: string | null }
  | { op: 'pull'; item: DiaryStamp; remoteId: string; etag: string | null }
  | { op: 'import'; remote: RemoteEvent }
  | { op: 'complete-local'; localKey: string; remoteId: string }
  | { op: 'delete-remote'; remoteId: string; etag: string | null; localKey: string };

export function contentStamp(
  item: Pick<DiaryStamp, 'title' | 'date' | 'start' | 'end' | 'status' | 'notes'>
): string {
  const clean = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();
  return [clean(item.title), item.date, item.start, item.end, item.status, clean(item.notes)].join('\n');
}

/** Empty or unparseable remote times lose to a real local timestamp. Equal times count as remote-newer so the binding settles. */
export function remoteIsNewer(remoteAt: string, localAt: string): boolean {
  const remote = Date.parse(remoteAt);
  const local = Date.parse(localAt);
  if (Number.isNaN(remote)) return false;
  if (Number.isNaN(local)) return true;
  return remote >= local;
}

function snapshotStatus(snapshot: string): 'open' | 'done' | '' {
  const status = snapshot.split('\n')[4] || '';
  return status === 'open' || status === 'done' ? status : '';
}

export function inWindow(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Johannesburg wall time as an ISO string with a fixed +02:00 offset. SAST has no daylight saving. */
export function johannesburgIso(date: string, time: string): string {
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  return `${date.slice(0, 10)}T${hhmm}:00+02:00`;
}

export function partsInJohannesburg(value: string): { date: string; time: string } | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, time: '09:00' };
  const stamp = new Date(raw);
  if (Number.isNaN(stamp.getTime())) return null;
  const shifted = new Date(stamp.getTime() + 2 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`,
    time: `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}`,
  };
}

export function saKeyFromText(value: string | null | undefined): string | null {
  const text = String(value || '');
  const tagged = /(?:^|\n)SA-KEY:([A-Za-z0-9_-]+)/.exec(text);
  if (tagged) return tagged[1];
  const uid = /sa-\d+-([A-Za-z]+-\d+)@supplieradvisor/.exec(text);
  return uid ? uid[1] : null;
}

export function stripSaKey(notes: string): string {
  return notes
    .replace(/(?:^|\n)SA-KEY:[A-Za-z0-9_-]+\n?/, '')
    .trim();
}

export function eventUid(profileId: number, key: string): string {
  return `sa-${profileId}-${key}@supplieradvisor`;
}

export function endAfter(start: string, end: string): string {
  if (/^\d{2}:\d{2}$/.test(end) && end > start) return end;
  const [h, m] = (start || '09:00').split(':').map(Number);
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + 30);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function remoteAsStamp(remote: RemoteEvent, key: string): DiaryStamp {
  return {
    key,
    title: remote.title,
    date: remote.date,
    start: remote.start,
    end: remote.end,
    notes: stripSaKey(remote.notes),
    status: remote.status,
    updatedAt: remote.updatedAt,
  };
}

export function reconcile(opts: {
  local: DiaryStamp[];
  remote: RemoteEvent[];
  bindings: BindingRow[];
  from: string;
  to: string;
}): SyncAction[] {
  const actions: SyncAction[] = [];
  const localByKey = new Map(opts.local.map((item) => [item.key, item]));
  const bindingByKey = new Map(opts.bindings.map((row) => [row.localKey, row]));
  const bindingByRemote = new Map(opts.bindings.map((row) => [row.remoteId, row]));
  const remoteById = new Map(opts.remote.map((event) => [event.remoteId, event]));
  const remoteByKey = new Map<string, RemoteEvent>();
  for (const event of opts.remote) {
    if (event.key && !remoteByKey.has(event.key)) remoteByKey.set(event.key, event);
  }

  for (const item of opts.local) {
    const binding = bindingByKey.get(item.key);
    const remote = (binding && remoteById.get(binding.remoteId)) || remoteByKey.get(item.key) || null;
    const localHash = contentStamp(item);
    if (!remote && !binding) {
      if (item.status === 'done') continue;
      actions.push({ op: 'push', item, etag: null });
      continue;
    }

    if (!remote && binding) {
      if (!inWindow(item.date, opts.from, opts.to)) {
        if (item.status === 'open' && localHash !== binding.snapshot) {
          actions.push({ op: 'push', item, remoteId: binding.remoteId, etag: binding.etag });
        }
        continue;
      }
      if (item.status === 'open' && snapshotStatus(binding.snapshot) === 'done') {
        actions.push({ op: 'push', item, remoteId: binding.remoteId, etag: binding.etag });
        continue;
      }
      if (item.status === 'open') {
        actions.push({ op: 'complete-local', localKey: item.key, remoteId: binding.remoteId });
      }
      continue;
    }

    if (!remote) continue;
    const remoteHash = contentStamp(remoteAsStamp(remote, item.key));
    const snapshot = binding?.snapshot;
    const etag = remote.etag;

    if (!binding) {
      if (remoteHash === localHash) {
        actions.push({ op: 'pull', item, remoteId: remote.remoteId, etag });
      } else if (remoteIsNewer(remote.updatedAt, item.updatedAt)) {
        actions.push({
          op: 'pull',
          item: remoteAsStamp(remote, item.key),
          remoteId: remote.remoteId,
          etag,
        });
      } else {
        actions.push({ op: 'push', item, remoteId: remote.remoteId, etag });
      }
      continue;
    }

    if (localHash === snapshot && remoteHash === snapshot) continue;
    if (localHash !== snapshot && remoteHash === snapshot) {
      actions.push({ op: 'push', item, remoteId: remote.remoteId, etag });
      continue;
    }
    if (remoteHash !== snapshot && localHash === snapshot) {
      actions.push({
        op: 'pull',
        item: remoteAsStamp(remote, item.key),
        remoteId: remote.remoteId,
        etag,
      });
      continue;
    }
    if (remoteIsNewer(remote.updatedAt, item.updatedAt)) {
      actions.push({
        op: 'pull',
        item: remoteAsStamp(remote, item.key),
        remoteId: remote.remoteId,
        etag,
      });
    } else {
      actions.push({ op: 'push', item, remoteId: remote.remoteId, etag });
    }
  }

  for (const event of opts.remote) {
    if (bindingByRemote.has(event.remoteId)) continue;
    if (event.key && localByKey.has(event.key)) continue;
    if (event.key) {
      actions.push({
        op: 'delete-remote',
        remoteId: event.remoteId,
        etag: event.etag,
        localKey: event.key,
      });
      continue;
    }
    if (event.status === 'done' || !event.title.trim()) continue;
    if (!inWindow(event.date, opts.from, opts.to)) continue;
    actions.push({ op: 'import', remote: event });
  }

  return actions;
}

function unfoldIcs(ics: string): string {
  return ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function icsValue(block: string, name: string): string {
  const match = new RegExp(`(?:^|\\n)${name}(?:;[^:\\n]*)?:([^\\n]*)`).exec(block);
  return match ? match[1].replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim() : '';
}

function icsClock(raw: string): { date: string; time: string; utc: boolean } | null {
  const compact = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(?:\d{2})?)?(Z)?/.exec(raw.trim());
  if (!compact) return null;
  return {
    date: `${compact[1]}-${compact[2]}-${compact[3]}`,
    time: compact[4] ? `${compact[4]}:${compact[5]}` : '09:00',
    utc: compact[6] === 'Z',
  };
}

/** Event times that arrive in UTC are shifted to Johannesburg. Floating and TZID values stay as wall time. */
function icsWall(raw: string): { date: string; time: string } | null {
  const clock = icsClock(raw);
  if (!clock) return null;
  if (clock.utc && raw.includes('T')) return partsInJohannesburg(`${clock.date}T${clock.time}:00Z`);
  return { date: clock.date, time: clock.time };
}

/** Read VEVENT blocks written by this app or by Apple/Google. */
export function parseIcsEvents(ics: string): Array<Omit<RemoteEvent, 'remoteId' | 'etag'> & { uid: string }> {
  const text = unfoldIcs(ics);
  const blocks = text.split('BEGIN:VEVENT').slice(1);
  const out: Array<Omit<RemoteEvent, 'remoteId' | 'etag'> & { uid: string }> = [];
  for (const chunk of blocks) {
    const block = chunk.split('END:VEVENT')[0] || '';
    const start = icsWall(icsValue(block, 'DTSTART'));
    if (!start) continue;
    const end = icsWall(icsValue(block, 'DTEND'));
    const notes = icsValue(block, 'DESCRIPTION');
    const uid = icsValue(block, 'UID');
    const key = icsValue(block, 'X-SA-KEY') || saKeyFromText(notes) || saKeyFromText(uid);
    const modified = icsClock(icsValue(block, 'LAST-MODIFIED'));
    const when = modified ? { date: modified.date, time: modified.time } : null;
    out.push({
      uid,
      key,
      title: icsValue(block, 'SUMMARY') || 'Busy',
      date: start.date,
      start: start.time,
      end: end?.time || start.time,
      notes: stripSaKey(notes),
      status: icsValue(block, 'STATUS').toUpperCase() === 'CANCELLED' ? 'done' : 'open',
      updatedAt: when ? `${when.date}T${when.time}:00Z` : '',
    });
  }
  return out;
}

export function firstXmlHref(xml: string): string | null {
  const match = /<(?:[A-Za-z0-9]+:)?href\b[^>]*>([^<]+)<\/(?:[A-Za-z0-9]+:)?href>/i.exec(xml);
  return match ? decodeXml(match[1].trim()) : null;
}

/** Href nested inside one property. The first href in a PROPFIND body is the resource itself. */
export function xmlPropHref(xml: string, prop: string): string | null {
  const match = new RegExp(
    `<(?:[A-Za-z0-9]+:)?${prop}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${prop}>`,
    'i'
  ).exec(xml);
  return match ? firstXmlHref(match[1]) : null;
}

/** Turn a CalDAV calendar-data body into ICS text. Apple often sends `&#13;` line breaks. */
export function decodeCalendarData(raw: string): string {
  let text = String(raw || '').trim();
  const wrapped = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(text);
  if (wrapped) text = wrapped[1];
  return text
    .replace(/&#(\d+);/g, (_, digits) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Calendars in a Depth-1 home listing. The home collection itself is not one of them. */
export function calendarCollections(xml: string): { href: string; name: string }[] {
  const chunks = xml.split(/<(?:[A-Za-z0-9]+:)?response\b/i).slice(1);
  const out: { href: string; name: string }[] = [];
  for (const chunk of chunks) {
    const href = firstXmlHref(chunk);
    const typeMatch = /<(?:[A-Za-z0-9]+:)?resourcetype\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9]+:)?resourcetype>/i.exec(
      chunk
    );
    const isCalendar = typeMatch ? /<(?:[A-Za-z0-9]+:)?calendar\b/i.test(typeMatch[1]) : false;
    if (!href || !isCalendar) continue;
    const nameMatch = /<(?:[A-Za-z0-9]+:)?displayname\b[^>]*>([^<]*)<\//i.exec(chunk);
    out.push({ href, name: nameMatch ? decodeXml(nameMatch[1].trim()) : '' });
  }
  return out;
}

export function calendarHrefs(xml: string): { href: string; name: string }[] {
  const chunks = xml.split(/<(?:[A-Za-z0-9]+:)?response\b/i).slice(1);
  const out: { href: string; name: string }[] = [];
  for (const chunk of chunks) {
    const href = firstXmlHref(chunk);
    const nameMatch = /<(?:[A-Za-z0-9]+:)?displayname\b[^>]*>([^<]*)<\//i.exec(chunk);
    if (!href) continue;
    out.push({ href, name: nameMatch ? decodeXml(nameMatch[1].trim()) : '' });
  }
  return out;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}
