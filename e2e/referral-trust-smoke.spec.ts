import { test, expect } from '@playwright/test';

/**
 * Referral + trust-loop API smoke (unauthenticated → 401).
 * Confirms new surfaces are gated the same as other company APIs.
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const protectedGets = [
  '/api/business/referrals?companyId=1',
  '/api/business/rating-prompts?companyId=1',
  '/api/business/trust?companyId=1',
  '/api/business/subscription?companyId=1',
  '/api/business/founding-waitlist',
  '/api/sam/history?companyId=1',
  '/api/suppliers/ratings?companyId=1',
  '/api/customers/reviews?companyId=1',
];

const protectedPosts = [
  {
    path: '/api/business/referrals',
    data: {
      companyId: 1,
      privyUserId: 'did:privy:attacker',
      action: 'request_payout',
    },
  },
  {
    path: '/api/business/rating-prompts',
    data: {
      companyId: 1,
      privyUserId: 'did:privy:attacker',
      action: 'create',
      counterpartyProfileId: 2,
      rateeRole: 'supplier',
    },
  },
  {
    path: '/api/sam/chat',
    data: {
      privyUserId: 'did:privy:attacker',
      companyId: 1,
      messages: [{ role: 'user', content: 'hello' }],
    },
  },
  {
    path: '/api/connections',
    data: {
      companyId: 1,
      privyUserId: 'did:privy:attacker',
      action: 'accept',
      connectionId: 1,
    },
  },
];

test.describe('Referral + trust API gates', () => {
  for (const path of protectedGets) {
    test(`rejects unauth: GET ${path.split('?')[0]}`, async ({ request }) => {
      const res = await request.get(`${base}${path}`);
      // Company routes → 401; ops-only (founding-waitlist) may return 403
      expect([401, 403], path).toContain(res.status());
    });
  }

  for (const { path, data } of protectedPosts) {
    test(`401 without token: POST ${path}`, async ({ request }) => {
      const res = await request.post(`${base}${path}`, { data });
      expect(res.status(), path).toBe(401);
    });
  }

  test('SAM health remains public', async ({ request }) => {
    const res = await request.get(`${base}/api/sam/chat`);
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const json = await res.json();
      expect(json.name || json.configured !== undefined).toBeTruthy();
    }
  });

  test('verified companies listing remains public', async ({ request }) => {
    const res = await request.get(
      `${base}/api/public/verified-companies?page=1&pageSize=9`
    );
    expect([200, 500]).toContain(res.status());
  });
});
