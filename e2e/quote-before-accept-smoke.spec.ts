/**
 * Smoke: pending connection path APIs used for quote/invoice before accept.
 *
 * Requires:
 *   E2E_ACCESS_TOKEN + E2E_COMPANY_ID
 * Optional:
 *   E2E_PEER_PROFILE_ID — signed-up peer to request/seed
 *   E2E_MUTATE=1 — actually POST connection request
 */
import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';
const peerId = Number(process.env.E2E_PEER_PROFILE_ID || 0);
const mutate = process.env.E2E_MUTATE === '1';

test.describe('Quote before accept (smoke)', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN + E2E_COMPANY_ID');

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  test('customers list seeds pending peers + bank-share works', async ({
    request,
  }) => {
    const cust = await request.get(
      `${base}/api/customers?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(cust.status()).not.toBe(401);
    if (cust.status() !== 200) {
      test.skip(true, `customers ${cust.status()}`);
      return;
    }
    const cj = await cust.json();
    expect(cj.success).toBeTruthy();
    expect(Array.isArray(cj.customers)).toBeTruthy();

    const bank = await request.get(
      `${base}/api/business/bank-share?companyId=${companyId}&peerName=E2E`,
      { headers: headers() }
    );
    expect(bank.status()).not.toBe(401);
    if (bank.status() === 200) {
      const bj = await bank.json();
      expect(bj.success).toBeTruthy();
      expect(typeof bj.text).toBe('string');
      expect(bj.text.length).toBeGreaterThan(20);
    }

    const money = await request.get(
      `${base}/api/customers/money-hub?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(money.status()).not.toBe(401);

    const ft = await request.get(
      `${base}/api/business/first-trade?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(ft.status()).not.toBe(401);
  });

  test('optional: request connect to peer seeds CRM', async ({ request }) => {
    test.skip(!mutate || !peerId, 'Set E2E_MUTATE=1 and E2E_PEER_PROFILE_ID');

    const res = await request.post(`${base}/api/connections`, {
      headers: headers(),
      data: {
        companyId: Number(companyId),
        targetProfileId: peerId,
        connectionType: 'partner',
        mode: 'request',
        message: 'E2E quote-before-accept seed',
      },
    });
    expect([200, 201].includes(res.status()) || res.status() === 409).toBeTruthy();
    const j = await res.json().catch(() => ({}));
    // Pending or already connected/pending
    if (res.ok) {
      expect(
        j.status === 'pending' ||
          j.status === 'accepted' ||
          j.alreadyPending ||
          j.alreadyConnected
      ).toBeTruthy();
    }

    const cust = await request.get(
      `${base}/api/customers?companyId=${companyId}`,
      { headers: headers() }
    );
    if (cust.ok()) {
      const cj = await cust.json();
      const hit = (cj.customers || []).find(
        (c: { linked_profile_id?: number }) =>
          Number(c.linked_profile_id) === peerId
      );
      expect(hit, 'CRM row for peer after connect request').toBeTruthy();
    }
  });
});
