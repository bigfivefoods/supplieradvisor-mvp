/**
 * Fixture fetch gate. GET /api/* is answered from memory.
 * Any other method is rejected in the browser and never reaches a database.
 */
import { previewJson } from '@/lib/preview/os-fixtures';

const WRITE_BODY = {
  error: 'Sample book only — nothing was saved on SupplierAdvisor®',
};

export function installPreviewFetch(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __saPreviewFetch?: boolean };
  if (w.__saPreviewFetch) return;
  w.__saPreviewFetch = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.includes('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') {
        return new Response(JSON.stringify(WRITE_BODY), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const body = previewJson(url);
      return new Response(JSON.stringify(body ?? { success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(input, init);
  };
}
