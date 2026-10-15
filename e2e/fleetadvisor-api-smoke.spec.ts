import { test, expect } from '@playwright/test';

/**
 * Signed-out FleetAdvisor® staff route. The book stays closed.
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

test.describe('FleetAdvisor staff route', () => {
  test('fleet staff book stays closed when signed out', async ({ request }) => {
    const getRes = await request.get(`${base}/api/fleet/fleetgraph`);
    expect([401, 403]).toContain(getRes.status());
    const getBody = await getRes.text();
    expect(getBody).not.toContain('"vehicles"');
    expect(getBody).not.toContain('price_cents');
    const postRes = await request.post(`${base}/api/fleet/fleetgraph`, {
      data: { op: 'vehicle.upsert', payload: { reg_no: 'X' } },
    });
    expect([401, 403]).toContain(postRes.status());
    const postBody = await postRes.text();
    expect(postBody).not.toContain('"vehicles"');
  });

  test('compliance export stays closed when signed out', async ({ request }) => {
    const response = await request.get(`${base}/api/fleet/fleetgraph/compliance/export`);
    expect([401, 403]).toContain(response.status());
    const body = await response.text();
    expect(body).not.toContain('subject_ref');
    expect(body).not.toContain('price_cents');
  });

  test('reminder cron stays closed when signed out', async ({ request }) => {
    const missing = await request.get(`${base}/api/fleet/fleetgraph/cron/reminders`);
    const wrong = await request.get(`${base}/api/fleet/fleetgraph/cron/reminders`, {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    expect([401, 503]).toContain(missing.status());
    expect(wrong.status()).toBe(missing.status());
    expect(await wrong.text()).toBe(await missing.text());
    const body = await missing.text();
    expect(body).not.toContain('@');
    expect(body).not.toContain('company_id');
  });
});
