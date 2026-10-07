import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Golden-path production smoke (unauthenticated).
 * Run on every main deploy via CI: health, trade-loop, SEO, auth gates.
 */
const base =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';
const hasPrivyAppId = Boolean(String(process.env.NEXT_PUBLIC_PRIVY_APP_ID || '').trim());

test.describe('Golden path smoke (public)', () => {
  test('public pages have no enforced CSP violations, login modal opens, embed renders in iframe', async ({
    page,
  }) => {
    const paths = ['/', '/login', '/pricing', '/marketplace'];

    await page.addInitScript(() => {
      (
        window as Window & {
          __saCspViolations?: Array<{ directive: string; blocked: string }>;
        }
      ).__saCspViolations = [];
      // Best-effort listener: captures runtime violations after document start.
      window.addEventListener('securitypolicyviolation', (event) => {
        (
          window as Window & {
            __saCspViolations?: Array<{ directive: string; blocked: string }>;
          }
        ).__saCspViolations?.push({
          directive: event.effectiveDirective || '',
          blocked: event.blockedURI || '',
        });
      });
    });

    for (const path of paths) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      const violations = await page.evaluate(() => {
        const records =
          (
            window as Window & {
              __saCspViolations?: Array<{ directive: string; blocked: string }>;
            }
          ).__saCspViolations || [];
        const isLocal =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        return records.filter(
          (v) => !(isLocal && v.directive.startsWith('script-src') && v.blocked === 'eval')
        );
      });
      const violationMessages = violations.map(
        (v: { directive: string; blocked: string }) => `${v.directive}:${v.blocked}`
      );
      expect(
        violationMessages,
        `${path} should not trigger enforced CSP violations`
      ).toEqual([]);
      await page.evaluate(() => {
        (
          window as Window & {
            __saCspViolations?: Array<{ directive: string; blocked: string }>;
          }
        ).__saCspViolations = [];
      });
    }

    if (hasPrivyAppId) {
      await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
      const trigger = page.getByRole('button', { name: /continue with email/i }).first();
      await expect(trigger).toBeVisible({ timeout: 20_000 });
      await trigger.click();
      const modalSignals = await Promise.all([
        page
          .waitForSelector('[role="dialog"]', { timeout: 12_000 })
          .then(() => true)
          .catch(() => false),
        page
          .waitForSelector('iframe[src*="privy"], iframe[src*="walletconnect"]', {
            timeout: 12_000,
          })
          .then(() => true)
          .catch(() => false),
      ]);
      expect(
        modalSignals.some(Boolean),
        'Privy login modal should open after clicking login'
      ).toBeTruthy();
    } else if (process.env.CI) {
      test.info().annotations.push({
        type: 'skip-check',
        description: 'Privy modal assertion skipped in CI because NEXT_PUBLIC_PRIVY_APP_ID is not set',
      });
    }

    const parentServer = createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body><iframe id="embed" src="${base}/embed/containers/test" style="width:900px;height:700px"></iframe></body></html>`
      );
    });
    await new Promise<void>((resolve) => parentServer.listen(0, '127.0.0.1', () => resolve()));
    const parentPort = (parentServer.address() as AddressInfo).port;
    try {
      await page.goto(`http://127.0.0.1:${parentPort}`, { waitUntil: 'domcontentloaded' });
      const iframe = page.locator('#embed');
      await expect(iframe).toBeVisible();
      const frameHandle = await iframe.elementHandle();
      const frame = await frameHandle?.contentFrame();
      expect(frame, 'embed iframe should load from parent page').toBeTruthy();
      await frame!.waitForLoadState('domcontentloaded');
      expect(frame!.url()).toContain('/embed/containers/');
      const frameHtml = await frame!.content();
      expect(frameHtml.length).toBeGreaterThan(200);
    } finally {
      await new Promise<void>((resolve) => parentServer.close(() => resolve()));
    }
  });

  test('install banner never covers hero CTAs on mobile while hero is visible', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        configurable: true,
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });

    const assertNoFixedStickyOverlap = async () => {
      const overlaps = await page.evaluate(() => {
        const ctas = [...document.querySelectorAll('#platform a, #platform button')].filter(
          (node) => {
            const rect = (node as HTMLElement).getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }
        );

        const blockers = [...document.querySelectorAll('body *')].filter((node) => {
          const el = node as HTMLElement;
          const style = window.getComputedStyle(el);
          if (!['fixed', 'sticky'].includes(style.position)) return false;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          if (rect.top <= 120 && rect.height <= 140) return false;
          return true;
        });

        const hits: Array<{ cta: string; blocker: string }> = [];
        for (const cta of ctas) {
          const ctaBox = (cta as HTMLElement).getBoundingClientRect();
          for (const blocker of blockers) {
            const blockerBox = blocker.getBoundingClientRect();
            const intersects =
              ctaBox.left < blockerBox.right &&
              ctaBox.right > blockerBox.left &&
              ctaBox.top < blockerBox.bottom &&
              ctaBox.bottom > blockerBox.top;
            if (intersects) {
              hits.push({
                cta: (cta as HTMLElement).textContent?.trim() || 'cta',
                blocker: blocker.tagName,
              });
            }
          }
        }
        return hits;
      });

      expect(
        overlaps,
        'visible hero CTAs should not intersect any fixed/sticky element other than the top nav'
      ).toEqual([]);
    };

    await assertNoFixedStickyOverlap();
    await page.waitForTimeout(500);
    await assertNoFixedStickyOverlap();

    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    });
    await page.waitForTimeout(500);
    await expect(page.getByText('Add to Home Screen')).not.toBeVisible();

    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 1.8, behavior: 'instant' });
    });
    await expect(
      page.getByRole('button', { name: /add to home screen|install app/i })
    ).toBeVisible({ timeout: 20_000 });
  });

  test('system health liveness is public (no secret leak)', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    expect(j).toHaveProperty('ok');
    expect(j.checks).toBeFalsy();
    expect(j.deploy).toBeFalsy();
  });

  test('trade-loop-smoke is not public', async ({
    request,
  }) => {
    const res = await request.get(`${base}/api/system/trade-loop-smoke`);
    expect([401, 403, 503]).toContain(res.status());
  });

  test('retired directory redirects home', async ({ request }) => {
    const res = await request.get(`${base}/directory`, { maxRedirects: 0 });
    // Permanent redirect away from public directory
    expect([301, 302, 307, 308]).toContain(res.status());
    const loc = res.headers()['location'] || '';
    expect(loc === '/' || loc.endsWith('/') || loc.includes(base)).toBeTruthy();
  });

  test('sitemap.xml present', async ({ request }) => {
    const res = await request.get(`${base}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/sitemapindex/i);
    expect(body).toContain('/sitemap/0.xml');
  });

  test('robots.txt present', async ({ request }) => {
    const res = await request.get(`${base}/robots.txt`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.toLowerCase()).toMatch(/user-agent|sitemap/);
  });

  test('public pages send anti-framing headers and embed stays framable', async ({
    request,
  }) => {
    test.setTimeout(120_000);

    for (const path of ['/', '/login']) {
      const res = await request.get(`${base}${path}`);
      expect(res.headers()['x-frame-options']).toBe('DENY');
      expect(res.headers()['x-content-type-options']).toBe('nosniff');
      expect(res.headers()['referrer-policy']).toBe(
        'strict-origin-when-cross-origin'
      );
      expect(res.headers()['content-security-policy']).toContain(
        "frame-ancestors 'none'"
      );
      expect(res.headers()['content-security-policy-report-only']).toContain(
        "default-src 'self'"
      );
    }

    const embedRes = await request.get(`${base}/embed/containers/test`);
    expect(embedRes.headers()['x-frame-options']).toBeFalsy();
    expect(embedRes.headers()['content-security-policy']).toContain(
      "frame-ancestors *"
    );
    expect(embedRes.headers()['content-security-policy-report-only']).toBeFalsy();
  });

  test('protected invoice docs without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/docs?companyId=1&type=invoice`
    );
    expect(res.status()).toBe(401);
  });

  test('protected AR aging without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/customers/ar-aging?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('AR digest cron without secret → 401/403/503', async ({ request }) => {
    const res = await request.get(`${base}/api/customers/ar-digest/cron`);
    expect([401, 403, 503]).toContain(res.status());
  });

  test('promise-to-pay cron without secret → 401/403/503', async ({
    request,
  }) => {
    const res = await request.get(
      `${base}/api/customers/docs/promise-to-pay-cron`
    );
    expect([401, 403, 503]).toContain(res.status());
  });

  test('overdue cron without secret → 401/403/503', async ({ request }) => {
    const res = await request.get(`${base}/api/customers/docs/overdue-cron`);
    expect([401, 403, 503]).toContain(res.status());
  });

  test('golden-loop health probe present', async ({ request }) => {
    const res = await request.get(`${base}/api/system/health`);
    expect([200, 503]).toContain(res.status());
    const j = await res.json();
    // When service role available, golden_loop block is included
    if (j.golden_loop) {
      expect(j.golden_loop).toHaveProperty('ok');
      expect(Array.isArray(j.golden_loop.missing) || j.golden_loop.ok).toBeTruthy();
    }
    expect(j.ok !== undefined).toBeTruthy();
  });

  test('golden-path without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/golden-path?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('board-pack without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/business/board-pack?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('intelligence summary without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/intelligence/summary?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('settle page open (auth gate client-side)', async ({ request }) => {
    const res = await request.get(`${base}/dashboard/settle`);
    // HTML shell always 200; client AuthGate handles login
    expect([200, 307, 308]).toContain(res.status());
  });

  // ── Sprint A–D auth gates ──────────────────────────────────────────────
  test('stuck-stage alerts without cron secret → 401/403/503', async ({
    request,
  }) => {
    const res = await request.post(`${base}/api/system/stuck-stage-alerts`, {
      data: { limit: 1 },
    });
    expect([401, 403, 503]).toContain(res.status());
  });

  test('intelligence actions without auth → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/intelligence/actions`, {
      data: {
        companyId: 1,
        action: 'activity',
        insight: { id: 'test', title: 't', detail: 'd', domain: 'ops' },
      },
    });
    expect(res.status()).toBe(401);
  });

  test('leadership progress without auth → 401', async ({ request }) => {
    const res = await request.get(
      `${base}/api/intelligence/leadership?companyId=1`
    );
    expect(res.status()).toBe(401);
  });

  test('board-pack POST without auth → 401', async ({ request }) => {
    const res = await request.post(`${base}/api/business/board-pack`, {
      data: { companyId: 1, email: false },
    });
    expect(res.status()).toBe(401);
  });

  test('escrow hub page open (client auth gate)', async ({ request }) => {
    const res = await request.get(`${base}/dashboard/escrow`);
    expect([200, 307, 308]).toContain(res.status());
  });

  test('leadership development page open (client auth gate)', async ({
    request,
  }) => {
    const res = await request.get(
      `${base}/dashboard/intelligence/leadership-development`
    );
    expect([200, 307, 308]).toContain(res.status());
  });
});
