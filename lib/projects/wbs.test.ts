/**
 * Run: npx --yes tsx lib/projects/wbs.test.ts
 */
import assert from 'node:assert/strict';
import {
  WBS_MAX_DEPTH,
  buildWbsTree,
  flattenWbs,
  rollupWbsDates,
  wbsDepthOf,
} from './wbs';

const tasks = [
  { id: 1, parent_task_id: null, start_date: '2026-08-01', due_date: '2026-08-10' },
  { id: 2, parent_task_id: 1, start_date: '2026-08-01', due_date: '2026-08-04' },
  { id: 3, parent_task_id: 1, start_date: '2026-08-05', due_date: '2026-08-12' },
  { id: 4, parent_task_id: 3, start_date: '2026-08-06', due_date: '2026-08-07' },
];

const tree = buildWbsTree(tasks);
assert.equal(tree.length, 1);
assert.equal(tree[0].id, 1);
assert.equal(tree[0].children.length, 2);
assert.equal(tree[0].children[1].children[0].id, 4);
assert.equal(tree[0].children[1].children[0].depth, 2);

const collapsed = flattenWbs(tree, new Set([1]));
assert.equal(collapsed.length, 1);

const expanded = flattenWbs(tree);
assert.equal(expanded.map((n) => n.id).join(','), '1,2,3,4');

rollupWbsDates(tree);
assert.equal(tree[0].start_date, '2026-08-01');
assert.equal(tree[0].due_date, '2026-08-12');

assert.equal(wbsDepthOf(tasks, 4), 2);
assert.equal(wbsDepthOf(tasks, 1), 0);
assert.ok(WBS_MAX_DEPTH >= 3);

console.log('wbs.test.ts ok');
