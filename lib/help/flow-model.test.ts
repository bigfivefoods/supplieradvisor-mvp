/**
 * Process diagrams: edges, decisions, anchors, and a wrapping layout.
 * Run: npx --yes tsx lib/help/flow-model.test.ts
 */
import assert from 'node:assert/strict';
import { MODULE_GUIDES, getModuleGuide } from '@/lib/help/module-guides';
import {
  boxesOverlap,
  branchDetails,
  classifyEdges,
  collapseAllStages,
  columnsForWidth,
  expandAllStages,
  flowErrors,
  flowLanes,
  flowStages,
  initialOpenStages,
  layoutFlow,
  missingStageIds,
  needsFlowStages,
  resolveEdges,
  bookLines,
  toggleId,
  toggleOpenNode,
  whoChips,
} from '@/lib/help/flow-model';

for (const guide of MODULE_GUIDES) {
  const errors = flowErrors(guide, { requireAnchor: true, requireIcon: true });
  assert.deepEqual(errors, [], `${guide.id}: ${errors.join('; ')}`);
  assert.ok(guide.flow.length > 0, `${guide.id} flow`);
}

const finance = getModuleGuide('accounting');
assert.ok(finance);
const strict = flowErrors(finance, { requireAnchor: true, requireIcon: true });
assert.deepEqual(strict, [], strict.join('; '));
assert.deepEqual(flowLanes(finance.flow), ['Owner · Finance', 'System']);

const edges = resolveEdges(finance.flow, finance.edges);
const { forward, back } = classifyEdges(finance.flow, edges);
const backPairs = back.map((edge) => `${edge.from}->${edge.to}`);
assert.ok(backPairs.includes('balanced->draft'), 'save draft returns to Draft');
assert.ok(backPairs.includes('allocate->line'), 'unallocate returns to the line');
assert.ok(backPairs.includes('review->vat201'), 'an unreviewed VAT201 stays draft');
assert.ok(forward.some((edge) => edge.from === 'review' && edge.to === 'lock'));
assert.ok(forward.some((edge) => edge.from === 'po-allocated' && edge.to === 'skip-bill'));
assert.ok(forward.some((edge) => edge.from === 'po-allocated' && edge.to === 'recognise'));

const blob = JSON.stringify(finance.flow);
assert.match(blob, /po_already_allocated/);
assert.match(blob, /Locked by VAT201 review/);
assert.match(blob, /invoice_recognition/);
assert.match(blob, /invoice_settlement/);
assert.match(blob, /1130/);
assert.match(blob, /1140/);
assert.match(blob, /2125/);
assert.equal(blob.includes('Kwaden'), false);
assert.equal(/Acme|Harbour/i.test(blob), false);

for (const width of [768, 960, 1200]) {
  const laid = layoutFlow({ nodes: finance.flow, edges: finance.edges, width });
  assert.equal(laid.boxes.length, finance.flow.length, `placed ${width}`);
  assert.ok(laid.columns >= 2, `wraps at ${width} (${laid.columns})`);
  assert.ok(laid.boxes.some((box) => box.band > 0), `snakes at ${width}`);
  assert.equal(laid.showLanes, true);
  for (const box of laid.boxes) {
    assert.ok(box.x >= 0 && box.y >= 0, box.id);
    assert.ok(box.x + box.w <= width + 1, `${box.id} overflows ${width}`);
    assert.ok(box.y + box.h <= laid.height + 1, box.id);
  }
  for (let i = 0; i < laid.boxes.length; i += 1) {
    for (let j = i + 1; j < laid.boxes.length; j += 1) {
      assert.equal(
        boxesOverlap(laid.boxes[i], laid.boxes[j]),
        false,
        `${laid.boxes[i].id} overlaps ${laid.boxes[j].id} at ${width}`
      );
    }
  }
  for (const route of laid.routes) {
    assert.match(route.d, /^M /);
    assert.ok(finance.flow.some((node) => node.id === route.from));
    assert.ok(finance.flow.some((node) => node.id === route.to));
  }
}

const linear = getModuleGuide('home');
assert.ok(linear);
assert.equal(linear.edges, undefined);
assert.equal(resolveEdges(linear.flow).length, Math.max(0, linear.flow.length - 1));
assert.ok(columnsForWidth(960, false) >= 3);

const broken = flowErrors({
  id: 'sample',
  flow: [
    { id: 'a', label: 'A', kind: 'decision', anchor: 'missing' },
    { id: 'a', label: 'Again' },
  ],
  edges: [{ from: 'a', to: 'nope' }],
  features: [{ id: 'real' } as never],
});
assert.ok(broken.some((error) => error.includes('duplicate')));
assert.ok(broken.some((error) => error.includes('unknown node')));
assert.ok(broken.some((error) => error.includes('needs 2')));
assert.ok(broken.some((error) => error.includes('not a feature')));

for (const guide of MODULE_GUIDES) {
  if (!needsFlowStages(guide.flow)) continue;
  const missing = missingStageIds(guide.flow);
  assert.deepEqual(missing, [], `${guide.id} missing stages: ${missing.join(',')}`);
  const stages = flowStages(guide.flow);
  assert.ok(stages.length > 1, guide.id);
  assert.equal(initialOpenStages(stages).length, 1);
  assert.deepEqual(expandAllStages(stages), stages.map((stage) => stage.id));
  assert.deepEqual(collapseAllStages(), []);
  const opened = toggleId(initialOpenStages(stages), stages[1].id);
  assert.equal(opened.includes(stages[1].id), true);
  assert.equal(toggleId(opened, stages[1].id).includes(stages[1].id), false);
}

const financeStages = flowStages(finance.flow);
assert.deepEqual(
  financeStages.map((stage) => stage.title),
  [
    'Setup and journals',
    'Invoicing and settlement',
    'Bills and costs',
    'Bank and reconciliation',
    'VAT201',
    'Close and reporting',
  ]
);
assert.deepEqual(initialOpenStages(financeStages), ['setup-and-journals']);
const post = finance.flow.find((node) => node.id === 'post');
assert.ok(post?.posts && post.status && post.who);
const balanced = finance.flow.find((node) => node.id === 'balanced');
assert.ok(balanced);
const branches = branchDetails(balanced, resolveEdges(finance.flow, finance.edges), finance.flow);
assert.ok(branches.length >= 2);
assert.ok(branches.some((branch) => branch.label === 'Post'));
assert.ok(branches.some((branch) => branch.label === 'Save draft'));

assert.equal(toggleOpenNode(null, 'post'), 'post');
assert.equal(toggleOpenNode('post', 'invoice'), 'invoice');
assert.equal(toggleOpenNode('post', 'post'), null);
assert.deepEqual(whoChips(post), ['Owner', 'Finance']);
assert.ok(bookLines('Dr 1130, Cr 4100, Cr 2120').length >= 3);
assert.match(post.does || '', /Post entry/);
assert.match(post.posts || '', /Source manual/);
assert.match(post.status || '', /posted/);

const quality = getModuleGuide('quality');
assert.ok(quality);
assert.equal(needsFlowStages(quality.flow), false);
assert.equal(quality.flow.some((node) => node.kind === 'decision'), true);

console.log('flow-model.test.ts ok');
