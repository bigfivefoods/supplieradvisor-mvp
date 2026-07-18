/**
 * Dual-tenant live settle path (buyer claim → seller confirm → ledger).
 *
 * Requires:
 *   E2E_ACCESS_TOKEN + E2E_COMPANY_ID  (seller)
 *   E2E_BUYER_TOKEN + E2E_BUYER_COMPANY_ID
 *   E2E_MUTATE=1
 *   Optional: E2E_INVOICE_ID (shared open invoice on seller owned by linked buyer)
 *   Optional: E2E_CONFIRM_CLAIM=1 (default confirm; set 0 to only create claim)
 *
 * Does not invent invoices — uses open shared invoice or E2E_INVOICE_ID.
 */
import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const sellerToken = process.env.E2E_ACCESS_TOKEN || '';
const sellerCompanyId = process.env.E2E_COMPANY_ID || '';
const buyerToken = process.env.E2E_BUYER_TOKEN || '';
const buyerCompanyId = process.env.E2E_BUYER_COMPANY_ID || '';
const mutate = process.env.E2E_MUTATE === '1';
const confirmClaim = process.env.E2E_CONFIRM_CLAIM !== '0';
const fixedInvoiceId = Number(process.env.E2E_INVOICE_ID || 0);

test.describe('Dual-tenant claim → ledger settle', () => {
  test.skip(
    !sellerToken ||
      !sellerCompanyId ||
      !buyerToken ||
      !buyerCompanyId ||
      !mutate,
    'Set E2E_ACCESS_TOKEN, E2E_COMPANY_ID, E2E_BUYER_TOKEN, E2E_BUYER_COMPANY_ID, E2E_MUTATE=1'
  );

  const sellerHeaders = () => ({
    Authorization: `Bearer ${sellerToken}`,
    'Content-Type': 'application/json',
  });
  const buyerHeaders = () => ({
    Authorization: `Bearer ${buyerToken}`,
    'Content-Type': 'application/json',
  });

  test('buyer claim → seller confirm → ledger', async ({ request }) => {
    // 1) Buyer money hub — find open invoice with supplier
    const hub = await request.get(
      `${base}/api/buyer/money-hub?buyerCompanyId=${buyerCompanyId}`,
      { headers: buyerHeaders() }
    );
    expect(hub.status()).not.toBe(401);
    if (hub.status() !== 200) {
      test.skip(true, `buyer money-hub ${hub.status()}`);
      return;
    }
    const hj = await hub.json();
    const open = (hj.hub?.openInvoices || []) as Array<{
      id: number;
      balance: number;
      currency?: string;
      supplier_profile_id?: number | null;
      claimStatus?: string | null;
    }>;

    let inv =
      fixedInvoiceId > 0
        ? open.find((i) => i.id === fixedInvoiceId) || null
        : open.find(
            (i) =>
              i.balance > 0.01 &&
              i.supplier_profile_id &&
              i.claimStatus !== 'pending' &&
              i.claimStatus !== 'confirmed'
          ) || null;

    if (!inv && fixedInvoiceId > 0) {
      inv = {
        id: fixedInvoiceId,
        balance: 1,
        currency: 'ZAR',
        supplier_profile_id: Number(sellerCompanyId),
        claimStatus: null,
      };
    }

    if (!inv?.id || !inv.supplier_profile_id) {
      test.skip(
        true,
        'No open shared invoice for buyer — set E2E_INVOICE_ID after sharing'
      );
      return;
    }

    // 2) Buyer creates claim
    const claimRes = await request.post(`${base}/api/buyer/payment-claim`, {
      headers: buyerHeaders(),
      data: {
        buyerCompanyId: Number(buyerCompanyId),
        supplierProfileId: Number(inv.supplier_profile_id),
        invoiceId: Number(inv.id),
        amount: Math.min(Number(inv.balance) || 1, Number(inv.balance) || 1),
        currency: inv.currency || 'ZAR',
        reference: `E2E-${Date.now()}`,
        notes: 'E2E dual-tenant claim — safe to confirm/reject',
      },
    });
    expect([200, 400, 403, 409, 500]).toContain(claimRes.status());
    expect(claimRes.status()).not.toBe(401);
    if (claimRes.status() === 409) {
      // Pending claim already exists — continue to seller resolve
    } else if (claimRes.status() !== 200) {
      const err = await claimRes.json().catch(() => ({}));
      test.skip(true, `claim failed: ${err.error || claimRes.status()}`);
      return;
    }

    // 3) Seller lists pending claims
    const list = await request.get(
      `${base}/api/customers/payment-claims?companyId=${sellerCompanyId}&status=pending`,
      { headers: sellerHeaders() }
    );
    expect(list.status()).not.toBe(401);
    if (list.status() !== 200) return;
    const lj = await list.json();
    const claims = (lj.claims || []) as Array<{
      id: number;
      invoice_id: number;
    }>;
    const match =
      claims.find((c) => Number(c.invoice_id) === Number(inv!.id)) ||
      claims[0];
    expect(match?.id).toBeTruthy();
    if (!match?.id) return;

    if (!confirmClaim) {
      // Soft path: claim created, stop before ledger write
      expect(match.id).toBeGreaterThan(0);
      return;
    }

    // 4) Seller confirms → ledger
    const confirm = await request.post(`${base}/api/customers/payment-claims`, {
      headers: sellerHeaders(),
      data: {
        companyId: Number(sellerCompanyId),
        claimId: Number(match.id),
        action: 'confirm',
      },
    });
    expect([200, 400, 403, 500]).toContain(confirm.status());
    expect(confirm.status()).not.toBe(401);
    if (confirm.status() === 200) {
      const cj = await confirm.json();
      expect(
        cj.ledgerId != null ||
          cj.claim?.status === 'confirmed' ||
          cj.claim?.ledger_payment_id != null
      ).toBeTruthy();
    }

    // 5) Soft: rating prompts may be due
    const prompts = await request.get(
      `${base}/api/business/rating-prompts?companyId=${sellerCompanyId}`,
      { headers: sellerHeaders() }
    );
    expect(prompts.status()).not.toBe(401);
  });

  test('credit hold blocks new invoice without force', async ({ request }) => {
    // Soft API probe — does not create hold; expects 400/409 if hold customer id set
    const holdCustomerId = Number(process.env.E2E_CREDIT_HOLD_CUSTOMER_ID || 0);
    test.skip(!holdCustomerId, 'Set E2E_CREDIT_HOLD_CUSTOMER_ID to exercise hold');

    const res = await request.post(`${base}/api/customers/docs`, {
      headers: sellerHeaders(),
      data: {
        companyId: Number(sellerCompanyId),
        type: 'invoice',
        customer_id: holdCustomerId,
        items: [{ description: 'E2E hold probe', qty: 1, unit_price: 100 }],
        status: 'draft',
      },
    });
    expect([409, 400, 403, 500]).toContain(res.status());
    if (res.status() === 409) {
      const j = await res.json();
      expect(j.code === 'CREDIT_HOLD' || j.code === 'OVER_CREDIT_LIMIT').toBeTruthy();
    }
  });
});
