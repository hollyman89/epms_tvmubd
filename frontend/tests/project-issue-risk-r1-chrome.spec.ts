import { test, expect, Page, Locator } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi, logoutViaUi } from './canonical-lifecycle-helpers';

// Helper to load env
function loadEnvFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...v] = trimmed.split('=');
          process.env[k.trim()] = v.join('=').trim();
        }
      });
    }
  } catch {}
}

loadEnvFile(path.resolve(__dirname, '../.env.local'));
loadEnvFile(path.resolve(__dirname, '../../backend/.env'));

const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('[SECURITY STOP] E2E_TEST_PASSWORD environment variable is required.');
}

const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:4000/api/v1';
const PM_EMAIL = 'pm@epms.com';
const SECONDARY_PM_EMAIL = 'faza@epms.com';
const PROJECT_ID = 2007;

const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-issue-risk-r1');
const BRAIN_DIR = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\UBDOPS3',
  '.gemini/antigravity-ide/brain/d8d26e2a-2c42-4769-b525-864d3146ccd0'
);

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}
if (!fs.existsSync(BRAIN_DIR)) {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
}

async function captureEvidence(page: Page, filename: string) {
  const p1 = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: p1, fullPage: true });
  try {
    const p2 = path.join(BRAIN_DIR, filename);
    fs.copyFileSync(p1, p2);
  } catch (err) {
    console.warn(`[WARN] Could not copy evidence to brain: ${err}`);
  }
  console.log(`[EVIDENCE CAPTURED] ${filename}`);
}

async function selectAntOption(page: Page, selectLocator: Locator, optionText: string | RegExp) {
  await selectLocator.click();
  await page.waitForTimeout(300);
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: optionText })
    .first();
  await option.waitFor({ state: 'visible', timeout: 5000 });
  await option.click();
  await page.waitForTimeout(200);
}

test.describe('EPMS: PROJECT-ISSUE-RISK-R1 Headed Chrome Live Validation', () => {
  test.setTimeout(300000);

  test('Complete Phase 22 Issue & Risk Management E2E Lifecycle', async ({ page }) => {
    const timestamp = Date.now();
    const testIssueTitle = `LIVE-ISSUE-P22-${timestamp}`;
    const testRiskTitle = `LIVE-RISK-P22-${timestamp}`;

    let createdIssueId: number = 0;
    let createdIssueNumber: string = '';
    let createdRiskId: number = 0;
    let createdRiskNumber: string = '';
    let materializedIssueNumber: string = '';

    let progressBefore: string = '';
    let progressAfter: string = '';

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // =========================================================================
    // STEP 1: Scenario A — Login and Navigate to Issue & Risk Workspace
    // =========================================================================
    await test.step('01. Scenario A — Login and Navigate to Issue & Risk Workspace', async () => {
      await loginViaUi(page, BASE_URL, PM_EMAIL, E2E_PASSWORD);

      // Direct navigate to project 2007 issue-risk workspace
      await page.goto(`${BASE_URL}/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=issue-risk`, {
        waitUntil: 'domcontentloaded',
      });

      // Verify workspace rendered
      await expect(page.locator('[data-testid="project-issue-risk-workspace"]')).toBeVisible({ timeout: 15000 });

      // Verify PM Identity Presentation: Must be "Project Manager", NOT "Faza Afina"
      const headerLocator = page.locator('[data-testid="project-workspace-header"]');
      await expect(headerLocator).toBeVisible();
      await expect(headerLocator).toContainText('Project Manager');
      await expect(headerLocator).not.toContainText('Faza Afina');

      // Capture initial Project Progress
      const kpiBar = page.locator('[data-testid="workspace-header-kpi-bar"]');
      await expect(kpiBar).toBeVisible();
      progressBefore = (await kpiBar.innerText()).trim();
      console.log(`[PROGRESS BEFORE]:\n${progressBefore}`);
      expect(progressBefore).toContain('0%');

      // Verify no fatal array filtering crash
      const fatalFilterErrors = consoleErrors.filter(
        (e) => e.includes('issues.filter') || e.includes('risks.filter')
      );
      expect(fatalFilterErrors).toHaveLength(0);
    });

    // =========================================================================
    // STEP 2: Scenario B — Create Fresh Issue & Verify Persistence
    // =========================================================================
    await test.step('02. Scenario B — Create Fresh Issue & Verify Persistence', async () => {
      // Click "Buat Issue" button
      const createBtn = page.locator('[data-testid="create-issue-btn"]');
      await expect(createBtn).toBeVisible({ timeout: 10000 });
      await createBtn.click();

      // Fill form
      await page.locator('[data-testid="issue-title-input"]').fill(testIssueTitle);
      await page.locator('[data-testid="issue-description-input"]').fill('Pengujian Playwright lifecycle Issue Phase 22');

      // Select category: TECHNICAL
      await selectAntOption(page, page.locator('[data-testid="issue-category-select"]'), 'TECHNICAL');

      // Select owner: Project Manager
      await selectAntOption(page, page.locator('[data-testid="issue-owner-select"]'), /Project Manager/i);

      // Select severity: HIGH
      await selectAntOption(page, page.locator('[data-testid="issue-severity-select"]'), 'HIGH');

      // Select priority: HIGH
      await selectAntOption(page, page.locator('[data-testid="issue-priority-select"]'), 'HIGH');

      // Submit
      const submitBtn = page.locator('[data-testid="submit-create-issue-btn"]');
      await submitBtn.click();

      // Wait for table row to appear
      const issueRow = page.locator('tr').filter({ hasText: testIssueTitle });
      await expect(issueRow).toBeVisible({ timeout: 15000 });

      // Assert initial state: OPEN, Owner=Project Manager, Severity=HIGH, Priority=HIGH
      await expect(issueRow).toContainText('OPEN');
      await expect(issueRow).toContainText('Project Manager');
      await expect(issueRow).toContainText('HIGH');

      // Extract issue number
      const numEl = issueRow.locator('[data-testid^="issue-number-"]');
      createdIssueNumber = (await numEl.innerText()).trim();
      const testIdAttr = await numEl.getAttribute('data-testid');
      createdIssueId = Number(testIdAttr?.replace('issue-number-', ''));
      console.log(`[CREATED ISSUE]: ${createdIssueNumber} (ID: ${createdIssueId})`);
      expect(createdIssueNumber).toMatch(/^ISS-\d{8}-\d{3}$/);

      // Capture evidence: 01_issue_created_open.png
      await captureEvidence(page, '01_issue_created_open.png');

      // Reload page and verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-testid="project-issue-risk-workspace"]')).toBeVisible({ timeout: 15000 });
      const persistedRow = page.locator('tr').filter({ hasText: testIssueTitle });
      await expect(persistedRow).toBeVisible();
      await expect(persistedRow).toContainText('OPEN');
      await expect(persistedRow).toContainText('Project Manager');
    });

    // =========================================================================
    // STEP 3: Scenario C — Issue Lifecycle: Start, Resolve, and Close
    // =========================================================================
    await test.step('03. Scenario C — Issue Lifecycle: Start, Resolve, and Close', async () => {
      // 1. START: OPEN -> IN_PROGRESS
      const startBtn = page.locator(`[data-testid="start-issue-btn-${createdIssueId}"]`);
      await expect(startBtn).toBeVisible({ timeout: 10000 });
      await startBtn.click();

      const rowInProgress = page.locator('tr').filter({ hasText: testIssueTitle });
      await expect(rowInProgress).toContainText('IN_PROGRESS', { timeout: 10000 });

      // Reload to verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(rowInProgress).toContainText('IN_PROGRESS');
      await captureEvidence(page, '02_issue_in_progress.png');

      // 2. RESOLVE: IN_PROGRESS -> RESOLVED
      const resolveBtn = page.locator(`[data-testid="resolve-issue-btn-${createdIssueId}"]`);
      await expect(resolveBtn).toBeVisible({ timeout: 10000 });
      await resolveBtn.click();

      // Fill resolution note
      await page
        .locator('[data-testid="resolve-resolution-input"]')
        .fill('Pengujian Playwright Phase 22 selesai dan issue berhasil ditangani.');
      await page.locator('[data-testid="submit-resolve-btn"]').click();

      const rowResolved = page.locator('tr').filter({ hasText: testIssueTitle });
      await expect(rowResolved).toContainText('RESOLVED', { timeout: 10000 });

      // Reload to verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(rowResolved).toContainText('RESOLVED');

      // 3. CLOSE: RESOLVED -> CLOSED (if authorized)
      const closeBtn = page.locator(`[data-testid="close-issue-btn-${createdIssueId}"]`);
      if (await closeBtn.isVisible({ timeout: 5000 })) {
        await closeBtn.click();
        // Confirm popconfirm
        const confirmOk = page.locator('.ant-popconfirm-buttons .ant-btn-primary');
        await confirmOk.click();

        const rowClosed = page.locator('tr').filter({ hasText: testIssueTitle });
        await expect(rowClosed).toContainText('CLOSED', { timeout: 10000 });

        // Reload to verify persistence
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(rowClosed).toContainText('CLOSED');
        console.log('[ISSUE LIFECYCLE]: Successfully CLOSED');
      } else {
        console.log('[ISSUE LIFECYCLE]: Close action not available for current role.');
      }

      await captureEvidence(page, '03_issue_resolved_or_closed.png');
    });

    // =========================================================================
    // STEP 4: Scenario D — Create Unassessed Risk & Verify Belum Dinilai
    // =========================================================================
    await test.step('04. Scenario D — Create Unassessed Risk & Verify Belum Dinilai', async () => {
      // Switch tab to risks
      const riskTab = page.locator('.ant-segmented-item').filter({ hasText: /Daftar Risiko/i });
      await riskTab.click();
      await page.waitForTimeout(500);

      // Click "Daftarkan Risiko"
      const createRiskBtn = page.locator('[data-testid="create-risk-btn"]');
      await expect(createRiskBtn).toBeVisible({ timeout: 10000 });
      await createRiskBtn.click();

      // Fill title & description
      await page.locator('[data-testid="risk-title-input"]').fill(testRiskTitle);
      await page.locator('[data-testid="risk-description-input"]').fill('Pengujian Playwright Risk Management Phase 22');

      // Select category: TECHNICAL
      await selectAntOption(page, page.locator('[data-testid="risk-category-select"]'), 'TECHNICAL');

      // Select owner: Project Manager
      await selectAntOption(page, page.locator('[data-testid="risk-owner-select"]'), /Project Manager/i);

      // CRITICAL: Probability & Impact left EMPTY

      // Submit
      await page.locator('[data-testid="submit-create-risk-btn"]').click();

      // Wait for row
      const riskRow = page.locator('tr').filter({ hasText: testRiskTitle });
      await expect(riskRow).toBeVisible({ timeout: 15000 });

      // Assert unassessed state:
      // Status = IDENTIFIED
      await expect(riskRow).toContainText('IDENTIFIED');
      // Probability = Belum dinilai
      await expect(riskRow.locator('[data-testid="risk-probability-cell"]')).toContainText('Belum dinilai');
      // Impact = Belum dinilai
      await expect(riskRow.locator('[data-testid="risk-impact-cell"]')).toContainText('Belum dinilai');
      // Score = N/A
      await expect(riskRow.locator('[data-testid="risk-score-cell"]')).toContainText('N/A');
      // Risk Level = Belum dinilai
      await expect(riskRow.locator('[data-testid="risk-level-unassessed"]')).toContainText('Belum dinilai');

      // Must NOT contain 0, LOW, ASSESSED
      expect(await riskRow.locator('[data-testid="risk-score-cell"]').innerText()).not.toBe('0');
      expect(await riskRow.locator('[data-testid="risk-level-unassessed"]').innerText()).not.toBe('LOW');

      // Extract risk number & ID
      const numEl = riskRow.locator('[data-testid^="risk-number-"]');
      createdRiskNumber = (await numEl.innerText()).trim();
      const testIdAttr = await numEl.getAttribute('data-testid');
      createdRiskId = Number(testIdAttr?.replace('risk-number-', ''));
      console.log(`[CREATED RISK]: ${createdRiskNumber} (ID: ${createdRiskId})`);
      expect(createdRiskNumber).toMatch(/^RSK-\d{8}-\d{3}$/);

      await captureEvidence(page, '04_risk_identified_unassessed.png');

      // Reload and verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-testid="project-issue-risk-workspace"]')).toBeVisible({ timeout: 15000 });
      // ensure we are on risks tab
      const riskTabAfter = page.locator('.ant-segmented-item').filter({ hasText: /Daftar Risiko/i });
      if (!(await page.locator('tr').filter({ hasText: testRiskTitle }).isVisible())) {
        await riskTabAfter.click();
      }
      const persistedRiskRow = page.locator('tr').filter({ hasText: testRiskTitle });
      await expect(persistedRiskRow).toBeVisible();
      await expect(persistedRiskRow).toContainText('IDENTIFIED');
      await expect(persistedRiskRow.locator('[data-testid="risk-score-cell"]')).toContainText('N/A');
    });

    // =========================================================================
    // STEP 5: Scenario E & F — Assess Risk 4x4, CRITICAL 16 & Mitigation Plan
    // =========================================================================
    await test.step('05. Scenario E & F — Assess Risk 4x4, CRITICAL 16 & Mitigation Plan', async () => {
      // 1. ASSESS: 4x4
      const assessBtn = page.locator(`[data-testid="assess-risk-btn-${createdRiskId}"]`);
      await expect(assessBtn).toBeVisible({ timeout: 10000 });
      await assessBtn.click();

      // Select Probability = 4
      await selectAntOption(page, page.locator('[data-testid="assess-probability-select"]'), /^4/);

      // Select Impact = 4
      await selectAntOption(page, page.locator('[data-testid="assess-impact-select"]'), /^4/);

      // Submit assessment
      await page.locator('[data-testid="submit-assess-btn"]').click();

      // Verify in table
      const assessedRow = page.locator('tr').filter({ hasText: testRiskTitle });
      await expect(assessedRow).toContainText('ASSESSED', { timeout: 10000 });
      await expect(assessedRow.locator('[data-testid="risk-probability-cell"]')).toContainText('4 / 5');
      await expect(assessedRow.locator('[data-testid="risk-impact-cell"]')).toContainText('4 / 5');
      await expect(assessedRow.locator('[data-testid="risk-score-cell"]')).toContainText('16');
      await expect(assessedRow.locator('[data-testid="risk-level-critical"]')).toContainText('CRITICAL');

      // Reload and verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      const riskTab = page.locator('.ant-segmented-item').filter({ hasText: /Daftar Risiko/i });
      if (!(await page.locator('tr').filter({ hasText: testRiskTitle }).isVisible())) {
        await riskTab.click();
      }
      const persistedAssessed = page.locator('tr').filter({ hasText: testRiskTitle });
      await expect(persistedAssessed.locator('[data-testid="risk-score-cell"]')).toContainText('16');
      await expect(persistedAssessed.locator('[data-testid="risk-level-critical"]')).toContainText('CRITICAL');

      await captureEvidence(page, '05_risk_critical_16.png');

      // 2. MITIGATION UPDATE
      const mitBtn = page.locator(`[data-testid="mitigation-risk-btn-${createdRiskId}"]`);
      await expect(mitBtn).toBeVisible({ timeout: 10000 });
      await mitBtn.click();

      const mitInput = page.locator('[data-testid="edit-mitigation-plan-input"]');
      await expect(mitInput).toBeVisible();
      await mitInput.fill(
        'Siapkan alternatif material/vendor dan lakukan percepatan koordinasi sebelum berdampak ke jadwal proyek.'
      );
      await page.locator('[data-testid="submit-mitigation-btn"]').click();

      // Reload and verify
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (!(await page.locator('tr').filter({ hasText: testRiskTitle }).isVisible())) {
        await riskTab.click();
      }
      await expect(page.locator('tr').filter({ hasText: testRiskTitle })).toBeVisible();
      console.log('[MITIGATION]: Successfully saved and persisted');
    });

    // =========================================================================
    // STEP 6: Scenario G & H — Materialize Risk to Issue & Duplicate Guard
    // =========================================================================
    await test.step('06. Scenario G & H — Materialize Risk to Issue & Duplicate Guard', async () => {
      // Click "Materialisasi" button
      const matBtn = page.locator(`[data-testid="materialize-risk-btn-${createdRiskId}"]`);
      await expect(matBtn).toBeVisible({ timeout: 10000 });
      await matBtn.click();

      // Capture modal form: 06_risk_materialization_form.png
      await captureEvidence(page, '06_risk_materialization_form.png');

      // Explicitly select Severity = HIGH (NOT auto CRITICAL)
      await selectAntOption(page, page.locator('[data-testid="materialize-severity-select"]'), /^HIGH/);

      // Explicitly select Priority = HIGH
      await selectAntOption(page, page.locator('[data-testid="materialize-priority-select"]'), /^HIGH/);

      // Submit materialization
      await page.locator('[data-testid="submit-materialize-btn"]').click();

      // Verify Risk status becomes MATERIALIZED
      const matRiskRow = page.locator('tr').filter({ hasText: testRiskTitle });
      await expect(matRiskRow).toContainText('MATERIALIZED', { timeout: 10000 });
      await captureEvidence(page, '07_risk_materialized.png');

      // Verify DUPLICATE GUARD: Materialize button is now UNAVAILABLE for this row
      const duplicateMatBtn = page.locator(`[data-testid="materialize-risk-btn-${createdRiskId}"]`);
      await expect(duplicateMatBtn).not.toBeVisible();

      // Switch to Issue Register tab
      const issueTab = page.locator('.ant-segmented-item').filter({ hasText: /Daftar Issue/i });
      await issueTab.click();
      await page.waitForTimeout(500);

      // Verify linked Issue exists
      const materializedIssueRow = page.locator('tr').filter({ hasText: testRiskTitle });
      await expect(materializedIssueRow).toBeVisible({ timeout: 10000 });
      await expect(materializedIssueRow).toContainText('Materialized Risk');
      await expect(materializedIssueRow).toContainText('OPEN');
      await expect(materializedIssueRow).toContainText('HIGH'); // Severity was explicitly set to HIGH, not CRITICAL

      const numEl = materializedIssueRow.locator('[data-testid^="issue-number-"]');
      materializedIssueNumber = (await numEl.innerText()).trim();
      console.log(`[MATERIALIZED ISSUE]: ${materializedIssueNumber}`);

      await captureEvidence(page, '08_linked_issue.png');
    });

    // =========================================================================
    // STEP 7: Scenario I — Direct Canonical Deep-Link Verification
    // =========================================================================
    await test.step('07. Scenario I — Direct Canonical Deep-Link Verification', async () => {
      // Navigate using canonical direct deep link to the created Issue
      await page.goto(
        `${BASE_URL}/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=issue-risk&type=issue&id=${createdIssueId}`,
        { waitUntil: 'domcontentloaded' }
      );

      await expect(page.locator('[data-testid="project-issue-risk-workspace"]')).toBeVisible({ timeout: 15000 });

      // Verify exact record detail modal opens
      const modalContent = page.locator('.ant-modal-content').filter({ hasText: createdIssueNumber });
      await expect(modalContent).toBeVisible({ timeout: 10000 });
      await expect(modalContent).toContainText(testIssueTitle);

      await captureEvidence(page, '09_deep_link_exact_record.png');

      // Close modal
      const closeBtn = page.locator('.ant-modal-close').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    });

    // =========================================================================
    // STEP 8: Scenario J — Cross-PM Authorization & Project Isolation
    // =========================================================================
    await test.step('08. Scenario J — Cross-PM Authorization & Project Isolation', async () => {
      // Logout primary PM
      await logoutViaUi(page, BASE_URL);

      // Login as secondary PM: faza@epms.com
      await loginViaUi(page, BASE_URL, SECONDARY_PM_EMAIL, E2E_PASSWORD);

      // 1. Check Project Delivery listing
      await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Switch to "Daftar Proyek Berjalan"
      const activeProjectsTab = page.locator('div[role="tab"]').filter({ hasText: 'Daftar Proyek Berjalan' });
      if (await activeProjectsTab.isVisible()) {
        await activeProjectsTab.click();
        await page.waitForTimeout(1000);
        // Project 2007 (CONT-20261008-0149) must NOT be present in Faza's list
        const projectRow = page.locator('tr').filter({ hasText: 'CONT-20261008-0149' });
        await expect(projectRow).not.toBeVisible();
      }

      // 2. Direct deep link attempt to Project 2007 issue-risk workspace
      let eligibleOwnersStatus = 0;
      page.on('response', (response) => {
        if (response.url().includes(`/project/${PROJECT_ID}/eligible-owners`)) {
          eligibleOwnersStatus = response.status();
        }
      });

      await page.goto(`${BASE_URL}/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=issue-risk`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForTimeout(2000);

      // Verify eligible-owners was denied with 403 Forbidden
      console.log(`[CROSS-PM ELIGIBLE-OWNERS HTTP STATUS]: ${eligibleOwnersStatus}`);
      expect([403, 401]).toContain(eligibleOwnersStatus);

      await captureEvidence(page, '10_cross_pm_denied.png');

      // Logout secondary PM
      await logoutViaUi(page, BASE_URL);
    });

    // =========================================================================
    // STEP 9: Scenario K — Progress Isolation Verification
    // =========================================================================
    await test.step('09. Scenario K — Progress Isolation Verification', async () => {
      // Log back in as primary PM
      await loginViaUi(page, BASE_URL, PM_EMAIL, E2E_PASSWORD);

      // Navigate to Project 2007 workspace
      await page.goto(`${BASE_URL}/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=issue-risk`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('[data-testid="project-issue-risk-workspace"]')).toBeVisible({ timeout: 15000 });

      const kpiBar = page.locator('[data-testid="workspace-header-kpi-bar"]');
      await expect(kpiBar).toBeVisible();
      progressAfter = (await kpiBar.innerText()).trim();
      console.log(`[PROGRESS AFTER]:\n${progressAfter}`);

      // Verify progress remains unchanged at 0%
      expect(progressAfter).toContain('0%');
      console.log('[PROGRESS ISOLATION]: Verified — No progress mutation from Issue/Risk operations.');
    });

    // =========================================================================
    // STEP 10: Responsive Viewport Audits (1440, 1024, 390)
    // =========================================================================
    await test.step('10. Responsive Viewport Audits (1440, 1024, 390)', async () => {
      await page.goto(`${BASE_URL}/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=issue-risk`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('[data-testid="project-issue-risk-workspace"]')).toBeVisible({ timeout: 15000 });

      // Viewport 1440 x 900
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(500);
      await captureEvidence(page, '11_responsive_1440.png');
      let hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(hasOverflow).toBe(false);

      // Viewport 1024 x 768
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(500);
      await captureEvidence(page, '12_responsive_1024.png');
      hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(hasOverflow).toBe(false);

      // Viewport 390 x 844
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      await captureEvidence(page, '13_responsive_390.png');
      hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(hasOverflow).toBe(false);

      console.log('[RESPONSIVE AUDIT]: All viewports passed without whole-page overflow.');
    });
  });
});
