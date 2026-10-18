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

// Credential Hygiene: secrets come only from environment variables
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('[SECURITY STOP] E2E_TEST_PASSWORD is missing in environment.');
}

const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-delivery-kickoff-ui-r1');
const BRAIN_DIR = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\UBDOPS3',
  '.gemini/antigravity-ide/brain/88efac64-c2bb-4ce3-a219-5d7fd994a58c'
);

// Helper to save screenshot to both evidence and brain directories
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

test.describe('EPMS — PROJECT-DELIVERY-KICKOFF-UI-R1 Visible Chrome Acceptance', () => {
  test.setTimeout(180000);

  test('CHROME A — ASSIGNED PM: Kickoff Queue Table & Kick Off Proyek Modal Flow', async ({ page }) => {
    // 1. Login as Assigned PM (pm@epms.com)
    await loginViaUi(page, BASE_URL, 'pm@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify Tab 1 is active
    const antreanTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Antrean Kick-off Charter' });
    await expect(antreanTab).toBeVisible();

    // Locate Row for CONT-20260930-0099 (Tender PMO Inbox DeepLink)
    const targetRow = page.locator('tr').filter({ hasText: 'CONT-20260930-0099' }).first();
    await expect(targetRow).toBeVisible();

    // Verify Column 1: Project / Client
    await expect(targetRow.locator('td').nth(0).getByText('Tender PMO Inbox DeepLink')).toBeVisible();
    await expect(targetRow.locator('td').nth(0).getByText('CONT-20260930-0099')).toBeVisible();
    await expect(targetRow.locator('td').nth(0).getByText('PT Asianet Media Teknologi')).toBeVisible();

    // Verify Column 2: PM / Marketing
    // Must render Faza Afina (NOT role string 'Project Manager')
    await expect(targetRow.locator('td').nth(1).getByText('Faza Afina', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(1).getByText('Dwi Ragil Pribadi', { exact: true })).toBeVisible();
    // Verify initials avatars
    await expect(targetRow.locator('td').nth(1).getByText('FA', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(1).getByText('DR', { exact: true })).toBeVisible();

    // Verify Column 3: Commercial
    await expect(targetRow.locator('td').nth(2).getByText('SPK', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(2).getByText('Budget', { exact: true })).toBeVisible();

    // Verify Column 4: Status Separation
    // Operational Plan = APPROVED
    // Handover = SIAP KICKOFF
    await expect(targetRow.locator('td').nth(3).getByText('Operational Plan', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(3).getByText('APPROVED', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(3).getByText('Handover', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(3).getByText('SIAP KICKOFF', { exact: true })).toBeVisible();

    // Ensure NO combined or duplicate status text
    const cellStatus = targetRow.locator('td').nth(3);
    const statusText = await cellStatus.innerText();
    expect(statusText).not.toContain('APPROVED (SIAP KICKOFF)');
    expect(statusText).not.toContain('MENUNGGU KICKOFF PM');

    // Verify Column 5: Next Action
    // Kick Off Proyek button MUST be visible and enabled for assigned PM
    const kickoffBtn = targetRow.locator('td').nth(4).locator('button').filter({ hasText: 'Kick Off Proyek' });
    await expect(kickoffBtn).toBeVisible();
    await expect(kickoffBtn).toBeEnabled();

    // Verify button size is compact (fit content, height ~34px)
    const btnBox = await kickoffBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    if (btnBox) {
      expect(btnBox.height).toBeGreaterThanOrEqual(30);
      expect(btnBox.height).toBeLessThanOrEqual(38);
      expect(btnBox.width).toBeLessThan(180); // Compact, not filling entire cell!
    }

    // Capture main table screenshot
    await captureEvidence(page, 'chrome_a_assigned_pm_queue.png');

    // Click "Kick Off Proyek" to open modal
    await kickoffBtn.click();
    await page.waitForTimeout(800);

    // Verify Modal Opens: "Formal Kick-off Proyek (Aktivasi ke IN_PROGRESS)"
    const modalTitle = page.locator('.ant-modal-title').filter({ hasText: 'Formal Kick-off Proyek' });
    await expect(modalTitle).toBeVisible();

    // Capture modal open screenshot
    await captureEvidence(page, 'chrome_a_assigned_pm_modal.png');

    // Click Cancel ("Batal")
    const cancelBtn = page.locator('.ant-modal-footer button').filter({ hasText: 'Batal' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await page.waitForTimeout(600);

    // Modal should be closed
    await expect(modalTitle).not.toBeVisible();

    // Project must REMAIN in PLANNING state (no unintended mutation)
    await expect(targetRow.locator('td').nth(3).getByText('SIAP KICKOFF', { exact: true })).toBeVisible();
    console.log('[PASS] CHROME A: Assigned PM Kickoff Queue & Modal Acceptance PASSED');
  });

  test('CHROME B — ADMIN / SUPERADMIN: Waiting-for-PM Text & Hidden CTA', async ({ page }) => {
    // 1. Login as System Admin (admin@epms.com)
    await loginViaUi(page, BASE_URL, 'admin@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Locate Row for CONT-20260930-0099
    const targetRow = page.locator('tr').filter({ hasText: 'CONT-20260930-0099' }).first();
    await expect(targetRow).toBeVisible();

    // Verify actual PM name is visible in PM column
    await expect(targetRow.locator('td').nth(1).getByText('Faza Afina', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(3).getByText('APPROVED', { exact: true })).toBeVisible();
    await expect(targetRow.locator('td').nth(3).getByText('SIAP KICKOFF', { exact: true })).toBeVisible();

    // Kick Off Proyek button MUST NOT be visible for Admin
    const kickoffBtn = targetRow.locator('button').filter({ hasText: 'Kick Off Proyek' });
    await expect(kickoffBtn).not.toBeVisible();

    // Informative waiting text must be displayed in Next Action column
    const waitingText = targetRow.locator('td').nth(4).getByText('Menunggu Faza Afina melakukan kickoff');
    await expect(waitingText).toBeVisible();

    // Overflow action button [...] remains available
    const overflowBtn = targetRow.locator('td').nth(5).locator('button');
    await expect(overflowBtn).toBeVisible();

    // Capture screenshot
    await captureEvidence(page, 'chrome_b_admin_queue.png');
    console.log('[PASS] CHROME B: Admin Waiting Text Acceptance PASSED');
  });

  test('CHROME C — PMO / DIRECTOR: Next Actor Clarity & Status Consistency', async ({ page }) => {
    // 1. Login as PMO (pmo@epms.com)
    await loginViaUi(page, BASE_URL, 'pmo@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Locate Row for CONT-20260930-0099
    const targetRow = page.locator('tr').filter({ hasText: 'CONT-20260930-0099' }).first();
    await expect(targetRow).toBeVisible();

    // NO Kick Off Proyek button
    await expect(targetRow.locator('button').filter({ hasText: 'Kick Off Proyek' })).not.toBeVisible();

    // Next Action clearly explains next actor
    await expect(targetRow.locator('td').nth(4).getByText('Menunggu Faza Afina melakukan kickoff')).toBeVisible();

    // Check governance stage project row: PRJ-R1V1-UAT-1791255462928 (Review HOPS)
    const reviewRow = page.locator('tr').filter({ hasText: 'PRJ-R1V1-UAT-1791255462928' }).first();
    if (await reviewRow.isVisible()) {
      await expect(reviewRow.locator('td').nth(3).getByText('REVIEW HEAD OF OPS', { exact: true }).first()).toBeVisible();
      await expect(reviewRow.locator('td').nth(4).getByText('Head of Operations', { exact: true })).toBeVisible();
    }

    // Capture screenshot
    await captureEvidence(page, 'chrome_c_pmo_director_queue.png');
    console.log('[PASS] CHROME C: PMO/Director Acceptance PASSED');
  });

  test('CHROME D — UNASSIGNED: "Belum Ditugaskan" & "Tugaskan PM" Button', async ({ page }) => {
    // 1. Login as PMO (pmo@epms.com) who has authority to assign PM
    await loginViaUi(page, BASE_URL, 'pmo@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Locate unassigned contract CONT-20260930-0100
    const unassignedRow = page.locator('tr').filter({ hasText: 'CONT-20260930-0100' }).first();
    await expect(unassignedRow).toBeVisible();

    // Verify PM column displays "Belum Ditugaskan" (NO fake identity!)
    await expect(unassignedRow.locator('td').nth(1).getByText('Belum Ditugaskan', { exact: true })).toBeVisible();
    await expect(unassignedRow.locator('td').nth(1).getByText('Project Manager', { exact: true })).toBeVisible();

    // Verify Status column
    await expect(unassignedRow.locator('td').nth(3).getByText('BELUM DITUGASKAN', { exact: true })).toBeVisible();
    await expect(unassignedRow.locator('td').nth(3).getByText('ANTREAN KICKOFF', { exact: true })).toBeVisible();

    // Verify Next Action displays "Tugaskan PM" for PMO
    const assignBtn = unassignedRow.locator('td').nth(4).locator('button').filter({ hasText: 'Tugaskan PM' });
    await expect(assignBtn).toBeVisible();
    await expect(assignBtn).toBeEnabled();

    // Capture screenshot
    await captureEvidence(page, 'chrome_d_unassigned_queue.png');
    console.log('[PASS] CHROME D: Unassigned Queue Acceptance PASSED');
  });

  test('CHROME E — PLANNING: Operational Plan Stage Clarity', async ({ page }) => {
    // 1. Login as PM (pm@epms.com) or PMO (pmo@epms.com)
    await loginViaUi(page, BASE_URL, 'pmo@epms.com', E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Locate planning project CONT-20261001-0104 (Renovasi Ruangan Direktur)
    const planningRow = page.locator('tr').filter({ hasText: 'CONT-20261001-0104' }).first();
    await expect(planningRow).toBeVisible();

    // Verify Operational Plan = BELUM DIINISIASI
    // Handover = PENYUSUNAN PLAN
    await expect(planningRow.locator('td').nth(3).getByText('BELUM DIINISIASI', { exact: true })).toBeVisible();
    await expect(planningRow.locator('td').nth(3).getByText('PENYUSUNAN PLAN', { exact: true })).toBeVisible();

    // Verify Next Action displays "Operational Plan" button
    const planBtn = planningRow.locator('td').nth(4).locator('button').filter({ hasText: 'Operational Plan' });
    await expect(planBtn).toBeVisible();

    // MUST NOT have Kick Off Proyek button
    await expect(planningRow.locator('button').filter({ hasText: 'Kick Off Proyek' })).not.toBeVisible();

    // Capture screenshot
    await captureEvidence(page, 'chrome_e_planning_queue.png');
    console.log('[PASS] CHROME E: Planning Queue Acceptance PASSED');
  });
});
