import assert from 'node:assert/strict';
import { buildDiaryFeedToken, diaryFeedLinks, parseDiaryFeedToken } from './diary-feed';

process.env.SALES_DIARY_FEED_SECRET = 'unit-test-diary-secret';
process.env.NEXT_PUBLIC_APP_URL = 'https://www.supplieradvisor.com';

const token = buildDiaryFeedToken(102);
assert.equal(parseDiaryFeedToken(token), 102);
assert.equal(parseDiaryFeedToken(`${token}x`), null);
assert.equal(parseDiaryFeedToken('s1.not-a-token.nope'), null);
assert.equal(buildDiaryFeedToken(102), token);

const links = diaryFeedLinks(102);
assert.ok(links);
assert.match(links.https, /^https:\/\/www\.supplieradvisor\.com\/api\/public\/sales\/diary\/ics\/s1\..+\.ics$/);
assert.equal(links.webcal, links.https.replace(/^https:/, 'webcal:'));
assert.equal(
  links.google,
  `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(links.webcal)}`
);
assert.match(links.outlook, /^https:\/\/outlook\.live\.com\/calendar\/0\/addfromweb\?url=/);
const pathToken = links.https.split('/').pop() || '';
assert.equal(parseDiaryFeedToken(decodeURIComponent(pathToken).replace(/\.ics$/, '')), 102);

console.log('sales/diary-feed.test.ts ok');
