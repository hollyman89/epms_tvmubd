import { test, expect } from '@playwright/test';
import { loginViaUi, logoutViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';

test.describe('R9.1B-HARNESS-FIX-08: Login Route Transition & Multi-Actor Harness', () => {
  test('Phase E & G: Targeted Finance Login and Viewport Invariant (1920x1080)', async ({ page }) => {
    // Phase G: Viewport Invariant Verification
    const viewport = page.viewportSize();
    console.log('[VIEWPORT CHECK] Current runtime viewport:', JSON.stringify(viewport));
    expect(viewport).toEqual({ width: 1920, height: 1080 });

    // Phase E: Targeted Finance Login
    console.log('[HARNESS CHECK] Executing targeted login for finance@epms.com...');
    await loginViaUi(page, BASE_URL, 'finance@epms.com');

    // Assert final URL equals expected landing route
    expect(page.url()).toBe(`${BASE_URL}/finance/invoices`);
    await expect(page).not.toHaveURL(/.*\/login(\?.*)?$/);

    // Verify authenticated content is rendered
    const authHeader = page.locator('header .ant-dropdown-trigger').first();
    await expect(authHeader).toBeVisible({ timeout: 15000 });
    console.log('[HARNESS CHECK] Finance authenticated landing content rendered successfully.');

    await logoutViaUi(page);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Phase F: Multi-Actor Login Regression (PM, Procurement, Finance)', async ({ page }) => {
    const actors = [
      { email: 'pm@epms.com', expectedPath: '/project-delivery', label: 'Project Manager' },
      { email: 'purchasing@epms.com', expectedPath: '/procurement', label: 'Procurement' },
      { email: 'finance@epms.com', expectedPath: '/finance/invoices', label: 'Finance' },
    ];

    for (const actor of actors) {
      console.log(`\n[MULTI-ACTOR HARNESS] Testing ${actor.label} (${actor.email})...`);
      await loginViaUi(page, BASE_URL, actor.email);

      // Verify exact expected landing path
      expect(page.url()).toBe(`${BASE_URL}${actor.expectedPath}`);
      await expect(page).not.toHaveURL(/.*\/login(\?.*)?$/);

      // Verify authenticated header visible
      const authHeader = page.locator('header .ant-dropdown-trigger').first();
      await expect(authHeader).toBeVisible({ timeout: 15000 });
      console.log(`[MULTI-ACTOR HARNESS] ${actor.label} authenticated and landed on ${actor.expectedPath}.`);

      await logoutViaUi(page);
      await expect(page).toHaveURL(/.*\/login/);
    }

    console.log('\n[PROOF] All canonical actors successfully authenticated and transitioned without stale login state.');
  });
});
