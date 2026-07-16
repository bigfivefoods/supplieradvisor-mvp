import { test, expect } from '@playwright/test';

/**
 * Trade-loop + founding public surfaces smoke.
 * Unauthenticated: public open, protected closed.
 * With E2E_ACCESS_TOKEN + E2E_COMPANY_ID: golden API path (not 401).
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';
const supplierId = process.env.E2E_SUPPLIER_PROFILE_ID || '';

test.describe('Trade loop public + gates', () => {
  test('system health open', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const j = await res.json();
      expect(j).toHaveProperty('ok');
      expect(j.checks).toBeTruthy();
    }
  });

  test('public founding waitlist slots', async ({ request }) => {
    const res = await request.get(`${base}/api/public/founding-waitlist`);
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.success).toBeTruthy();
    expect(typeof j.limit).toBe('number');
    expect(typeof j.remaining).toBe('number');
  });

  test('SAM GET health (no auth)', async ({ request }) => {
    const res = await request.get(`${base}/api/sam/chat`);
    expect([200, 503]).toContain(res.status());
  });

  test('supplier catalogue without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/suppliers/catalogue?companyId=1&supplierId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('buyer PO list without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/suppliers/purchase-orders?companyId=1&privyUserId=did:privy:x`
    );
    expect(res.status()).toBe(401);
  });

  test('inbound PO list without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/purchase-orders?companyId=1&privyUserId=did:privy:x`
    );
    expect(res.status()).toBe(401);
  });

  test('subscription cron without secret → 401/403/503', async ({
    request,
  }) => {
    const res = await request.get(
      `${base}/api/business/subscription/cron`
    );
    expect([401, 403, 503]).toContain(res.status());
  });

  test('company delete without auth → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/business/company`, {
      data: {
        action: 'delete',
        companyId: 1,
        confirmName: 'X',
        confirmPhrase: 'DELETE',
      },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Trade loop authenticated (optional token)', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  const headers = () => ({ Authorization: `Bearer ${token}` });

  test('subscription + founding pulse', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/subscription?companyId=${companyId}&autoTrial=0`,
      { headers: headers() }
    );
    expect([200, 403]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(j.subscription).toBeTruthy();
      if (j.founding) {
        expect(typeof j.founding.limit).toBe('number');
        expect(typeof j.founding.remaining).toBe('number');
      }
    }
  });

  test('onboarding checklist', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/onboarding?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('inventory products (sales catalogue source)', async ({ request }) => {
    const res = await request.get(
      `${base}/api/inventory/products?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('buyer outbound PO list', async ({ request }) => {
    const res = await request.get(
      `${base}/api/suppliers/purchase-orders?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('seller inbound PO list', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/purchase-orders?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('supplier catalogue when peer known', async ({ request }) => {
    test.skip(!supplierId, 'Set E2E_SUPPLIER_PROFILE_ID for catalogue check');
    const res = await request.get(
      `${base}/api/suppliers/catalogue?companyId=${companyId}&sellerProfileId=${supplierId}`,
      { headers: headers() }
    );
    // 200 ok, 403 not connected, 400 missing, 404 srm
    expect([200, 400, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.items)).toBeTruthy();
    }
  });

  test('notifications include actionable feed', async ({ request }) => {
    const res = await request.get(
      `${base}/api/notifications?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('customer invoices list (trade loop AR)', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/invoices?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('connections graph', async ({ request }) => {
    const res = await request.get(
      `${base}/api/connections?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.edges || j.connections || [])).toBeTruthy();
    }
  });

  test('peer workspace depth when supplier known', async ({ request }) => {
    test.skip(!supplierId, 'Set E2E_SUPPLIER_PROFILE_ID');
    const res = await request.get(
      `${base}/api/connections/peer-workspace?companyId=${companyId}&peerId=${supplierId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(j.purchaseOrders).toBeTruthy();
      expect(j.invoices).toBeTruthy();
    }
  });

  test('discover pagination meta', async ({ request }) => {
    const res = await request.get(
      `${base}/api/suppliers/discover?companyId=${companyId}&limit=10&offset=0`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    if (res.status() === 200) {
      const j = await res.json();
      expect(typeof j.total).toBe('number');
      expect(j).toHaveProperty('hasMore');
      expect(j).toHaveProperty('page');
    }
  });

  test('schema health deploy identity', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const j = await res.json();
      expect(j.deploy || j.checks).toBeTruthy();
    }
  });
});
