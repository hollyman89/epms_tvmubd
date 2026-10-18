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
const PROJECT_CODE = 'CONT-20260928-0043'; // Project 1365 (MYREPUBLIK, IN_PROGRESS, PM: faza@epms.com)
const PM_EMAIL = 'faza@epms.com';
const PMO_EMAIL = 'pmo@epms.com';
const TEST_FILE_PATH = path.resolve(__dirname, '../test-assets/test-sample.pdf');

test.describe('PROJECT-CORE-R2: Authoritative Execution Actual Model Live Chrome Acceptance', () => {
  test.setTimeout(240000);

  test('R2-50 to R2-55: Complete Scenarios A through F on Google Chrome', async ({ page }) => {
    console.log('\n[E2E-R2] Starting PROJECT-CORE-R2 Live Chrome Acceptance Suite...');

    // =========================================================================
    // SCENARIO A: INITIAL STATE & ROUTINE PROGRESS (0% -> 25%)
    // =========================================================================
    console.log('\n[E2E-R2] --- SCENARIO A: Initial State (0%) & Routine Progress (0% -> 25%) ---');
    await loginViaUi(page, BASE_URL, PM_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Switch to "Daftar Proyek Berjalan" tab (key: '2')
    const activeProjectsTab = page.locator('.ant-tabs-tab', { hasText: 'Daftar Proyek Berjalan' }).first();
    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    // Open Project Detail Drawer for Project 1365
    const projectRow = page.locator('tr', { hasText: PROJECT_CODE }).first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });
    const detailBtn = projectRow.locator('button', { hasText: 'Detail' }).first();
    await detailBtn.click();

    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer).toBeVisible({ timeout: 15000 });

    // Switch to Task tab
    const taskTabBtn = drawer.locator('button[data-tab-key="task"]');
    await expect(taskTabBtn).toBeVisible();
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    // Locate Task 1617 (DONASI)
    const donasiTask = drawer.locator('.ant-list-item', { hasText: 'DONASI' }).first();
    await expect(donasiTask).toBeVisible({ timeout: 10000 });

    // Initial check: Actual Start = N/A, Actual Finish = N/A
    await expect(donasiTask).toContainText('Actual Start: N/A');
    await expect(donasiTask).toContainText('Actual Finish: N/A');
    await expect(donasiTask).toContainText('Actual Duration: N/A');
    await expect(donasiTask).toContainText('Progress Resmi: 0%');
    console.log('[E2E-R2] Scenario A: Verified initial Actual Start = N/A, Actual Finish = N/A.');

    // PM performs routine update: 0% -> 25%
    const updateProgressBtn = donasiTask.locator('button', { hasText: 'Update Progress' }).first();
    await expect(updateProgressBtn).toBeVisible();
    await updateProgressBtn.click();

    const routineModal = page.locator('.ant-modal-content', { hasText: 'Update Progres Tugas (Rutin)' });
    await expect(routineModal).toBeVisible({ timeout: 10000 });

    const routineProgressInput = routineModal.locator('#progress');
    await routineProgressInput.fill('25');

    const routineReasonInput = routineModal.locator('#reason');
    await routineReasonInput.fill('Pekerjaan tahap 1 telah dimulai secara resmi di lapangan');

    const saveRoutineBtn = routineModal.locator('button', { hasText: 'Simpan Progres' });
    await saveRoutineBtn.click();

    await expect(routineModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Assert Task 1617 after 0 -> 25%
    await expect(donasiTask).toContainText('Progress Resmi: 25%');
    await expect(donasiTask).not.toContainText('Actual Start: N/A'); // Actual Start is now populated!
    await expect(donasiTask).toContainText('Actual Finish: N/A');
    console.log('[E2E-R2] Scenario A: Verified Actual Start is populated and Actual Finish is N/A after 0 -> 25%.');

    // Capture the exact populated Actual Start text
    const actualStartEl = donasiTask.locator('text=Actual Start:').locator('..');
    const capturedActualStart = await actualStartEl.innerText();
    console.log(`[E2E-R2] Scenario A: Captured Actual Start: "${capturedActualStart}"`);

    // =========================================================================
    // SCENARIO B: WRITE-ONCE RULE (25% -> 50%)
    // =========================================================================
    console.log('\n[E2E-R2] --- SCENARIO B: Actual Start Write-Once Rule (25% -> 50%) ---');
    await updateProgressBtn.click();
    await expect(routineModal).toBeVisible({ timeout: 10000 });

    await routineProgressInput.fill('50');
    await routineReasonInput.fill('Melanjutkan pekerjaan tahap 2 tanpa perubahan tanggal mulai');
    await saveRoutineBtn.click();

    await expect(routineModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Assert Task 1617 after 25 -> 50%
    await expect(donasiTask).toContainText('Progress Resmi: 50%');
    const actualStartAfterSecondUpdate = await actualStartEl.innerText();
    expect(actualStartAfterSecondUpdate).toBe(capturedActualStart); // EXACTLY identical
    await expect(donasiTask).toContainText('Actual Finish: N/A');
    console.log('[E2E-R2] Scenario B: Verified Actual Start remains EXACTLY unchanged after 25% -> 50%.');

    // =========================================================================
    // SCENARIO C: CRITICAL 100% CLAIM & VERIFICATION APPROVAL
    // =========================================================================
    console.log('\n[E2E-R2] --- SCENARIO C: Critical 100% Claim & Approval ---');
    const claimProgressBtn = donasiTask.locator('button', { hasText: 'Claim Progress' }).first();
    await expect(claimProgressBtn).toBeVisible();
    await claimProgressBtn.click();

    const claimModal = page.locator('.ant-modal-content', { hasText: 'Pengajuan Klaim Progres' });
    await expect(claimModal).toBeVisible({ timeout: 10000 });

    const claimProgressInput = claimModal.locator('#progress');
    await claimProgressInput.fill('100');

    const claimReasonInput = claimModal.locator('#reason');
    await claimReasonInput.fill('Pekerjaan donasi 100% tuntas dengan pengujian lapangan');

    const fileInput = claimModal.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_FILE_PATH);
    await expect(claimModal.locator('.ant-upload-list-item')).toBeVisible({ timeout: 10000 });

    const submitClaimBtn = claimModal.locator('button', { hasText: 'Ajukan Klaim' });
    await submitClaimBtn.click();

    await expect(claimModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Before approval: Pending 100% displayed, Official progress still 50%, Actual Finish still N/A
    await expect(donasiTask).toContainText('Progress Resmi: 50%');
    await expect(donasiTask).toContainText('Pending: 100% (Critical 100%)');
    await expect(donasiTask).toContainText('Actual Finish: N/A');
    console.log('[E2E-R2] Scenario C: Before verification approval, Actual Finish remains N/A and official progress is 50%.');

    // Close drawer and logout PM
    const closeDrawerBtn = drawer.locator('.ant-drawer-close');
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);

    // PMO Logs in to approve claim
    console.log('[E2E-R2] Switching to PMO verifier to approve 100% claim...');
    await loginViaUi(page, BASE_URL, PMO_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await detailBtn.click();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    // Open Progress tab and verify claims
    const progressTabBtn = drawer.locator('button[data-tab-key="progress"]');
    await progressTabBtn.click();
    await page.waitForTimeout(1500);

    const verifyClaimsBtn = drawer.locator('button', { hasText: /Verify \d+ Claims/ }).first();
    await expect(verifyClaimsBtn).toBeVisible({ timeout: 10000 });
    await verifyClaimsBtn.click();

    const verificationDrawer = page.locator('.ant-drawer-content', { hasText: 'Verify Pending Progress Claims' });
    await expect(verificationDrawer).toBeVisible({ timeout: 10000 });

    const approveClaimBtn = verificationDrawer.locator('button', { hasText: 'Approve' }).first();
    await approveClaimBtn.click();

    await expect(verificationDrawer).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Switch to Task tab to verify official 100% and Actual Finish populated
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    await expect(donasiTask).toContainText('Progress Resmi: 100%');
    await expect(donasiTask).toContainText('COMPLETED');
    await expect(donasiTask).not.toContainText('Actual Finish: N/A'); // Actual Finish is now populated!
    console.log('[E2E-R2] Scenario C: Verified Progress = 100%, Status = COMPLETED, Actual Finish is populated.');

    // =========================================================================
    // SCENARIO D: GOVERNED DOWNWARD CORRECTION (100% -> 80%)
    // =========================================================================
    console.log('\n[E2E-R2] --- SCENARIO D: Downward Correction (100% -> 80%) ---');
    // Logout PMO and switch back to PM to submit downward claim
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);

    await loginViaUi(page, BASE_URL, PM_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await detailBtn.click();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    await claimProgressBtn.click();
    await expect(claimModal).toBeVisible({ timeout: 10000 });

    await claimProgressInput.fill('80');
    await claimReasonInput.fill('Koreksi penurunan: penyesuaian evaluasi teknis lapangan ke 80%');
    await fileInput.setInputFiles(TEST_FILE_PATH);
    await expect(claimModal.locator('.ant-upload-list-item')).toBeVisible({ timeout: 10000 });
    await submitClaimBtn.click();

    await expect(claimModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Logout PM and login PMO to approve downward correction
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);

    await loginViaUi(page, BASE_URL, PMO_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await detailBtn.click();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    await progressTabBtn.click();
    await page.waitForTimeout(1500);

    await expect(verifyClaimsBtn).toBeVisible({ timeout: 10000 });
    await verifyClaimsBtn.click();
    await expect(verificationDrawer).toBeVisible({ timeout: 10000 });

    await approveClaimBtn.click();
    await expect(verificationDrawer).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Switch to Task tab: Actual Start is PRESERVED, Actual Finish is reset to N/A
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    await expect(donasiTask).toContainText('Progress Resmi: 80%');
    const actualStartAfterDownward = await actualStartEl.innerText();
    expect(actualStartAfterDownward).toBe(capturedActualStart); // Start is preserved!
    await expect(donasiTask).toContainText('Actual Finish: N/A'); // Finish is cleared!
    console.log('[E2E-R2] Scenario D: Verified Progress = 80%, Actual Start PRESERVED, Actual Finish = N/A.');

    // =========================================================================
    // SCENARIO E: RE-COMPLETION (80% -> 100%)
    // =========================================================================
    console.log('\n[E2E-R2] --- SCENARIO E: Re-completion (80% -> 100%) ---');
    // Logout PMO and login PM to submit re-completion
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);

    await loginViaUi(page, BASE_URL, PM_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await detailBtn.click();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    await claimProgressBtn.click();
    await expect(claimModal).toBeVisible({ timeout: 10000 });

    await claimProgressInput.fill('100');
    await claimReasonInput.fill('Pekerjaan perbaikan tuntas dan diverifikasi kembali 100%');
    await fileInput.setInputFiles(TEST_FILE_PATH);
    await expect(claimModal.locator('.ant-upload-list-item')).toBeVisible({ timeout: 10000 });
    await submitClaimBtn.click();

    await expect(claimModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Logout PM and login PMO to approve re-completion
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);

    await loginViaUi(page, BASE_URL, PMO_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await detailBtn.click();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    await progressTabBtn.click();
    await page.waitForTimeout(1500);

    await expect(verifyClaimsBtn).toBeVisible({ timeout: 10000 });
    await verifyClaimsBtn.click();
    await expect(verificationDrawer).toBeVisible({ timeout: 10000 });

    await approveClaimBtn.click();
    await expect(verificationDrawer).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Switch to Task tab: Actual Start unchanged, Actual Finish re-populated!
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    await expect(donasiTask).toContainText('Progress Resmi: 100%');
    await expect(donasiTask).toContainText('COMPLETED');
    const actualStartAfterRecompletion = await actualStartEl.innerText();
    expect(actualStartAfterRecompletion).toBe(capturedActualStart);
    await expect(donasiTask).not.toContainText('Actual Finish: N/A');
    console.log('[E2E-R2] Scenario E: Verified Re-completion: Progress = 100%, Actual Start unchanged, Actual Finish re-populated.');

    // =========================================================================
    // SCENARIO F: MILESTONE ACTUAL DATE (ATP)
    // =========================================================================
    console.log('\n[E2E-R2] --- SCENARIO F: Milestone Actual Date (ATP) ---');
    // Locate Task 1624 (ATP)
    const atpTask = drawer.locator('.ant-list-item', { hasText: 'ATP' }).first();
    await expect(atpTask).toBeVisible({ timeout: 10000 });

    // Initial milestone check: Plan Start visible, Actual Finish (Milestone Actual Date) = N/A
    await expect(atpTask).toContainText('Plan Start:');
    await expect(atpTask).toContainText('Actual Finish: N/A');
    console.log('[E2E-R2] Scenario F: Before completion, Milestone Actual Finish = N/A.');

    // Logout PMO and login PM to submit 100% claim on Milestone
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);

    await loginViaUi(page, BASE_URL, PM_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await detailBtn.click();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    const atpClaimBtn = atpTask.locator('button', { hasText: 'Claim Progress' }).first();
    await atpClaimBtn.click();
    await expect(claimModal).toBeVisible({ timeout: 10000 });

    await claimProgressInput.fill('100');
    await claimReasonInput.fill('Milestone ATP telah dicapai dengan penerbitan sertifikat ATP');
    await fileInput.setInputFiles(TEST_FILE_PATH);
    await expect(claimModal.locator('.ant-upload-list-item')).toBeVisible({ timeout: 10000 });
    await submitClaimBtn.click();

    await expect(claimModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Logout PM and login PMO to approve milestone
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);

    await loginViaUi(page, BASE_URL, PMO_EMAIL);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await expect(activeProjectsTab).toBeVisible({ timeout: 15000 });
    await activeProjectsTab.click();
    await page.waitForTimeout(1000);

    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await detailBtn.click();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    await progressTabBtn.click();
    await page.waitForTimeout(1500);

    await expect(verifyClaimsBtn).toBeVisible({ timeout: 10000 });
    await verifyClaimsBtn.click();
    await expect(verificationDrawer).toBeVisible({ timeout: 10000 });

    await approveClaimBtn.click();
    await expect(verificationDrawer).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Switch to Task tab: Milestone Actual Finish (Milestone Actual Date) is now POPULATED!
    await taskTabBtn.click();
    await page.waitForTimeout(1000);

    await expect(atpTask).toContainText('Progress Resmi: 100%');
    await expect(atpTask).toContainText('COMPLETED');
    await expect(atpTask).not.toContainText('Actual Finish: N/A');
    console.log('[E2E-R2] Scenario F: Verified Milestone Actual Date (actual_finish_at) is populated upon verified 100% completion.');

    // Close drawer and logout
    await closeDrawerBtn.click();
    await expect(drawer).not.toBeVisible();
    await logoutViaUi(page);
    console.log('\n[E2E-R2] ALL SCENARIOS A THROUGH F PASSED CLEANLY ON GOOGLE CHROME!');
  });
});
