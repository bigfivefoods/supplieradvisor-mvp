/**
 * Run: npx --yes tsx lib/clinic/clinic-portal-shop.test.ts
 */
import assert from 'node:assert/strict';
import { clinicPortalShop } from './clinic-portal-shop';
import { parseClinicMemberTab } from './clinic-member-tabs';
import { SYS_PERSONAL_CODE } from './appointment-kind';

assert.equal(parseClinicMemberTab('book'), 'mine');
assert.equal(parseClinicMemberTab('schedule'), 'open');
assert.equal(parseClinicMemberTab('you'), 'profile');
assert.equal(parseClinicMemberTab('rehab'), 'care');
assert.equal(parseClinicMemberTab('scripts'), 'care');
assert.equal(parseClinicMemberTab('shop'), 'care');
assert.equal(parseClinicMemberTab('care'), 'care');
assert.equal(parseClinicMemberTab('share'), 'share');
assert.equal(parseClinicMemberTab('inbox'), 'messages');
assert.equal(parseClinicMemberTab('nope'), null);

const shop = clinicPortalShop({
  services: [
    {
      id: 's1',
      name: 'Treatment',
      price_zar: 650,
      default_duration_min: 45,
      active: true,
    },
    {
      id: 'sys',
      code: SYS_PERSONAL_CODE,
      name: 'Own time',
      active: true,
    },
    { id: 'off', name: 'Hidden', active: false, price_zar: 1 },
  ],
  packages: [
    {
      id: 'p1',
      name: '6-pack',
      sessions_total: 6,
      price_zar: 3600,
      active: true,
    },
  ],
});
assert.equal(shop.length, 2);
assert.equal(shop[0].kind, 'package');
assert.equal(shop[1].kind, 'service');
assert.ok(!shop.some((i) => i.id === 'sys'));

const hidden = clinicPortalShop({
  services: [{ id: 's1', name: 'Treatment', active: true, price_zar: 10 }],
  settings: { show_pricing: false },
});
assert.equal(hidden.length, 0);

console.log('clinic-portal-shop.test.ts ok');
