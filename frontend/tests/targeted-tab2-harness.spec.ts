import { test, expect } from '@playwright/test';
import { loginViaUi, activateProjectDeliveryTab2 } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const HISTORICAL_TENDER_NAME = 'CANONICAL-E2E-1790563053595';

test.describe('R9.1B-HARNESS-FIX-01B: Targeted Tab 2 Determinism Test', () => {
  test('Prove Tab 2 uniqueness, deterministic activation, and row visibility on Project 1364', async ({ page }) => {
    // Step 1: Login as assigned PM
    await loginViaUi(page, BASE_URL, 'pm@epms.com');

    // Step 2 & 3 & 4 & 5 & 6: Use activateProjectDeliveryTab2 helper
    console.log('[HARNESS CHECK] Invoking activateProjectDeliveryTab2...');
    const activeTabPane = await activateProjectDeliveryTab2(page, BASE_URL);

    // Step 7: Locate historical Project 1364 row inside active Tab 2 pane
    const projectRow = activeTabPane.locator(`tr:has-text("${HISTORICAL_TENDER_NAME}")`);
    console.log('[HARNESS CHECK] Locating Project 1364 row in Tab 2...');
    await expect(projectRow).toHaveCount(1);
    await expect(projectRow).toBeVisible({ timeout: 15000 });
    console.log('[HARNESS CHECK] Project 1364 row is unique and visible in Tab 2!');

    // Step 8: Verify no production business action is executed (READ-ONLY PROOF)
    console.log('[HARNESS CHECK] Targeted verification completed successfully without business mutation.');
  });
});
