/**
 * Run: npx --yes tsx lib/business/group-pipeline-view.test.ts
 */
import assert from 'node:assert/strict';
import {
  defaultGroupPipelineView,
  filterOpportunitiesByGroupView,
  summarizeGroupPipeline,
} from './group-pipeline-view';

const names = new Map([
  [10, 'Big Five Group'],
  [102, 'Big Five Foods'],
  [123, 'Big Five Foods Kenya'],
]);

const opps = [
  {
    source_company_id: 10,
    stage: 'prospecting',
    amount: 100,
    weighted_amount: 10,
  },
  {
    source_company_id: 102,
    stage: 'proposal',
    amount: 1000,
    weighted_amount: 600,
  },
  {
    source_company_id: 102,
    stage: 'closed_lost',
    amount: 50,
    weighted_amount: 0,
  },
  {
    source_company_id: 123,
    stage: 'negotiation',
    amount: 400,
    weighted_amount: 320,
  },
];

const group = summarizeGroupPipeline({
  viewerCompanyId: 10,
  names,
  companyIds: [10, 102, 123],
  opportunities: opps,
});

assert.equal(group.includesSubsidiaries, true);
assert.equal(group.viewerCompanyName, 'Big Five Group');
assert.equal(group.companies.length, 3);
assert.equal(group.companies[0].isViewer, true);
assert.equal(group.companies[1].name, 'Big Five Foods');
assert.equal(group.companies[1].dealCount, 2);
assert.equal(group.companies[1].openCount, 1);
assert.equal(group.companies[1].openAmount, 1000);
assert.equal(group.companies[2].openAmount, 400);

assert.equal(filterOpportunitiesByGroupView(opps, 'all').length, 4);
assert.equal(filterOpportunitiesByGroupView(opps, 102).length, 2);
assert.equal(filterOpportunitiesByGroupView(opps, 123).length, 1);

assert.equal(group.defaultView, 'all');
assert.equal(group.isSubsidiary, false);

const foods = summarizeGroupPipeline({
  viewerCompanyId: 102,
  names,
  companyIds: [102, 123],
  isSubsidiary: true,
  opportunities: opps,
});
assert.equal(foods.isSubsidiary, true);
assert.equal(foods.defaultView, 102);
assert.equal(
  defaultGroupPipelineView({
    isSubsidiary: true,
    viewerCompanyId: 102,
    includesSubsidiaries: true,
  }),
  102
);
assert.equal(
  defaultGroupPipelineView({
    isSubsidiary: false,
    viewerCompanyId: 10,
    includesSubsidiaries: true,
  }),
  'all'
);

console.log('group-pipeline-view.test.ts ok');
