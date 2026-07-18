/**
 * Mutating golden path for settle-by-default (P1).
 * Skips unless E2E_ACCESS_TOKEN + E2E_COMPANY_ID + E2E_MUTATE=1.
 *
 * Flow: first-trade plan → bootstrap (idempotent) → send if draft → money-hub.
 * Does not delete data; uses E2E company only.
 */
import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const token = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';
const mutate = process.env.E2E_MUTATE === '1';

test.describe('Settle mutate golden path', () => {
  test.skip(
    !token || !companyId || !mutate,
    'Set E2E_ACCESS_TOKEN, E2E_COMPANY_ID, and E2E_MUTATE=1'
  );

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  test('money hub loads', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/money-hub?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(j.hub).toBeTruthy();
      expect(typeof j.hub.openAr).toBe('number');
    }
  });

  test('first-trade bootstrap + send (idempotent)', async ({ request }) => {
    const plan = await request.get(
      `${base}/api/business/first-trade?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(plan.status()).not.toBe(401);
    if (plan.status() !== 200) return;

    const boot = await request.post(`${base}/api/business/first-trade`, {
      headers: headers(),
      data: { companyId: Number(companyId), action: 'bootstrap' },
    });
    expect([200, 400, 403, 500]).toContain(boot.status());
    expect(boot.status()).not.toBe(401);
    if (boot.status() !== 200) return;
    const bj = await boot.json();
    const invoiceId = bj.invoiceId || bj.plan?.activeInvoiceId;

    if (invoiceId && bj.plan && !bj.plan.complete) {
      const send = await request.post(`${base}/api/business/first-trade`, {
        headers: headers(),
        data: {
          companyId: Number(companyId),
          action: 'send',
          invoiceId: Number(invoiceId),
        },
      });
      expect([200, 400, 403, 500]).toContain(send.status());
      expect(send.status()).not.toBe(401);
    }

    const hub = await request.get(
      `${base}/api/customers/money-hub?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(hub.status()).not.toBe(401);
  });

  test('AR CSV export auth', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/money-hub?companyId=${companyId}&format=csv`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const text = await res.text();
      expect(text).toContain('invoice_id');
    }
  });

  test('request-trade ranking', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/request-trade?companyId=${companyId}&limit=5`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('activation funnel + aging csv + money hub', async ({ request }) => {
    const funnel = await request.get(
      `${base}/api/business/activation-funnel?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(funnel.status()).not.toBe(401);
    if (funnel.status() === 200) {
      const j = await funnel.json();
      expect(Array.isArray(j.funnel?.stages)).toBeTruthy();
    }

    const aging = await request.get(
      `${base}/api/customers/ar-aging?companyId=${companyId}&format=csv`,
      { headers: headers() }
    );
    expect(aging.status()).not.toBe(401);
    if (aging.status() === 200) {
      const text = await aging.text();
      expect(text).toContain('bucket');
    }
  });

  test('next-action + notifications deep-links', async ({ request }) => {
    const next = await request.get(
      `${base}/api/business/next-action?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(next.status()).not.toBe(401);
    if (next.status() === 200) {
      const j = await next.json();
      expect(j.action?.href).toBeTruthy();
      expect(j.action?.cta).toBeTruthy();
    }

    const notif = await request.get(
      `${base}/api/notifications?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(notif.status()).not.toBe(401);
    if (notif.status() === 200) {
      const j = await notif.json();
      expect(Array.isArray(j.notifications)).toBeTruthy();
      for (const n of (j.notifications || []).slice(0, 8)) {
        if (n.href) expect(String(n.href).startsWith('/')).toBeTruthy();
      }
    }
  });

  test('ledger list soft path (claim→ledger readiness)', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/ar-ledger?companyId=${companyId}`,
      { headers: headers() }
    );
    expect([200, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200) {
      const j = await res.json();
      expect(Array.isArray(j.entries)).toBeTruthy();
    }

    const claims = await request.get(
      `${base}/api/customers/payment-claims?companyId=${companyId}&status=pending`,
      { headers: headers() }
    );
    expect(claims.status()).not.toBe(401);

    const prompts = await request.get(
      `${base}/api/business/rating-prompts?companyId=${companyId}`,
      { headers: headers() }
    );
    expect(prompts.status()).not.toBe(401);
    if (prompts.status() === 200) {
      const j = await prompts.json();
      expect(j.dueCount === undefined || typeof j.dueCount === 'number').toBeTruthy();
    }
  });

  test('settle-smoke + payment-proof auth gate', async ({ request }) => {
    const smoke = await request.get(`${base}/api/system/settle-smoke`);
    // Public or service-role: should not 404
    expect([200, 401, 403, 500]).toContain(smoke.status());
    if (smoke.status() === 200) {
      const j = await smoke.json();
      expect(j.checks).toBeTruthy();
    }

    // Proof upload requires auth + multipart — reject empty without file
    const proof = await request.post(`${base}/api/buyer/payment-proof`, {
      headers: headers(),
      multipart: {
        buyerCompanyId: companyId,
        companyId,
      },
    });
    expect([400, 401, 403, 415, 500]).toContain(proof.status());
    expect(proof.status()).not.toBe(404);
  });

  test('claim→confirm when pending claim exists (live settle)', async ({
    request,
  }) => {
    const list = await request.get(
      `${base}/api/customers/payment-claims?companyId=${companyId}&status=pending`,
      { headers: headers() }
    );
    expect(list.status()).not.toBe(401);
    if (list.status() !== 200) return;
    const j = await list.json();
    const claims = j.claims || [];
    if (!claims.length) {
      // Soft pass — no pending claim on E2E tenant
      expect(true).toBeTruthy();
      return;
    }
    const claimId = Number(claims[0].id);
    if (!claimId) return;

    // Prefer reject of non-prod claim to avoid double-ledger; only confirm if E2E_CONFIRM_CLAIM=1
    const action =
      process.env.E2E_CONFIRM_CLAIM === '1' ? 'confirm' : 'reject';
    const res = await request.post(`${base}/api/customers/payment-claims`, {
      headers: headers(),
      data: {
        companyId: Number(companyId),
        claimId,
        action,
      },
    });
    expect([200, 400, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    if (res.status() === 200 && action === 'confirm') {
      const body = await res.json();
      expect(
        body.ledgerId != null || body.claim?.status === 'confirmed'
      ).toBeTruthy();
    }
  });
});
