import { defineConfig, devices } from '@playwright/test';

const port = process.env.PORT ?? '3010';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.PLAYWRIGHT_PROD === '1' ? 'npm run start' : 'npm run dev',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI && process.env.PLAYWRIGHT_PROD !== '1',
    timeout: 180_000,
    env: {
      NODE_ENV: process.env.PLAYWRIGHT_PROD === '1' ? 'production' : 'development',
      PORT: port,
    },
  },
});
