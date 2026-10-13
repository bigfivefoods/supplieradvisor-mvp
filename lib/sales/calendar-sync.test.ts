import assert from 'node:assert/strict';
import { buildIcsCalendar } from '../schedule/advisor-ics';
import {
  calendarCollections,
  calendarHrefs,
  contentStamp,
  decodeCalendarData,
  endAfter,
  firstXmlHref,
  xmlPropHref,
  parseIcsEvents,
  partsInJohannesburg,
  reconcile,
  remoteIsNewer,
  saKeyFromText,
  type BindingRow,
  type DiaryStamp,
  type RemoteEvent,
} from './calendar-sync';

const from = '2026-08-01';
const to = '2027-11-01';

function item(over: Partial<DiaryStamp> & Pick<DiaryStamp, 'key'>): DiaryStamp {
  return {
    title: 'Call the buyer',
    date: '2026-10-20',
    start: '09:00',
    end: '09:30',
    notes: '',
    status: 'open',
    updatedAt: '2026-10-12T08:00:00.000Z',
    ...over,
  };
}

function remote(over: Partial<RemoteEvent> & Pick<RemoteEvent, 'remoteId'>): RemoteEvent {
  return {
    etag: 'e1',
    key: 'task-1',
    title: 'Call the buyer',
    date: '2026-10-20',
    start: '09:00',
    end: '09:30',
    notes: '',
    status: 'open',
    updatedAt: '2026-10-12T08:00:00.000Z',
    ...over,
  };
}

function binding(local: DiaryStamp, remoteId = 'g1'): BindingRow {
  return { localKey: local.key, remoteId, snapshot: contentStamp(local), etag: 'e1' };
}

function ops(local: DiaryStamp[], remoteEvents: RemoteEvent[], bindings: BindingRow[], window = { from, to }) {
  return reconcile({ local, remote: remoteEvents, bindings, ...window }).map((action) => action.op);
}

const open = item({ key: 'task-1' });

const created = reconcile({ local: [open], remote: [], bindings: [], from, to });
assert.equal(created.length, 1);
assert.equal(created[0].op, 'push');
assert.equal(created[0].op === 'push' ? created[0].remoteId : 'set', undefined);

const changedRemote = remote({ remoteId: 'g1', title: 'Call tomorrow', updatedAt: '2026-10-12T09:00:00.000Z' });
const remoteOnly = reconcile({ local: [open], remote: [changedRemote], bindings: [binding(open)], from, to });
assert.equal(remoteOnly[0].op, 'pull');
assert.equal(remoteOnly[0].op === 'pull' && remoteOnly[0].item.title, 'Call tomorrow');

const edited = item({ key: 'task-1', title: 'Call tomorrow', updatedAt: '2026-10-12T10:00:00.000Z' });
const localOnly = reconcile({ local: [edited], remote: [remote({ remoteId: 'g1' })], bindings: [binding(open)], from, to });
assert.equal(localOnly[0].op, 'push');
assert.equal(localOnly[0].op === 'push' && localOnly[0].remoteId, 'g1');

const bothRemote = reconcile({
  local: [edited],
  remote: [remote({ remoteId: 'g1', title: 'Their title', notes: 'from them', updatedAt: '2026-10-12T11:00:00.000Z' })],
  bindings: [binding(open)],
  from,
  to,
});
assert.equal(bothRemote[0].op, 'pull');
assert.equal(bothRemote[0].op === 'pull' && bothRemote[0].item.title, 'Their title');

const bothLocal = reconcile({
  local: [item({ key: 'task-1', title: 'Ours', updatedAt: '2026-10-12T12:00:00.000Z' })],
  remote: [remote({ remoteId: 'g1', title: 'Theirs', updatedAt: '2026-10-12T09:00:00.000Z' })],
  bindings: [binding(open)],
  from,
  to,
});
assert.equal(bothLocal[0].op, 'push');

const imported = reconcile({
  local: [],
  remote: [remote({ remoteId: 'new', key: null, title: 'Added in Google' })],
  bindings: [],
  from,
  to,
});
assert.equal(imported[0].op, 'import');

const missing = reconcile({ local: [open], remote: [], bindings: [binding(open)], from, to });
assert.equal(missing[0].op, 'complete-local');

assert.deepEqual(ops([item({ key: 'task-9', status: 'done' })], [], []), []);

const same = remote({ remoteId: 'g1' });
assert.deepEqual(ops([open], [same], [binding(open)]), []);

const orphan = reconcile({
  local: [],
  remote: [remote({ remoteId: 'gone', key: 'task-4' })],
  bindings: [],
  from,
  to,
});
assert.equal(orphan[0].op, 'delete-remote');
assert.equal(orphan[0].op === 'delete-remote' && orphan[0].localKey, 'task-4');

const outside = item({ key: 'task-1', date: '2020-01-01', title: 'Moved' });
const outsideActions = reconcile({
  local: [outside],
  remote: [],
  bindings: [binding(open, 'g1')],
  from,
  to,
});
assert.equal(outsideActions[0].op, 'push');
assert.equal(outsideActions[0].op === 'push' && outsideActions[0].remoteId, 'g1');
const outsideSame = item({ key: 'task-1', date: '2020-01-01' });
assert.deepEqual(
  ops([outsideSame], [], [{ ...binding(open), snapshot: contentStamp(outsideSame) }], { from, to }),
  []
);

const reopened = item({ key: 'task-1', status: 'open', updatedAt: '2026-10-13T08:00:00.000Z' });
const reopen = reconcile({
  local: [reopened],
  remote: [],
  bindings: [binding(item({ key: 'task-1', status: 'done' }))],
  from,
  to,
});
assert.equal(reopen[0].op, 'push');
assert.equal(reopen[0].op === 'push' && reopen[0].remoteId, 'g1');

const doneLocal = item({ key: 'task-1', status: 'done', updatedAt: '2026-10-13T08:00:00.000Z' });
const pushDone = reconcile({
  local: [doneLocal],
  remote: [remote({ remoteId: 'g1' })],
  bindings: [binding(open)],
  from,
  to,
});
assert.equal(pushDone[0].op, 'push');

const emptyRemoteTime = reconcile({
  local: [edited],
  remote: [remote({ remoteId: 'g1', title: 'Theirs', updatedAt: '' })],
  bindings: [binding(open)],
  from,
  to,
});
assert.equal(emptyRemoteTime[0].op, 'push');

assert.deepEqual(
  ops([], [remote({ remoteId: 'cancelled', key: null, status: 'done', title: 'Old' })], []),
  []
);

assert.equal(remoteIsNewer('', '2026-10-12T08:00:00.000Z'), false);
assert.equal(remoteIsNewer('2026-10-12T10:00:00.000Z', '2026-10-12T08:00:00+00:00'), true);
assert.equal(endAfter('09:00', '09:30'), '09:30');
assert.equal(endAfter('09:00', '09:00'), '09:30');
assert.equal(endAfter('23:50', ''), '23:59');
assert.deepEqual(partsInJohannesburg('2026-10-12T07:00:00Z'), { date: '2026-10-12', time: '09:00' });
assert.equal(saKeyFromText('sa-102-task-4@supplieradvisor'), 'task-4');
assert.equal(saKeyFromText('SA-KEY:next-8'), 'next-8');

const ics = buildIcsCalendar(
  [
    {
      id: 'sa-102-task-4',
      title: 'Call',
      description: 'Bring the\nprice',
      date: '2026-10-20',
      start_time: '09:00',
      end_time: '09:30',
      status: 'CANCELLED',
      xProps: { 'X-SA-KEY': 'task-4' },
      tzid: 'Africa/Johannesburg',
    },
  ],
  { calName: 'SupplierAdvisor' }
);
assert.match(ics, /DTSTART;TZID=Africa\/Johannesburg:20261020T090000/);
assert.match(ics, /BEGIN:VTIMEZONE/);
const parsed = parseIcsEvents(ics);
assert.equal(parsed[0].key, 'task-4');
assert.equal(parsed[0].status, 'done');
assert.equal(parsed[0].date, '2026-10-20');
assert.equal(parsed[0].start, '09:00');
assert.equal(parsed[0].notes, 'Bring the\nprice');

const utc = parseIcsEvents(
  'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:sa-102-close-3@supplieradvisor\nDTSTART:20261012T070000Z\nDTEND:20261012T073000Z\nSUMMARY:Close · Palm\nLAST-MODIFIED:20261012T060000Z\nEND:VEVENT\nEND:VCALENDAR\n'
);
assert.equal(utc[0].key, 'close-3');
assert.equal(utc[0].date, '2026-10-12');
assert.equal(utc[0].start, '09:00');
assert.equal(utc[0].updatedAt, '2026-10-12T06:00:00Z');

const xml =
  '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">' +
  '<d:response><d:href>/102/calendars/home/</d:href><d:propstat><d:prop><d:displayname>Home</d:displayname></d:prop></d:propstat></d:response>' +
  '<d:response><d:href>/102/calendars/SupplierAdvisor/</d:href><d:propstat><d:prop><d:displayname>SupplierAdvisor</d:displayname></d:prop></d:propstat></d:response>' +
  '</d:multistatus>';
assert.equal(firstXmlHref(xml), '/102/calendars/home/');
const principalXml =
  '<multistatus xmlns="DAV:"><response><href>/</href><propstat><prop>' +
  '<current-user-principal xmlns="DAV:"><href xmlns="DAV:">/200385701/principal/</href></current-user-principal>' +
  '</prop></propstat></response></multistatus>';
const homeXml =
  '<multistatus xmlns="DAV:"><response><href>/200385701/principal/</href><propstat><prop>' +
  '<calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav">' +
  '<href xmlns="DAV:">https://p34-caldav.icloud.com:443/200385701/calendars/</href>' +
  '</calendar-home-set></prop></propstat></response></multistatus>';
const namedXml =
  '<multistatus xmlns="DAV:"><response><href xmlns="DAV:">/200385701/calendars/abc/</href><propstat><prop>' +
  '<displayname xmlns="DAV:">SupplierAdvisor</displayname></prop></propstat></response></multistatus>';
assert.equal(calendarHrefs(namedXml)[0].name, 'SupplierAdvisor');
assert.equal(xmlPropHref(principalXml, 'current-user-principal'), '/200385701/principal/');
assert.equal(
  xmlPropHref(homeXml, 'calendar-home-set'),
  'https://p34-caldav.icloud.com:443/200385701/calendars/'
);
assert.equal(xmlPropHref(principalXml, 'calendar-home-set'), null);
assert.deepEqual(calendarHrefs(xml), [
  { href: '/102/calendars/home/', name: 'Home' },
  { href: '/102/calendars/SupplierAdvisor/', name: 'SupplierAdvisor' },
]);

const homeListing =
  '<multistatus xmlns="DAV:"><response><href>/2236/calendars/</href><propstat><prop>' +
  '<resourcetype><collection/></resourcetype><displayname>calendars</displayname></prop></propstat></response>' +
  '<response><href xmlns="DAV:">/2236/calendars/home/</href><propstat><prop>' +
  '<displayname xmlns="DAV:">Home</displayname>' +
  '<resourcetype><collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/></resourcetype>' +
  '</prop></propstat></response></multistatus>';
assert.deepEqual(calendarCollections(homeListing), [{ href: '/2236/calendars/home/', name: 'Home' }]);

const escaped = decodeCalendarData(
  '<![CDATA[BEGIN:VCALENDAR&#13;BEGIN:VEVENT&#13;UID:abc&#13;DTSTART:20261020T090000&#13;SUMMARY:Site visit&#13;END:VEVENT&#13;END:VCALENDAR]]>'
);
assert.equal(parseIcsEvents(escaped)[0].title, 'Site visit');
assert.equal(parseIcsEvents(escaped)[0].date, '2026-10-20');
assert.equal(parseIcsEvents(escaped)[0].start, '09:00');

console.log('calendar-sync tests ok');
