import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi, logoutViaUi } from './canonical-lifecycle-helpers';

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

const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:4000/api/v1';

test.describe('PROJECT-EXEC-F1: Live Google Chrome End-to-End Validation', () => {
  test.setTimeout(180000);

  // =========================================================================
  // SCENARIO A: ROUTINE PROGRESS & SCENARIO B/D: 100% CLAIM WITH EVIDENCE
  // =========================================================================
  test('Scenario A & D (Part 1): Assigned PM updates routine progress (0% -> 25%) and submits critical 100% claim with real evidence', async ({ page }) => {
    console.log('\n[E2E] Starting Scenario A: Assigned PM Routine Progress Update...');

    // Step 1: Login as assigned PM
    await loginViaUi(page, BASE_URL, 'pm@epms.com');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Step 2: Switch to "Daftar Proyek Berjalan" tab (key: '2')
    const activeProjectsTab = page.locator('.ant-tabs-tab', { hasText: 'Daftar Proyek Berjalan' }).first();
    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    // Step 3: Find Project 1364 (CONT-20260928-0042) row and click Detail
    const projectRow = page.locator('tr', { hasText: 'CONT-20260928-0042' }).first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });
    const detailBtn = projectRow.locator('button', { hasText: 'Detail' }).first();
    await detailBtn.click();

    // Step 4: Assert ProjectDetailDrawer is open
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer).toBeVisible({ timeout: 15000 });

    // Step 5: Switch to Task tab
    const taskTabBtn = drawer.locator('button[data-tab-key="task"]');
    await expect(taskTabBtn).toBeVisible();
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    // Step 6: Verify Task 1616 shows initial progress and Update Progress button is present
    const taskListItem = drawer.locator('.ant-list-item').first();
    await expect(taskListItem).toBeVisible();
    await expect(taskListItem).toContainText('Pekerjaan Konstruksi & Fabrikasi Proyek');
    await expect(taskListItem).toContainText('Progress Resmi: 0%');

    const updateProgressBtn = taskListItem.locator('button', { hasText: 'Update Progress' });
    await expect(updateProgressBtn).toBeVisible();

    const claimProgressBtn = taskListItem.locator('button', { hasText: 'Claim Progress' });
    await expect(claimProgressBtn).toBeVisible();

    // Step 7: Click Update Progress to open RoutineProgressModal
    await updateProgressBtn.click();
    const routineModal = page.locator('.ant-modal-content', { hasText: 'Update Progres Tugas (Rutin)' });
    await expect(routineModal).toBeVisible({ timeout: 10000 });

    // Step 8: Enter 25% and reason
    const progressInput = routineModal.locator('#progress');
    await progressInput.fill('25');

    const reasonInput = routineModal.locator('#reason');
    await reasonInput.fill('Pelaksanaan fondasi dan fabrikasi material tahap 1');

    // Step 9: Save routine progress using exact button label "Simpan Progres"
    const saveBtn = routineModal.locator('button', { hasText: 'Simpan Progres' });
    await saveBtn.click();

    // Step 10: Assert modal closed and task officially updated
    await expect(routineModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    await expect(taskListItem).toContainText('Progress Resmi: 25%');
    console.log('[E2E] Scenario A: Task official progress updated to 25%');

    // Step 11: Switch to Progress tab and verify Overall Progress recalculated
    const progressTabBtn = drawer.locator('button[data-tab-key="progress"]');
    await progressTabBtn.click();
    await page.waitForTimeout(1500);

    const overallProgressCard = drawer.locator('text=OVERALL PROGRESS').locator('..');
    await expect(overallProgressCard).toContainText('25.00%');
    console.log('[E2E] Scenario A: Overall project progress correctly calculated as 25.00%');

    // Step 12: Verify Progress History / Ledger contains the routine update
    const viewHistoryBtn = drawer.locator('button', { hasText: 'View Progress History' });
    await viewHistoryBtn.click();
    const ledgerDrawer = page.locator('.ant-drawer-content', { hasText: 'Project Progress Ledger' });
    await expect(ledgerDrawer).toContainText('ROUTINE_UPDATE');
    await expect(ledgerDrawer).toContainText('25%');
    await expect(ledgerDrawer).toContainText('OFFICIAL');

    // Close ledger drawer
    const closeLedgerBtn = ledgerDrawer.locator('.ant-drawer-close');
    await closeLedgerBtn.click();
    await expect(ledgerDrawer).not.toBeVisible();
    await page.waitForTimeout(500);

    // =========================================================================
    // SCENARIO B & D: CRITICAL CLAIM & REAL EVIDENCE UPLOAD
    // =========================================================================
    console.log('\n[E2E] Starting Scenario B & D: Submitting 100% Critical Claim with Real Evidence...');

    // Switch back to Task tab
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    // Click Claim Progress
    await claimProgressBtn.click();
    const claimModal = page.locator('.ant-modal-content', { hasText: 'Pengajuan Klaim Progres' });
    await expect(claimModal).toBeVisible({ timeout: 10000 });

    // Enter 100%
    const claimProgressInput = claimModal.locator('#progress');
    await claimProgressInput.fill('100');

    const claimReasonInput = claimModal.locator('#reason');
    await claimReasonInput.fill('Pekerjaan 100% selesai didukung BAST dan dokumentasi uji fungsi');

    // Upload real evidence file (CP10)
    const testFilePath = path.resolve(__dirname, '../test-assets/test-sample.pdf');
    const fileInput = claimModal.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(claimModal.locator('.ant-upload-list-item')).toBeVisible({ timeout: 10000 });

    // Submit claim using exact button label "Ajukan Klaim"
    const submitClaimBtn = claimModal.locator('button', { hasText: 'Ajukan Klaim' });
    await submitClaimBtn.click();

    // Assert modal closes
    await expect(claimModal).not.toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Assert Task row displays Pending Claim while Official Progress REMAINS 25% (CP15)
    await expect(taskListItem).toContainText('Progress Resmi: 25%');
    await expect(taskListItem).toContainText('Pending: 100% (Critical 100%)');
    console.log('[E2E] Scenario B: Pending 100% displayed without mutating official 25% progress.');

    // Switch to Progress tab: Overall progress still 25.00%
    await progressTabBtn.click();
    await page.waitForTimeout(1000);
    await expect(overallProgressCard).toContainText('25.00%');
    console.log('[E2E] Scenario B: Overall progress remains 25.00% while claim is pending.');

    // Close detail drawer
    const closeDrawerBtn = drawer.locator('.ant-drawer-close');
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();

    await logoutViaUi(page);
    console.log('[E2E] Assigned PM logout complete.');
  });

  // =========================================================================
  // SCENARIO B (Part 2) & D: PMO VERIFICATION & REAL EVIDENCE AUDIT
  // =========================================================================
  test('Scenario B (Part 2): PMO reviews real evidence and approves 100% Critical Claim', async ({ page }) => {
    console.log('\n[E2E] Starting Scenario B Part 2: PMO Verification...');

    // Step 1: Login as PMO
    await loginViaUi(page, BASE_URL, 'pmo@epms.com');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Step 2: Open "Daftar Proyek Berjalan" tab
    const activeProjectsTab = page.locator('.ant-tabs-tab', { hasText: 'Daftar Proyek Berjalan' }).first();
    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    // Step 3: Open Project 1364 Detail
    const projectRow = page.locator('tr', { hasText: 'CONT-20260928-0042' }).first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });
    const detailBtn = projectRow.locator('button', { hasText: 'Detail' }).first();
    await detailBtn.click();

    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer).toBeVisible({ timeout: 15000 });

    // Step 4: Verify that PMO does NOT see PM execution mutation buttons in Task tab (CP1 / CP14)
    const taskTabBtn = drawer.locator('button[data-tab-key="task"]');
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    const taskListItem = drawer.locator('.ant-list-item').first();
    await expect(taskListItem.locator('button', { hasText: 'Update Progress' })).not.toBeVisible();
    await expect(taskListItem.locator('button', { hasText: 'Claim Progress' })).not.toBeVisible();
    console.log('[E2E] Verified PMO cannot perform PM execution mutations.');

    // Step 5: Switch to Progress tab and click Verify Claims
    const progressTabBtn = drawer.locator('button[data-tab-key="progress"]');
    await progressTabBtn.click();
    await page.waitForTimeout(1500);

    const verifyClaimsBtn = drawer.locator('button', { hasText: /Verify \d+ Claims/ }).first();
    await expect(verifyClaimsBtn).toBeVisible({ timeout: 10000 });
    await verifyClaimsBtn.click();

    // Step 6: Verify ProgressVerificationDrawer opened with real evidence (Scenario D)
    const verificationDrawer = page.locator('.ant-drawer-content', { hasText: 'Verify Pending Progress Claims' });
    await expect(verificationDrawer).toBeVisible({ timeout: 10000 });

    // Assert real document file name is displayed (CP10 / Scenario D)
    await expect(verificationDrawer).toContainText('test-sample.pdf');
    console.log('[E2E] Scenario D: Real evidence file test-sample.pdf confirmed in PMO verification drawer.');

    // Step 7: Approve claim
    const approveBtn = verificationDrawer.locator('button', { hasText: 'Approve' }).first();
    await approveBtn.click();

    // Verification drawer closes on success
    await expect(verificationDrawer).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Step 8: Assert Task official progress is now 100% and COMPLETED
    await taskTabBtn.click();
    await page.waitForTimeout(1000);
    await expect(taskListItem).toContainText('Progress Resmi: 100%');
    await expect(taskListItem).toContainText('COMPLETED');
    console.log('[E2E] Scenario B: Official progress atomically updated to 100% COMPLETED upon verification.');

    // Step 9: Assert Overall Progress is now 100.00%
    await progressTabBtn.click();
    await page.waitForTimeout(1000);
    const overallProgressCard = drawer.locator('text=OVERALL PROGRESS').locator('..');
    await expect(overallProgressCard).toContainText('100.00%');
    console.log('[E2E] Scenario B: Overall project progress updated to 100.00%.');

    // Close drawer & logout
    const closeDrawerBtn = drawer.locator('.ant-drawer-close');
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);
  });

  // =========================================================================
  // SCENARIO C: SECURITY DIRECT API CHECKS
  // =========================================================================
  test('Scenario C: Direct API Security Enforces Ownership and Super Admin Read-Only', async ({ request }) => {
    console.log('\n[E2E] Starting Scenario C: Direct API Security Checks...');

    // Helper to login via API and get access token
    const getAuthToken = async (email: string, pass = process.env.E2E_TEST_PASSWORD || '') => {
      const res = await request.post(`${BACKEND_URL}/auth/login`, {
        data: { email, password: pass },
      });
      expect(res.status()).toBe(200);
      const json = await res.json();
      return (json.data || json).accessToken;
    };

    // 1. PM A (Faza Afina, id 879) attempts mutation on PM B project (id 1364, manager 2)
    const pmAToken = await getAuthToken('faza@epms.com');

    const crossPmRoutineRes = await request.patch(`${BACKEND_URL}/project/1364/tasks/1616/progress`, {
      headers: { Authorization: `Bearer ${pmAToken}` },
      data: { progress: 30, expectedProgress: 0, reason: 'Cross-PM mutation attempt' },
    });
    expect(crossPmRoutineRes.status()).toBe(403);
    console.log('[SECURITY C.1] PM A direct routine update on PM B project: 403 Forbidden (PASS)');

    const crossPmClaimRes = await request.post(`${BACKEND_URL}/project/1364/tasks/1616/progress-claims`, {
      headers: { Authorization: `Bearer ${pmAToken}` },
      data: { reportedProgress: 100, reason: 'Cross-PM claim attempt' },
    });
    expect(crossPmClaimRes.status()).toBe(403);
    console.log('[SECURITY C.2] PM A direct claim on PM B project: 403 Forbidden (PASS)');

    // 2. Super Admin (System Admin, id 1) attempts routine progress mutation
    const adminToken = await getAuthToken('admin@epms.com');

    const adminRoutineRes = await request.patch(`${BACKEND_URL}/project/1364/tasks/1616/progress`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { progress: 30, expectedProgress: 0, reason: 'Super Admin bypass attempt' },
    });
    expect(adminRoutineRes.status()).toBe(403);
    console.log('[SECURITY C.3] SUPER_ADMIN direct routine progress mutation: 403 Forbidden (PASS)');

    const adminClaimRes = await request.post(`${BACKEND_URL}/project/1364/tasks/1616/progress-claims`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { reportedProgress: 100, reason: 'Super Admin claim bypass attempt' },
    });
    expect(adminClaimRes.status()).toBe(403);
    console.log('[SECURITY C.4] SUPER_ADMIN direct progress claim: 403 Forbidden (PASS)');

    // 3. PMO (id 769) attempts PM execution routine mutation
    const pmoToken = await getAuthToken('pmo@epms.com');

    const pmoRoutineRes = await request.patch(`${BACKEND_URL}/project/1364/tasks/1616/progress`, {
      headers: { Authorization: `Bearer ${pmoToken}` },
      data: { progress: 30, expectedProgress: 0, reason: 'PMO PM mutation attempt' },
    });
    expect(pmoRoutineRes.status()).toBe(403);
    console.log('[SECURITY C.5] PMO direct routine progress mutation: 403 Forbidden (PASS)');

    // 4. HEAD_OF_OPERATIONS attempts PM execution routine mutation
    const hooToken = await getAuthToken('hops@epms.com');

    const hooRoutineRes = await request.patch(`${BACKEND_URL}/project/1364/tasks/1616/progress`, {
      headers: { Authorization: `Bearer ${hooToken}` },
      data: { progress: 30, expectedProgress: 0, reason: 'HOO PM mutation attempt' },
    });
    expect(hooRoutineRes.status()).toBe(403);
    console.log('[SECURITY C.6] HOO direct routine progress mutation: 403 Forbidden (PASS)');
  });
});
