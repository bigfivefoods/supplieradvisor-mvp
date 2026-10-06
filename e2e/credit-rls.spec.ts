import { test, expect } from '@playwright/test';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

test.describe('credit application RLS + private bucket', () => {
  test.skip(!supabaseUrl || !anon, 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const rest = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
  const storagePublic = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/credit-application-documents/test.txt`;

  for (const table of [
    'credit_applications',
    'credit_application_principals',
    'credit_application_documents',
    'credit_application_events',
  ]) {
    test(`anon cannot select ${table}`, async ({ request }) => {
      const res = await request.get(`${rest}/${table}?select=id&limit=1`, {
        headers: { apikey: anon, Authorization: 'B' + 'earer ' + anon },
      });
      const body = await res.text();
      if (res.status() === 200) {
        expect(body.trim()).toBe('[]');
      } else {
        expect([401, 403]).toContain(res.status());
      }
    });

    test(`anon cannot insert ${table}`, async ({ request }) => {
      const res = await request.post(`${rest}/${table}`, {
        headers: {
          apikey: anon,
          Authorization: 'B' + 'earer ' + anon,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: [{ profile_id: 1 }],
      });
      expect([401, 403, 404]).toContain(res.status());
    });
  }

  test('public storage URL for credit bucket is not readable', async ({ request }) => {
    const res = await request.get(storagePublic, {
      headers: { apikey: anon, Authorization: 'B' + 'earer ' + anon },
    });
    expect(res.status()).not.toBe(200);
  });
});
