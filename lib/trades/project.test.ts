/**
 * Run: npx --yes tsx lib/trades/project.test.ts
 */
import assert from 'node:assert/strict';
import { seedHarbourBook } from './harbour-seed';
import { applyTradeOp, customerPack } from './desk';
import { groupPhotos, projectFeed, projectHome } from './project';

const book = seedHarbourBook();
const home = projectHome(book, book.store.jobs[0]);
assert.equal(home.job.number, 'J-1808');
assert.ok(home.progress_pct > 0 && home.progress_pct < 100);
assert.equal(home.current_phase, 'Fit and test');
assert.equal(home.next_milestone, 'Compliance certificate');
assert.equal(home.status, 'behind');
assert.ok(home.variance_days > 0);
assert.match(home.reason, /Fit and test/);
assert.match(home.reason, /VO-001/);
assert.ok(home.latest);
assert.equal(home.latest.internal, false);
assert.notEqual(home.latest.id, 'tu_waste_private');

const client = projectFeed(book, 'tj_waste', 'client');
assert.ok(client.some((row) => row.id === 'tu_waste_shared'));
assert.equal(client.some((row) => row.id === 'tu_waste_private'), false);
assert.equal(client.some((row) => row.id === 'ph_private'), false);
assert.ok(client.some((row) => row.phase === 'during'));
assert.ok(client.some((row) => row.kind === 'variation'));
assert.ok(client.some((row) => row.kind === 'invoice'));

const desk = projectFeed(book, 'tj_waste', 'desk');
assert.ok(desk.some((row) => row.id === 'tu_waste_private' && row.internal));

const pack = customerPack(book, 'tc_naledi');
assert.equal(pack.programmes[0]?.photos.some((row) => row.id === 'ph_private'), false);
assert.equal(pack.jobs[0]?.updates.some((row) => row.id === 'tu_waste_private'), false);
assert.ok(pack.feed_replies.some((row) => row.comment.includes('knock')));

const groups = groupPhotos(pack.programmes[0]?.photos || []);
assert.ok(groups.length >= 2);
assert.ok(groups.some((day) => day.phases.some((phase) => phase.phase === 'before')));

const posted = applyTradeOp(
  book,
  { type: 'add_note', job_id: 'tj_waste', note: 'Floor is closed.', shared: true },
  '2026-10-14T12:00:00.000Z'
);
assert.equal(posted.notices[0]?.audience, 'customer');
assert.equal(posted.notices[0]?.title, 'Job update');

const quiet = applyTradeOp(
  book,
  { type: 'add_note', job_id: 'tj_waste', note: 'Price the joist later.', shared: false },
  '2026-10-14T12:00:00.000Z'
);
assert.equal(quiet.notices.length, 0);
assert.equal(
  customerPack(quiet.book, 'tc_naledi').jobs[0]?.updates.some((row) => row.note.includes('joist')),
  false
);

const reply = applyTradeOp(
  book,
  {
    type: 'feed_reply',
    job_id: 'tj_waste',
    target_id: 'tu_waste_shared',
    from: 'customer',
    author: 'Naledi',
    reaction: '👍',
  },
  '2026-10-14T12:05:00.000Z'
);
assert.equal(reply.notices[0]?.audience, 'desk');

console.log('project tests ok');
