/**
 * Gym calendar delete must tombstone sessions so merge cannot resurrect them.
 * Run: npx --yes tsx lib/fitness/gym-calendar-delete.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve('app/api/fitness/fitgraph/route.ts'), 'utf8');
const deleteBlock = route.split("action === 'delete'")[1] || '';
assert.match(deleteBlock, /rememberRemovedFitgraphIds/);
assert.match(deleteBlock, /delete_series/);
assert.match(deleteBlock, /store\.sessions = store\.sessions\.filter/);

const merge = readFileSync(resolve('lib/fitness/fitgraph-merge.ts'), 'utf8');
assert.match(merge, /removed_ids/);
assert.match(merge, /rememberRemovedFitgraphIds/);

const cal = readFileSync(
  resolve('app/dashboard/fitgraph/calendar/page.tsx'),
  'utf8'
);
assert.match(cal, /removed_ids\?\.sessions/);
assert.match(cal, /delete_series/);
assert.match(cal, /sessionRosterNames/);
assert.match(cal, /names\.join\(', '\)/);
assert.match(
  route,
  /stampCatalogSeriesAndBookSubscribers\(store, \[row\]/
);

const shell = readFileSync(resolve('components/chrome/AppShell.tsx'), 'utf8');
assert.match(
  shell,
  /overflow-y-auto min-h-0 overscroll-contain scrollbar-none">\s*<Sidebar forceExpanded/
);

const sidebar = readFileSync(resolve('components/Sidebar.tsx'), 'utf8');
assert.match(sidebar, /router\.push\(mod\.href\)/);
assert.match(sidebar, /if \(prev\[mod\.id\]\) return prev/);

console.log('gym-calendar-delete.test.ts ok');
