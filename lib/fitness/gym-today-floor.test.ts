/**
 * Today's floor board: members under each class, earliest class first.
 * Run: npx --yes tsx lib/fitness/gym-today-floor.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyFitgraphStore } from './fitgraph';
import { gymTodayFloorClasses } from './gym-today-floor';

const store = emptyFitgraphStore();
store.class_types.push(
  {
    id: 'cls_boot',
    code: 'BOOT',
    name: 'Bootcamp',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cls_fsf',
    code: 'FSF',
    name: 'FSF',
    created_at: '2026-08-01T00:00:00.000Z',
  }
);
store.coaches.push({
  id: 'coh_pat',
  code: 'PAT',
  name: 'Pat',
  specialties: [],
  active: true,
  created_at: '2026-08-01T00:00:00.000Z',
});
store.clients.push(
  {
    id: 'cli_ada',
    code: 'A1',
    name: 'Ada',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cli_ben',
    code: 'B1',
    name: 'Ben',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cli_cara',
    code: 'C1',
    name: 'Cara',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  }
);
store.sessions.push(
  {
    id: 'ses_late',
    class_type_id: 'cls_boot',
    coach_id: 'coh_pat',
    date: '2026-08-31',
    start_time: '17:30',
    status: 'scheduled',
    location: 'Studio',
  },
  {
    id: 'ses_early',
    class_type_id: 'cls_fsf',
    coach_id: 'coh_pat',
    date: '2026-08-31',
    start_time: '05:00',
    status: 'scheduled',
    location: 'Park',
  },
  {
    id: 'ses_empty',
    class_type_id: 'cls_boot',
    coach_id: 'coh_pat',
    date: '2026-08-31',
    start_time: '06:00',
    status: 'scheduled',
  },
  {
    id: 'ses_cancel',
    class_type_id: 'cls_boot',
    date: '2026-08-31',
    start_time: '04:00',
    status: 'cancelled',
  },
  {
    id: 'ses_other_day',
    class_type_id: 'cls_fsf',
    date: '2026-09-01',
    start_time: '05:00',
    status: 'scheduled',
  }
);
store.bookings.push(
  {
    id: 'bkg_ben',
    session_id: 'ses_early',
    client_id: 'cli_ben',
    status: 'booked',
    booked_at: '2026-08-30T00:00:00.000Z',
  },
  {
    id: 'bkg_ada',
    session_id: 'ses_early',
    client_id: 'cli_ada',
    status: 'booked',
    booked_at: '2026-08-30T00:00:00.000Z',
  },
  {
    id: 'bkg_cara',
    session_id: 'ses_late',
    client_id: 'cli_cara',
    status: 'attended',
    booked_at: '2026-08-30T00:00:00.000Z',
  },
  {
    id: 'bkg_cancel',
    session_id: 'ses_early',
    client_id: 'cli_cara',
    status: 'cancelled',
    booked_at: '2026-08-30T00:00:00.000Z',
  }
);

const board = gymTodayFloorClasses(store, '2026-08-31');
assert.deepEqual(
  board.map((c) => `${c.time} ${c.title}`),
  ['05:00 FSF', '06:00 Bootcamp', '17:30 Bootcamp']
);
assert.deepEqual(
  board[0].members.map((m) => m.name),
  ['Ada', 'Ben']
);
assert.equal(board[1].members.length, 0);
assert.deepEqual(
  board[2].members.map((m) => m.name),
  ['Cara']
);
assert.equal(board[0].person, 'Pat');
assert.equal(board[0].meta, 'Park');

const hub = readFileSync(resolve('app/dashboard/fitgraph/page.tsx'), 'utf8');
assert.match(hub, /gymTodayFloorClasses/);
assert.match(hub, /Today's floor board/);
assert.match(hub, /groups=\{todayGroups\}/);

const boardSrc = readFileSync(
  resolve('components/services/AdvisorTodayBoard.tsx'),
  'utf8'
);
assert.match(boardSrc, /groups\?:/);
assert.match(boardSrc, /g\.members/);
assert.match(boardSrc, /aria-expanded/);
assert.match(boardSrc, /Coach ·/);
assert.match(boardSrc, /Expand all/);
assert.match(boardSrc, /FloorClassBlock/);

console.log('gym-today-floor.test.ts ok');
