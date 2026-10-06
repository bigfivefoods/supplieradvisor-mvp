import { test, expect } from '@playwright/test';

const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const bearerFake = 'aaaaaaaaaaaaaaaaaaaa';
const accessToken = process.env.E2E_ACCESS_TOKEN || '';
const companyId = process.env.E2E_COMPANY_ID || '';

function authHeaders(token: string) {
  return { Authorization: `****** };
}

test.describe('credit application auth', () => {
  test('fake bearer is rejected on supplier routes', async ({ request }) => {
    const list = await request.get(`${base}/api/customers/credit-applications?companyId=1`, {
      headers: authHeaders(bearerFake),
    });
    expect(list.status()).toBe(401);

    const detail = await request.get(`${base}/api/customers/credit-applications/1?companyId=1`, {
      headers: authHeaders(bearerFake),
    });
    expect(detail.status()).toBe(401);

    const patch = await request.patch(`${base}/api/customers/credit-applications/1`, {
      headers: { ...authHeaders(bearerFake), 'Content-Type': 'application/json' },
      data: { companyId: 1, action: 'start_review' },
    });
    expect(patch.status()).toBe(401);

    const invite = await request.post(`${base}/api/customers/credit-applications/invite`, {
      headers: { ...authHeaders(bearerFake), 'Content-Type': 'application/json' },
      data: {
        companyId: 1,
        prospect: {
          tradingName: 'Fake',
          contactName: 'Fake',
          email: 'fake@example.com',
        },
      },
    });
    expect(invite.status()).toBe(401);
  });

  test('random portal token rejected on public credit routes', async ({ request }) => {
    const token = 'aaaaaaaaaaaaaaaa';
    const list = await request.get(`${base}/api/public/portals/trade/credit-application?token=${token}`);
    expect(list.status()).toBe(404);

    const doc = await request.get(`${base}/api/public/portals/trade/credit-application/document?token=${token}&docId=1`);
    expect(doc.status()).toBe(404);
  });

  test('valid token but non-member company returns 403', async ({ request }) => {
    test.skip(!accessToken || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');
    const wrongCompanyId = Number(companyId) + 999999;
    const res = await request.get(`${base}/api/customers/credit-applications?companyId=${wrongCompanyId}`, {
      headers: authHeaders(accessToken),
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('credit application happy path', () => {
  test.skip(!accessToken || !companyId, 'Set E2E_ACCESS_TOKEN and E2E_COMPANY_ID');

  test('invite, submit, request info, respond, approve, and clean up', async ({ request }) => {
    const stamp = Date.now();
    const tradingName = `E2E Credit ${stamp}`;

    let customerId = 0;
    let token = '';
    let applicationId = 0;
    try {
      const invite = await request.post(`${base}/api/customers/credit-applications/invite`, {
        headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
        data: {
          companyId: Number(companyId),
          prospect: {
            tradingName,
            contactName: 'E2E Contact',
            email: `credit-${stamp}@example.com`,
            phone: '+27110000000',
          },
        },
      });
      expect(invite.status()).toBe(200);
      const inviteJson = await invite.json();
      customerId = Number(inviteJson.customerId);
      token = String(inviteJson.token || '').trim();
      expect(token.length).toBeGreaterThan(10);

      const saveDraft = await request.post(`${base}/api/public/portals/trade/credit-application`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          token,
          action: 'save_draft',
          data: {
            country_code: 'ZA',
            business: {
              trading_name: tradingName,
              registered_name: `${tradingName} Pty Ltd`,
              entity_type: 'pty',
              registration_number: '2018/123456/07',
              vat_number: '4123456789',
            },
            contacts: {
              accounts: { name: 'E2E Accounts', email: `acc-${stamp}@example.com`, phone: '0110000000' },
              buyer: { name: 'E2E Buyer', email: `buy-${stamp}@example.com`, phone: '0110000001' },
            },
            bank: {
              bank_name: 'FNB',
              branch_code: '250655',
              account_holder: tradingName,
              account_number: '1234567890',
            },
            requested_limit: 50000,
            requested_terms: '30 days from statement',
            trade_references: [
              { company: 'Ref A', contact: 'A', phone: '1', email: 'a@a.com' },
              { company: 'Ref B', contact: 'B', phone: '2', email: 'b@b.com' },
              { company: 'Ref C', contact: 'C', phone: '3', email: 'c@c.com' },
            ],
            principals: [
              { full_name: 'E2E Principal', role: 'Director', id_type: 'sa_id', id_number: '8001015009087' },
            ],
            consent: { popia: true, credit_check: true, terms_accepted: true },
            signature: { typed_name: 'E2E Signer', capacity: 'Director' },
          },
        },
      });
      expect(saveDraft.status()).toBe(200);
      const saveJson = await saveDraft.json();
      applicationId = Number(saveJson.application?.id);
      expect(applicationId).toBeGreaterThan(0);

      const tinyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');
      for (const docType of ['cipc_registration', 'bank_confirmation', 'vat_certificate', 'id_copy']) {
        const upload = await request.post(`${base}/api/public/portals/trade/credit-application/upload`, {
          multipart: {
            token,
            applicationId: String(applicationId),
            docType,
            file: {
              name: `${docType}.pdf`,
              mimeType: 'application/pdf',
              buffer: tinyPdf,
            },
          },
        });
        expect(upload.status(), docType).toBe(200);
      }

      const submit = await request.post(`${base}/api/public/portals/trade/credit-application`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          token,
          action: 'submit',
          applicationId,
          data: {
            country_code: 'ZA',
            business: {
              trading_name: tradingName,
              registered_name: `${tradingName} Pty Ltd`,
              entity_type: 'pty',
              registration_number: '2018/123456/07',
              vat_number: '4123456789',
            },
            contacts: {
              accounts: { name: 'E2E Accounts', email: `acc-${stamp}@example.com`, phone: '0110000000' },
              buyer: { name: 'E2E Buyer', email: `buy-${stamp}@example.com`, phone: '0110000001' },
            },
            bank: {
              bank_name: 'FNB',
              branch_code: '250655',
              account_holder: tradingName,
              account_number: '1234567890',
            },
            requested_limit: 50000,
            requested_terms: '30 days from statement',
            trade_references: [
              { company: 'Ref A', contact: 'A', phone: '1', email: 'a@a.com' },
              { company: 'Ref B', contact: 'B', phone: '2', email: 'b@b.com' },
              { company: 'Ref C', contact: 'C', phone: '3', email: 'c@c.com' },
            ],
            principals: [
              { full_name: 'E2E Principal', role: 'Director', id_type: 'sa_id', id_number: '8001015009087' },
            ],
            consent: { popia: true, credit_check: true, terms_accepted: true },
            signature: { typed_name: 'E2E Signer', capacity: 'Director' },
          },
        },
      });
      expect(submit.status()).toBe(200);

      const listSubmitted = await request.get(`${base}/api/customers/credit-applications?companyId=${companyId}&status=submitted`, {
        headers: authHeaders(accessToken),
      });
      expect(listSubmitted.status()).toBe(200);

      const requestInfo = await request.patch(`${base}/api/customers/credit-applications/${applicationId}`, {
        headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
        data: { companyId: Number(companyId), action: 'request_info', note: 'Please clarify monthly turnover' },
      });
      expect(requestInfo.status()).toBe(200);

      const respondInfo = await request.post(`${base}/api/public/portals/trade/credit-application`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          token,
          action: 'respond_info',
          applicationId,
          data: {
            info_response: 'Monthly turnover is seasonal, average R120k',
          },
        },
      });
      expect(respondInfo.status()).toBe(200);

      const approve = await request.patch(`${base}/api/customers/credit-applications/${applicationId}`, {
        headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
        data: {
          companyId: Number(companyId),
          action: 'approve',
          approved_limit: 50000,
          approved_terms: '30 days from statement',
        },
      });
      expect(approve.status()).toBe(200);

      const portalView = await request.get(`${base}/api/public/portals/trade/credit-application?token=${encodeURIComponent(token)}`);
      expect(portalView.status()).toBe(200);
      const portalJson = await portalView.json();
      expect(String(portalJson.applications?.[0]?.status || '')).toBe('approved');

      const customersRes = await request.get(`${base}/api/customers?companyId=${companyId}&q=${encodeURIComponent(tradingName)}`, {
        headers: authHeaders(accessToken),
      });
      expect(customersRes.status()).toBe(200);
      const customersJson = await customersRes.json();
      const customer = (customersJson.customers || []).find((c: { id: number }) => Number(c.id) === customerId);
      expect(Number(customer?.credit_limit || 0)).toBe(50000);

      const pdf = await request.get(`${base}/api/customers/credit-applications/${applicationId}/pdf?companyId=${companyId}`, {
        headers: authHeaders(accessToken),
      });
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()['content-type'] || '').toContain('application/pdf');

      // Customer A token against customer B application should return 404
      const invite2 = await request.post(`${base}/api/customers/credit-applications/invite`, {
        headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
        data: {
          companyId: Number(companyId),
          prospect: {
            tradingName: `${tradingName} B`,
            contactName: 'B',
            email: `credit-b-${stamp}@example.com`,
          },
        },
      });
      expect(invite2.status()).toBe(200);
      const invite2Json = await invite2.json();
      const tokenB = String(invite2Json.token || '');
      const cross = await request.get(`${base}/api/public/portals/trade/credit-application/document?token=${encodeURIComponent(tokenB)}&docId=1`);
      expect([400, 404]).toContain(cross.status());

      const crossApp = await request.post(`${base}/api/public/portals/trade/credit-application`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          token: tokenB,
          action: 'save_draft',
          applicationId,
          data: { business: { trading_name: 'hack' } },
        },
      });
      expect(crossApp.status()).toBe(404);

      const cleanupB = await request.delete(`${base}/api/customers?id=${invite2Json.customerId}&companyId=${companyId}`, {
        headers: authHeaders(accessToken),
      });
      expect([200, 204]).toContain(cleanupB.status());
    } finally {
      if (customerId > 0) {
        const cleanup = await request.delete(`${base}/api/customers?id=${customerId}&companyId=${companyId}`, {
          headers: authHeaders(accessToken),
        });
        expect([200, 204]).toContain(cleanup.status());
      }
    }
  });
});
