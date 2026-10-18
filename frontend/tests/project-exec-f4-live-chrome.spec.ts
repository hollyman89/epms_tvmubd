import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaUi } from './canonical-lifecycle-helpers';

const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!E2E_PASSWORD) {
  throw new Error('Required test credential environment variable is not configured.');
}
const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:4000/api/v1';
const TEST_FILE_PATH = path.resolve(__dirname, '../test-assets/test-sample.pdf');

const MARKETING_EMAIL = 'ragil@epms.com';
const DIRECTOR_EMAIL = 'director@epms.com';
const LEGAL_EMAIL = 'legal@epms.com';
const PMO_EMAIL = 'pmo@epms.com';
const PM_EMAIL = 'pm@epms.com';
const HOO_EMAIL = 'hops@epms.com';
const PROCUREMENT_EMAIL = 'purchasing@epms.com';
const FINANCE_EMAIL = 'finance@epms.com';

const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/project-exec-f4');
const BRAIN_DIR = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\UBDOPS3',
  '.gemini/antigravity-ide/brain/57b84306-0ffc-4a30-9988-f78e601ba10a'
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
    console.warn(`[WARN] Could not copy evidence: ${err}`);
  }
  console.log(`[EVIDENCE CAPTURED] ${filename}`);
}

function extractData<T = any>(json: any): T {
  if (json && typeof json === 'object' && 'data' in json && json.data !== undefined) {
    if (json.data && typeof json.data === 'object' && 'data' in json.data && json.data.data !== undefined) {
      return json.data.data;
    }
    return json.data;
  }
  return json;
}

async function apiToken(request: any, email: string): Promise<{ token: string; userId: number }> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email, password: E2E_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const json = extractData<any>(await res.json());
  const token = json.accessToken || json.access_token || json.token;
  expect(token).toBeTruthy();
  const userId = Number(json.user?.id || json.user?.sub || 0);
  return { token, userId };
}

test.describe.serial('EPMS — PROJECT-EXEC-F2-F4: Procurement Material Sync Live Chrome Acceptance', () => {
  test.setTimeout(360000); // 6 minutes

  let testProjectId: number = 0;
  let testProjectCode: string = '';
  let testFixtureName: string = '';
  let testContractId: number = 0;
  let testWbsNodeId: number = 0;
  let managementReviewTaskId: number = 0;
  let managementReviewInstanceId: number = 0;

  test('STEP 1: Create Controlled Valid Fixture & Prove Material Itemization Rule', async ({
    request,
  }) => {
    testFixtureName = `F4-SYNC-${Date.now()}`;
    console.log(`\n>>> [FIXTURE] Creating fresh project fixture: ${testFixtureName}`);

    const mkt = await apiToken(request, MARKETING_EMAIL);
    const dir = await apiToken(request, DIRECTOR_EMAIL);
    const legal = await apiToken(request, LEGAL_EMAIL);
    const pmo = await apiToken(request, PMO_EMAIL);
    const pm = await apiToken(request, PM_EMAIL);

    // 1. Marketing tender
    const tRes = await request.post(`${BACKEND_URL}/marketing/tenders`, {
      headers: { Authorization: `Bearer ${mkt.token}` },
      data: {
        customerId: 8,
        projectName: testFixtureName,
        estimatedBudget: 350000000,
        expectedClosingDate: '2026-12-31',
        bidSubmissionDeadline: '2026-12-31',
        marketingPicId: mkt.userId,
      },
    });
    expect(tRes.status()).toBe(201);
    const tender = extractData<any>(await tRes.json());
    const tenderId = tender.id;

    // 2. Submit & approve Go/No-Go
    await request.post(`${BACKEND_URL}/marketing/tenders/${tenderId}/submit-go-no-go`, {
      headers: { Authorization: `Bearer ${mkt.token}` },
      data: {
        executiveSummary: 'F4 Procurement Material Sync Fixture',
        readiness: { customerRequirement: 'CLEAR', commercialInformation: 'READY', timeline: 'FEASIBLE' },
        marketingRecommendation: 'GO',
        marketingRecommendationReason: 'Automated acceptance test',
      },
    });

    await request.post(`${BACKEND_URL}/marketing/tenders/${tenderId}/go-no-go`, {
      headers: { Authorization: `Bearer ${dir.token}` },
      data: { decision: 'GO' },
    });

    // 3. Upload SPK & Legal approve
    const upRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tenderId}/upload-spk`, {
      headers: { Authorization: `Bearer ${mkt.token}` },
      multipart: {
        file: {
          name: 'test-sample.pdf',
          mimeType: 'application/pdf',
          buffer: fs.readFileSync(TEST_FILE_PATH),
        },
      },
    });
    expect(upRes.status()).toBe(201);
    const upJson = extractData<any>(await upRes.json());
    testContractId = Number(upJson.contractId || upJson.contract?.id || upJson.id);

    const legTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${legal.token}` },
    });
    const legTasks = extractData<any[]>(await legTasksRes.json()) || [];
    const legalTask = legTasks.find(
      (t: any) =>
        t.taskKey === 'LEGAL_REVIEW' &&
        Number(t.workflowInstance?.entityId) === Number(testContractId)
    );
    expect(legalTask).toBeDefined();
    await request.post(
      `${BACKEND_URL}/workflow/instances/${legalTask.workflowInstanceId}/tasks/${legalTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${legal.token}` },
        data: { action: 'APPROVE', reason: 'Approved for PM Assignment' },
      }
    );

    // 4. PMO assigns PM
    const pmoTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${pmo.token}` },
    });
    const pmoTasks = extractData<any[]>(await pmoTasksRes.json()) || [];
    const pmoTask = pmoTasks.find(
      (t: any) =>
        t.taskKey === 'PMO_ASSIGN_PM' &&
        Number(t.workflowInstance?.entityId) === Number(testContractId)
    );
    expect(pmoTask).toBeDefined();
    await request.post(
      `${BACKEND_URL}/workflow/instances/${pmoTask.workflowInstanceId}/tasks/${pmoTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${pmo.token}` },
        data: {
          action: 'ASSIGN_PM',
          contextUpdate: { project_manager_id: 2 },
        },
      }
    );

    // Resolve project ID
    const boardRes = await request.get(`${BACKEND_URL}/project/operational-board`, {
      headers: { Authorization: `Bearer ${pm.token}` },
    });
    const board = extractData<any>(await boardRes.json());
    const allBoardProjects = [
      ...(board?.pendingKickoff || []),
      ...(board?.activeProjects || []),
    ];
    const foundProject = allBoardProjects.find(
      (p: any) =>
        Number(p.contractId) === Number(testContractId) ||
        p.name === testFixtureName ||
        p.project_name === testFixtureName
    );
    expect(foundProject).toBeDefined();
    testProjectId = Number(foundProject.projectId || foundProject.id);
    testProjectCode = String(foundProject.project_code || foundProject.code);
    expect(testProjectId).toBeGreaterThan(0);
    console.log(`[FIXTURE] Project established: ID ${testProjectId} (${testProjectCode})`);

    // 5. Save WBS (100% weight)
    const wbsRes = await request.put(`${BACKEND_URL}/project/${testProjectId}/wbs-tree`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        nodes: [{ code: '1.0', name: 'Scope Deliverable Utama', level: 1, weightPercentage: 100 }],
      },
    });
    expect([200, 201]).toContain(wbsRes.status());
    const wbsJson = extractData<any>(await wbsRes.json());
    testWbsNodeId = Number(wbsJson?.[0]?.id || 1);

    // 6. NEGATIVE TEST: Material DIRECT is NOT procurement-ready
    console.log('[PROVING] Negative test: Setting MATERIAL to DIRECT mode...');
    const directCostRes = await request.put(`${BACKEND_URL}/project/${testProjectId}/cost-estimate`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        categories: [
          { categoryKey: 'MATERIAL', mode: 'DIRECT', directSubtotal: 20000000 },
        ],
        pmNotes: 'Direct material testing',
      },
    });
    expect([200, 201]).toContain(directCostRes.status());

    // Verify operational readiness rejects DIRECT Material
    const readinessDirect = await request.get(`${BACKEND_URL}/project/${testProjectId}/operational-readiness`, {
      headers: { Authorization: `Bearer ${pm.token}` },
    });
    const readyDirectJson = extractData<any>(await readinessDirect.json());
    expect(readyDirectJson.pillars?.cost?.status).toBe('IN_PROGRESS');
    expect(readyDirectJson.pillars?.cost?.message).toContain('Kategori Material & Consumables belum dirinci');
    console.log('[PASS] Material DIRECT correctly blocked from procurement readiness!');

    // 7. POSITIVE TEST: Material ITEMIZED is procurement-ready
    console.log('[PROVING] Positive test: Setting MATERIAL to ITEMIZED with realistic items...');
    const itemizedCostRes = await request.put(`${BACKEND_URL}/project/${testProjectId}/cost-estimate`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        categories: [
          {
            categoryKey: 'MATERIAL',
            mode: 'ITEMIZED',
            items: [
              {
                itemName: 'Kabel Power NYY 4x16mm',
                description: 'Kabel tembaga standar SPLN 4 inti',
                quantity: 100,
                uom: 'Meter',
                rateType: 'UNIT_RATE',
                unitPrice: 120000,
                subtotal: 12000000,
                assignmentScope: 'WBS',
                wbsId: testWbsNodeId,
              },
              {
                itemName: 'Pipa Conduit PVC 20mm',
                description: 'Pipa pelindung kabel tahan api',
                quantity: 150,
                uom: 'Batang',
                rateType: 'UNIT_RATE',
                unitPrice: 20000,
                subtotal: 3000000,
                assignmentScope: 'WBS',
                wbsId: testWbsNodeId,
              },
            ],
          },
          {
            categoryKey: 'LABOR',
            mode: 'DIRECT',
            directSubtotal: 10000000,
          },
        ],
        pmNotes: 'Itemized material requirement for procurement',
      },
    });
    expect([200, 201]).toContain(itemizedCostRes.status());

    // 8. Schedule & Initial Condition
    await request.put(`${BACKEND_URL}/project/${testProjectId}/schedule`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        tasks: [
          {
            wbsId: testWbsNodeId,
            name: 'Instalasi Jalur Kabel & Conduit',
            startDate: '2026-11-01',
            endDate: '2026-11-20',
            progress: 0,
          },
        ],
      },
    });

    await request.put(`${BACKEND_URL}/project/${testProjectId}/initial-condition`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        conditionStatus: 'NORMAL',
        locationCondition: 'Site clear and ready',
        initialConstraints: 'None',
        initialRisks: 'None',
      },
    });

    // Verify 4/4 Pillars are READY
    const readyCheck = await request.get(`${BACKEND_URL}/project/${testProjectId}/operational-readiness`, {
      headers: { Authorization: `Bearer ${pm.token}` },
    });
    const readyJson = extractData<any>(await readyCheck.json());
    expect(readyJson.pillars?.cost?.status).toBe('READY');
    expect(readyJson.overallStatus).toBe('READY');
    console.log('[PASS] Cost pillar is READY with 100% itemized material!');

    // 9. PM submits Management Review
    const subRes = await request.post(`${BACKEND_URL}/project/${testProjectId}/management-review/submit`, {
      headers: { Authorization: `Bearer ${pm.token}` },
    });
    expect([200, 201]).toContain(subRes.status());
    console.log('[PASS] Plan submitted to Management Review successfully.');
  });

  test('STEP 2: CHROME LIVE FLOW B — Reviewer Inspects Itemized Drill-down & Direct Mode Presentation', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [CHROME LIVE] Reviewer inspecting RAB drill-down in Google Chrome...');
    await loginViaUi(page, BASE_URL, HOO_EMAIL, E2E_PASSWORD);

    await page.goto(`${BASE_URL}/governance/tasks`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Locate the task in Governance Task Center table
    const reviewBtn = page.locator(`button:has-text("Tinjau")`).first();
    await expect(reviewBtn).toBeVisible({ timeout: 15000 });
    await reviewBtn.click();

    // Verify Governance Review Workspace Modal opens
    const modalTitle = page.locator('.ant-modal-title:has-text("Tugas Persetujuan Proyek")');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });

    // Select Estimasi Biaya (RAB) Tab
    const rabTab = page.locator('.ant-tabs-tab:has-text("Estimasi Biaya (RAB)")');
    await expect(rabTab).toBeVisible();
    await rabTab.click();
    await page.waitForTimeout(500);

    // Assert Material row displays "Itemized" and "2 item" (NOT "0 item")
    const itemizedBadge = page.locator('.ant-table-cell:has-text("Itemized")').first();
    await expect(itemizedBadge).toBeVisible();
    await expect(page.locator('.ant-table-cell:has-text("2 item")').first()).toBeVisible();

    // Assert Labor row displays "Lump Sum / Direct" (NOT "0 item")
    const directBadge = page.locator('.ant-tag:has-text("Lump Sum / Direct")').first();
    await expect(directBadge).toBeVisible();

    // Open item drill-down by clicking row expand icon
    const expandIcon = page.locator('.ant-table-row-expand-icon').first();
    await expect(expandIcon).toBeVisible();
    await expandIcon.click();
    await page.waitForTimeout(500);

    // Verify expanded items table contains authoritative CostItem fields
    await expect(page.locator('strong:has-text("Kabel Power NYY 4x16mm")')).toBeVisible();
    await expect(page.locator('strong:has-text("Pipa Conduit PVC 20mm")')).toBeVisible();
    await expect(page.locator('.ant-table-cell:has-text("100")').first()).toBeVisible();
    await expect(page.locator('.ant-table-cell:has-text("Meter")').first()).toBeVisible();
    await expect(page.locator('.ant-table-cell:has-text("Rp 120.000")').first()).toBeVisible();
    await expect(page.locator('.ant-table-cell:has-text("Rp 12.000.000")').first()).toBeVisible();

    // Verify strictly READ-ONLY: NO edit or save controls inside the RAB table
    await expect(page.locator('button:has-text("Simpan Draft RAB")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Tambah Item")')).not.toBeVisible();

    // Capture screenshot evidence
    await captureEvidence(page, 'f4_01_management_review_itemized_drilldown.png');
    console.log('[PASS] Management Review Itemized Drill-down and Direct Mode Presentation Verified!');

    // Close review modal
    const closeBtn = page.locator('.ant-modal-footer button:has-text("Tutup"), .ant-modal-close').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('STEP 3: Complete Management Review Chain & Formal Kickoff to IN_PROGRESS', async ({
    request,
  }) => {
    console.log('\n>>> [WORKFLOW PROGRESSION] Moving project through review chain & kickoff...');

    const hoo = await apiToken(request, HOO_EMAIL);
    const proc = await apiToken(request, PROCUREMENT_EMAIL);
    const fin = await apiToken(request, FINANCE_EMAIL);
    const dir = await apiToken(request, DIRECTOR_EMAIL);
    const pm = await apiToken(request, PM_EMAIL);

    // 1. HOO Approves
    const hooTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${hoo.token}` },
    });
    const hooTasks = extractData<any[]>(await hooTasksRes.json()) || [];
    const hooTask = hooTasks.find(
      (t: any) =>
        t.nodeId === 'node_hops_review' &&
        Number(t.workflowInstance?.entityId) === Number(testProjectId)
    );
    expect(hooTask).toBeDefined();
    await request.post(
      `${BACKEND_URL}/workflow/instances/${hooTask.workflowInstanceId}/tasks/${hooTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${hoo.token}` },
        data: { action: 'APPROVE', reason: 'HOO Approved itemized material plan' },
      }
    );

    // 2. Procurement Approves
    const procTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${proc.token}` },
    });
    const procTasks = extractData<any[]>(await procTasksRes.json()) || [];
    const procTask = procTasks.find(
      (t: any) =>
        t.nodeId === 'node_procurement_review' &&
        Number(t.workflowInstance?.entityId) === Number(testProjectId)
    );
    expect(procTask).toBeDefined();
    await request.post(
      `${BACKEND_URL}/workflow/instances/${procTask.workflowInstanceId}/tasks/${procTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${proc.token}` },
        data: { action: 'APPROVE', reason: 'Procurement verified material lines' },
      }
    );

    // 3. Finance Approves
    const finTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${fin.token}` },
    });
    const finTasks = extractData<any[]>(await finTasksRes.json()) || [];
    const finTask = finTasks.find(
      (t: any) =>
        t.nodeId === 'node_finance_review' &&
        Number(t.workflowInstance?.entityId) === Number(testProjectId)
    );
    expect(finTask).toBeDefined();
    await request.post(
      `${BACKEND_URL}/workflow/instances/${finTask.workflowInstanceId}/tasks/${finTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${fin.token}` },
        data: { action: 'APPROVE', reason: 'Finance budget approved' },
      }
    );

    // 4. Director Approves
    const dirTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${dir.token}` },
    });
    const dirTasks = extractData<any[]>(await dirTasksRes.json()) || [];
    const dirTask = dirTasks.find(
      (t: any) =>
        t.nodeId === 'node_director_approval' &&
        Number(t.workflowInstance?.entityId) === Number(testProjectId)
    );
    expect(dirTask).toBeDefined();
    await request.post(
      `${BACKEND_URL}/workflow/instances/${dirTask.workflowInstanceId}/tasks/${dirTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${dir.token}` },
        data: { action: 'APPROVE', reason: 'Director final approval' },
      }
    );

    // 5. Formal Kickoff by PM
    const koRes = await request.post(`${BACKEND_URL}/project/${testProjectId}/kickoff`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        actualKickoffDate: '2026-10-08',
      },
    });
    if (![200, 201].includes(koRes.status())) {
      console.error('[KICKOFF ERROR BODY]:', await koRes.text());
    }
    expect([200, 201]).toContain(koRes.status());
    console.log('[PASS] Project kicked off formally. Status is now IN_PROGRESS!');
  });

  test('STEP 4: CHROME LIVE FLOW D — Project Workspace Procurement Package Uses Authoritative CostItems', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [CHROME LIVE] PM creating Procurement Package from authoritative CostItems...');
    await loginViaUi(page, BASE_URL, PM_EMAIL, E2E_PASSWORD);

    // Switch to Tab 2: "Daftar Proyek Berjalan"
    const activeTab = page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")');
    await expect(activeTab).toBeVisible({ timeout: 15000 });
    await activeTab.click();
    await page.waitForTimeout(1000);

    // Locate active projects table and row
    await page.waitForSelector('[data-testid="active-projects-table"]', { timeout: 15000 });
    const row = page.locator(`tr:has-text("${testProjectCode}")`).first();
    await expect(row).toBeVisible({ timeout: 15000 });

    // Open "Aksi lainnya" dropdown and click "Paket Pengadaan"
    const moreRowBtn = row.locator('.ant-dropdown-trigger, button[title*="Aksi"]').last();
    await moreRowBtn.click();
    await page.waitForTimeout(500);

    const pkgMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Paket Pengadaan")').first();
    await expect(pkgMenuItem).toBeVisible();
    await pkgMenuItem.click();
    await page.waitForTimeout(1000);

    // Modal opens: click "Buat Paket Pengadaan Baru"
    const createPkgBtn = page.locator('button:has-text("Buat Paket Pengadaan Baru")');
    await expect(createPkgBtn).toBeVisible({ timeout: 15000 });
    await createPkgBtn.click();
    await page.waitForTimeout(1000);

    // Verify authoritative CostItems appear in selection table
    await expect(page.locator('.ant-table-cell:has-text("Kabel Power NYY 4x16mm")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.ant-table-cell:has-text("Pipa Conduit PVC 20mm")')).toBeVisible();

    // Fill package form
    await page.locator('input#title').fill('Paket Pengadaan Kabel & Conduit Substation');
    
    // Select the first material item checkbox
    const firstItemRow = page.locator('.ant-modal .ant-table-body tr.ant-table-row, .ant-modal .ant-table-tbody tr.ant-table-row').first();
    await expect(firstItemRow).toBeVisible({ timeout: 10000 });
    const rowCheckbox = firstItemRow.locator('.ant-checkbox-input');
    await rowCheckbox.check({ force: true });

    // Capture screenshot evidence of package modal
    await captureEvidence(page, 'f4_02_project_workspace_procurement_package.png');

    // Save draft
    const saveDraftBtn = page.locator('button:has-text("Simpan Draf")');
    await saveDraftBtn.click();
    await page.waitForTimeout(1500);
    console.log('[PASS] Package created successfully from authoritative CostItem!');

    // Close package modal
    const closeBtn = page.locator('.ant-modal-close').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('STEP 5: CHROME LIVE FLOW F & G — Project Detail Truth, No Fake Fallbacks & Project Isolation', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [CHROME LIVE] Inspecting Project Detail Drawer Procurement Truth...');
    const pmUser = await apiToken(request, PM_EMAIL);
    await loginViaUi(page, BASE_URL, PM_EMAIL, E2E_PASSWORD);

    // Switch to Tab 2: "Daftar Proyek Berjalan"
    const activeTab = page.locator('.ant-tabs-tab:has-text("Daftar Proyek Berjalan")');
    await expect(activeTab).toBeVisible({ timeout: 15000 });
    await activeTab.click();
    await page.waitForTimeout(1000);

    // Locate active projects table
    await page.waitForSelector('[data-testid="active-projects-table"]', { timeout: 15000 });

    // Click on our project in table to open ProjectDetailDrawer via Action menu "Detail Project"
    const projectRow = page.locator(`tr:has-text("${testProjectCode}")`).first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });
    
    const moreBtn = projectRow.locator('button[title*="Aksi"], .ant-dropdown-trigger').last();
    await moreBtn.click();
    await page.waitForTimeout(500);
    const detailItem = page.locator('.ant-dropdown-menu-item:has-text("Detail Project")').first();
    await expect(detailItem).toBeVisible({ timeout: 5000 });
    await detailItem.click();
    await page.waitForTimeout(1000);

    // Ensure drawer is open
    const drawerTitle = page.locator('.ant-drawer-title');
    await expect(drawerTitle).toBeVisible({ timeout: 10000 });

    // Select Tab "Material / Pengadaan"
    const procTab = page.locator('[data-tab-key="material"]');
    await expect(procTab).toBeVisible({ timeout: 5000 });
    await procTab.click();
    await page.waitForTimeout(1000);

    // Assert: Hardcoded "READY FOR RFQ" is REMOVED
    await expect(page.locator('.ant-tag:has-text("READY FOR RFQ")')).not.toBeVisible();

    // Assert: Fake fallback "PR-20260901-001" is REMOVED
    await expect(page.locator('text=PR-20260901-001')).not.toBeVisible();

    // Assert: Real summary exists with package count
    await expect(page.locator('text=Status Pengadaan Proyek (Procurement SSOT)')).toBeVisible();
    await expect(page.locator('text=1 Paket')).toBeVisible();

    // Capture screenshot evidence of Project Detail Procurement Truth
    await captureEvidence(page, 'f4_03_project_detail_procurement_ssot.png');
    console.log('[PASS] Project Detail Procurement SSOT verified without fake fallbacks!');

    // Close drawer and test Project Isolation with Empty State
    const drawerCloseBtn = page.locator('.ant-drawer-close').first();
    await drawerCloseBtn.click();
    await expect(page.locator('.ant-drawer-open')).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Find a real project in active list that has 0 procurement packages (Project B)
    const boardRes = await request.get(`${BACKEND_URL}/project/operational-board`, {
      headers: { Authorization: `Bearer ${pmUser.token}` },
    });
    const board = extractData<any>(await boardRes.json());
    const active = board?.activeProjects || [];
    let emptyProjectCode = '';
    for (const p of active) {
      const pid = Number(p.id || p.projectId);
      if (pid > 0 && pid !== testProjectId) {
        const sumRes = await request.get(`${BACKEND_URL}/project/${pid}/procurement-summary`, {
          headers: { Authorization: `Bearer ${pmUser.token}` },
        });
        const summary = extractData<any>(await sumRes.json());
        if (summary && Number(summary.packageCount || 0) === 0 && Number(summary.prCount || 0) === 0) {
          emptyProjectCode = String(p.project_code || p.code);
          break;
        }
      }
    }
    expect(emptyProjectCode).toBeTruthy();

    // Open project B in table to test Project Isolation & Truthful Empty State
    const otherRow = page.locator(`tr:has-text("${emptyProjectCode}")`).first();
    await otherRow.scrollIntoViewIfNeeded();
    const otherMoreBtn = otherRow.locator('button[title*="Aksi"], .ant-dropdown-trigger').last();
    await otherMoreBtn.click();
    await page.waitForTimeout(400);
    const otherDetailItem = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Detail Project")').first();
    await expect(otherDetailItem).toBeVisible({ timeout: 5000 });
    await otherDetailItem.click();
    await page.waitForTimeout(1000);

    // Click Tab "material"
    const procTabB = page.locator('[data-tab-key="material"]');
    await procTabB.click();
    await page.waitForTimeout(800);

    // Assert: Honest empty state rendered, no stale data from Project A!
    await expect(page.locator('text=Belum Ada Data Pengadaan')).toBeVisible();
    await expect(page.locator('text=Belum ada Paket Pengadaan atau Purchase Request resmi yang diterbitkan untuk proyek ini.')).toBeVisible();

    // Capture screenshot evidence of empty state and isolation
    await captureEvidence(page, 'f4_04_cross_project_isolation_empty_state.png');
    console.log('[PASS] Cross-Project Isolation & Truthful Empty State Verified!');

    // Responsive check at 1440, 1024, 390
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(300);
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);
    }
    await captureEvidence(page, 'f4_05_responsive_check.png');
    console.log('[PASS] Responsive check passed across 1440, 1024, and 390 viewports!');
  });
});
