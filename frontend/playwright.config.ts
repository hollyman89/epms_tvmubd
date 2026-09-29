import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration for EPMS Frontend
 * Two-Mode Design:
 * 1. 'chromium'      -> Mode A: Headless automated regression / CI
 * 2. 'chromium-live' -> Mode B: Visible desktop GUI Chromium with slowMo & full artifact collection
 */
export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on',
    video: 'on',
    screenshot: 'on',
  },
  projects: [
    // Mode A — AUTOMATED (Headless regression / CI)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        headless: true,
      },
    },
    // Mode B — LIVE GUI (Visible Chromium window, human-observable slowMo, artifacts)
    {
      name: 'chromium-live',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        launchOptions: {
          slowMo: 300,
          args: ['--start-maximized'],
        },
        screenshot: 'on',
        video: 'on',
        trace: 'on',
      },
    },
  ],
});
