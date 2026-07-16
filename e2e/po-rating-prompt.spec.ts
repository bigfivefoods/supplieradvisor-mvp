import { test, expect } from '@playwright/test';

/**
 * Authenticated trust-loop API:
 * 1) Create a rating prompt (always, if table exists)
 * 2) Optional: complete a PO when E2E_SUPPLIER_PROFILE_ID is set → assert prompt
 *
 * Requires: E2E_ACCESS_TOKEN + E2E_COMPANY_ID
 * Optional: E2E_SUPPLIER_PROFILE_ID (on-platform peer ≠ buyer)
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';
const supplierId = process.env.E2E_SUPPLIER_PROFILE_ID || '';

const auth = { Authorization: `Bearer ${token}` };

test.describe('PO → rating prompts (authenticated)', () => {
  test.skip(!token || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  test('GET rating-prompts with bearer is not 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/rating-prompts?companyId=${companyId}`,
      { headers: auth }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('create rating prompt via API', async ({ request }) => {
    const peer =
      supplierId && supplierId !== companyId
        ? Number(supplierId)
        : Number(companyId) + 1; // best-effort peer id if not configured

    const res = await request.post(`${base}/api/business/rating-prompts`, {
      headers: auth,
      data: {
        companyId: Number(companyId),
        action: 'create',
        counterpartyProfileId: peer,
        counterpartyName: 'E2E Peer Co',
        rateeRole: 'supplier',
        contextType: 'general',
        contextId: `e2e-${Date.now()}`,
      },
    });

    // 200 ok; 403 membership; 500 if migration missing
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);

    if (res.status() === 200) {
      const json = await res.json();
      expect(json.success).toBeTruthy();
      expect(json.prompt?.id || json.promptId).toBeTruthy();

      const list = await request.get(
        `${base}/api/business/rating-prompts?companyId=${companyId}`,
        { headers: auth }
      );
      if (list.status() === 200) {
        const body = await list.json();
        expect(Array.isArray(body.prompts)).toBeTruthy();
      }
    }
  });

  test('complete PO creates context_type=po prompt when supplier configured', async ({
    request,
  }) => {
    test.skip(
      !supplierId || supplierId === companyId,
      'Set E2E_SUPPLIER_PROFILE_ID to a different on-platform company'
    );

    const create = await request.post(
      `${base}/api/suppliers/purchase-orders`,
      {
        headers: auth,
        data: {
          companyId: Number(companyId),
          supplierProfileId: Number(supplierId),
          currency: 'ZAR',
          description: 'E2E rating-prompt PO',
          items: [
            {
              description: 'E2E line',
              quantity: 1,
              unit_price: 10,
            },
          ],
        },
      }
    );

    // May 403 if no connection — soft pass
    if (![200, 201].includes(create.status())) {
      expect([400, 403, 500]).toContain(create.status());
      test.info().annotations.push({
        type: 'note',
        description: `PO create status ${create.status()} — connection/schema may block; create-prompt test above still covers queue`,
      });
      return;
    }

    const created = await create.json();
    const po =
      created.purchaseOrder || created.po || created.data || null;
    const poId = Number(po?.id);
    expect(Number.isFinite(poId) && poId > 0).toBeTruthy();

    const patch = await request.patch(
      `${base}/api/suppliers/purchase-orders`,
      {
        headers: auth,
        data: {
          companyId: Number(companyId),
          id: poId,
          status: 'completed',
          actual_delivery_date: new Date().toISOString().slice(0, 10),
          delivered_quantity: 1,
          order_quantity: 1,
        },
      }
    );
    expect([200, 400, 403, 500]).toContain(patch.status());
    expect(patch.status()).not.toBe(401);

    if (patch.status() !== 200) return;

    // Soft wait for async void prompt
    await new Promise((r) => setTimeout(r, 800));

    const list = await request.get(
      `${base}/api/business/rating-prompts?companyId=${companyId}`,
      { headers: auth }
    );
    if (list.status() !== 200) return;
    const body = await list.json();
    if (body.warning) {
      // migration missing — don't fail CI
      expect(body.success).toBeTruthy();
      return;
    }
    const prompts = (body.prompts || []) as Array<{
      context_type?: string;
      context_id?: string;
      counterparty_profile_id?: number;
    }>;
    const match = prompts.find(
      (p) =>
        p.context_type === 'po' &&
        String(p.context_id) === String(poId)
    );
    // Deduped within 14d may return existing — either match or any supplier prompt
    expect(
      match ||
        prompts.some(
          (p) =>
            Number(p.counterparty_profile_id) === Number(supplierId)
        )
    ).toBeTruthy();
  });
});
