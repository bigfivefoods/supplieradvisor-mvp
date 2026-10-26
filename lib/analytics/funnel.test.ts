/**
 * Run: npx --yes tsx lib/analytics/funnel.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstOptionalModule, sanitizeFunnelProps } from './funnel';
import { publicMetricUrl, sanitizeSpeedEvent } from './privacy';

assert.deepEqual(
  sanitizeFunnelProps({
    surface: 'Onboarding',
    lane: 'b2g',
    module: 'fitgraph',
    email: 'person@example.com',
    companyId: '102',
    name: 'Amina',
  }),
  { surface: 'onboarding', lane: 'b2g', module: 'fitgraph' }
);

assert.deepEqual(sanitizeFunnelProps({ module: 'not a module', surface: 'billing' }), {
  surface: 'billing',
});

assert.equal(
  firstOptionalModule({ customers: false }, { customers: true, schools: true }, (id) => id === 'schools'),
  'customers'
);
assert.equal(
  firstOptionalModule({ customers: true }, { fitgraph: true }, () => false),
  null
);
assert.equal(firstOptionalModule({}, { schools: true }, (id) => id === 'schools'), null);

const clean = publicMetricUrl(
  'https://www.supplieradvisor.com/pricing?email=person@example.com&next=/dashboard'
);
assert.equal(clean, null);

const stripped = publicMetricUrl('https://www.supplieradvisor.com/c/big-five-foods-102?from=quote#rate');
assert.equal(stripped, 'https://www.supplieradvisor.com/c/big-five-foods-102');

assert.equal(
  sanitizeSpeedEvent({
    type: 'vital' as const,
    url: 'https://www.supplieradvisor.com/onboarding?token=abc',
  })?.url,
  'https://www.supplieradvisor.com/onboarding'
);

const layout = readFileSync(resolve('app/layout.tsx'), 'utf8');
const metrics = readFileSync(resolve('components/analytics/PublicMetrics.tsx'), 'utf8');
assert.match(layout, /PublicMetrics/);
assert.match(metrics, /sampleRate=\{1\}/);
assert.match(metrics, /<SpeedInsights/);
assert.match(metrics, /<Analytics/);
assert.match(metrics, /beforeSend/);
assert.doesNotMatch(readFileSync(resolve('lib/analytics/track-funnel.ts'), 'utf8'), /email|privyUserId|companyId/);

console.log('funnel.test.ts ok');
