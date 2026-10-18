import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi } from './canonical-lifecycle-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mysql = require('../../backend/node_modules/mysql2/promise');

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

async function getDbConnection() {
  return mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: Number(process.env.DATABASE_PORT) || 3306,
  });
}

test.describe.serial('PROJECT-CORE-R1-C1: Visible Chrome E2E Suite (C1-15)', () => {
  test.setTimeout(180000);

  const testProjectCode = `PRJ-R1C1-CTRL-${Date.now()}`;
  let testProjectId: number = 0;
  let testContractId: number = 0;
  let wbsRoot1Id: number = 0;
  let wbsLeaf1Id: number = 0;
  let wbsRoot2Id: number = 0;
  let wbsLeaf2Id: number = 0;
  let task1Id: number = 0;
  let task2Id: number = 0;

  test.beforeAll(async () => {
    const conn = await getDbConnection();
    try {
      // 1. Create a controlled approved contract assigned to PM 2 (pm@epms.com)
      const [contractResult] = await conn.execute(
        `INSERT INTO contracts (contract_number, customer_id, contract_value, start_date, end_date, status, legal_status, project_manager_id, version, created_at, updated_at)
         VALUES (?, 8, 150000000, '2026-11-01', '2026-12-31', 'ACTIVE', 'APPROVED', 2, 1, NOW(), NOW())`,
        [testProjectCode]
      );
      testContractId = (contractResult as any).insertId;

      // 2. Create controlled disposable project in PLANNING state assigned to PM 2
      const [projResult] = await conn.execute(
        `INSERT INTO projects (code, name, status, manager_id, contract_id, version, created_at, updated_at)
         VALUES (?, ?, 'PLANNING', 2, ?, 1, NOW(), NOW())`,
        [testProjectCode, `Controlled R1-C1 Live Chrome Project (${testProjectCode})`, testContractId]
      );
      testProjectId = (projResult as any).insertId;
      console.log(`[SETUP] Created controlled project ID: ${testProjectId} (${testProjectCode})`);

      // 3. Insert INITIAL INCOMPLETE WBS: Root 1.0 = 70%, Leaf 1.1 = 70% (Total Root = 70%, under 100%)
      const [r1Res] = await conn.execute(
        `INSERT INTO work_breakdown_structures (project_id, code, name, level, weight_percentage, parent_wbs_id, created_at, updated_at)
         VALUES (?, '1.0', 'Infrastruktur Data Center', 1, 70.00, NULL, NOW(), NOW())`,
        [testProjectId]
      );
      wbsRoot1Id = (r1Res as any).insertId;

      const [l1Res] = await conn.execute(
        `INSERT INTO work_breakdown_structures (project_id, code, name, level, weight_percentage, parent_wbs_id, created_at, updated_at)
         VALUES (?, '1.1', 'Pekerjaan Rak & Server', 2, 70.00, ?, NOW(), NOW())`,
        [testProjectId, wbsRoot1Id]
      );
      wbsLeaf1Id = (l1Res as any).insertId;

      // 4. Linked Schedule Task for 1.1
      const [t1Res] = await conn.execute(
        `INSERT INTO tasks (project_id, wbs_id, name, start_date, end_date, duration, is_milestone, progress, status, created_at, updated_at)
         VALUES (?, ?, 'Instalasi Server Utama', '2026-11-01', '2026-11-20', 19, 0, 0, 'PLANNED', NOW(), NOW())`,
        [testProjectId, wbsLeaf1Id]
      );
      task1Id = (t1Res as any).insertId;

      // 5. Cost Estimate and Initial Condition to satisfy the other pillars
      const [estRes] = await conn.execute(
        `INSERT INTO project_cost_estimates (project_id, status, version, created_by, updated_by, created_at, updated_at)
         VALUES (?, 'DRAFT', 1, 2, 2, NOW(), NOW())`,
        [testProjectId]
      );
      const estId = (estRes as any).insertId;

      await conn.execute(
        `INSERT INTO cost_items (estimate_id, category_key, entry_mode, item_name, quantity, uom, rate_type, unit_price, subtotal, cost_source, assignment_scope, created_by, updated_by, created_at, updated_at)
         VALUES (?, 'MATERIAL', 'ITEMIZED', 'Server Unit', 10, 'Unit', 'UNIT_RATE', 12000000, 120000000, 'PM_ESTIMATE', 'PROJECT', 2, 2, NOW(), NOW())`,
        [estId]
      );

      await conn.execute(
        `INSERT INTO project_initial_conditions (project_id, condition_status, location_condition, initial_constraints, initial_risks, created_by, updated_by, created_at, updated_at)
         VALUES (?, 'NORMAL', 'Lokasi siap instalasi', 'Daya listrik mencukupi', 'Risiko suhu pendingin aman', 2, 2, NOW(), NOW())`,
        [testProjectId]
      );

      // Create initial review record in NOT_SUBMITTED status
      await conn.execute(
        `INSERT INTO project_management_reviews (project_id, status, created_by, updated_by, created_at, updated_at)
         VALUES (?, 'NOT_SUBMITTED', 2, 2, NOW(), NOW())`,
        [testProjectId]
      );
    } finally {
      await conn.end();
    }
  });

  test.afterAll(async () => {
    if (testProjectId > 0) {
      const conn = await getDbConnection();
      try {
        await conn.execute(`DELETE FROM project_baseline_wbs_items WHERE baseline_id IN (SELECT id FROM project_baselines WHERE project_id = ?)`, [testProjectId]);
        await conn.execute(`DELETE FROM project_baselines WHERE project_id = ?`, [testProjectId]);
        await conn.execute(`DELETE FROM project_management_reviews WHERE project_id = ?`, [testProjectId]);
        await conn.execute(`DELETE FROM project_initial_conditions WHERE project_id = ?`, [testProjectId]);
        await conn.execute(`DELETE FROM cost_items WHERE estimate_id IN (SELECT id FROM project_cost_estimates WHERE project_id = ?)`, [testProjectId]);
        await conn.execute(`DELETE FROM project_cost_estimates WHERE project_id = ?`, [testProjectId]);
        await conn.execute(`DELETE FROM tasks WHERE project_id = ?`, [testProjectId]);
        await conn.execute(`DELETE FROM work_breakdown_structures WHERE project_id = ? AND parent_wbs_id IS NOT NULL`, [testProjectId]);
        await conn.execute(`DELETE FROM work_breakdown_structures WHERE project_id = ?`, [testProjectId]);
        await conn.execute(`DELETE FROM projects WHERE id = ?`, [testProjectId]);
        if (testContractId > 0) {
          await conn.execute(`DELETE FROM contracts WHERE id = ?`, [testContractId]);
        }
        console.log(`[CLEANUP] Deleted controlled test project ID: ${testProjectId} & contract ID: ${testContractId}`);
      } catch (err) {
        console.warn('[CLEANUP] Error during cleanup:', err);
      } finally {
        await conn.end();
      }
    }
  });

  let pmToken = '';
  async function getPmToken(request: any): Promise<string> {
    if (pmToken) return pmToken;
    const loginRes = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email: 'pm@epms.com', password: process.env.E2E_TEST_PASSWORD || '' },
    });
    const json = await loginRes.json();
    pmToken = json.data?.accessToken || json.accessToken;
    return pmToken;
  }

  // =========================================================================
  // SCENARIO A: INCOMPLETE DRAFT (Root = 70% < 100%)
  // Save Draft succeeds, warning visible, Submit remains blocked
  // =========================================================================
  test('Scenario A: Incomplete WBS (Root 70%) -> Save Draft succeeds, warning visible, Submit blocked', async ({ page, request }) => {
    console.log('\n=============================================================');
    console.log('[SCENARIO A START] Testing Incomplete Draft WBS (Root 70%)...');
    console.log('=============================================================');

    const token = await getPmToken(request);

    // 1. Authoritative Backend Readiness check
    const readinessRes = await request.get(`${BACKEND_URL}/project/${testProjectId}/operational-readiness`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(readinessRes.status()).toBe(200);
    const readinessJson = await readinessRes.json();
    const readinessData = readinessJson.data || readinessJson;
    const wbsData = readinessData.pillars?.wbs || readinessData.wbs;

    console.log('[SCENARIO A] WBS Status:', wbsData.status, 'Root Sum:', wbsData.rootWeightSum, 'Root Status:', wbsData.rootWeightStatus);

    // Assert: WBS is IN_PROGRESS (incomplete), not BLOCKED
    expect(wbsData.status).toBe('IN_PROGRESS');
    expect(wbsData.rootWeightStatus).toBe('INCOMPLETE');
    expect(wbsData.rootWeightSum).toBe(70);
    expect(readinessData.overallStatus).toBe('IN_PROGRESS');
    expect(readinessData.canSubmitForReview).toBe(false);

    // 2. Direct PM Management Review submission must be BLOCKED by backend hard gate
    const submitAttemptRes = await request.post(`${BACKEND_URL}/project/${testProjectId}/management-review/submit`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(submitAttemptRes.status()).toBe(400);
    const submitErrJson = await submitAttemptRes.json();
    console.log('[SCENARIO A] Submission rejection:', submitErrJson.message);
    expect(submitErrJson.message).toMatch(/Pengajuan review gagal.*4 Pilar Operasional.*wajib berstatus READY/i);

    // 3. Live Visible Google Chrome UI Interaction
    await loginViaUi(page, BASE_URL, 'pm@epms.com');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const projectRow = page.locator('tr', { hasText: testProjectCode }).first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });

    // Open Operational Plan modal
    const directPlanBtn = projectRow.locator('button', { hasText: 'Operational Plan' }).first();
    if (await directPlanBtn.isVisible().catch(() => false)) {
      await directPlanBtn.click();
    } else {
      const moreBtn = projectRow.locator('button.ant-dropdown-trigger').first();
      await moreBtn.click();
      await page.waitForTimeout(300);
      const menuPlanBtn = page.locator('.ant-dropdown-menu-item', { hasText: 'Operational Plan' }).first();
      await menuPlanBtn.click();
    }

    const planModal = page.locator('.ant-modal-content', { hasText: 'PM Operational Plan Workspace' }).first();
    await expect(planModal).toBeVisible({ timeout: 15000 });

    // Verify warning alert is visible in WBS section
    const wbsWarningAlert = planModal.locator('.ant-alert-warning', { hasText: 'Draf WBS Belum Lengkap (Incomplete)' }).first();
    await expect(wbsWarningAlert).toBeVisible({ timeout: 10000 });
    await expect(wbsWarningAlert).toContainText('70.00%');

    // Click "Simpan Draft" to verify Save Draft SUCCEEDS on incomplete WBS
    const saveAllDraftBtn = planModal.locator('button', { hasText: 'Simpan Draft' }).first();
    await expect(saveAllDraftBtn).toBeVisible({ timeout: 10000 });
    await saveAllDraftBtn.click();

    // Verify success toast appears: "Draft Operational Plan berhasil disimpan."
    const successMsg = page.locator('.ant-message-success', { hasText: 'Draft Operational Plan berhasil disimpan' }).first();
    await expect(successMsg).toBeVisible({ timeout: 10000 });

    // Verify Left panel shows INCOMPLETE (3/4 INCOMPLETE)
    const completenessTag = planModal.locator('text=3/4 INCOMPLETE').first();
    await expect(completenessTag).toBeVisible({ timeout: 10000 });

    // Verify "Ajukan untuk Management Review" button is strictly DISABLED
    const submitReviewBtn = planModal.locator('button', { hasText: 'Ajukan untuk Management Review' }).first();
    await expect(submitReviewBtn).toBeDisabled();

    // Close modal
    const closeBtn = planModal.locator('.ant-modal-close').first();
    await closeBtn.click();
    await expect(planModal).not.toBeVisible({ timeout: 10000 });

    console.log('[SCENARIO A PASS] Incomplete WBS saved draft successfully, displayed warning, and blocked submit.');
  });

  // =========================================================================
  // SCENARIO B: COMPLETE HIERARCHY (Root = 100%, Leaf = 100%)
  // Readiness PASS, Submit allowed, Advances through lifecycle
  // =========================================================================
  test('Scenario B: Complete WBS (Root 100%, Leaf 100%) -> Readiness PASS, Submit allowed', async ({ page, request }) => {
    console.log('\n=============================================================');
    console.log('[SCENARIO B START] Testing Complete Valid WBS & Review Submission...');
    console.log('=============================================================');

    const token = await getPmToken(request);

    // 1. Add remaining 30% WBS package (Root 2.0 = 30%, Leaf 2.1 = 30%) and link schedule task
    const conn = await getDbConnection();
    try {
      const [r2Res] = await conn.execute(
        `INSERT INTO work_breakdown_structures (project_id, code, name, level, weight_percentage, parent_wbs_id, created_at, updated_at)
         VALUES (?, '2.0', 'Sistem Pendingin & Kelistrikan', 1, 30.00, NULL, NOW(), NOW())`,
        [testProjectId]
      );
      wbsRoot2Id = (r2Res as any).insertId;

      const [l2Res] = await conn.execute(
        `INSERT INTO work_breakdown_structures (project_id, code, name, level, weight_percentage, parent_wbs_id, created_at, updated_at)
         VALUES (?, '2.1', 'Pekerjaan UPS & Chiller', 2, 30.00, ?, NOW(), NOW())`,
        [testProjectId, wbsRoot2Id]
      );
      wbsLeaf2Id = (l2Res as any).insertId;

      const [t2Res] = await conn.execute(
        `INSERT INTO tasks (project_id, wbs_id, name, start_date, end_date, duration, is_milestone, progress, status, created_at, updated_at)
         VALUES (?, ?, 'Instalasi UPS & Testing', '2026-11-15', '2026-12-10', 25, 0, 0, 'PLANNED', NOW(), NOW())`,
        [testProjectId, wbsLeaf2Id]
      );
      task2Id = (t2Res as any).insertId;
      console.log(`[SCENARIO B] Added remaining 30% WBS package 2.0/2.1 and linked schedule task`);
    } finally {
      await conn.end();
    }

    // 2. Authoritative Operational Readiness re-check
    const readinessRes = await request.get(`${BACKEND_URL}/project/${testProjectId}/operational-readiness`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(readinessRes.status()).toBe(200);
    const readinessJson = await readinessRes.json();
    const readinessData = readinessJson.data || readinessJson;
    const wbsData = readinessData.pillars?.wbs || readinessData.wbs;

    console.log('[SCENARIO B] WBS Status:', wbsData.status, 'Root Sum:', wbsData.rootWeightSum, 'Leaf Sum:', wbsData.leafWeightSum);

    expect(wbsData.status).toBe('READY');
    expect(wbsData.rootWeightValid).toBe(true);
    expect(wbsData.rootWeightSum).toBe(100);
    expect(wbsData.leafWeightValid).toBe(true);
    expect(wbsData.leafWeightSum).toBe(100);
    expect(wbsData.hierarchyWeightValid).toBe(true);
    expect(readinessData.completenessCount).toBe(4);
    expect(readinessData.overallStatus).toBe('READY');
    expect(readinessData.canSubmitForReview).toBe(true);

    // 3. Live Visible Google Chrome UI Validation
    await loginViaUi(page, BASE_URL, 'pm@epms.com');
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const projectRow = page.locator('tr', { hasText: testProjectCode }).first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });

    const directPlanBtn = projectRow.locator('button', { hasText: 'Operational Plan' }).first();
    if (await directPlanBtn.isVisible().catch(() => false)) {
      await directPlanBtn.click();
    } else {
      const moreBtn = projectRow.locator('button.ant-dropdown-trigger').first();
      await moreBtn.click();
      await page.waitForTimeout(300);
      const menuPlanBtn = page.locator('.ant-dropdown-menu-item', { hasText: 'Operational Plan' }).first();
      await menuPlanBtn.click();
    }

    const planModal = page.locator('.ant-modal-content', { hasText: 'PM Operational Plan Workspace' }).first();
    await expect(planModal).toBeVisible({ timeout: 15000 });

    // Verify 4/4 READY state in Left panel
    const readyTag = planModal.locator('text=4/4 READY').first();
    await expect(readyTag).toBeVisible({ timeout: 10000 });

    // Incomplete warning alert should NOT be visible
    const wbsWarningAlert = planModal.locator('.ant-alert-warning', { hasText: 'Draf WBS Belum Lengkap (Incomplete)' });
    await expect(wbsWarningAlert).not.toBeVisible();

    // Verify "Ajukan untuk Management Review" button is now ENABLED!
    const submitReviewBtn = planModal.locator('button', { hasText: 'Ajukan untuk Management Review' }).first();
    await expect(submitReviewBtn).toBeEnabled();

    // Click submit for management review
    await submitReviewBtn.click();

    // Confirmation modal with button "Konfirmasi & Ajukan ke Head of Operations"
    const confirmBtn = page.locator('.ant-modal').locator('button', { hasText: /Konfirmasi & Ajukan/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Success toast appears
    const successMsg = page.locator('.ant-message-success', { hasText: /berhasil diajukan untuk Management Review/i }).first();
    await expect(successMsg).toBeVisible({ timeout: 10000 });

    console.log('[SCENARIO B PASS] Complete WBS passed readiness 4/4 READY and submitted for Management Review successfully.');
  });

  // =========================================================================
  // SCENARIO C: OVERALLOCATED HIERARCHY (Root = 110% > 100%)
  // Clear validation error, blocked save, cannot proceed
  // =========================================================================
  test('Scenario C: Overallocated hierarchy (Root 110%) -> Clear validation error & save blocked', async ({ page, request }) => {
    console.log('\n=============================================================');
    console.log('[SCENARIO C START] Testing Overallocated WBS Hierarchy (Root 110%)...');
    console.log('=============================================================');

    // Create a fresh disposable project in PLANNING state for Scenario C isolation
    const conn = await getDbConnection();
    let projCId = 0;
    let contractCId = 0;
    const testCodeC = `PRJ-R1C1-CTRL-C-${Date.now()}`;
    try {
      const [cRes] = await conn.execute(
        `INSERT INTO contracts (contract_number, customer_id, contract_value, start_date, end_date, status, legal_status, project_manager_id, version, created_at, updated_at)
         VALUES (?, 8, 100000000, '2026-11-01', '2026-12-31', 'ACTIVE', 'APPROVED', 2, 1, NOW(), NOW())`,
        [testCodeC]
      );
      contractCId = (cRes as any).insertId;
      const [pRes] = await conn.execute(
        `INSERT INTO projects (code, name, status, manager_id, contract_id, version, created_at, updated_at)
         VALUES (?, ?, 'PLANNING', 2, ?, 1, NOW(), NOW())`,
        [testCodeC, `Controlled Project C (${testCodeC})`, contractCId]
      );
      projCId = (pRes as any).insertId;

      await conn.execute(
        `INSERT INTO project_management_reviews (project_id, status, created_by, updated_by, created_at, updated_at)
         VALUES (?, 'NOT_SUBMITTED', 2, 2, NOW(), NOW())`,
        [projCId]
      );
    } finally {
      await conn.end();
    }

    try {
      const token = await getPmToken(request);

      // 1. Direct API call to save over-allocated WBS (Root 110%) must be REJECTED with 400
      const overPayload = {
        nodes: [
          { code: '1.0', name: 'Scope 1', level: 1, weightPercentage: 70.0 },
          { code: '2.0', name: 'Scope 2 Over', level: 1, weightPercentage: 40.0 },
        ],
      };
      const overSaveRes = await request.put(`${BACKEND_URL}/project/${projCId}/wbs-tree`, {
        headers: { Authorization: `Bearer ${token}` },
        data: overPayload,
      });
      expect(overSaveRes.status()).toBe(400);
      const overErrJson = await overSaveRes.json();
      console.log('[SCENARIO C] Over-allocation save rejection:', overErrJson.message);
      expect(overErrJson.message).toMatch(/WBS_OVER_ALLOCATED|melebihi 100/i);

      // 2. Direct API call to save child > parent over-allocation must be REJECTED with 400
      const childOverPayload = {
        nodes: [
          {
            code: '1.0',
            name: 'Parent 30%',
            level: 1,
            weightPercentage: 30.0,
            children: [
              { code: '1.1', name: 'Child A', level: 2, weightPercentage: 20.0 },
              { code: '1.2', name: 'Child B Over', level: 2, weightPercentage: 15.0 },
            ],
          },
          { code: '2.0', name: 'Other', level: 1, weightPercentage: 70.0 },
        ],
      };
      const childOverRes = await request.put(`${BACKEND_URL}/project/${projCId}/wbs-tree`, {
        headers: { Authorization: `Bearer ${token}` },
        data: childOverPayload,
      });
      expect(childOverRes.status()).toBe(400);
      const childOverErr = await childOverRes.json();
      console.log('[SCENARIO C] Child over-allocation save rejection:', childOverErr.message);
      expect(childOverErr.message).toMatch(/Over-allocation|melebihi bobot parent/i);

      // 3. Review submission must also fail with clear validation
      const reviewSubmitRes = await request.post(`${BACKEND_URL}/project/${projCId}/management-review/submit`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { notes: 'Attempt submit overallocated' },
      });
      expect(reviewSubmitRes.status()).toBe(400);
      const submitErr = await reviewSubmitRes.json();
      console.log('[SCENARIO C] Review submit blocked as expected:', submitErr.message);

      console.log('[SCENARIO C PASS] Over-allocated WBS correctly blocked from save and hard gates.');
    } finally {
      if (projCId > 0) {
        const cleanConn = await getDbConnection();
        try {
          await cleanConn.execute(`DELETE FROM project_management_reviews WHERE project_id = ?`, [projCId]);
          await cleanConn.execute(`DELETE FROM work_breakdown_structures WHERE project_id = ?`, [projCId]);
          await cleanConn.execute(`DELETE FROM projects WHERE id = ?`, [projCId]);
          await cleanConn.execute(`DELETE FROM contracts WHERE id = ?`, [contractCId]);
          console.log(`[CLEANUP] Deleted Scenario C disposable project ID: ${projCId}`);
        } finally {
          await cleanConn.end();
        }
      }
    }
  });
});
