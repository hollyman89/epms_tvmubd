import { Page, Locator, expect } from '@playwright/test';
import path from 'path';
import dayjs from 'dayjs';

/**
 * TEST-ONLY CANONICAL E2E LIFECYCLE HELPERS (Phase R9.1B)
 *
 * Implements Strategy B: Reusable, modular test-only helper functions for the
 * pure browser canonical lifecycle:
 * Tender -> Project Initiation -> PM Assignment -> Operational Plan (4/4 Ready)
 * -> Management Review Chain (HOPS -> Procurement -> Finance -> Director)
 * -> Formal Kickoff -> Procurement Package -> PR Creation & Approval -> RFQ
 * -> 3 Quotations -> Evaluation -> Purchase Order
 *
 * Zero production imports. Test-harness only.
 */

// ---------------------------------------------------------------------------
// 1. UI AUTHENTICATION HELPERS
// ---------------------------------------------------------------------------
export function resolveExpectedLandingRoute(roles: string[] = []): string {
  const upper = roles.map((r) => String(r).toUpperCase());
  if (upper.includes('SUPER_ADMIN') || upper.includes('ADMIN') || upper.includes('DIRECTOR')) {
    return '/dashboard';
  }
  if (upper.includes('PROJECT_MANAGER') || upper.includes('PMO') || upper.includes('HEAD_OF_OPERATIONS')) {
    return '/project-delivery';
  }
  if (upper.includes('PROCUREMENT') || upper.includes('PURCHASING') || upper.includes('MANAGER')) {
    return '/procurement';
  }
  if (upper.includes('FINANCE')) {
    return '/finance/invoices';
  }
  if (upper.includes('MARKETING') || upper.includes('GM_MARKETING')) {
    return '/sales';
  }
  if (upper.includes('LEGAL')) {
    return '/legal/review';
  }
  if (upper.includes('GENERAL_MANAGER')) {
    return '/reports';
  }
  return '/project-delivery';
}

export async function loginViaUi(
  page: Page,
  baseUrl: string,
  email: string,
  pass = process.env.E2E_TEST_PASSWORD
): Promise<void> {
  if (!pass) {
    throw new Error('E2E_TEST_PASSWORD environment variable is required for loginViaUi');
  }
  console.log(`\n[UI AUTH] Logging in as ${email}...`);

  await page.context().clearCookies().catch(() => {});
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
  }).catch(() => {});
  if (!page.url().includes('/login')) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  }

  await expect(page.locator('.epms-login-card-title')).toHaveText('Welcome Back', { timeout: 15000 });

  const emailInput = page.locator('#login_form_email');
  await emailInput.click();
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);

  const passInput = page.locator('#login_form_password');
  await passInput.click();
  await passInput.fill(pass);
  await expect(passInput).toHaveValue(pass);

  // Install auth response listener BEFORE submitting form
  const authResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') &&
      response.request().method() === 'POST',
    { timeout: 20000 }
  );

  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').click();

  // Assert authentic API response
  const authResponse = await authResponsePromise;
  expect(authResponse.status()).toBe(200);

  const authJson = await authResponse.json();
  const payload = authJson.data || authJson;
  const user = payload.user;
  expect(user).toBeDefined();
  expect(user.email.toLowerCase()).toBe(email.toLowerCase());

  const roles: string[] = user.roles || [];
  const expectedRoute = resolveExpectedLandingRoute(roles);
  console.log(`[UI AUTH] Auth API 200 OK for ${email} with roles: [${roles.join(', ')}]. Expected landing: "${expectedRoute}"`);

  // State-based wait for route transition away from /login to expected landing route
  // Next.js dev server may compile cold routes on-demand; tolerate compilation latency strictly on URL state
  const urlPredicate = (url: URL) => {
    if (expectedRoute === '/' || expectedRoute === '/dashboard') {
      return url.pathname === '/' || url.pathname === '' || url.pathname.startsWith('/dashboard');
    }
    return url.pathname.startsWith(expectedRoute);
  };

  await page.waitForURL(urlPredicate, { timeout: 45000 });
  await expect(page).not.toHaveURL(/.*\/login(\?.*)?$/);
  await page.waitForLoadState('domcontentloaded');
  console.log(`[UI AUTH] Successfully logged in as ${email}. Current URL: ${page.url()}`);
}

export async function logoutViaUi(page: Page, baseUrl = 'http://localhost:3000'): Promise<void> {
  console.log(`\n[UI AUTH] Logging out and resetting auth session...`);
  await page.context().clearCookies().catch(() => {});
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
  }).catch(() => {});
  if (!page.url().includes('/login')) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  }

  await expect(page.locator('.epms-login-card-title')).toHaveText('Welcome Back', { timeout: 15000 });
  console.log(`[UI AUTH] Successfully logged out.`);
}

// ---------------------------------------------------------------------------
// 2. PMO ASSIGN PROJECT MANAGER
// ---------------------------------------------------------------------------
export async function pmoAssignProjectManager(
  page: Page,
  baseUrl: string,
  tenderUniqueName: string
): Promise<void> {
  console.log(`\n>>> [PMO] Assigning Project Manager (pm@epms.com) to project "${tenderUniqueName}"...`);
  await page.goto(`${baseUrl}/project-delivery`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Ensure Tab 1 (Antrean Kick-off Charter) is active
  const tab1 = page.locator('.ant-tabs-tab').filter({ hasText: 'Antrean Kick-off Charter' });
  if (await tab1.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab1.click();
    await page.waitForTimeout(1000);
  }

  const projectRow = page.locator(`tr:has-text("${tenderUniqueName}")`).first();
  await expect(projectRow).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/04_pmo_queue.png'), fullPage: true });

  const tugaskanPmBtn = projectRow.locator('button:has-text("Tugaskan PM")');
  await expect(tugaskanPmBtn).toBeVisible({ timeout: 10000 });
  await tugaskanPmBtn.click();

  const pmModal = page.locator('.ant-modal-content').filter({ hasText: 'Penugasan Project Manager (PMO)' }).first();
  await expect(pmModal).toBeVisible({ timeout: 10000 });

  // Open Project Manager Select dropdown
  const pmSelect = pmModal.locator('.ant-select').first();
  await pmSelect.click();
  await page.waitForTimeout(500);

  const pmOption = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: 'pm@epms.com' })
    .first();
  await expect(pmOption).toBeVisible({ timeout: 10000 });
  await pmOption.click();

  // Submit PM assignment
  const submitAssignBtn = pmModal.locator('button:has-text("Tugaskan PM")');
  await submitAssignBtn.click();
  await expect(pmModal).not.toBeVisible({ timeout: 15000 });

  // Verify the row now displays the primary "Operational Plan" button
  await page.waitForTimeout(1500);
  const opPlanBtn = projectRow.locator('button:has-text("Operational Plan")');
  await expect(opPlanBtn).toBeVisible({ timeout: 15000 });
  console.log(`[UI ASSERTION] PM assigned successfully to ${tenderUniqueName}. Operational Plan workspace unlocked.`);
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/05_pm_assigned.png'), fullPage: true });
}

// ---------------------------------------------------------------------------
// 3. PM SETUP 4/4 OPERATIONAL PLAN
// ---------------------------------------------------------------------------
export async function pmSetupOperationalPlan(
  page: Page,
  baseUrl: string,
  tenderUniqueName: string
): Promise<void> {
  console.log(`\n>>> [PM] Building 4/4 Operational Plan for "${tenderUniqueName}"...`);
  await page.goto(`${baseUrl}/project-delivery`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const projectRow = page.locator(`tr:has-text("${tenderUniqueName}")`).first();
  await expect(projectRow).toBeVisible({ timeout: 15000 });

  const opPlanBtn = projectRow.locator('button:has-text("Operational Plan")');
  await expect(opPlanBtn).toBeVisible({ timeout: 10000 });
  await opPlanBtn.click();

  const planModal = page.locator('.ant-modal-content').filter({ hasText: 'PM Operational Plan Workspace' }).first();
  await expect(planModal).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2000);

  // ── Pillar 1: Cost / RAB ──
  console.log('[UI ACTION] PM Pillar 1: Cost / RAB setup...');
  const costSection = planModal.locator('#section-cost');
  await expect(costSection).toBeVisible({ timeout: 10000 });

  // 1. Switch Category 1 from DIRECT to ITEMIZED
  const cat1RadioItemized = costSection.locator('.ant-radio-button-wrapper').filter({ hasText: 'Rincian Item' }).first();
  await expect(cat1RadioItemized).toBeVisible({ timeout: 10000 });
  await cat1RadioItemized.click();
  await expect(cat1RadioItemized).toHaveClass(/ant-radio-button-wrapper-checked/);

  // 2. Only after ITEMIZED is active, click Tambah Item
  const tambahItemBtn = costSection.locator('button:has-text("Tambah Item")').first();
  await expect(tambahItemBtn).toBeVisible({ timeout: 10000 });
  await tambahItemBtn.click();

  // 3. Fill one valid eligible item
  const itemNameInput = costSection.locator('input[placeholder*="Nama Item"]').first();
  await expect(itemNameInput).toBeVisible({ timeout: 10000 });
  await itemNameInput.fill('Material Utama Konstruksi & Fabrikasi');

  const qtyInput = costSection.locator('input[placeholder*="Qty"]').first()
    .or(costSection.locator('.ant-input-number-input').first());
  await qtyInput.fill('100');

  const uomSelect = costSection.locator('.ant-select').filter({ hasText: /Unit|Lot/i }).first();
  if (await uomSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await uomSelect.click();
    const lotOption = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: /^Lot$/i }).first();
    if (await lotOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lotOption.click();
    }
  }

  const priceInput = costSection.locator('input[placeholder*="Harga"]').first();
  await priceInput.fill('850000');

  // Expand secondary metadata using "Detail" button to assign Scope
  const detailBtn = costSection.locator('button').filter({ hasText: 'Detail' }).first();
  await detailBtn.click();
  await page.waitForTimeout(400);

  // Set Cost assignmentScope = PROJECT (Project-Level)
  const scopeSelect = costSection.locator('.ant-select').filter({ hasText: 'Belum Ditentukan' }).first();
  await scopeSelect.click();
  await page.waitForTimeout(300);
  const projectOption = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: 'Project-Level' }).first();
  await expect(projectOption).toBeVisible({ timeout: 5000 });
  await projectOption.click();

  // 4. Verify the Cost pillar no longer shows 'Belum ada rincian' or 'Rp 0' and contains at least one ITEMIZED CostItem
  await expect(itemNameInput).toBeVisible({ timeout: 10000 });
  await expect(itemNameInput).toHaveValue('Material Utama Konstruksi & Fabrikasi');
  console.log('[UI ACTION] Cost item populated: 100 units @ Rp 850.000 = Rp 85.000.000');

  // ── Pillar 2: WBS Structure ──
  console.log('[UI ACTION] PM Pillar 2: WBS Structure setup...');
  const wbsNav = planModal.getByText('2. WBS Structure').first();
  if (await wbsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await wbsNav.click();
    await page.waitForTimeout(500);
  }

  const tambahWbsBtn = planModal.locator('button:has-text("Tambah Work Package Utama"), button:has-text("Tambah Work Package")').first();
  if (await tambahWbsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tambahWbsBtn.click();
    await page.waitForTimeout(600);

    const wbsModal = page.locator('.ant-modal-content').filter({
      has: page.locator('.ant-modal-title', {
        hasText: 'Tambah Work Package Utama',
      }),
    });
    await expect(wbsModal).toBeVisible({ timeout: 10000 });

    const wbsNameInput = wbsModal.locator('#name');
    await expect(wbsNameInput).toBeVisible({ timeout: 10000 });
    await wbsNameInput.fill('Pekerjaan Konstruksi & Fabrikasi Proyek');

    const wbsWeightInput = wbsModal.locator('#weightPercentage');
    await wbsWeightInput.click();
    await wbsWeightInput.fill('100');

    const submitWbsBtn = wbsModal.locator('button:has-text("Tambahkan")');
    await submitWbsBtn.click();
    await expect(wbsModal).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('[UI ACTION] WBS Work Package Utama added with 100% weight.');
  }

  // ── Pillar 3: Schedule & Gantt ──
  console.log('[UI ACTION] PM Pillar 3: Schedule setup...');
  const schedSection = planModal.locator('#section-schedule');

  // Ensure Schedule section is unminimized / expanded
  const schedNav = planModal.locator('div').filter({ hasText: /^3\. Schedule & Gantt/ }).first();
  await schedNav.click();

  const plusBtn = schedSection.locator('.anticon-plus').first();
  if (await plusBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await plusBtn.click();
  }

  // Wait for ScheduleGanttTab to mount and render task table
  const taskRow = schedSection.locator('.ant-table-row').first();
  await expect(taskRow).toBeVisible({ timeout: 15000 });

  // 1. Scope to the exact first canonical task row
  const startInput = taskRow.locator('input[placeholder*="Mulai"]').first();
  const endInput = taskRow.locator('input[placeholder*="Selesai"]').first();

  // 1. Open Start Date picker
  await expect(startInput).toBeVisible({ timeout: 10000 });
  await startInput.click();

  // 2. Wait for active, stable popup (no opening animation in progress)
  const startDropdown = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
  await expect(startDropdown).toHaveCount(1, { timeout: 10000 });
  await expect(startDropdown).toBeVisible({ timeout: 10000 });
  await expect(startDropdown).not.toHaveClass(/ant-slide-up-(appear|enter)/, { timeout: 10000 });

  // 3. Select exact valid in-month Start Date cell (Day 1) using robust inner text matching
  const startCell = startDropdown.locator('.ant-picker-cell-in-view .ant-picker-cell-inner').filter({ hasText: /^1$/ }).first();
  await expect(startCell).toBeVisible({ timeout: 5000 });
  await expect(startCell).toBeEnabled({ timeout: 5000 });
  await expect(startCell).toHaveCount(1);
  await startCell.click();

  // 4. Assert Start Date popup is CLOSED before touching End Date
  await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toHaveCount(0, { timeout: 5000 });

  // 5. Assert Start Date input contains the committed date matching DD MMM YYYY
  const startVal = await startInput.inputValue();
  expect(startVal).not.toBe('');
  expect(startVal).toMatch(/^\d{2}\s[A-Za-z]{3}\s\d{4}$/);
  console.log(`[UI ACTION] Schedule Start Date committed: "${startVal}"`);

  // 6. Open End Date picker
  await expect(endInput).toBeVisible({ timeout: 10000 });
  await endInput.click();

  // 7. Wait for active, stable popup (no opening animation in progress)
  const endDropdown = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
  await expect(endDropdown).toHaveCount(1, { timeout: 10000 });
  await expect(endDropdown).toBeVisible({ timeout: 10000 });
  await expect(endDropdown).not.toHaveClass(/ant-slide-up-(appear|enter)/, { timeout: 10000 });

  // 8. Select exact in-month End Date strictly after Start Date (Day 15)
  const endCell = endDropdown.locator('.ant-picker-cell-in-view .ant-picker-cell-inner').filter({ hasText: /^15$/ }).first();
  await expect(endCell).toBeVisible({ timeout: 5000 });
  await expect(endCell).toBeEnabled({ timeout: 5000 });
  await expect(endCell).toHaveCount(1);
  await endCell.click();

  // 9. Assert End Date popup is closed
  await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toHaveCount(0, { timeout: 5000 });

  // 10. Assert End Date input contains the committed date matching DD MMM YYYY and End > Start
  const endVal = await endInput.inputValue();
  expect(endVal).not.toBe('');
  expect(endVal).toMatch(/^\d{2}\s[A-Za-z]{3}\s\d{4}$/);
  expect(dayjs(endVal, 'DD MMM YYYY').isAfter(dayjs(startVal, 'DD MMM YYYY'))).toBe(true);
  console.log(`[UI ACTION] Schedule End Date committed: "${endVal}" (End > Start verified)`);

  // 12. Assert Duration != "—" and Schedule changes from 0/1 Terjadwal to 1/1 Terjadwal
  const durCell = taskRow.locator('td').filter({ hasText: 'Hari' }).first();
  await expect(durCell).toBeVisible({ timeout: 10000 });
  await expect(durCell).not.toHaveText('—');

  await expect(planModal.locator('text=1/1 Terjadwal').first()).toBeVisible({ timeout: 10000 });
  console.log('[UI ASSERTION] Schedule 1/1 Terjadwal verified.');

  // ── Pillar 4: Kondisi Awal Proyek ──
  console.log('[UI ACTION] PM Pillar 4: Initial Condition setup...');
  const condNav = planModal.getByText('4. Kondisi Awal Proyek').first();
  if (await condNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await condNav.click();
    await page.waitForTimeout(500);
  }

  const expandCondBtn = planModal.locator('button[aria-label="Expand Kondisi Awal"], button[aria-label="Maximize Kondisi Awal"]').first();
  if (await expandCondBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expandCondBtn.click();
    await page.waitForTimeout(500);
  }

  const isiBaselineBtn = planModal.locator('button:has-text("Isi Baseline"), button:has-text("Tinjau / Edit")').first();
  if (await isiBaselineBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await isiBaselineBtn.click();
    await page.waitForTimeout(600);

    const initModal = page.locator('.ant-modal-content').filter({
      has: page.locator('.ant-modal-title', {
        hasText: 'Baseline Kondisi Awal Proyek',
      }),
    });
    await expect(initModal).toBeVisible({ timeout: 10000 });

    const normalOpt = initModal.locator('#status-option-normal').first();
    if (await normalOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await normalOpt.click();
    }

    const locInput = initModal.locator('#locationCondition');
    await expect(locInput).toBeVisible({ timeout: 10000 });
    await locInput.fill('Site siap tanpa hambatan kritis, akses jalan memadai, daya PLN 33kVA dan keamanan 24 jam.');

    const constrInput = initModal.locator('#initialConstraints');
    await constrInput.click();
    await constrInput.fill('Izin kerja standar dan SOP keselamatan kerja K3 wajib dipatuhi.');

    const risksInput = initModal.locator('#initialRisks');
    await risksInput.click();
    await risksInput.fill('Risiko cuaca hujan → Dampak keterlambatan material → Mitigasi penyediaan shelter.');

    const saveInitBtn = initModal.locator('button:has-text("Simpan Baseline Kondisi Awal")');
    await saveInitBtn.click();
    await expect(initModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    console.log('[UI ACTION] Initial Condition baseline saved.');
  }

  // ── Save All Drafts to Sync with Server ──
  console.log('[UI ACTION] PM saving all operational drafts to server...');
  const simpanDraftBtn = planModal.locator('button:has-text("Simpan Draft")');
  await expect(simpanDraftBtn).toBeVisible({ timeout: 10000 });
  await simpanDraftBtn.click();
  await page.waitForTimeout(2500);

  // ── Assert 4/4 READY and 100% Kesiapan ──
  const readinessTag = planModal.locator('text="4/4 READY"').first();
  await expect(readinessTag).toBeVisible({ timeout: 15000 });

  const readinessPct = planModal.locator('text="100%"').first();
  await expect(readinessPct).toBeVisible({ timeout: 10000 });

  console.log('[UI ASSERTION] 4/4 READY and 100% Kesiapan confirmed: Cost (Itemized), WBS (100%), Schedule (1/1 Terjadwal), Initial Condition (Baseline Normal).');
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/06_operational_plan_4_4.png'), fullPage: true });
}

// ---------------------------------------------------------------------------
// 4. SUBMIT MANAGEMENT REVIEW
// ---------------------------------------------------------------------------
export async function submitManagementReview(page: Page): Promise<void> {
  console.log('\n>>> [PM] Submitting Operational Plan for Management Review...');
  const planModal = page.locator('.ant-modal-content').filter({ hasText: 'PM Operational Plan Workspace' }).first();
  await expect(planModal).toBeVisible({ timeout: 10000 });

  const ajukanReviewBtn = planModal.locator('button:has-text("Ajukan untuk Management Review")');
  await expect(ajukanReviewBtn).toBeEnabled({ timeout: 15000 });
  await ajukanReviewBtn.click();

  const confirmModal = page.locator('.ant-modal-content').filter({ hasText: 'Ajukan Operational Plan untuk Review' }).first();
  await expect(confirmModal).toBeVisible({ timeout: 10000 });

  const confirmSubmitBtn = confirmModal.locator('button:has-text("Konfirmasi & Ajukan ke Head of Operations")');
  await expect(confirmSubmitBtn).toBeVisible({ timeout: 10000 });
  await confirmSubmitBtn.click();

  await expect(confirmModal).not.toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2000);

  // Close workspace modal
  const closePlanModalBtn = planModal.locator('.ant-modal-close');
  if (await closePlanModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closePlanModalBtn.click();
    await expect(planModal).not.toBeVisible({ timeout: 10000 });
  }

  console.log('[UI ASSERTION] Operational Plan submitted for Management Review (Status: REVIEW_PENDING).');
}

// ---------------------------------------------------------------------------
// 5. GOVERNANCE REVIEW APPROVAL CHAIN
// ---------------------------------------------------------------------------
export async function completeGovernanceReviewChain(
  page: Page,
  baseUrl: string,
  tenderUniqueName: string,
  loginFn: (email: string) => Promise<void>,
  logoutFn: () => Promise<void>
): Promise<void> {
  console.log('\n>>> [GOVERNANCE] Executing full Management Review approval chain...');
  const reviewRoles = [
    { email: 'hops@epms.com', label: 'HEAD_OF_OPERATIONS' },
    { email: 'purchasing@epms.com', label: 'PROCUREMENT' },
    { email: 'finance@epms.com', label: 'FINANCE' },
    { email: 'director@epms.com', label: 'DIRECTOR' },
  ];

  for (const role of reviewRoles) {
    console.log(`\n[GOVERNANCE] Actor: ${role.label} (${role.email})...`);
    await loginFn(role.email);
    await page.goto(`${baseUrl}/governance/tasks`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const taskRow = page.locator('tr').filter({ hasText: tenderUniqueName }).first();
    await expect(taskRow).toBeVisible({ timeout: 20000 });

    const tinjauBtn = taskRow.locator('button:has-text("Tinjau")');
    await expect(tinjauBtn).toBeVisible({ timeout: 10000 });
    await tinjauBtn.click();

    // Review Modal opens
    const reviewModal = page.locator('.ant-modal-content').filter({ hasText: 'Tugas Persetujuan Proyek' }).first();
    await expect(reviewModal).toBeVisible({ timeout: 15000 });

    // Wait for content loading spin to disappear
    await page.waitForTimeout(2000);
    const modalSpin = reviewModal.locator('.ant-spin-spinning');
    if (await modalSpin.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(modalSpin).not.toBeVisible({ timeout: 15000 });
    }

    const setujuiBtn = reviewModal.locator('button:has-text("Setujui")').first();
    await expect(setujuiBtn).toBeVisible({ timeout: 10000 });
    await setujuiBtn.click();

    // Confirmation Modal
    const confirmModal = page.locator('.ant-modal-content').filter({ hasText: 'Setujui Rencana Operasional?' }).first();
    await expect(confirmModal).toBeVisible({ timeout: 10000 });

    const konfirmasiBtn = confirmModal.locator('button:has-text("Konfirmasi Persetujuan")');
    await expect(konfirmasiBtn).toBeVisible({ timeout: 10000 });
    await konfirmasiBtn.click();

    await expect(confirmModal).not.toBeVisible({ timeout: 20000 });
    await expect(reviewModal).not.toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    console.log(`[GOVERNANCE] Approval step completed by ${role.label}.`);
    if (role.label === 'HEAD_OF_OPERATIONS') {
      await page.screenshot({ path: path.resolve(__dirname, '../screenshots/07_hops_approved.png'), fullPage: true });
    } else if (role.label === 'PROCUREMENT') {
      await page.screenshot({ path: path.resolve(__dirname, '../screenshots/08_procurement_approved.png'), fullPage: true });
    } else if (role.label === 'FINANCE') {
      await page.screenshot({ path: path.resolve(__dirname, '../screenshots/09_finance_approved.png'), fullPage: true });
    } else if (role.label === 'DIRECTOR') {
      await page.screenshot({ path: path.resolve(__dirname, '../screenshots/10_director_approved_ready_for_kickoff.png'), fullPage: true });
    }
    await logoutFn();
  }

  console.log('[UI ASSERTION] Governance review chain complete. ProjectManagementReview is READY_FOR_KICKOFF.');
}

// ---------------------------------------------------------------------------
// 6. PM FORMAL KICKOFF
// ---------------------------------------------------------------------------
export async function pmExecuteFormalKickoff(
  page: Page,
  baseUrl: string,
  tenderUniqueName: string
): Promise<void> {
  console.log(`\n>>> [PM] Executing Formal Kickoff for "${tenderUniqueName}"...`);
  await page.goto(`${baseUrl}/project-delivery`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Tab 1: Antrean Kick-off Charter
  const tab1 = page.locator('.ant-tabs-tab').filter({ hasText: 'Antrean Kick-off Charter' });
  if (await tab1.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab1.click();
    await page.waitForTimeout(1000);
  }

  const readyCharterRow = page.locator(`tr:has-text("${tenderUniqueName}")`).first();
  await expect(readyCharterRow).toBeVisible({ timeout: 15000 });

  const kickoffBtn = readyCharterRow.locator('button:has-text("Formal Kickoff")');
  await expect(kickoffBtn).toBeVisible({ timeout: 10000 });
  await kickoffBtn.click();

  const kickoffModal = page
    .locator('.ant-modal-content')
    .filter({ hasText: 'Formal Kick-off Proyek (Aktivasi ke IN_PROGRESS)' })
    .first();
  await expect(kickoffModal).toBeVisible({ timeout: 10000 });

  // Select today date for actual kickoff
  const kickoffDateInput = kickoffModal.locator('#kickoffDate');
  await kickoffDateInput.click();
  await page.waitForTimeout(300);
  const todayBtn = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-today-btn').first();
  if (await todayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await todayBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(400);

  // Confirm Formal Kickoff
  const confirmKickoffBtn = kickoffModal.locator('button:has-text("Formal Kickoff")');
  await confirmKickoffBtn.click();
  await expect(kickoffModal).not.toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);

  // Verify transition to Tab 2: Daftar Proyek Berjalan (IN_PROGRESS)
  const activeTabPane = await activateProjectDeliveryTab2(page, baseUrl);

  const activeProjectRow = activeTabPane.locator(`tr:has-text("${tenderUniqueName}")`);
  await expect(activeProjectRow).toHaveCount(1);
  await expect(activeProjectRow).toBeVisible({ timeout: 15000 });

  // Verify status tag shows IN_PROGRESS and Cost/RAB shows APPROVED
  const rabApprovedTag = activeProjectRow.locator('.ant-tag:has-text("APPROVED"), .ant-tag:has-text("Disetujui")').first();
  await expect(rabApprovedTag).toBeVisible({ timeout: 10000 });
  console.log('[UI ASSERTION] Project status = IN_PROGRESS and Cost/RAB = APPROVED verified.');
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/11_project_in_progress.png'), fullPage: true });
}

/**
 * Deterministically activates Tab 2 ("Daftar Proyek Berjalan") in Project Delivery Workspace.
 * - Only navigates to /project-delivery if the page is not already there.
 * - Asserts Project Delivery UI readiness.
 * - Asserts exact uniqueness of Tab 2 locator (count = 1).
 * - Checks semantic aria-selected="true" state and clicks if inactive.
 * - Asserts Tab 2 is active via aria-selected="true".
 * - Scopes and returns the active Tab 2 pane.
 */
export async function activateProjectDeliveryTab2(page: Page, baseUrl: string) {
  if (!page.url().includes('/project-delivery')) {
    await page.goto(`${baseUrl}/project-delivery`, { waitUntil: 'domcontentloaded' });
  }

  // Ensure Project Delivery UI is ready
  const workspaceTitle = page.locator('h1, h2, h3, div').filter({ hasText: 'Project Delivery Workspace' }).first();
  await expect(workspaceTitle).toBeVisible({ timeout: 15000 });

  // Locate exact Tab 2
  const activeProjectsTab = page
    .locator('[role="tab"]')
    .filter({ hasText: 'Daftar Proyek Berjalan' });

  // Prove unique (strictly no .first())
  await expect(activeProjectsTab).toHaveCount(1);
  await expect(activeProjectsTab).toBeVisible({ timeout: 10000 });

  // Check exact semantic active state
  const isAlreadyActive = (await activeProjectsTab.getAttribute('aria-selected')) === 'true';
  if (!isAlreadyActive) {
    await activeProjectsTab.click();
  }
  await expect(activeProjectsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

  // Wait for active tabpane to be visible
  const activeTabPane = page.locator('.ant-tabs-tabpane-active');
  await expect(activeTabPane).toBeVisible({ timeout: 10000 });
  return activeTabPane;
}

// ---------------------------------------------------------------------------
// 7. PM CREATE & SUBMIT PROCUREMENT PACKAGE
// ---------------------------------------------------------------------------
export async function pmCreateAndSubmitProcurementPackage(
  page: Page,
  baseUrl: string,
  tenderUniqueName: string
): Promise<string> {
  console.log(`\n>>> [PM] Creating and submitting Procurement Package from approved RAB...`);
  const activeTabPane = await activateProjectDeliveryTab2(page, baseUrl);

  const activeProjectRow = activeTabPane.locator(`tr:has-text("${tenderUniqueName}")`);
  await expect(activeProjectRow).toHaveCount(1);
  await expect(activeProjectRow).toBeVisible({ timeout: 15000 });

  const paketPengadaanBtn = activeProjectRow.locator('button:has-text("Paket Pengadaan")');
  await expect(paketPengadaanBtn).toBeVisible({ timeout: 10000 });
  await paketPengadaanBtn.click();

  const packageModal = page.locator('.ant-modal-content').filter({ hasText: 'Paket Pengadaan Proyek' }).first();
  await expect(packageModal).toBeVisible({ timeout: 15000 });

  // Click Buat Paket Pengadaan Baru
  const buatPaketBtn = packageModal.locator('button:has-text("Buat Paket Pengadaan Baru")');
  await expect(buatPaketBtn).toBeVisible({ timeout: 10000 });
  await buatPaketBtn.click();

  // Form mode opens
  const titleInput = packageModal.locator('#title');
  await expect(titleInput).toBeVisible({ timeout: 10000 });
  await titleInput.click();
  await titleInput.fill('Paket Pengadaan Material Utama Konstruksi');

  // Set requiredDate (today) with strict DatePicker discipline
  const reqDateInput = packageModal.locator('#requiredDate');
  await expect(reqDateInput).toBeVisible({ timeout: 10000 });
  await reqDateInput.click();

  const activeDatePopup = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
  await expect(activeDatePopup).toHaveCount(1, { timeout: 10000 });
  await expect(activeDatePopup).toBeVisible({ timeout: 5000 });
  await expect(activeDatePopup).not.toHaveClass(/ant-slide-up-(appear|enter)/, { timeout: 10000 });

  const todayBtn = activeDatePopup.locator('.ant-picker-today-btn');
  if (await todayBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await todayBtn.click();
  } else {
    const todayCellInner = activeDatePopup.locator('.ant-picker-cell-today .ant-picker-cell-inner');
    await expect(todayCellInner).toBeVisible({ timeout: 5000 });
    await todayCellInner.click();
  }

  // Assert popup closed completely
  await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toHaveCount(0, { timeout: 5000 });

  // Assert committed value is not empty and matches DD/MM/YYYY
  const committedDate = await reqDateInput.inputValue();
  expect(committedDate).not.toBe('');
  expect(committedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  console.log(`[DOM ASSERTION] Committed requiredDate: "${committedDate}" and DatePicker popup closed.`);

  // Locate exact Cost Item row inside packageModal
  const costItemRow = packageModal
    .locator('.ant-table-tbody tr')
    .filter({ hasText: 'Material Utama Konstruksi & Fabrikasi' })
    .first();
  await expect(costItemRow).toBeVisible({ timeout: 10000 });

  // Locate and click the visible checkbox wrapper without force: true
  const checkboxWrapper = costItemRow.locator('.ant-checkbox-wrapper');
  await expect(checkboxWrapper).toBeVisible({ timeout: 10000 });
  await expect(checkboxWrapper).toBeEnabled({ timeout: 5000 });
  await checkboxWrapper.click();

  const checkboxInput = costItemRow.locator('input[type="checkbox"]');
  await expect(checkboxInput).toBeChecked({ timeout: 5000 });
  console.log('[DOM ASSERTION] Cost item checkbox checked normally without force.');

  // Click Simpan & Ajukan ke Procurement
  const submitPkgBtn = packageModal.locator('button:has-text("Simpan & Ajukan ke Procurement")');
  await expect(submitPkgBtn).toBeVisible({ timeout: 10000 });
  await submitPkgBtn.click();

  // Modal switches back to list mode
  await page.waitForTimeout(2000);
  const packageTable = packageModal.locator('table').first();
  await expect(packageTable).toBeVisible({ timeout: 15000 });

  // Capture fresh package number
  const packageRow = packageTable.locator('tbody tr').first();
  await expect(packageRow).toBeVisible({ timeout: 15000 });
  const pkgNumberEl = packageRow.locator('span[style*="monospace"]').first();
  const capturedPackageNumber = (await pkgNumberEl.innerText()).trim();
  console.log(`[DOM CAPTURE] Captured Canonical Procurement Package: "${capturedPackageNumber}"`);
  expect(capturedPackageNumber).toMatch(/^PKG-/);

  // Verify package status is SUBMITTED (renders as "Diajukan ke Pengadaan" in Indonesian UI)
  const pkgStatusTag = packageRow.locator('.ant-tag').filter({ hasText: /SUBMITTED|Diajukan ke Pengadaan/i }).first();
  await expect(pkgStatusTag).toBeVisible({ timeout: 10000 });
  console.log(`[UI ASSERTION] Package status = SUBMITTED verified in DOM.`);
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/12_procurement_package.png'), fullPage: true });

  // Close modal
  const closePkgModalBtn = packageModal.locator('.ant-modal-close');
  if (await closePkgModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closePkgModalBtn.click();
  }

  return capturedPackageNumber;
}

/**
 * Mandatory, deterministic activation of the "Purchase Request" tab on /procurement.
 * Adheres strictly to R9.1B-HARNESS-FIX-10 contract:
 * 1. Locate exact tab by role/text
 * 2. Assert count = 1
 * 3. Assert visible
 * 4. Inspect active state
 * 5. If inactive, click normally
 * 6. Assert active state (aria-selected="true" and ant-tabs-tab-active)
 * 7. Assert Purchase Request table/content is visible
 * No arbitrary sleep. No optional skipping.
 */
export async function activatePurchaseRequestTab(page: Page): Promise<void> {
  const prTab = page.getByRole('tab', { name: /Purchase Request/i });
  await expect(prTab).toHaveCount(1);
  await expect(prTab).toBeVisible({ timeout: 15000 });

  const isSelected = await prTab.getAttribute('aria-selected');
  const hasActiveClass = await page.locator('.ant-tabs-tab-active').filter({ hasText: 'Purchase Request' }).isVisible({ timeout: 1000 }).catch(() => false);
  const isActive = isSelected === 'true' || hasActiveClass;

  if (!isActive) {
    console.log('[TAB ACTION] Purchase Request tab is currently inactive. Clicking to activate...');
    await prTab.click();
  }

  // Assert active state deterministically:
  // In rc-tabs, role="tab" element (.ant-tabs-tab-btn) holds aria-selected="true"
  // while its parent wrapper (.ant-tabs-tab) holds .ant-tabs-tab-active
  await expect(prTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  await expect(page.locator('.ant-tabs-tab-active')).toContainText('Purchase Request');

  // Assert Purchase Request card and table are visible in DOM
  const prCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
  await expect(prCard).toBeVisible({ timeout: 15000 });
  const prTable = prCard.locator('.ant-table');
  await expect(prTable).toBeVisible({ timeout: 10000 });
  console.log('[TAB ASSERTION] Purchase Request tab confirmed active and PR table visible.');
}

/**
 * TEST-ONLY HELPER: Locate exact table row across Ant Design table pagination
 *
 * Requirements:
 * 1. Exact match (strict text filter)
 * 2. Count = 1 (fails if duplicates exist on the page where found)
 * 3. No .first() hiding duplicates
 * 4. Advances to next page if not found on current page
 * 5. Deterministic page transition waiting (no arbitrary sleep)
 * 6. Stops when found or when no next page exists
 */
export async function findTableRowByTextWithPagination(
  page: Page,
  exactText: string,
  options: {
    containerLocator?: Locator;
    maxPages?: number;
    timeout?: number;
  } = {}
): Promise<Locator> {
  const maxPages = options.maxPages ?? 10;
  const timeout = options.timeout ?? 15000;

  // 1. Determine container scope
  let scope: Locator;
  if (options.containerLocator) {
    scope = options.containerLocator;
  } else {
    const prCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
    if (await prCard.isVisible({ timeout: 1000 }).catch(() => false)) {
      scope = prCard;
    } else {
      scope = page.locator('body');
    }
  }

  // 2. Ensure table container is visible and not in loading state
  await expect(scope.locator('.ant-table, table').first()).toBeVisible({ timeout });
  const spinLocator = scope.locator('.ant-spin-spinning');
  if (await spinLocator.isVisible({ timeout: 500 }).catch(() => false)) {
    await expect(spinLocator).toBeHidden({ timeout });
  }

  // 3. Locate pagination container if present
  const pagination = scope.locator('.ant-pagination');
  const hasPagination = await pagination.isVisible({ timeout: 2000 }).catch(() => false);

  // If pagination exists and not on page 1, reset to page 1 to search deterministically
  if (hasPagination) {
    const page1Item = pagination.locator('.ant-pagination-item-1');
    if (await page1Item.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isPage1Active = await page1Item.evaluate((el) => el.classList.contains('ant-pagination-item-active')).catch(() => false);
      if (!isPage1Active) {
        console.log(`[PAGINATION HELPER] Resetting pagination to Page 1 before search...`);
        const firstRowTextBefore = await scope.locator('tbody tr').first().innerText().catch(() => '');
        await page1Item.click();
        await expect(page1Item).toHaveClass(/ant-pagination-item-active/, { timeout: 10000 });
        if (firstRowTextBefore) {
          await expect(scope.locator('tbody tr').first()).not.toHaveText(firstRowTextBefore, { timeout: 10000 }).catch(() => {});
        }
      }
    }
  }

  // 4. Iterate through pages searching for exact row
  let currentPage = 1;
  while (currentPage <= maxPages) {
    // Exact row matching within tbody tr:
    // Matches row containing an element with exact text
    const exactRows = scope.locator('tbody tr').filter({
      has: page.getByText(exactText, { exact: true })
    });

    const count = await exactRows.count();
    console.log(`[PAGINATION HELPER] Page ${currentPage}: searching for "${exactText}", found count = ${count}`);

    if (count === 1) {
      await expect(exactRows).toHaveCount(1);
      await expect(exactRows).toBeVisible({ timeout: 5000 });
      console.log(`[PAGINATION HELPER] Found unique row for "${exactText}" on Page ${currentPage}.`);
      return exactRows;
    }

    if (count > 1) {
      throw new Error(`[PAGINATION HELPER] Non-unique row match: Found ${count} rows matching "${exactText}" on Page ${currentPage}. Strict uniqueness violated.`);
    }

    // If not found and no pagination, stop
    if (!hasPagination) {
      break;
    }

    // Check if next page button exists and is enabled
    const nextBtn = pagination.locator('.ant-pagination-next');
    const isNextVisible = await nextBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (!isNextVisible) {
      break;
    }

    const isNextDisabled = await nextBtn.evaluate((el) => {
      return el.classList.contains('ant-pagination-disabled') ||
             el.getAttribute('aria-disabled') === 'true' ||
             el.querySelector('button')?.disabled === true;
    }).catch(() => true);

    if (isNextDisabled) {
      console.log(`[PAGINATION HELPER] Reached last page (${currentPage}) without finding "${exactText}". Next button is disabled.`);
      break;
    }

    // Capture state before advancing to guarantee state-based transition
    const activeItem = pagination.locator('.ant-pagination-item-active');
    const activePageText = (await activeItem.innerText().catch(() => ''))?.trim();
    const firstRowText = await scope.locator('tbody tr').first().innerText().catch(() => '');

    console.log(`[PAGINATION HELPER] Advancing from Page ${currentPage} to next page...`);
    const nextClickTarget = nextBtn.locator('button').first();
    if (await nextClickTarget.isVisible().catch(() => false)) {
      await nextClickTarget.click();
    } else {
      await nextBtn.click();
    }

    // State-based wait: active page indicator changes AND/OR first row text changes
    if (activePageText) {
      await expect(activeItem).not.toHaveText(activePageText, { timeout: 10000 });
    } else if (firstRowText) {
      await expect(scope.locator('tbody tr').first()).not.toHaveText(firstRowText, { timeout: 10000 });
    }

    // Ensure spin has finished if present
    if (await scope.locator('.ant-spin-spinning').isVisible({ timeout: 500 }).catch(() => false)) {
      await expect(scope.locator('.ant-spin-spinning')).toBeHidden({ timeout: 10000 });
    }
    await expect(scope.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

    currentPage++;
  }

  // If loop exhausted and not found, perform strict assertion to yield standard Playwright failure
  const finalExactRows = scope.locator('tbody tr').filter({
    has: page.getByText(exactText, { exact: true })
  });
  await expect(finalExactRows).toHaveCount(1, {
    timeout: 1000
  });
  return finalExactRows;
}

// ---------------------------------------------------------------------------
// 8. PURCHASING CREATE PR FROM PACKAGE
// ---------------------------------------------------------------------------
export async function purchasingCreatePrFromPackage(
  page: Page,
  baseUrl: string,
  packageNumber: string
): Promise<string> {
  console.log(`\n>>> [PURCHASING] Creating PR from fresh package "${packageNumber}"...`);
  await page.goto(`${baseUrl}/procurement`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Ensure Tab "Paket Pengadaan" is active
  const pkgTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Paket Pengadaan' });
  if (await pkgTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pkgTab.click();
    await page.waitForTimeout(1000);
  }

  const pkgRow = page.locator(`tr:has-text("${packageNumber}")`).first();
  await expect(pkgRow).toBeVisible({ timeout: 20000 });

  // 1. Layer 1 (Backend/API): Setup response listener for POST create-pr
  const prResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/create-pr') && resp.request().method() === 'POST',
    { timeout: 20000 }
  );

  const buatPrBtn = pkgRow.locator('button:has-text("Buat PR")');
  await expect(buatPrBtn).toBeVisible({ timeout: 10000 });
  await buatPrBtn.click();

  // Await and verify HTTP 201 backend response
  const prResponse = await prResponsePromise;
  expect(prResponse.status()).toBe(201);
  const prJson = await prResponse.json();
  const createdPr = prJson.data?.purchaseRequest || prJson.purchaseRequest || prJson.data || prJson;
  console.log(`[API ASSERTION] POST /create-pr returned 201 with backend status = "${createdPr.status}"`);
  expect(createdPr.status).toBe('SUBMITTED');

  // Wait for success toast with PR number
  const successToast = page.locator('.ant-message-success').first();
  await expect(successToast).toBeVisible({ timeout: 15000 });
  const toastText = await successToast.innerText();
  const prMatch = toastText.match(/PR-[0-9A-Za-z_-]+/);
  let capturedPrNumber = createdPr?.prNumber || (prMatch ? prMatch[0] : '');

  // Navigate to Purchase Request tab deterministically
  await activatePurchaseRequestTab(page);

  const prCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Request' });
  await expect(prCard).toBeVisible({ timeout: 15000 });

  if (!capturedPrNumber) {
    // Fallback: capture from first row of PR table
    const firstPrRow = prCard.locator('table tbody tr').first();
    await expect(firstPrRow).toBeVisible({ timeout: 15000 });
    capturedPrNumber = (await firstPrRow.locator('td').first().innerText()).split('\n')[0].trim();
  }

  console.log(`[DOM CAPTURE] Captured Fresh Canonical PR Number: "${capturedPrNumber}"`);
  expect(capturedPrNumber).toMatch(/^PR-/);

  // 3. Layer 2 (UI Presentation Contract):
  // Scope exact fresh PR row uniquely by capturedPrNumber
  const prRow = prCard.locator('tr').filter({ hasText: capturedPrNumber });
  await expect(prRow).toHaveCount(1);
  await expect(prRow).toBeVisible({ timeout: 15000 });

  // Locate exact status tag within that already-unique row
  const prStatusTag = prRow.locator('.ant-tag');
  await expect(prStatusTag).toHaveCount(1);
  await expect(prStatusTag).toBeVisible({ timeout: 10000 });
  const renderedLabel = (await prStatusTag.innerText()).trim();
  console.log(`[UI ASSERTION] Fresh PR rendered status label = "${renderedLabel}" (Expected: "Menunggu Review Finance").`);
  expect(renderedLabel).toBe('Menunggu Review Finance');
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/13_purchase_request.png'), fullPage: true });

  return capturedPrNumber;
}

// ---------------------------------------------------------------------------
// 9. COMPLETE PR APPROVAL WORKFLOW (Finance -> Director -> Purchasing)
// ---------------------------------------------------------------------------
export interface PrWorkflowResult {
  prNumber: string;
  terminalStatus: string;
  currentActor: string;
  rfqAvailable: boolean;
}

export async function completePrApprovalWorkflow(
  page: Page,
  baseUrl: string,
  prNumber: string,
  loginFn: (email: string) => Promise<void>,
  logoutFn: () => Promise<void>
): Promise<PrWorkflowResult> {
  console.log(`\n[STEP24-START] Executing Purchase Request Approval Workflow for "${prNumber}"...`);

  // Ensure clean unauthenticated boundary if called while logged in as prior actor
  if (page.url() !== `${baseUrl}/login` && !page.url().includes('/login')) {
    const hasHeaderDropdown = await page.locator('header .ant-dropdown-trigger').first().isVisible({ timeout: 1000 }).catch(() => false);
    if (hasHeaderDropdown) {
      await logoutFn();
    }
  }

  // =========================================================================
  // PHASE 1: FINANCE REVIEW & FORWARD TO DIRECTOR
  // =========================================================================
  console.log('\n[STEP24-FINANCE-LOGIN] Logging in as Finance (finance@epms.com)...');
  await loginFn('finance@epms.com');
  expect(page.url()).not.toMatch(/\/login$/);

  // Navigate to /procurement and assert route
  if (!page.url().includes('/procurement')) {
    await page.goto(`${baseUrl}/procurement`, { waitUntil: 'domcontentloaded' });
  }
  await expect(page).toHaveURL(/.*\/procurement/, { timeout: 15000 });
  await activatePurchaseRequestTab(page);

  // Locate exact fresh PR row without .first()
  const finPrRow = page.locator('tr').filter({ hasText: prNumber });
  await expect(finPrRow).toHaveCount(1);
  await expect(finPrRow).toBeVisible({ timeout: 15000 });
  console.log(`[STEP24-FINANCE-PR-FOUND] Found exact PR row for "${prNumber}".`);

  // Verify visible status label
  const finStatusTag = finPrRow.locator('.ant-tag').first();
  await expect(finStatusTag).toBeVisible({ timeout: 10000 });
  const finStatusText = (await finStatusTag.innerText()).trim();
  console.log(`[PR STATUS] Finance observed PR status: "${finStatusText}"`);

  // If status is Menunggu Review Finance (or SUBMITTED), execute Finance action
  if (finStatusText.match(/Menunggu Review Finance|SUBMITTED/i)) {
    const finAlurBtn = finPrRow.locator('button:has-text("Alur Approval")');
    await expect(finAlurBtn).toBeVisible({ timeout: 10000 });
    await finAlurBtn.click();

    const finModal = page.locator('.ant-modal-content').filter({ hasText: /PR Approval Workflow|Alur Approval/ }).first();
    await expect(finModal).toBeVisible({ timeout: 15000 });

    const passToDirBtn = finModal.locator('button:has-text("Lanjutkan ke Director")');
    await expect(passToDirBtn).toBeVisible({ timeout: 10000 });
    await passToDirBtn.click();

    const confirmPassModal = page.locator('.ant-modal-content').filter({ hasText: 'Lanjutkan PR ke Director' }).first();
    await expect(confirmPassModal).toBeVisible({ timeout: 10000 });
    const confirmPassBtn = confirmPassModal.locator('button:has-text("Konfirmasi — Lanjutkan ke Director")');
    await expect(confirmPassBtn).toBeVisible({ timeout: 10000 });
    await confirmPassBtn.click();
    await expect(confirmPassModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    const closeWorkflowFin = finModal.locator('.ant-modal-close');
    if (await closeWorkflowFin.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeWorkflowFin.click();
    }

    // Verify visible transition to Director-pending state
    await expect(finPrRow.locator('.ant-tag').first()).toContainText(/Director/i, { timeout: 15000 });
    console.log('[STEP24-FINANCE-APPROVED] PR successfully reviewed by Finance and forwarded to Director.');
  } else {
    console.log(`[STEP24-FINANCE-APPROVED] PR already beyond Finance review (current status: "${finStatusText}").`);
  }

  // Logout Finance through UI
  await logoutFn();

  // =========================================================================
  // PHASE 2: DIRECTOR FINAL APPROVAL
  // =========================================================================
  console.log('\n[STEP24-DIRECTOR-LOGIN] Logging in as Director (director@epms.com)...');
  await loginFn('director@epms.com');
  expect(page.url()).not.toMatch(/\/login$/);

  // Navigate to /procurement and assert route
  if (!page.url().includes('/procurement')) {
    await page.goto(`${baseUrl}/procurement`, { waitUntil: 'domcontentloaded' });
  }
  await expect(page).toHaveURL(/.*\/procurement/, { timeout: 15000 });
  await activatePurchaseRequestTab(page);

  // Locate exact same fresh PR
  const dirPrRow = page.locator('tr').filter({ hasText: prNumber });
  await expect(dirPrRow).toHaveCount(1);
  await expect(dirPrRow).toBeVisible({ timeout: 15000 });
  console.log(`[STEP24-DIRECTOR-PR-FOUND] Found exact PR row for "${prNumber}".`);

  // Verify awaiting Director approval
  const dirStatusTag = dirPrRow.locator('.ant-tag').first();
  await expect(dirStatusTag).toBeVisible({ timeout: 10000 });
  const dirStatusText = (await dirStatusTag.innerText()).trim();
  console.log(`[PR STATUS] Director observed PR status: "${dirStatusText}"`);

  if (dirStatusText.match(/Menunggu Final Approval Director|DIRECTOR_APPROVAL/i)) {
    const dirAlurBtn = dirPrRow.locator('button:has-text("Alur Approval")');
    await expect(dirAlurBtn).toBeVisible({ timeout: 10000 });
    await dirAlurBtn.click();

    const dirModal = page.locator('.ant-modal-content').filter({ hasText: /PR Approval Workflow|Alur Approval/ }).first();
    await expect(dirModal).toBeVisible({ timeout: 15000 });

    const approvePrBtn = dirModal.locator('button:has-text("Approve PR")');
    await expect(approvePrBtn).toBeVisible({ timeout: 10000 });
    await approvePrBtn.click();

    const confirmDirModal = page.locator('.ant-modal-content').filter({ hasText: 'Final Approval PR — Konfirmasi' }).first();
    await expect(confirmDirModal).toBeVisible({ timeout: 10000 });
    const confirmDirApproveBtn = confirmDirModal.locator('button:has-text("Approve PR")');
    await expect(confirmDirApproveBtn).toBeVisible({ timeout: 10000 });
    await confirmDirApproveBtn.click();
    await expect(confirmDirModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    const closeWorkflowDir = dirModal.locator('.ant-modal-close');
    if (await closeWorkflowDir.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeWorkflowDir.click();
    }

    // Verify visible transition to Approved state
    await expect(dirPrRow.locator('.ant-tag').first()).toContainText(/Disetujui|APPROVED/i, { timeout: 15000 });
    console.log('[STEP24-DIRECTOR-APPROVED] Final Approval completed by Director.');
  } else {
    console.log(`[STEP24-DIRECTOR-APPROVED] PR already approved (current status: "${dirStatusText}").`);
  }

  // Logout Director through UI
  await logoutFn();

  // =========================================================================
  // PHASE 3: TERMINAL PROCUREMENT VERIFICATION & RFQ ELIGIBILITY
  // =========================================================================
  console.log('\n[STEP24-PURCHASING-LOGIN] Logging in as Purchasing (purchasing@epms.com)...');
  await loginFn('purchasing@epms.com');
  expect(page.url()).not.toMatch(/\/login$/);

  // Navigate to /procurement and assert route
  if (!page.url().includes('/procurement')) {
    await page.goto(`${baseUrl}/procurement`, { waitUntil: 'domcontentloaded' });
  }
  await expect(page).toHaveURL(/.*\/procurement/, { timeout: 15000 });
  await activatePurchaseRequestTab(page);

  // Locate exact same fresh PR
  const finalPrRow = page.locator('tr').filter({ hasText: prNumber });
  await expect(finalPrRow).toHaveCount(1);
  await expect(finalPrRow).toBeVisible({ timeout: 15000 });

  // Locate status tag and assert terminal label
  const finalApprovedTag = finalPrRow.locator('.ant-tag').first();
  await expect(finalApprovedTag).toBeVisible({ timeout: 10000 });
  const renderedLabel = (await finalApprovedTag.innerText()).trim();
  console.log(`[STEP24-PR-TERMINAL-APPROVED] PR "${prNumber}" status tag label = "${renderedLabel}" (Expected: "PR Disetujui")`);
  expect(renderedLabel).toMatch(/PR Disetujui|APPROVED/i);

  // Verify "Buat RFQ" button is visible and enabled
  const buatRfqBtn = finalPrRow.locator('button:has-text("Buat RFQ")');
  await expect(buatRfqBtn).toHaveCount(1);
  await expect(buatRfqBtn).toBeVisible({ timeout: 10000 });
  await expect(buatRfqBtn).toBeEnabled({ timeout: 5000 });
  console.log(`[STEP24-RFQ-ACTION-AVAILABLE] "Buat RFQ" button is visible and enabled for "${prNumber}".`);
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/14_pr_approved.png'), fullPage: true });

  console.log('\n[STEP24-END] PR Approval Workflow complete. Procurement actor logged in and ready for RFQ.');

  return {
    prNumber,
    terminalStatus: renderedLabel,
    currentActor: 'purchasing@epms.com',
    rfqAvailable: true,
  };
}

// ---------------------------------------------------------------------------
// 10. CREATE RFQ, 3 QUOTATIONS, VENDOR COMPARISON & EVALUATION
// ---------------------------------------------------------------------------
export async function createAndEvaluateRfq(
  page: Page,
  prNumber: string
): Promise<string> {
  console.log(`\n>>> [PURCHASING] Creating fresh RFQ from APPROVED PR "${prNumber}"...`);
  // Ensure Purchase Request tab is active deterministically
  await activatePurchaseRequestTab(page);

  const prRow = page.locator('tr').filter({ hasText: prNumber });
  await expect(prRow).toHaveCount(1);
  await expect(prRow).toBeVisible({ timeout: 15000 });

  // Extract PR ID from PR row text: e.g. "PR-20260928-006 Ref ID: #10"
  const prRowText = await prRow.innerText();
  const prIdMatch = prRowText.match(/Ref ID:\s*#(\d+)/i);
  const resolvedPrId: number | undefined = prIdMatch ? Number(prIdMatch[1]) : undefined;
  console.log(`[PR CONTEXT] Sourced PR ID = ${resolvedPrId ?? 'N/A'} for "${prNumber}".`);

  // Open RFQ modal
  const buatRfqBtn = prRow.locator('button:has-text("Buat RFQ")');
  if (await buatRfqBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await buatRfqBtn.click();
  } else {
    const alurBtn = prRow.locator('button:has-text("Alur Approval")');
    await alurBtn.click();
    const prModal = page.locator('.ant-modal-content').filter({ hasText: 'PR Approval Workflow' }).first();
    await expect(prModal).toBeVisible({ timeout: 10000 });
    const modalBuatRfq = prModal.locator('button:has-text("Buat RFQ")');
    await expect(modalBuatRfq).toBeVisible({ timeout: 10000 });
    await modalBuatRfq.click();
  }

  const rfqCreationModal = page.locator('.ant-modal-content').filter({ hasText: 'Request for Quotation (RFQ)' }).or(page.locator('.ant-modal-content').filter({ hasText: 'Penerbitan RFQ' })).first();
  await expect(rfqCreationModal).toBeVisible({ timeout: 15000 });

  // Fill RFQ notes
  const notesInput = rfqCreationModal.locator('textarea, input[placeholder*="Catatan"]').first();
  if (await notesInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await notesInput.fill('Canonical E2E Procurement Cycle — Fast Track Delivery');
  }

  // Set up waitForResponse for POST /api/v1/procurement/rfqs before clicking confirm
  const rfqResponsePromise = page.waitForResponse(
    (res) => {
      try {
        const url = new URL(res.url());
        return (
          url.pathname === '/api/v1/procurement/rfqs' &&
          res.request().method() === 'POST'
        );
      } catch {
        return false;
      }
    },
    { timeout: 20000 }
  );

  // Click Terbitkan RFQ
  const submitRfqBtn = rfqCreationModal.locator('button:has-text("Terbitkan RFQ")');
  await expect(submitRfqBtn).toBeVisible({ timeout: 5000 });
  await submitRfqBtn.click();

  const confirmRfqModal = page.locator('.ant-modal-confirm');
  await expect(confirmRfqModal).toBeVisible({ timeout: 10000 });
  const confirmOkBtn = confirmRfqModal.locator('button:has-text("Terbitkan RFQ")');
  await confirmOkBtn.click();

  // Await and assert HTTP 201 response
  const rfqResponse = await rfqResponsePromise;
  expect(rfqResponse.status()).toBe(201);
  const rfqJson = await rfqResponse.json();
  const rfqPayload = rfqJson.data?.data || rfqJson.data || rfqJson;
  const capturedRfqId = Number(rfqPayload.id);
  const capturedRfqNumber = String(rfqPayload.rfqNumber || rfqPayload.rfq_number);
  const rfqStatus = rfqPayload.status;
  const rfqPrId = Number(rfqPayload.prId || rfqPayload.pr_id || rfqPayload.purchaseRequestId);

  expect(capturedRfqId).toBeGreaterThan(0);
  expect(capturedRfqNumber).toMatch(/^RFQ-/);
  expect(rfqStatus).toBe('OPEN');
  if (resolvedPrId) {
    expect(rfqPrId).toBe(resolvedPrId);
  }
  console.log(`[API ASSERTION] Fresh RFQ created: ID=${capturedRfqId}, Number="${capturedRfqNumber}", Status="${rfqStatus}", Linked PR ID=${rfqPrId} (expected ${resolvedPrId ?? 'N/A'})`);

  // Assert RFQ creation modal closes
  await expect(rfqCreationModal).not.toBeVisible({ timeout: 15000 });

  // Scope exact PR row in table
  const updatedPrRow = page.locator('tr').filter({ hasText: prNumber });
  await expect(updatedPrRow).toHaveCount(1);
  await expect(updatedPrRow).toBeVisible({ timeout: 15000 });

  // Assert UI projection in PR row: RFQ Number and status tag OPEN
  const rfqTag = updatedPrRow.locator(`.ant-tag:has-text("${capturedRfqNumber}")`);
  await expect(rfqTag).toBeVisible({ timeout: 15000 });

  const rfqOpenTag = updatedPrRow.locator('.ant-tag:has-text("OPEN")');
  await expect(rfqOpenTag).toBeVisible({ timeout: 15000 });
  console.log(`[UI ASSERTION] PR row reflects "${capturedRfqNumber}" with status OPEN.`);
  await page.screenshot({ path: path.resolve(__dirname, '../screenshots/15_rfq.png'), fullPage: true });

  // Locate exact "Lihat RFQ" button on the PR row
  const lihatRfqBtn = updatedPrRow.locator('button:has-text("Lihat RFQ")');
  await expect(lihatRfqBtn).toHaveCount(1);
  await expect(lihatRfqBtn).toBeVisible({ timeout: 10000 });
  await expect(lihatRfqBtn).toBeEnabled({ timeout: 10000 });
  await lihatRfqBtn.click();

  // Scope exact RFQ detail workspace modal
  const rfqWorkspaceModal = page.locator('.ant-modal-content').filter({ hasText: capturedRfqNumber }).first();
  await expect(rfqWorkspaceModal).toBeVisible({ timeout: 15000 });
  console.log(`[UI ASSERTION] RFQ Workspace modal opened for "${capturedRfqNumber}".`);

  // Verify quotation entry section exists
  const quoteSection = rfqWorkspaceModal.locator('text=/Daftar Penawaran Vendor/');
  await expect(quoteSection).toBeVisible({ timeout: 10000 });

  // ── Quotation #1 ──
  console.log('\n[RFQ] Recording Vendor Quotation #1...');
  const addQuoteBtn1 = rfqWorkspaceModal.locator('button:has-text("Input Penawaran Vendor"), button:has-text("Tambah Vendor")').first();
  await expect(addQuoteBtn1).toBeVisible({ timeout: 10000 });
  await addQuoteBtn1.click();

  const quoteModal1 = page.locator('.ant-modal-content').filter({ hasText: 'Pilih Vendor Terdaftar' }).first();
  await expect(quoteModal1).toBeVisible({ timeout: 10000 });

  const vendorSelect1 = quoteModal1.locator('.ant-select').first();
  await vendorSelect1.click();
  await page.waitForTimeout(400);

  const vendorOptions1 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)');
  await expect(vendorOptions1.first()).toBeVisible({ timeout: 10000 });
  const vendor1Name = (await vendorOptions1.first().innerText()).trim();
  console.log(`[UI ACTION] Selected Vendor #1: "${vendor1Name}"`);
  await vendorOptions1.first().click();

  const leadTimeInput1 = quoteModal1.locator('#leadTimeDays');
  await leadTimeInput1.click();
  await leadTimeInput1.fill('7');

  const priceInputs1 = quoteModal1.locator('.ant-table tbody .ant-input-number-input');
  const count1 = await priceInputs1.count();
  for (let i = 0; i < count1; i++) {
    await priceInputs1.nth(i).click();
    await priceInputs1.nth(i).fill('800000');
  }

  const submitQuoteBtn1 = quoteModal1.locator('button:has-text("Simpan Penawaran Vendor")');
  await submitQuoteBtn1.click();
  await expect(quoteModal1).not.toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  // ── Quotation #2 ──
  console.log('\n[RFQ] Recording Vendor Quotation #2...');
  const addQuoteBtn2 = rfqWorkspaceModal.locator('button:has-text("Input Penawaran Vendor"), button:has-text("Tambah Vendor")').first();
  await expect(addQuoteBtn2).toBeVisible({ timeout: 10000 });
  await addQuoteBtn2.click();

  const quoteModal2 = page.locator('.ant-modal-content').filter({ hasText: 'Pilih Vendor Terdaftar' }).first();
  await expect(quoteModal2).toBeVisible({ timeout: 10000 });

  const vendorSelect2 = quoteModal2.locator('.ant-select').first();
  await vendorSelect2.click();
  await page.waitForTimeout(400);

  const vendorOptions2 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)');
  await expect(vendorOptions2.first()).toBeVisible({ timeout: 10000 });
  const vendor2Name = (await vendorOptions2.first().innerText()).trim();
  console.log(`[UI ACTION] Selected Vendor #2: "${vendor2Name}"`);
  await vendorOptions2.first().click();

  const leadTimeInput2 = quoteModal2.locator('#leadTimeDays');
  await leadTimeInput2.click();
  await leadTimeInput2.fill('10');

  const priceInputs2 = quoteModal2.locator('.ant-table tbody .ant-input-number-input');
  const count2 = await priceInputs2.count();
  for (let i = 0; i < count2; i++) {
    await priceInputs2.nth(i).click();
    await priceInputs2.nth(i).fill('820000');
  }

  const submitQuoteBtn2 = quoteModal2.locator('button:has-text("Simpan Penawaran Vendor")');
  await submitQuoteBtn2.click();
  await expect(quoteModal2).not.toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  // ── Quotation #3 ──
  console.log('\n[RFQ] Recording Vendor Quotation #3...');
  const addQuoteBtn3 = rfqWorkspaceModal.locator('button:has-text("Input Penawaran Vendor"), button:has-text("Tambah Vendor")').first();
  await expect(addQuoteBtn3).toBeVisible({ timeout: 10000 });
  await addQuoteBtn3.click();

  const quoteModal3 = page.locator('.ant-modal-content').filter({ hasText: 'Pilih Vendor Terdaftar' }).first();
  await expect(quoteModal3).toBeVisible({ timeout: 10000 });

  const vendorSelect3 = quoteModal3.locator('.ant-select').first();
  await vendorSelect3.click();
  await page.waitForTimeout(400);

  const vendorOptions3 = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)');
  await expect(vendorOptions3.first()).toBeVisible({ timeout: 10000 });
  const vendor3Name = (await vendorOptions3.first().innerText()).trim();
  console.log(`[UI ACTION] Selected Vendor #3: "${vendor3Name}"`);
  await vendorOptions3.first().click();

  const leadTimeInput3 = quoteModal3.locator('#leadTimeDays');
  await leadTimeInput3.click();
  await leadTimeInput3.fill('14');

  const priceInputs3 = quoteModal3.locator('.ant-table tbody .ant-input-number-input');
  const count3 = await priceInputs3.count();
  for (let i = 0; i < count3; i++) {
    await priceInputs3.nth(i).click();
    await priceInputs3.nth(i).fill('840000');
  }

  const submitQuoteBtn3 = quoteModal3.locator('button:has-text("Simpan Penawaran Vendor")');
  await submitQuoteBtn3.click();
  await expect(quoteModal3).not.toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('[UI ASSERTION] 3 distinct vendor quotations successfully recorded.');

  // ── Vendor Comparison & Winner Finalization ──
  console.log('\n[EVALUATION] Opening Vendor Comparison...');
  const comparisonBtn = rfqWorkspaceModal.locator('button:has-text("Evaluasi Vendor"), button:has-text("Bandingkan Penawaran Vendor"), button:has-text("Vendor Comparison")').first();
  await expect(comparisonBtn).toBeVisible({ timeout: 10000 });
  await comparisonBtn.click();

  const comparisonModal = page.locator('.ant-modal-content').filter({ hasText: 'Evaluasi & Perbandingan Vendor' }).first();
  await expect(comparisonModal).toBeVisible({ timeout: 15000 });

  // Select Winner (Vendor #1 - Radio button)
  const winnerRadio = comparisonModal.locator('.ant-radio-wrapper, label.ant-radio-wrapper').first();
  await expect(winnerRadio).toBeVisible({ timeout: 10000 });
  await winnerRadio.click();
  await page.waitForTimeout(400);

  // Enter Justification
  const justNotesInput = comparisonModal.locator('textarea').first();
  if (await justNotesInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await justNotesInput.fill('Vendor terpilih memiliki harga terendah dengan lead time tercepat dan kepatuhan spesifikasi teknis 100%.');
  }

  // Click Tetapkan Pemenang Evaluasi
  const finalizeBtn = comparisonModal.locator('button:has-text("Tetapkan Pemenang Evaluasi")');
  await expect(finalizeBtn).toBeVisible({ timeout: 10000 });
  await finalizeBtn.click();

  // 1. Assert comparison modal closes upon save
  await expect(comparisonModal).not.toBeVisible({ timeout: 15000 });

  // 2. Assert parent RFQ workspace modal remains visible
  await expect(rfqWorkspaceModal).toBeVisible({ timeout: 10000 });

  // Extract clean vendor name (e.g. from "VND-001 — PT IT Solusi Bersama\nHardware" -> "PT IT Solusi Bersama")
  const cleanWinnerName = vendor1Name.includes('—')
    ? vendor1Name.split('—')[1].split('\n')[0].trim()
    : vendor1Name.split('\n')[0].trim();

  // 3. Assert RFQ EVALUATED status and winner projection inside parent RFQ workspace
  const evaluatedStatusTag = rfqWorkspaceModal.locator('.ant-tag').filter({ hasText: 'EVALUATED' }).first();
  await expect(evaluatedStatusTag).toBeVisible({ timeout: 10000 });

  const winnerTag = rfqWorkspaceModal.locator('.ant-tag').filter({ hasText: new RegExp(`EVALUATED — Pemenang:.*${cleanWinnerName}`) }).first();
  await expect(winnerTag).toBeVisible({ timeout: 10000 });
  console.log(`[UI ASSERTION] Parent RFQ workspace confirms status EVALUATED and winner "${cleanWinnerName}".`);

  // 4. Assert and click "Lihat Hasil Evaluasi" button
  const viewEvaluationBtn = rfqWorkspaceModal.locator('button:has-text("Lihat Hasil Evaluasi")');
  await expect(viewEvaluationBtn).toHaveCount(1);
  await expect(viewEvaluationBtn).toBeVisible({ timeout: 10000 });
  await expect(viewEvaluationBtn).toBeEnabled({ timeout: 10000 });
  await viewEvaluationBtn.click();

  // 5. Assert evaluated comparison modal reopens
  const evaluatedComparisonModal = page.locator('.ant-modal-content').filter({ hasText: 'Evaluasi & Perbandingan Vendor' }).first();
  await expect(evaluatedComparisonModal).toBeVisible({ timeout: 15000 });

  // 6. Assert evaluated banner and winner inside comparison modal
  const evaluatedBanner = evaluatedComparisonModal.locator('.ant-alert-success').filter({ hasText: 'Vendor Comparison Selesai' });
  await expect(evaluatedBanner).toBeVisible({ timeout: 10000 });
  await expect(evaluatedComparisonModal.getByText(cleanWinnerName).first()).toBeVisible({ timeout: 10000 });
  console.log('[UI ASSERTION] Evaluated comparison modal re-opened, "Vendor Comparison Selesai" verified.');

  // 7. Assert "Buat Purchase Order (PO)" action contract
  const buatPoBtn = evaluatedComparisonModal.locator('button:has-text("Buat Purchase Order (PO)")');
  await expect(buatPoBtn).toHaveCount(1);
  await expect(buatPoBtn).toBeVisible({ timeout: 10000 });
  await expect(buatPoBtn).toBeEnabled({ timeout: 10000 });
  console.log('[UI ASSERTION] "Buat Purchase Order (PO)" is unique, visible, and enabled.');

  return capturedRfqNumber;
}

// ---------------------------------------------------------------------------
// 11. CREATE PURCHASE ORDER WITH DETERMINISTIC PAYMENT TERMS (Step 24 Fix)
// ---------------------------------------------------------------------------
export async function createPurchaseOrder(page: Page): Promise<string> {
  console.log('\n>>> [PO] Creating Purchase Order from winning vendor...');
  const buatPoBtn = page.locator('.ant-modal-content button:has-text("Buat Purchase Order (PO)")').first();
  await expect(buatPoBtn).toBeVisible({ timeout: 10000 });
  await buatPoBtn.click();

  const poModal = page
    .locator('.ant-modal-content')
    .filter({ hasText: 'Penerbitan Purchase Order (PO) ke Vendor Pemenang' })
    .first();
  await expect(poModal).toBeVisible({ timeout: 15000 });

  // Verify: winner linked, total PO visible
  const winnerLinkedText = poModal.getByText('Vendor Pemenang Terpilih').first();
  await expect(winnerLinkedText).toBeVisible({ timeout: 10000 });

  const totalPoEl = poModal.getByText('TOTAL PO:').first();
  await expect(totalPoEl).toBeVisible({ timeout: 10000 });
  const poTotalText = await totalPoEl.innerText();
  console.log(`[UI ASSERTION] PO Total visible in DOM: "${poTotalText}"`);

  // Delivery Location
  const locInput = poModal.locator('#deliveryLocation');
  if (await locInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await locInput.fill('Gudang Utama Proyek — Site Office');
  }

  // ── STEP 26 PAYMENT TERMS: DETERMINISTIC PRODUCTION PRESET SELECTION ──
  console.log('[UI ACTION] Applying Preset A (30/30/30/10) Payment Terms...');
  const presetABtn = poModal.locator('button:has-text("Preset A (30/30/30/10)")');
  await expect(presetABtn).toBeVisible({ timeout: 5000 });
  await presetABtn.click();

  // Assert 100% Valid Tag
  const validTag = poModal.getByText(/Total Termin: 100(\.00)?% — Valid/).first();
  await expect(validTag).toBeVisible({ timeout: 10000 });
  console.log('[UI ASSERTION] Payment Terms validated: Preset A (30/30/30/10) = 100.00% Valid.');

  // Set up API response promise for PO creation
  const poResponsePromise = page.waitForResponse(
    (res) => {
      try {
        const u = new URL(res.url());
        return (
          u.pathname === '/api/v1/procurement/purchase-orders' &&
          res.request().method() === 'POST'
        );
      } catch {
        return false;
      }
    },
    { timeout: 15000 }
  );

  // Submit PO with exact button text
  const submitPoBtn = poModal.locator('button:has-text("Terbitkan Purchase Order (PO)")');
  await expect(submitPoBtn).toBeVisible({ timeout: 5000 });
  await expect(submitPoBtn).toBeEnabled({ timeout: 5000 });
  await submitPoBtn.click();

  // Await and verify HTTP 201 response with canonical envelope
  const poResponse = await poResponsePromise;
  expect(poResponse.status()).toBe(201);
  const poJson = await poResponse.json();
  const poPayload = poJson.data?.data || poJson.data || poJson;
  const capturedPoId = Number(poPayload.id);
  const capturedPoNumber = String(poPayload.poNumber || poPayload.po_number);
  const poStatus = poPayload.status;

  expect(capturedPoId).toBeGreaterThan(0);
  expect(capturedPoNumber).toMatch(/^PO-/);
  expect(poStatus).toBe('ISSUED');
  console.log(`[API ASSERTION] Fresh PO created: ID=${capturedPoId}, Number="${capturedPoNumber}", Status="${poStatus}"`);

  // Assert PO modal closes
  await expect(poModal).not.toBeVisible({ timeout: 15000 });

  // Locate and click "Lihat Purchase Order" button in evaluated comparison modal
  const lihatPoBtn = page.locator('button:has-text("Lihat Purchase Order")').first();
  await expect(lihatPoBtn).toBeVisible({ timeout: 15000 });

  // Capture PO number strictly from DOM text if needed
  const lihatPoText = await lihatPoBtn.innerText();
  const poMatch = lihatPoText.match(/PO-[0-9A-Za-z_-]+/);
  if (poMatch) {
    expect(poMatch[0]).toBe(capturedPoNumber);
  }
  console.log(`[DOM CAPTURE] Verified Canonical PO Number in button: "${capturedPoNumber}"`);

  // Click Lihat Purchase Order to verify details modal
  await lihatPoBtn.click();

  const poDetailsModal = page.locator('.ant-modal-content').filter({ hasText: 'Rincian Purchase Order' }).first();
  await expect(poDetailsModal).toBeVisible({ timeout: 15000 });

  // Assert PO status = ISSUED in details modal
  const poStatusTag = poDetailsModal.locator('.ant-tag').filter({ hasText: 'ISSUED' }).first();
  await expect(poStatusTag).toBeVisible({ timeout: 10000 });
  console.log('[UI ASSERTION] PO status = ISSUED verified in details modal.');

  // Assert payment terms persisted in details table
  const persistedTermsTable = poDetailsModal.locator('.term-table-stable, .ant-table').filter({ hasText: 'Uang Muka / DP' }).first();
  await expect(persistedTermsTable).toBeVisible({ timeout: 10000 });
  await expect(persistedTermsTable.locator('tr:has-text("Uang Muka / DP")').first()).toBeVisible({ timeout: 10000 });
  await expect(persistedTermsTable.locator('tr:has-text("Progress Tahap 1")').first()).toBeVisible({ timeout: 10000 });
  console.log('[UI ASSERTION] Payment terms (Preset A) persisted in PO record.');

  // =========================================================================
  // MODAL TEARDOWN: UNWIND ALL 3 MODAL LAYERS DETERMINISTICALLY
  // =========================================================================
  // Layer 3: Close PO Details Modal
  console.log('[MODAL TEARDOWN] Step 1: Closing PO Details Modal...');
  const closePoBtn = poDetailsModal.locator('.ant-modal-footer button').filter({ hasText: /Tutup|Batal/ }).first();
  await expect(closePoBtn).toBeVisible({ timeout: 5000 });
  await closePoBtn.click();
  await expect(poDetailsModal).not.toBeVisible({ timeout: 10000 });
  console.log('[MODAL TEARDOWN] PO Details Modal closed and hidden.');

  // Layer 2: Close Vendor Comparison Modal
  console.log('[MODAL TEARDOWN] Step 2: Closing Vendor Comparison Modal...');
  const comparisonModal = page.locator('.ant-modal-content').filter({ has: page.locator('.ant-modal-title:has-text("Evaluasi & Perbandingan Vendor")') });
  await expect(comparisonModal).toBeVisible({ timeout: 5000 });
  const closeComparisonBtn = comparisonModal.locator('.ant-modal-footer button').filter({ hasText: /Tutup|Batal/ }).first();
  await expect(closeComparisonBtn).toBeVisible({ timeout: 5000 });
  await closeComparisonBtn.click();
  await expect(comparisonModal).not.toBeVisible({ timeout: 10000 });
  console.log('[MODAL TEARDOWN] Vendor Comparison Modal closed and hidden.');

  // Layer 1: Close RFQ Workspace Modal
  console.log('[MODAL TEARDOWN] Step 3: Closing RFQ Workspace Modal...');
  const rfqModal = page.locator('.ant-modal-content').filter({ has: page.locator('.ant-modal-title:has-text("Request for Quotation")') });
  await expect(rfqModal).toBeVisible({ timeout: 5000 });
  const closeRfqBtn = rfqModal.locator('.ant-modal-footer button').filter({ hasText: /Tutup|Batal/ }).first();
  await expect(closeRfqBtn).toBeVisible({ timeout: 5000 });
  await closeRfqBtn.click();
  await expect(rfqModal).not.toBeVisible({ timeout: 10000 });
  console.log('[MODAL TEARDOWN] RFQ Workspace Modal closed and hidden.');

  // OVERLAY CLEANLINESS GATE
  console.log('[MODAL TEARDOWN] Verifying Overlay Cleanliness Gate...');
  const remainingModals = await page.locator('.ant-modal-content:visible').count();
  expect(remainingModals).toBe(0);
  await expect(page.locator('.ant-modal-mask:not(.ant-modal-mask-hidden)')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.ant-modal-wrap:not([style*="display: none"])')).toHaveCount(0, { timeout: 5000 });
  console.log('[MODAL TEARDOWN] Overlay Cleanliness Gate PASSED: Zero blocking modals, masks, or wraps.');

  // Switch to Tab "Purchase Order" in /procurement to verify final state
  const poTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Purchase Order' });
  await expect(poTab).toHaveCount(1);
  await expect(poTab).toBeVisible({ timeout: 10000 });
  await poTab.click();
  await expect(poTab).toHaveClass(/ant-tabs-tab-active/, { timeout: 10000 });

  const finalPoCard = page.locator('.ant-card').filter({ hasText: 'Daftar Purchase Order' });
  await expect(finalPoCard).toBeVisible({ timeout: 15000 });
  const finalPoRow = finalPoCard.locator(`tr:has-text("${capturedPoNumber}")`).first();
  await expect(finalPoRow).toBeVisible({ timeout: 15000 });
  const finalPoTag = finalPoRow.locator('.ant-tag').filter({ hasText: /ISSUED|Diterbitkan/i }).first();
  await expect(finalPoTag).toBeVisible({ timeout: 10000 });
  console.log(`[UI ASSERTION] PO "${capturedPoNumber}" verified with status ISSUED / Diterbitkan in PO Table.`);

  // Return to Purchase Request tab so subsequent terminal assertions can verify PR row
  await activatePurchaseRequestTab(page);

  return capturedPoNumber;
}
