import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi } from './canonical-lifecycle-helpers';

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

if (!process.env.E2E_TEST_PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required for tests');
}
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-exec-f2-f3v');
const BRAIN_DIR = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\UBDOPS3',
  '.gemini/antigravity-ide/brain/88efac64-c2bb-4ce3-a219-5d7fd994a58c'
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
    console.warn(`[WARN] Could not copy screenshot to brain dir: ${err}`);
  }
  console.log(`[EVIDENCE CAPTURED] ${filename}`);
}

test.describe('EPMS — PROJECT-EXEC-F2-F3V Full F3 UI Validation Suite', () => {
  test.setTimeout(240000);

  test.use({
    viewport: { width: 1440, height: 900 },
  });

  test('COMPREHENSIVE F3 ACCEPTANCE GATE — Scenarios 1 through 10', async ({ page }) => {
    // -------------------------------------------------------------------------
    // 1. SCENARIO 1: F3A — DAFTAR PROYEK BERJALAN (Project 1760)
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 1] Logging in as Assigned PM (pm@epms.com)...');
    await loginViaUi(page, BASE_URL, 'pm@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    console.log('[F3V SCENARIO 1] Navigating to Project Delivery & switching to Daftar Proyek Berjalan...');
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan`, { waitUntil: 'networkidle' });

    const activeTab = page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")');
    await expect(activeTab).toBeVisible({ timeout: 15000 });

    const row1760 = page.locator('tr:has-text("CONT-20261006-0125")');
    await expect(row1760).toBeVisible({ timeout: 15000 });

    // Verify F3A control columns
    await expect(row1760).toContainText('PROJECT-E2E-V1-C1 Disposable Fixture');
    await expect(row1760).toContainText('PT Asianet Media Teknologi');
    await expect(row1760).toContainText('Project Manager');
    await expect(row1760).toContainText('21%'); // Actual progress
    await expect(row1760).toContainText('+11 pp'); // Progress variance
    await expect(row1760).toContainText('LEBIH CEPAT'); // Schedule health
    await expect(row1760).toContainText('0 Task Terlambat'); // Overdue count
    await expect(row1760).toContainText('06 Okt 2026'); // Actual start
    await expect(row1760).toContainText('29 Okt 2026'); // Planned finish

    await captureEvidence(page, '01_f3a_active_project_list.png');

    // -------------------------------------------------------------------------
    // 2. SCENARIO 2: F3B — TASK BOARD / KANBAN
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 2] Navigating to Task Board for Project 1760...');
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=task-board&projectId=1760`, {
      waitUntil: 'networkidle',
    });

    const taskBoard = page.locator('[data-testid="project-task-board"]');
    await expect(taskBoard).toBeVisible({ timeout: 15000 });

    // Verify lanes and task counts
    const laneToDo = page.locator('[data-testid="lane-to_do"]');
    const laneInProgress = page.locator('[data-testid="lane-in_progress"]');
    const laneReview = page.locator('[data-testid="lane-review"]');
    const laneDone = page.locator('[data-testid="lane-done"]');

    await expect(laneToDo).toBeVisible();
    await expect(laneInProgress).toBeVisible();
    await expect(laneReview).toBeVisible();
    await expect(laneDone).toBeVisible();

    await expect(laneToDo).toContainText('6');
    await expect(laneInProgress).toContainText('1');
    await expect(laneReview).toContainText('0');
    await expect(laneDone).toContainText('2');

    // Verify representative tasks
    await expect(laneDone).toContainText('Site Survey');
    await expect(laneDone).toContainText('100%');
    await expect(laneDone).toContainText('ATP / Acceptance');
    await expect(laneInProgress).toContainText('Preparation');
    await expect(laneInProgress).toContainText('10%');

    await captureEvidence(page, '02_f3b_full_task_board.png');

    // -------------------------------------------------------------------------
    // 3. SCENARIO 3: F3C — PROGRESS & MONITORING + S-CURVE
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 3] Navigating to Progress & Monitoring + S-Curve...');
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=progress-monitoring&projectId=1760`, {
      waitUntil: 'networkidle',
    });

    const monitoringWorkspace = page.locator('[data-testid="project-progress-monitoring"]');
    await expect(monitoringWorkspace).toBeVisible({ timeout: 15000 });

    // Verify F3C overview KPI cards
    await expect(monitoringWorkspace).toContainText('PROJECT-E2E-V1-C1 Disposable Fixture');
    await expect(monitoringWorkspace).toContainText('CONT-20261006-0125');
    await expect(monitoringWorkspace).toContainText('20.5%'); // Actual progress
    await expect(monitoringWorkspace).toContainText('LEBIH CEPAT'); // Health

    // Verify execution summary chips align 100% with F3B lanes
    const chipsRow = page.locator('[data-testid="execution-summary-chips"]');
    await expect(chipsRow).toContainText('Belum Dimulai:');
    await expect(chipsRow).toContainText('6');
    await expect(chipsRow).toContainText('Dikerjakan:');
    await expect(chipsRow).toContainText('1');
    await expect(chipsRow).toContainText('Menunggu Review:');
    await expect(chipsRow).toContainText('0');
    await expect(chipsRow).toContainText('Selesai:');
    await expect(chipsRow).toContainText('2');

    await captureEvidence(page, '03_f3c_monitoring_overview.png');

    // S-Curve section
    const sCurveCard = page.locator('[data-testid="scurve-chart-card"]');
    await expect(sCurveCard).toBeVisible();
    await captureEvidence(page, '04_f3c_s_curve.png');

    // Work Package & Milestone section
    const wpCard = page.locator('[data-testid="work-package-card"]');
    const milestoneCard = page.locator('[data-testid="milestone-card"]');
    await expect(wpCard).toBeVisible();
    await expect(milestoneCard).toBeVisible();
    await expect(milestoneCard).toContainText('ATP / Acceptance');
    await expect(milestoneCard).toContainText('Selesai Cepat');

    await captureEvidence(page, '05_f3c_work_packages_and_milestones.png');

    // -------------------------------------------------------------------------
    // 4. SCENARIO 4: F3D — GANTT BASELINE VS ACTUAL
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 4] Navigating to Gantt Chart (Baseline vs Actual)...');
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=gantt&projectId=1760`, {
      waitUntil: 'networkidle',
    });

    const ganttWorkspace = page.locator('[data-testid="project-gantt-workspace"]');
    await expect(ganttWorkspace).toBeVisible({ timeout: 15000 });

    // Verify Gantt Header & Summary Cards
    const ganttHeader = page.locator('[data-testid="gantt-header"]');
    const ganttCards = page.locator('[data-testid="gantt-summary-cards"]');
    await expect(ganttHeader).toBeVisible();
    await expect(ganttCards).toBeVisible();

    await expect(ganttCards).toContainText('07 Okt - 29 Okt'); // Planned baseline
    await expect(ganttCards).toContainText('Mulai: 07 Okt 2026 | Selesai: 29 Okt 2026');
    await expect(ganttCards).toContainText('06 Okt -'); // Actual start
    await expect(ganttCards).toContainText('Belum Selesai (Formal Closure Only)'); // Project actual finish strictly not modeled
    await expect(ganttCards).toContainText('20.5%');
    await expect(ganttCards).toContainText('Di Atas Target');
    await expect(ganttCards).toContainText('0 Tugas Overdue');

    await captureEvidence(page, '06_f3d_full_gantt.png');

    // Verify Gantt representative bars & milestone markers
    const planBar1_1 = page.locator('[data-testid="gantt-plan-bar-1.1"]');
    const actualBar1_1 = page.locator('[data-testid="gantt-actual-bar-1.1"]');
    const actualBar1_2 = page.locator('[data-testid="gantt-actual-bar-1.2"]');
    const planMilestone4_2 = page.locator('[data-testid="gantt-plan-milestone-4.2"]');
    const actualMilestone4_2 = page.locator('[data-testid="gantt-actual-milestone-4.2"]');
    const asOfLine = page.locator('[data-testid="gantt-asof-line"]');

    await expect(planBar1_1).toBeVisible();
    await expect(actualBar1_1).toBeVisible();
    await expect(actualBar1_2).toBeVisible();
    await expect(planMilestone4_2).toBeVisible();
    await expect(actualMilestone4_2).toBeVisible();
    await expect(asOfLine).toBeVisible();

    await captureEvidence(page, '07_f3d_actual_vs_baseline_bars.png');

    // -------------------------------------------------------------------------
    // 5. SCENARIO 5: DETAIL PROJECT DRAWER REGRESSION
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 5] Navigating back to Project Master & testing Detail Project drawer...');
    await page.goto(`${BASE_URL}/projects`, { waitUntil: 'networkidle' });

    const masterTable = page.locator('.ant-table-wrapper');
    await expect(masterTable).toBeVisible({ timeout: 15000 });

    const projectRow = page.locator('tr:has-text("CONT-20261006-0125")').first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });

    // Click Lihat Detail to open drawer
    await projectRow.locator('button:has-text("Lihat Detail")').click();
    const detailDrawer = page.locator('.ant-drawer');
    await expect(detailDrawer).toBeVisible({ timeout: 10000 });
    await expect(detailDrawer).toContainText('PROJECT-E2E-V1-C1 Disposable Fixture');

    await captureEvidence(page, '08_detail_project_drawer.png');

    // Close drawer
    const closeBtn = detailDrawer.locator('.ant-drawer-close, button:has-text("Tutup")').first();
    await closeBtn.click();
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // 6. SCENARIO 6: DEEP LINKS & BROWSER BACK/FORWARD
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 6] Testing Deep Links and Browser Back/Forward...');
    // Direct link to Gantt
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=gantt&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('[data-testid="project-gantt-workspace"]')).toBeVisible({ timeout: 10000 });

    // Refresh page
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="project-gantt-workspace"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="gantt-header"]')).toContainText('PROJECT-E2E-V1-C1 Disposable Fixture');

    // Click quick nav to Monitoring
    await page.locator('[data-testid="gantt-nav-monitoring"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="project-progress-monitoring"]')).toBeVisible({ timeout: 10000 });

    // Browser Back
    await page.goBack({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="project-gantt-workspace"]')).toBeVisible({ timeout: 10000 });

    // Browser Forward
    await page.goForward({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="project-progress-monitoring"]')).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // 7. SCENARIO 7: RBAC DIRECT ACCESS DENIAL & ROLE GOVERNANCE
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 7] Testing RBAC: Login as unassigned PM (faza@epms.com)...');
    await loginViaUi(page, BASE_URL, 'faza@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    // Attempt direct navigation to Project 1760 monitoring
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=progress-monitoring&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(1000);

    // Verify access error alert
    const accessDeniedAlert = page.locator('.ant-alert-error');
    await expect(accessDeniedAlert).toBeVisible({ timeout: 15000 });

    await captureEvidence(page, '09_rbac_denied_pm.png');

    // API checks for Governance & Marketing roles
    console.log('[F3V SCENARIO 7] Verifying Marketing role exclusion...');
    const mktLogin = await page.request.post('http://localhost:4000/api/v1/auth/login', {
      data: { email: 'ragil@epms.com', password: E2E_PASSWORD },
    });
    expect(mktLogin.status()).toBe(200);
    const mktToken = (await mktLogin.json()).data?.accessToken;

    const mktRes = await page.request.get('http://localhost:4000/api/v1/project/1760/gantt', {
      headers: { Authorization: `Bearer ${mktToken}` },
    });
    expect(mktRes.status()).toBe(403);

    console.log('[F3V SCENARIO 7] Verifying PMO role allowance...');
    const pmoLogin = await page.request.post('http://localhost:4000/api/v1/auth/login', {
      data: { email: 'pmo@epms.com', password: E2E_PASSWORD },
    });
    expect(pmoLogin.status()).toBe(200);
    const pmoToken = (await pmoLogin.json()).data?.accessToken;

    const pmoRes = await page.request.get('http://localhost:4000/api/v1/project/1760/gantt', {
      headers: { Authorization: `Bearer ${pmoToken}` },
    });
    expect(pmoRes.status()).toBe(200);

    // -------------------------------------------------------------------------
    // 8. SCENARIO 8: RESPONSIVE VALIDATION ACROSS VIEWPORTS
    // -------------------------------------------------------------------------
    console.log('\n[F3V SCENARIO 8] Relogging as Assigned PM to capture responsive evidence...');
    await loginViaUi(page, BASE_URL, 'pm@epms.com', E2E_PASSWORD);
    await page.waitForLoadState('networkidle');

    // Tablet viewport (1024x768)
    await page.setViewportSize({ width: 1024, height: 768 });

    // F3A Responsive
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan`, { waitUntil: 'networkidle' });
    await expect(page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")')).toBeVisible();
    await captureEvidence(page, '10_responsive_f3a.png');

    // F3B Responsive
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=task-board&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('[data-testid="project-task-board"]')).toBeVisible();
    await captureEvidence(page, '11_responsive_f3b.png');

    // F3C Responsive
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=progress-monitoring&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('[data-testid="project-progress-monitoring"]')).toBeVisible();
    await captureEvidence(page, '12_responsive_f3c.png');

    // F3D Responsive
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan&view=gantt&projectId=1760`, {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('[data-testid="project-gantt-workspace"]')).toBeVisible();
    await captureEvidence(page, '13_responsive_f3d.png');

    // Check whole-document overflow on mobile viewport (390x844)
    console.log('[F3V SCENARIO 8] Verifying no whole-document horizontal overflow on mobile viewport...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/project-delivery?tab=berjalan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2; // allowance of 2px
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Reset viewport to standard desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('\n[ALL F3V SCENARIOS COMPLETED SUCCESSFULLY]');
  });
});
