/**
 * Run: npx --yes tsx lib/fitness/programme-follow.test.ts
 */
import assert from 'node:assert/strict';
import { upsertProgramme } from './movements';
import {
  blockCalendarDate,
  buildMemberProgrammeFollow,
  enrollClientOnProgramme,
  enrollmentProgress,
  fillWeeksFromWeek1,
  isoWeekdayMon1,
  mondayOfIso,
  upsertProgrammeLog,
} from './programme-follow';

assert.equal(isoWeekdayMon1('2026-08-19'), 3);
assert.equal(mondayOfIso('2026-08-19'), '2026-08-17');
assert.equal(
  blockCalendarDate('2026-08-19', { week: 2, weekday: 4 }),
  '2026-08-27'
);

const now = '2026-08-19T10:00:00.000Z';
let n = 0;
const newId = (p: string) => `${p}_${++n}`;

const programmes = [] as ReturnType<typeof upsertProgramme>[];
const prg = upsertProgramme(
  programmes,
  {
    id: 'prg_hyrox',
    name: 'Hyrox 6',
    weeks: 4,
    description: 'Build the engine',
    follow_notes: 'Train 4 days. Walk on rest days.',
    blocks: [
      {
        id: 'blk_w1_mon',
        week: 1,
        weekday: 1,
        title: 'Squat + engine',
        notes: 'Stay crisp on depth',
        items: [
          { movement_id: 'mov_1', sets: 4, reps: '6', rest_sec: 120 },
          { movement_id: 'mov_2', sets: 3, reps: '8' },
        ],
      },
      {
        id: 'blk_w1_wed',
        week: 1,
        weekday: 3,
        title: 'Hinge',
        items: [{ movement_id: 'mov_3', sets: 3, reps: '5' }],
      },
    ],
  },
  now,
  newId
);
assert.equal(prg.weeks, 4);
assert.equal(prg.blocks?.length, 2);
assert.equal(prg.items.length, 3);

const enrollments = [] as ReturnType<typeof enrollClientOnProgramme>[];
const en = enrollClientOnProgramme(
  enrollments,
  {
    client_id: 'cli_1',
    programme_id: 'prg_hyrox',
    coach_id: 'coh_1',
    source: 'purchased',
    start_date: '2026-08-19',
  },
  now,
  newId
);
assert.equal(enrollments.length, 1);
const en2 = enrollClientOnProgramme(
  enrollments,
  {
    client_id: 'cli_1',
    programme_id: 'prg_hyrox',
    start_date: '2026-08-24',
  },
  now,
  newId
);
assert.equal(enrollments.length, 1);
assert.equal(en2.id, en.id);
assert.equal(en2.start_date, '2026-08-24');

const logs = [] as ReturnType<typeof upsertProgrammeLog>[];
upsertProgrammeLog(
  logs,
  {
    enrollment_id: en.id,
    programme_id: 'prg_hyrox',
    client_id: 'cli_1',
    block_id: 'blk_w1_mon',
    date: '2026-08-24',
    status: 'done',
    feeling: 4,
    rpe: 7,
    comment: 'Knees felt good',
    item_checks: [
      { item_id: 'x', done: true },
      { item_id: 'y', done: true },
    ],
  },
  now,
  newId
);
upsertProgrammeLog(
  logs,
  {
    enrollment_id: en.id,
    block_id: 'blk_w1_mon',
    feeling: 5,
    coach_comment: 'Great depth today',
    by_role: 'coach',
  },
  now,
  newId
);
assert.equal(logs.length, 1);
assert.equal(logs[0].feeling, 5);
assert.equal(logs[0].rpe, 7);
assert.equal(logs[0].coach_comment, 'Great depth today');

const prog = enrollmentProgress(prg, logs);
assert.equal(prog.total, 2);
assert.equal(prog.done, 1);
assert.equal(prog.avg_feeling, 5);
assert.ok(prog.pct >= 50);

const follow = buildMemberProgrammeFollow(prg, en2, logs, {
  movements: [
    {
      id: 'mov_1',
      name: 'Back squat',
      created_at: now,
    },
  ],
  coachName: 'Sam',
  today: '2026-08-24',
});
assert.equal(follow.weeks, 4);
assert.equal(follow.days.length, 28);
const mon = follow.days.find((d) => d.week === 1 && d.weekday === 1);
assert.equal(mon?.date, '2026-08-24');
assert.equal(mon?.block?.items[0].movement?.name, 'Back squat');
assert.equal(mon?.log?.comment, 'Knees felt good');
assert.equal(follow.today?.block?.title, 'Squat + engine');
assert.equal(follow.recent_feedback[0].coach_comment, 'Great depth today');

const filled = fillWeeksFromWeek1(prg.blocks || [], 3, newId);
assert.equal(filled.filter((b) => b.week === 1).length, 2);
assert.equal(filled.filter((b) => b.week === 3).length, 2);
assert.ok(filled.every((b) => (b.items || []).length > 0 || b.week === 1));

console.log('programme-follow ok');
