import { defineConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const storageStatePath = process.env.E2E_STORAGE_STATE || path.join(__dirname, 'e2e/.auth.json');
const hasStorage = fs.existsSync(storageStatePath);

/**
 * Vercel Protection Bypass for Automation.
 * The bypass header alone authorizes each request. Do not also ask Vercel to
 * set a bypass cookie: that answers the first request with Vercel's own
 * redirect and hides the app's Location (retired /directory → /).
 * Callers must not log the secret.
 */
export function vercelAutomationBypassHeaders(
  secret: string | undefined | null
): Record<string, string> | undefined {
  const value = secret?.trim();
  if (!value) return undefined;
  return {
    'x-vercel-protection-bypass': value,
  };
}

const bypassHeaders = vercelAutomationBypassHeaders(process.env.VERCEL_AUTOMATION_BYPASS_SECRET);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    ...(bypassHeaders ? { extraHTTPHeaders: bypassHeaders } : {}),
    // Optional: set E2E_STORAGE_STATE or place e2e/.auth.json after manual login
    ...(hasStorage && process.env.E2E_USE_STORAGE === '1'
      ? { storageState: storageStatePath }
      : {}),
  },
  // Do not auto-start webServer in CI unless configured
});
