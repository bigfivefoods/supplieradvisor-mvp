/**
 * Brief 29 — GymAdvisor® owner-only RBAC
 * Run: npx --yes tsx lib/fitness/fitgraph-rbac.test.ts
 */
import assert from 'node:assert/strict';
import { canOpenCompanyWorkspace, canAccessPath } from '@/lib/business/permissions';
import { FIT_SCREEN_ACCESS } from '@/lib/fitness/fitgraph-rbac';
import {
  coachIsGymOwner,
  coachPortalEmails,
  setGymOwnerEmails,
  emptyFitgraphStore,
} from '@/lib/fitness/fitgraph';

// ── 1. canOpenCompanyWorkspace ──────────────────────────────────────────────

assert.equal(canOpenCompanyWorkspace('owner'), true, 'owner may open workspace');
assert.equal(canOpenCompanyWorkspace('admin'), false, 'admin cannot open workspace');
assert.equal(canOpenCompanyWorkspace('operations'), false, 'operations cannot open workspace');
assert.equal(canOpenCompanyWorkspace('finance'), false, 'finance cannot open workspace');
assert.equal(canOpenCompanyWorkspace('sales_contractor'), false, 'sales_contractor cannot open workspace');
assert.equal(canOpenCompanyWorkspace('member'), false, 'member cannot open workspace');
assert.equal(canOpenCompanyWorkspace(null), false, 'null cannot open workspace');

// ── 2. canAccessPath — /dashboard/fitgraph is gym_owner only ───────────────

assert.equal(
  canAccessPath('owner', '/dashboard/fitgraph'),
  true,
  'owner can access /dashboard/fitgraph'
);
assert.equal(
  canAccessPath('operations', '/dashboard/fitgraph'),
  false,
  'operations cannot access /dashboard/fitgraph'
);
assert.equal(
  canAccessPath('admin', '/dashboard/fitgraph'),
  false,
  'admin cannot access /dashboard/fitgraph'
);
assert.equal(
  canAccessPath('finance', '/dashboard/fitgraph'),
  false,
  'finance cannot access /dashboard/fitgraph'
);
assert.equal(
  canAccessPath('member', '/dashboard/fitgraph'),
  false,
  'member (SA team) cannot access /dashboard/fitgraph'
);

// coach-calendar is also owner-only in the company OS (coaches use PWA)
assert.equal(
  canAccessPath('owner', '/dashboard/fitgraph/coach-calendar'),
  true,
  'owner can access /dashboard/fitgraph/coach-calendar'
);
assert.equal(
  canAccessPath('operations', '/dashboard/fitgraph/coach-calendar'),
  false,
  'operations cannot access /dashboard/fitgraph/coach-calendar (coach uses PWA)'
);

// Sub-paths also require gym_owner
assert.equal(
  canAccessPath('owner', '/dashboard/fitgraph/clients'),
  true,
  'owner can access /dashboard/fitgraph/clients'
);
assert.equal(
  canAccessPath('operations', '/dashboard/fitgraph/clients'),
  false,
  'operations cannot access /dashboard/fitgraph/clients'
);

// ── 3. FIT_SCREEN_ACCESS assertions ────────────────────────────────────────

assert.equal(
  FIT_SCREEN_ACCESS['/dashboard/fitgraph'].coach,
  false,
  'FIT_SCREEN_ACCESS[/dashboard/fitgraph].coach is false'
);
assert.equal(
  FIT_SCREEN_ACCESS['/dashboard/fitgraph'].member,
  false,
  'FIT_SCREEN_ACCESS[/dashboard/fitgraph].member is false'
);
assert.equal(
  FIT_SCREEN_ACCESS['/dashboard/fitgraph'].desk,
  false,
  'FIT_SCREEN_ACCESS[/dashboard/fitgraph].desk is false (desk uses Today board outside this gate)'
);

assert.equal(
  FIT_SCREEN_ACCESS['coach_portal'].coach,
  true,
  'coach_portal.coach is true'
);
assert.equal(
  FIT_SCREEN_ACCESS['member_portal'].member,
  true,
  'member_portal.member is true'
);

// coach-calendar is owner-only in company OS
assert.equal(
  FIT_SCREEN_ACCESS['/dashboard/fitgraph/coach-calendar'].coach,
  false,
  'coach-calendar.coach is false — coaches use PWA calendar'
);

// ── 4. coachIsGymOwner — email-based dual role ──────────────────────────────

const store = emptyFitgraphStore();
const ownerEmails = ['owner@vuka.co.za', 'admin@vuka.co.za'];
setGymOwnerEmails(store, ownerEmails);

const ownerCoach = {
  id: 'coh_owner',
  code: 'OWN',
  name: 'Vuka Owner',
  email: 'owner@vuka.co.za',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};
const inviteEmailCoach = {
  id: 'coh_invite',
  code: 'INV',
  name: 'Invite Coach',
  email: 'other@vuka.co.za',
  invite_email: '  Owner@Vuka.co.za  ', // matches with trim/lowercase
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};
const workInviteEmailCoach = {
  id: 'coh_work',
  code: 'WRK',
  name: 'Work Invite Coach',
  email: 'other2@vuka.co.za',
  work_invite_email: 'OWNER@VUKA.CO.ZA', // matches case-insensitive
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};
const nonOwnerCoach = {
  id: 'coh_other',
  code: 'OTH',
  name: 'Non-owner Coach',
  email: 'coach@external.com',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

assert.equal(
  coachIsGymOwner(store, ownerCoach),
  true,
  'coachIsGymOwner true when coach.email matches owner email'
);
assert.equal(
  coachIsGymOwner(store, inviteEmailCoach),
  true,
  'coachIsGymOwner true when invite_email matches owner email (trim/lowercase)'
);
assert.equal(
  coachIsGymOwner(store, workInviteEmailCoach),
  true,
  'coachIsGymOwner true when work_invite_email matches owner email (case-insensitive)'
);
assert.equal(
  coachIsGymOwner(store, nonOwnerCoach),
  false,
  'coachIsGymOwner false for non-owner coach'
);

// ── 5. Owner-coach invite email goes to owner email (coachPortalEmails) ─────

const ownerCoachEmails = coachPortalEmails(ownerCoach);
assert.ok(
  ownerCoachEmails.includes('owner@vuka.co.za'),
  'owner-coach invite "to" contains the owner email'
);

// Work-invite variant — work_invite_email is included in portal email set
const workInviteEmails = coachPortalEmails(workInviteEmailCoach);
assert.ok(
  workInviteEmails.some((e) => e.toLowerCase() === 'owner@vuka.co.za'),
  'work_invite_email is in coachPortalEmails for owner-as-coach via work_invite_email'
);

console.log('✅ Brief 29 fitgraph-rbac tests passed');
