import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi, logoutViaUi } from './canonical-lifecycle-helpers';

const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required');
}
const BASE_URL = 'http://localhost:3000';
const BRAIN_DIR = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\UBDOPS3',
  '.gemini/antigravity-ide/brain/aba26b55-198c-4f51-acea-0dd7d0ad221a'
);

async function captureScreenshot(page: Page, filename: string) {
  try {
    const p = path.join(BRAIN_DIR, filename);
    await page.screenshot({ path: p, fullPage: true });
    console.log(`[SCREENSHOT CAPTURED] ${p}`);
  } catch (err) {
    console.warn(`[WARN] Could not capture screenshot: ${err}`);
  }
}

test.describe('EPMS — PROJECT-CLOSE-R1-C5 Visible Browser Validation', () => {
  test.setTimeout(180000);

  test('C5 Targeted Browser Integration Proof — Workspace Closure & Workflow', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
      console.error('[BROWSER RUNTIME ERROR]', err.message);
    });

    // -------------------------------------------------------------------------
    // 1. LOGIN AS PM
    // -------------------------------------------------------------------------
    console.log('\n[C5-BROWSER 1] Logging in as PM (pm@epms.com)...');
    await loginViaUi(page, BASE_URL, 'pm@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    // -------------------------------------------------------------------------
    // 2. NAVIGATE TO PROJECT DELIVERY & OPEN PROJECT WORKSPACE
    // -------------------------------------------------------------------------
    console.log('\n[C5-BROWSER 2] Navigating to Project Delivery...');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });

    // Open active projects tab
    const deliveryTabs = page.locator('.ant-tabs-tab');
    if ((await deliveryTabs.count()) > 1) {
      await deliveryTabs.nth(1).click();
      await page.waitForTimeout(600);
    }

    // Open active project
    console.log('\n[C5-BROWSER 3] Opening project from active projects table...');
    const projectLink = page.locator('[data-testid^="project-name-link-"]').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    const projectName = await projectLink.textContent();
    console.log(`[C5-BROWSER 3] Opening project: "${projectName?.trim()}"`);
    await projectLink.click();
    await page.waitForTimeout(1000);

    // 1. Project Workspace loads
    const workspaceShell = page.locator('[data-testid="project-workspace-shell"]');
    await expect(workspaceShell).toBeVisible({ timeout: 15000 });
    console.log('[PASS] 1. Project Workspace loads successfully.');

    // 2. Click More -> Project Closure
    console.log('\n[C5-BROWSER 4] Opening More menu and selecting Project Closure...');
    const moreTab = page.locator('[data-testid="nav-tab-more"]');
    await expect(moreTab).toBeVisible({ timeout: 10000 });
    await moreTab.click();
    await page.waitForTimeout(400);

    const closureMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Project Closure")');
    await expect(closureMenuItem).toBeVisible({ timeout: 10000 });
    await closureMenuItem.click();
    await page.waitForTimeout(1500);

    // 2. Project Closure section exists
    const closureWorkspace = page.locator('[data-testid="project-closure-workspace"]');
    await expect(closureWorkspace).toBeVisible({ timeout: 15000 });
    console.log('[PASS] 2. Project Closure section exists and is visible.');

    // 3. Readiness displays (Authoritative from backend)
    const readinessBanner = page.locator('[data-testid="closure-readiness-banner"]');
    await expect(readinessBanner).toBeVisible();
    const readinessText = page.locator('[data-testid="readiness-verdict-text"]');
    await expect(readinessText).toBeVisible();
    const verdict = await readinessText.textContent();
    console.log(`[PASS] 3. Readiness verdict displays authoritatively: "${verdict}".`);

    // 4. Blocker / warning layout is understandable
    const blockersSection = page.locator('[data-testid="closure-blockers-section"]');
    if (await blockersSection.isVisible()) {
      const blockerCount = await page.locator('[data-testid="closure-blocker-item"]').count();
      console.log(`[PASS] 4. Blocker layout renders with ${blockerCount} items.`);
    }

    // Document evidence section exists
    const docEvidence = page.locator('[data-testid="closure-document-evidence-section"]');
    await expect(docEvidence).toBeVisible();
    await expect(page.locator('[data-testid="evidence-card-bast"]')).toBeVisible();
    await expect(page.locator('[data-testid="evidence-card-final-report"]')).toBeVisible();
    console.log('[PASS] 4b. Document evidence cards (BAST & Final Report) render correctly.');

    // 5. Capture screenshot of Closure Section
    await captureScreenshot(page, 'c5_01_project_workspace_closure_section.png');

    // -------------------------------------------------------------------------
    // 6. WORKFLOW ROUTE /workflow VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n[C5-BROWSER 6] Logging out and logging in as HOO (hops@epms.com) to validate /workflow approval center...');
    await logoutViaUi(page, BASE_URL);
    await loginViaUi(page, BASE_URL, 'hops@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('[C5-BROWSER 7] Navigating to /workflow...');
    await page.goto(`${BASE_URL}/workflow`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 6. Workflow route loads
    await expect(page).toHaveURL(/.*\/workflow/);
    console.log('[PASS] 6. Workflow route /workflow loads.');

    // Verify Tabs exist (Tasks and Definitions)
    const workflowTabs = page.locator('.ant-tabs-tab');
    await expect(workflowTabs.first()).toContainText('Tugas Persetujuan');
    console.log('[PASS] 7. Workflow Task Center tab is present and active.');

    // Verify Workflow Task Center table or card renders
    const taskCenter = page.locator('[data-testid="workflow-task-center"]');
    await expect(taskCenter).toBeVisible();
    console.log('[PASS] 8. WorkflowTaskCenter component rendered successfully.');

    // Capture screenshot of Workflow page
    await captureScreenshot(page, 'c5_02_workflow_approval_center.png');

    // -------------------------------------------------------------------------
    // 9. LOGOUT & CONSOLE ERROR CHECK
    // -------------------------------------------------------------------------
    expect(pageErrors.length).toBe(0);
    console.log('[PASS] 10. Zero fatal page runtime errors detected.');
  });
});
