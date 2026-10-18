import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi } from './canonical-lifecycle-helpers';

const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required');
}
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-pm-workspace-r1-c1');
const BRAIN_DIR = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\UBDOPS3',
  '.gemini/antigravity-ide/brain/6c538265-5bba-444b-8510-1f8594078a51'
);

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function captureEvidence(page: Page, filename: string) {
  const p1 = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: p1, fullPage: true });
  try {
    const p2 = path.join(BRAIN_DIR, filename);
    fs.copyFileSync(p1, p2);
  } catch (err) {
    console.warn(`[WARN] Could not copy to brain dir: ${err}`);
  }
  console.log(`[EVIDENCE CAPTURED] ${filename}`);
}

test.describe('EPMS — PROJECT-PM-WORKSPACE-R1-C1 Visible Google Chrome Validation', () => {
  test.setTimeout(240000);

  test('FULL C1 WORKSPACE VALIDATION SUITE — Scenarios A through O', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
      console.error('[RUNTIME ERROR]', err);
    });

    // -------------------------------------------------------------------------
    // SCENARIO A: Project Delivery Main Page & 2 Top-Level Tabs Verification
    // -------------------------------------------------------------------------
    console.log('\n[CHROME A] Logging in as PM (pm@epms.com)...');
    await loginViaUi(page, BASE_URL, 'pm@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('[CHROME A] Navigating to Project Delivery...');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });

    // Top level Project Delivery must contain exactly 2 tabs
    const deliveryTabs = page.locator('[data-testid="project-delivery-tabs"] .ant-tabs-nav-list .ant-tabs-tab');
    await expect(deliveryTabs).toHaveCount(2);
    await expect(deliveryTabs.nth(0)).toContainText('Antrean Kick-off Charter');
    await expect(deliveryTabs.nth(1)).toContainText('Daftar Proyek Berjalan');

    // Make sure Daftar Proyek Berjalan is active
    await deliveryTabs.nth(1).click();
    await page.waitForTimeout(500);

    const activeTable = page.locator('[data-testid="active-projects-table"]');
    await expect(activeTable).toBeVisible({ timeout: 15000 });
    await captureEvidence(page, 'c1_01_project_delivery_main_page.png');

    // -------------------------------------------------------------------------
    // SCENARIO B: Click Project Name -> Opens Unified Project Workspace
    // -------------------------------------------------------------------------
    console.log('\n[CHROME B] Clicking Project Name to open Unified Project Workspace...');
    const projectLink = page.locator('[data-testid^="project-name-link-"]').first();
    await expect(projectLink).toBeVisible();
    const projectNameText = await projectLink.textContent();
    console.log(`[CHROME B] Opening project: ${projectNameText}`);
    await projectLink.click();
    await page.waitForTimeout(1000);

    // Workspace shell must be visible
    const workspaceShell = page.locator('[data-testid="project-workspace-shell"]');
    await expect(workspaceShell).toBeVisible({ timeout: 15000 });

    // Canonical URL check
    await expect(page).toHaveURL(/.*view=workspace.*projectId=\d+/);
    await captureEvidence(page, 'c1_02_workspace_opened.png');

    // -------------------------------------------------------------------------
    // SCENARIO C: Overview Default Section Verification
    // -------------------------------------------------------------------------
    console.log('\n[CHROME C] Verifying Overview Tab Default Presentation...');
    const overviewSection = page.locator('[data-testid="workspace-section-overview"]');
    await expect(overviewSection).toBeVisible();

    // Verify workspace header
    const workspaceHeader = page.locator('[data-testid="project-workspace-header"]');
    await expect(workspaceHeader).toBeVisible();
    await expect(workspaceHeader.locator('h1')).toBeVisible();

    // Verify no fabricated shell fallbacks (PRJ-N/A, Baseline Aktif)
    const headerHtml = await workspaceHeader.innerHTML();
    expect(headerHtml).not.toContain('PRJ-N/A');
    expect(headerHtml).not.toContain('Baseline Aktif');

    // Verify Overview content cards
    await expect(page.locator('[data-testid="overview-progress-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="overview-schedule-summary"]')).toBeVisible();
    
    // Schedule summary must show "Belum selesai" or honest finish date, not raw engineering text
    const schedSummary = page.locator('[data-testid="overview-schedule-summary"]');
    const schedText = await schedSummary.textContent();
    expect(schedText).not.toContain('strictly NOT MODELED');
    expect(schedText).toContain('Belum selesai');

    // Update Progress button visibility for PM
    const updateProgressBtn = page.locator('[data-testid="workspace-header-update-progress-btn"]');
    await expect(updateProgressBtn).toBeVisible();

    // Single More control in primary nav (not duplicate)
    const moreNav = page.locator('[data-testid="nav-tab-more"]');
    await expect(moreNav).toBeVisible();
    const allMoreInNav = page.locator('[data-testid="workspace-primary-nav"] [data-testid="nav-tab-more"]');
    await expect(allMoreInNav).toHaveCount(1);

    await captureEvidence(page, 'c1_03_workspace_overview_tab.png');

    // -------------------------------------------------------------------------
    // SCENARIO D: Task Board Embedded Mode
    // -------------------------------------------------------------------------
    console.log('\n[CHROME D] Switching to Task Board tab...');
    const taskNavTab = page.locator('[data-testid="nav-tab-tasks"]');
    await taskNavTab.click();
    await page.waitForTimeout(1000);

    const taskBoard = page.locator('[data-testid="project-task-board"]');
    await expect(taskBoard).toBeVisible({ timeout: 15000 });

    // Verify embedded mode: internal breadcrumbs & top nav row are hidden inside task board
    const taskBoardInternalNav = taskBoard.locator('[class*="topNavRow"]');
    await expect(taskBoardInternalNav).toHaveCount(0);
    const taskBoardInternalHeader = taskBoard.locator('[class*="headerCard"]');
    await expect(taskBoardInternalHeader).toHaveCount(0);

    await captureEvidence(page, 'c1_04_task_board_embedded.png');

    // -------------------------------------------------------------------------
    // SCENARIO E: Monitoring Embedded Mode
    // -------------------------------------------------------------------------
    console.log('\n[CHROME E] Switching to Monitoring tab...');
    const monitoringNavTab = page.locator('[data-testid="nav-tab-monitoring"]');
    await monitoringNavTab.click();
    await page.waitForTimeout(1000);

    const monitoringWorkspace = page.locator('[data-testid="project-progress-monitoring"]');
    await expect(monitoringWorkspace).toBeVisible({ timeout: 15000 });

    // Verify embedded mode: internal top nav row hidden
    const monitoringInternalNav = monitoringWorkspace.locator('[class*="topNavRow"]');
    await expect(monitoringInternalNav).toHaveCount(0);

    // KPI cards remain visible inside monitoring
    await expect(monitoringWorkspace.locator('[data-testid="kpi-planned-today"]')).toBeVisible();
    await expect(monitoringWorkspace.locator('[data-testid="kpi-actual-today"]')).toBeVisible();
    await expect(monitoringWorkspace.locator('[data-testid="kpi-variance"]')).toBeVisible();
    await expect(monitoringWorkspace.locator('[data-testid="kpi-health"]')).toBeVisible();

    // S-Curve chart is visible
    const scurveCard = monitoringWorkspace.locator('[data-testid="scurve-chart-card"]');
    await expect(scurveCard).toBeVisible();

    await captureEvidence(page, 'c1_05_monitoring_embedded.png');

    // -------------------------------------------------------------------------
    // SCENARIO F: Gantt Embedded Mode
    // -------------------------------------------------------------------------
    console.log('\n[CHROME F] Switching to Gantt tab...');
    const ganttNavTab = page.locator('[data-testid="nav-tab-gantt"]');
    await ganttNavTab.click();
    await page.waitForTimeout(1000);

    const ganttWorkspace = page.locator('[data-testid="project-gantt-workspace"]');
    await expect(ganttWorkspace).toBeVisible({ timeout: 15000 });

    // Verify embedded mode: duplicated internal headerCard is hidden inside Gantt
    const ganttInternalHeader = ganttWorkspace.locator('[class*="headerCard"]');
    await expect(ganttInternalHeader).toHaveCount(0);

    // Summary cards and table remain visible
    await expect(ganttWorkspace.locator('[data-testid="gantt-summary-cards"]')).toBeVisible();

    await captureEvidence(page, 'c1_06_gantt_embedded.png');

    // -------------------------------------------------------------------------
    // SCENARIO G & H: More Menu & Activity / History Drawer
    // -------------------------------------------------------------------------
    console.log('\n[CHROME G & H] Testing More dropdown & Activity/History drawer...');
    const moreDropdownBtn = page.locator('[data-testid="nav-tab-more"]');
    await expect(moreDropdownBtn).toBeVisible();
    await moreDropdownBtn.click();
    await page.waitForTimeout(400);

    const activityMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Activity / History")');
    await expect(activityMenuItem).toBeVisible();
    await activityMenuItem.click();
    await page.waitForTimeout(800);

    // Project Detail Drawer should open with Activity tab active
    const detailDrawer = page.locator('.ant-drawer:has-text("Project Detail")');
    await expect(detailDrawer).toBeVisible();
    const activityTabBtn = detailDrawer.locator('[data-tab-key="activity"]');
    await expect(activityTabBtn).toBeVisible();

    await captureEvidence(page, 'c1_07_activity_drawer_opened.png');

    // Close the drawer
    const closeBtn = detailDrawer.locator('.ant-drawer-close');
    await closeBtn.click();
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // SCENARIO I: Legacy Task Board Deep-Link Canonicalization
    // -------------------------------------------------------------------------
    console.log('\n[CHROME I] Testing legacy task-board URL canonicalization...');
    await page.goto(`${BASE_URL}/project-delivery?view=task-board&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    // Canonicalized URL check
    await expect(page).toHaveURL(/.*view=workspace.*projectId=1760.*section=tasks/);
    await expect(page.locator('[data-testid="project-task-board"]')).toBeVisible();
    await captureEvidence(page, 'c1_08_legacy_task_board_canonical.png');

    // -------------------------------------------------------------------------
    // SCENARIO J: Legacy Monitoring Deep-Link Canonicalization
    // -------------------------------------------------------------------------
    console.log('\n[CHROME J] Testing legacy progress-monitoring URL canonicalization...');
    await page.goto(`${BASE_URL}/project-delivery?view=progress-monitoring&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(/.*view=workspace.*projectId=1760.*section=monitoring/);
    await expect(page.locator('[data-testid="project-progress-monitoring"]')).toBeVisible();
    await captureEvidence(page, 'c1_09_legacy_monitoring_canonical.png');

    // -------------------------------------------------------------------------
    // SCENARIO K: Legacy Gantt Deep-Link Canonicalization
    // -------------------------------------------------------------------------
    console.log('\n[CHROME K] Testing legacy gantt URL canonicalization...');
    await page.goto(`${BASE_URL}/project-delivery?view=gantt&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(/.*view=workspace.*projectId=1760.*section=gantt/);
    await expect(page.locator('[data-testid="project-gantt-workspace"]')).toBeVisible();
    await captureEvidence(page, 'c1_10_legacy_gantt_canonical.png');

    // -------------------------------------------------------------------------
    // SCENARIO L: Direct Refresh of Workspace
    // -------------------------------------------------------------------------
    console.log('\n[CHROME L] Direct refresh of workspace...');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="project-workspace-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-workspace-header"] h1')).toBeVisible();
    await captureEvidence(page, 'c1_11_direct_refresh_preserved.png');

    // -------------------------------------------------------------------------
    // SCENARIO M: Browser Back / Forward
    // -------------------------------------------------------------------------
    console.log('\n[CHROME M] Testing browser back and forward navigation...');
    // Click overview tab to create history entry
    await page.locator('[data-testid="nav-tab-overview"]').click();
    await page.waitForTimeout(400);
    expect(page.url()).toContain('section=overview');

    // Click tasks tab
    await page.locator('[data-testid="nav-tab-tasks"]').click();
    await page.waitForTimeout(400);
    expect(page.url()).toContain('section=tasks');

    // Browser Back
    await page.goBack();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('section=overview');
    await expect(page.locator('[data-testid="workspace-section-overview"]')).toBeVisible();

    // Browser Forward
    await page.goForward();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('section=tasks');
    await expect(page.locator('[data-testid="project-task-board"]')).toBeVisible();

    await captureEvidence(page, 'c1_12_back_forward_navigation.png');

    // -------------------------------------------------------------------------
    // SCENARIO N: Safe Handling of 404 / Invalid Project ID
    // -------------------------------------------------------------------------
    console.log('\n[CHROME N] Testing safe handling of non-existent project...');
    await page.goto(`${BASE_URL}/project-delivery?view=workspace&projectId=9999999&section=overview`, {
      waitUntil: 'networkidle',
    });
    const errorCard = page.locator('[data-testid="workspace-error-state"]');
    await expect(errorCard).toBeVisible({ timeout: 10000 });
    await captureEvidence(page, 'c1_13_safe_error_handling_404.png');

    // -------------------------------------------------------------------------
    // SCENARIO O: Responsive Viewports (Desktop, Tablet, Mobile)
    // -------------------------------------------------------------------------
    console.log('\n[CHROME O] Testing responsive viewports...');
    // Return to valid project overview
    await page.goto(`${BASE_URL}/project-delivery?view=workspace&projectId=1760&section=overview`, {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('[data-testid="project-workspace-shell"]')).toBeVisible();

    // Desktop: 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await captureEvidence(page, 'c1_14_responsive_desktop_1440.png');

    // Tablet: 768x1024
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await captureEvidence(page, 'c1_15_responsive_tablet_768.png');

    // Mobile: 375x667
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    await captureEvidence(page, 'c1_16_responsive_mobile_375.png');

    // Verify zero unexpected runtime errors
    expect(pageErrors).toEqual([]);

    console.log('\n[ALL C1 SCENARIOS A THROUGH O VALIDATED SUCCESSFULLY]');
  });
});
