import { test, expect } from '@playwright/test';

/**
 * Authenticated golden-path API smoke (PO → invoice → AR → rate surfaces).
 * Skips when E2E_ACCESS_TOKEN or E2E_COMPANY_ID unset.
 *
 * Env:
 *   PLAYWRIGHT_BASE_URL
 *   E2E_ACCESS_TOKEN — Privy access JWT
 *   E2E_COMPANY_ID
 *   E2E_SUPPLIER_PROFILE_ID (optional peer)
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';
const supplierId = process.env.E2E_SUPPLIER_PROFILE_ID || '';

test.describe('Golden path auth (optional token)', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  test('health + trade-loop-smoke still public', async ({ request }) => {
    const h = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(h.status());
    const s = await request.get(`${base}/api/system/trade-loop-smoke`);
    expect(s.status()).toBe(200);
    const j = await s.json();
    expect(j.deploy?.commitShort || j.deploy?.commit).toBeTruthy();
  });

  test('seller inbound POs (accept → invoice path)', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/purchase-orders?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('customer invoices list', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/docs?companyId=${companyId}&type=invoice`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.documents || j.invoices || [])).toBeTruthy();
    }
  });

  test('AR aging + by-customer rollup', async ({ request }) => {
    const aging = await request.get(
      `${base}/api/customers/ar-aging?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(aging.status());
    expect(aging.status()).not.toBe(401);

    const byCust = await request.get(
      `${base}/api/customers/ar-by-customer?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(byCust.status());
    expect(byCust.status()).not.toBe(401);
    if (byCust.status() === 200) {
      const j = await byCust.json();
      expect(Array.isArray(j.customers)).toBeTruthy();
    }
  });

  test('rating prompts + company ratings surfaces', async ({ request }) => {
    const prompts = await request.get(
      `${base}/api/business/rating-prompts?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 404, 500]).toContain(prompts.status());
    expect(prompts.status()).not.toBe(401);

    const ratings = await request.get(
      `${base}/api/suppliers/ratings?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 404, 500]).toContain(ratings.status());
    expect(ratings.status()).not.toBe(401);
  });

  test('notifications deep-link feed', async ({ request }) => {
    const res = await request.get(
      `${base}/api/notifications?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.notifications)).toBeTruthy();
      for (const n of (j.notifications || []).slice(0, 5)) {
        if (n.href) expect(String(n.href).startsWith('/')).toBeTruthy();
      }
    }
  });

  test('buyer shared documents list', async ({ request }) => {
    const res = await request.get(
      `${base}/api/buyer/documents?buyerCompanyId=${companyId}&type=all`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('peer workspace when supplier known', async ({ request }) => {
    test.skip(!supplierId, 'Set E2E_SUPPLIER_PROFILE_ID');
    const res = await request.get(
      `${base}/api/connections/peer-workspace?companyId=${companyId}&peerId=${supplierId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('create draft invoice dry-run rejected without items (not 401)', async ({
    request,
  }) => {
    // Ensures auth works for write path without mutating real data
    const res = await request.post(`${base}/api/customers/docs`, {
      headers: headers(),
      data: {
        companyId: Number(companyId),
        type: 'invoice',
        action: 'create',
        items: [],
      },
    });
    // 400 validation preferred; 403 membership; never 401 with bearer
    expect([400, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });
});
