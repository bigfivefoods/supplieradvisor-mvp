/**
 * Run: npx --yes tsx lib/clinic/clinic-pwa-copy.test.ts
 */
import assert from 'node:assert/strict';
import { clinicPwaCopy, isClinicPwaModule } from './clinic-pwa-copy';

assert.equal(isClinicPwaModule('vetgraph'), true);
assert.equal(clinicPwaCopy('medicalgraph').dockCare, 'Records');
assert.equal(clinicPwaCopy('physiograph').dockCare, 'Rehab');
assert.equal(clinicPwaCopy('dentalgraph').dockCare, 'Chart');
assert.equal(clinicPwaCopy('psychiatrygraph').dockCare, 'Records');
assert.equal(clinicPwaCopy('vetgraph').dockCare, 'Pets');
assert.equal(clinicPwaCopy('vetgraph').audienceSingular, 'client');
assert.equal(clinicPwaCopy('vetgraph').staffSingular, 'vet');
assert.equal(clinicPwaCopy('medicalgraph').bookCta, 'Book a consult');
assert.equal(clinicPwaCopy('psychiatrygraph').visitSingular, 'session');

console.log('clinic-pwa-copy.test.ts ok');
