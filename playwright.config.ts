import { defineConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const storageStatePath = process.env.E2E_STORAGE_STATE || path.join(__dirname, 'e2e/.auth.json');
const hasStorage = fs.existsSync(storageStatePath);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    // Optional: set E2E_STORAGE_STATE or place e2e/.auth.json after manual login
    ...(hasStorage && process.env.E2E_USE_STORAGE === '1'
      ? { storageState: storageStatePath }
      : {}),
  },
  // Do not auto-start webServer in CI unless configured
});
