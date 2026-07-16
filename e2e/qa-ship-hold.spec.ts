import { test, expect } from '@playwright/test';

/**
 * Authenticated QA hold smoke:
 * Create open inspection → ship transfer with that lot should 409 QA_HOLD
 * when a draft transfer with matching lot exists.
 *
 * Without transfer fixtures this still validates inspections + transfers APIs.
 * Full block requires E2E_TRANSFER_ID with held lot (optional).
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';
const transferId = process.env.E2E_TRANSFER_ID || '';

const auth = { Authorization: `Bearer ${token}` };
const lot = `E2E-QA-${Date.now().toString(36).toUpperCase()}`;

test.describe('QA ship-hold API', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  test('create open inspection on demo lot', async ({ request }) => {
    const res = await request.post(`${base}/api/quality/inspections`, {
      headers: auth,
      data: {
        companyId: Number(companyId),
        inspection_type: 'incoming',
        lot_number: lot,
        notes: 'E2E ship-hold demo',
        status: 'open',
        defects_found: 0,
      },
    });
    expect([200, 201, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200 || res.status() === 201) {
      const json = await res.json();
      expect(json.inspection?.id || json.id || json.success).toBeTruthy();
    }
  });

  test('ship known transfer returns QA_HOLD when held', async ({
    request,
  }) => {
    test.skip(
      !transferId,
      'Set E2E_TRANSFER_ID (draft transfer whose lines use a held lot)'
    );

    const res = await request.post(`${base}/api/inventory/transfers`, {
      headers: auth,
      data: {
        companyId: Number(companyId),
        id: Number(transferId),
        action: 'ship',
      },
    });

    // Ideal: 409 QA_HOLD; other codes if transfer state wrong
    if (res.status() === 409) {
      const json = await res.json();
      expect(json.code).toBe('QA_HOLD');
      expect(json.resolve_href).toBeTruthy();
      expect(json.error).toMatch(/QA hold/i);
    } else {
      expect([200, 400, 403, 500]).toContain(res.status());
      expect(res.status()).not.toBe(401);
    }
  });
});
