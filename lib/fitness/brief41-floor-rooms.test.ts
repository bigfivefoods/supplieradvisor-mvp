/**
 * Brief 41 — GymAdvisor Floor Rooms desk smoke test.
 * Run: npx --yes tsx lib/fitness/brief41-floor-rooms.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 1. module-nav includes Rooms under Floor section
const nav = readFileSync(resolve('lib/chrome/module-nav.ts'), 'utf8');
assert.match(nav, /\/dashboard\/fitgraph\/rooms/);
const roomsEntry = nav.match(/\{[^}]*\/dashboard\/fitgraph\/rooms[^}]*\}/s)?.[0] ?? '';
assert.match(roomsEntry, /section:\s*['"]Floor['"]/);

// 2. rooms page imports AdvisorRoomsCard
const roomsPage = readFileSync(resolve('app/dashboard/fitgraph/rooms/page.tsx'), 'utf8');
assert.match(roomsPage, /AdvisorRoomsCard/);
assert.match(roomsPage, /update_settings/);
assert.match(roomsPage, /settings\?\.rooms/);

// 3. calendar no longer points at Website for room list
const calPage = readFileSync(resolve('app/dashboard/fitgraph/calendar/page.tsx'), 'utf8');
assert.doesNotMatch(calPage, /set list under Website/);
assert.match(calPage, /Floor/);

// 4. website page passes manageHref to AdvisorRoomsCard
const websitePage = readFileSync(resolve('app/dashboard/fitgraph/website/page.tsx'), 'utf8');
assert.match(websitePage, /manageHref.*\/dashboard\/fitgraph\/rooms/);

console.log('brief41-floor-rooms.test.ts ok');
