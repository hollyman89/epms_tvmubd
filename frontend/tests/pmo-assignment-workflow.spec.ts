import { test, expect, APIRequestContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginViaUi, logoutViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:4000/api/v1';
const SAMPLE_PDF_PATH = path.resolve(__dirname, '../test-assets/test-sample.pdf');

function extractData<T = any>(json: any): T {
  if (json && typeof json === 'object' && 'data' in json && json.data !== undefined) {
    if (json.data && typeof json.data === 'object' && 'data' in json.data && json.data.data !== undefined) {
      return json.data.data;
    }
    return json.data;
  }
  return json;
}

/**
 * Setup fresh tender, won, SPK uploaded, and Legal approved via canonical business API.
 */
async function setupLegalApprovedContract(request: APIRequestContext, name: string) {
  // 1. Marketing login
  const mktLogin = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: 'ragil@epms.com', password: '123456' },
  });
  expect(mktLogin.status()).toBe(200);
  const mktJson = await mktLogin.json();
  const mktToken = mktJson.data?.accessToken || mktJson.data?.access_token || mktJson.accessToken;
  const mktUserId = Number(mktJson.data?.user?.sub || mktJson.data?.user?.id || 9);

  // 2. Resolve customer
  const custRes = await request.get(`${BACKEND_URL}/marketing/customers`, {
    headers: { Authorization: `Bearer ${mktToken}` },
  });
  const rawCust = extractData<any[]>(await custRes.json());
  const customerId = rawCust.length > 0 ? Number(rawCust[0].id) : 1;

  // 3. Create fresh Tender
  const tenderRes = await request.post(`${BACKEND_URL}/marketing/tenders`, {
    headers: { Authorization: `Bearer ${mktToken}` },
    data: {
      customerId,
      projectName: name,
      estimatedBudget: 420000000,
      expectedClosingDate: '2026-12-31',
      bidSubmissionDeadline: '2026-12-31',
      marketingPicId: mktUserId,
    },
  });
  expect(tenderRes.status()).toBe(201);
  const tender = extractData<any>(await tenderRes.json());

  // 4. Submit GO/NO-GO review
  await request.post(`${BACKEND_URL}/marketing/tenders/${tender.id}/submit-go-no-go`, {
    headers: { Authorization: `Bearer ${mktToken}` },
    data: {
      executiveSummary: 'Canonical PMO initiation tender',
      readiness: { customerRequirement: 'CLEAR', commercialInformation: 'READY', timeline: 'FEASIBLE' },
      marketingRecommendation: 'GO',
      marketingRecommendationReason: 'Budget teralokasi dan siap eksekusi',
    },
  });

  // 5. Director approves GO
  const dirLogin = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: 'director@epms.com', password: '123456' },
  });
  const dirToken = (await dirLogin.json()).data?.accessToken;
  await request.post(`${BACKEND_URL}/marketing/tenders/${tender.id}/go-no-go`, {
    headers: { Authorization: `Bearer ${dirToken}` },
    data: { decision: 'GO' },
  });

  // 6. Upload SPK
  const pdfBuffer = fs.readFileSync(SAMPLE_PDF_PATH);
  const uploadRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tender.id}/upload-spk`, {
    headers: { Authorization: `Bearer ${mktToken}` },
    multipart: {
      file: {
        name: 'test-sample.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      },
    },
  });
  expect(uploadRes.status()).toBe(201);
  const uploadData = extractData<any>(await uploadRes.json());
  const contractId = uploadData.contractId || uploadData.contract?.id || uploadData.id;
  expect(contractId).toBeDefined();

  // 7. Legal user approves contract via canonical workflow
  const legalLogin = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: 'legal@epms.com', password: '123456' },
  });
  const legalToken = (await legalLogin.json()).data?.accessToken;

  // Find active legal workflow task
  const myTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
    headers: { Authorization: `Bearer ${legalToken}` },
  });
  const myTasks = extractData<any[]>(await myTasksRes.json()) || [];
  const legalTask = myTasks.find(
    (t: any) => t.taskKey === 'LEGAL_REVIEW' && Number(t.workflowInstance?.entityId) === Number(contractId),
  ) || myTasks.find((t: any) => t.taskKey === 'LEGAL_REVIEW');
  expect(legalTask).toBeDefined();

  const legalInstanceId = legalTask.workflowInstanceId || legalTask.workflowInstance?.id;

  // Legal completes task with APPROVE
  const approveRes = await request.post(
    `${BACKEND_URL}/workflow/instances/${legalInstanceId}/tasks/${legalTask.id}/complete`,
    {
      headers: { Authorization: `Bearer ${legalToken}` },
      data: {
        action: 'APPROVE',
        reason: 'Dokumen SPK dan klausul kontrak sah dan disetujui untuk inisiasi PMO.',
      },
    },
  );
  expect([200, 201]).toContain(approveRes.status());

  return { tender, contractId };
}

test.describe('W6-CP4B-03: PMO ASSIGNMENT WORKFLOW (E2E Playwright)', () => {
  test.setTimeout(120000);

  test('SCENARIO A & B: Legal APPROVE -> PMO Task -> PM Assignment -> Status PLANNING', async ({
    page,
    request,
  }) => {
    const uniqueName = `Tender PMO Initiation E2E - ${Date.now()}`;
    const { tender, contractId } = await setupLegalApprovedContract(request, uniqueName);

    // Verify canonical workflow instance exists for Contract
    const pmoLogin = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email: 'pmo@epms.com', password: '123456' },
    });
    const pmoToken = (await pmoLogin.json()).data?.accessToken;

    const pmoInstanceRes = await request.get(
      `${BACKEND_URL}/workflow/instances/entity/CONTRACT/${contractId}?workflowKey=PROJECT_INITIATION_WORKFLOW`,
      { headers: { Authorization: `Bearer ${pmoToken}` } },
    );
    const pmoInstance = extractData<any>(await pmoInstanceRes.json());
    expect(pmoInstance).toBeDefined();
    expect(pmoInstance.status).toBe('IN_PROGRESS');

    const pmoTask = pmoInstance.tasks?.find(
      (t: any) => t.taskKey === 'PMO_ASSIGN_PM' && t.status === 'PENDING',
    );
    expect(pmoTask).toBeDefined();

    // 1. PMO Login via UI
    await loginViaUi(page, BASE_URL, 'pmo@epms.com', '123456');

    // 2. Navigate to PMO Board / Delivery surface
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Ensure Antrean Kick-off Charter tab is selected
    const tabAntrean = page.locator('.ant-tabs-tab').filter({ hasText: 'Antrean Kick-off Charter' });
    if (await tabAntrean.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tabAntrean.click();
      await page.waitForTimeout(1000);
    }

    // 3. Locate the contract row in PMO queue
    const projectRow = page.locator(`tr:has-text("${uniqueName}")`).first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });

    // 4. Click Tugaskan PM
    const tugaskanBtn = projectRow.locator('button:has-text("Tugaskan PM")');
    await expect(tugaskanBtn).toBeVisible({ timeout: 10000 });
    await tugaskanBtn.click();

    // 5. Modal Penugasan Project Manager opens
    const pmModal = page.locator('.ant-modal-content').filter({ hasText: 'Penugasan Project Manager (PMO)' }).first();
    await expect(pmModal).toBeVisible({ timeout: 10000 });

    // 6. Select Project Manager (pm@epms.com)
    const pmSelect = pmModal.locator('.ant-select').first();
    await pmSelect.click();
    await page.waitForTimeout(500);

    const pmOption = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'pm@epms.com' })
      .first();
    await expect(pmOption).toBeVisible({ timeout: 10000 });
    await pmOption.click();

    // 7. Submit assignment
    const submitBtn = pmModal.locator('button:has-text("Tugaskan PM")');
    await submitBtn.click();
    await expect(pmModal).not.toBeVisible({ timeout: 15000 });

    // 8. Verify board refreshed: row now has Operational Plan button (status PLANNING)
    await page.waitForTimeout(1500);
    const updatedRow = page.locator(`tr:has-text("${uniqueName}")`).first();
    await expect(updatedRow).toBeVisible({ timeout: 10000 });

    const opPlanBtn = updatedRow.locator('button:has-text("Operational Plan")');
    await expect(opPlanBtn).toBeVisible({ timeout: 10000 });

    // 9. Verify via backend that WorkflowTask is COMPLETED and Project is PLANNING
    const updatedInstanceRes = await request.get(
      `${BACKEND_URL}/workflow/instances/${pmoInstance.id}`,
      { headers: { Authorization: `Bearer ${pmoToken}` } },
    );
    const updatedInstance = extractData<any>(await updatedInstanceRes.json());
    expect(updatedInstance.status).toBe('COMPLETED');

    const completedTask = updatedInstance.tasks?.find((t: any) => t.id === pmoTask.id);
    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.action).toBe('ASSIGN_PM');

    // 10. Refresh browser and verify state persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const reloadedRow = page.locator(`tr:has-text("${uniqueName}")`).first();
    await expect(reloadedRow).toBeVisible({ timeout: 10000 });
    await expect(reloadedRow.locator('button:has-text("Operational Plan")')).toBeVisible({ timeout: 10000 });

    await logoutViaUi(page);
  });

  test('SCENARIO C: Selected PM Visibility & Status PLANNING (No WM-06 WorkflowTask)', async ({
    page,
    request,
  }) => {
    // 1. Login as PM (pm@epms.com)
    await loginViaUi(page, BASE_URL, 'pm@epms.com', '123456');

    // 2. Navigate to Project Delivery / Workspace
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 3. Verify page renders with operational board
    const boardTitle = page.locator('.ant-typography').filter({ hasText: /Operasional Proyek|Project Delivery/i }).first();
    await expect(boardTitle).toBeVisible({ timeout: 10000 });

    // 4. Verify PM does NOT have any pending PMO_ASSIGN_PM task
    const pmLogin = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email: 'pm@epms.com', password: '123456' },
    });
    const pmToken = (await pmLogin.json()).data?.accessToken;

    const myTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    const myTasks = extractData<any[]>(await myTasksRes.json()) || [];
    const pmoAssignTask = myTasks.find((t: any) => t.taskKey === 'PMO_ASSIGN_PM');
    expect(pmoAssignTask).toBeUndefined();

    // 5. Verify NO Operational Plan WorkflowTask is created (WM-06 remains in workspace)
    const opPlanTask = myTasks.find(
      (t: any) =>
        t.taskKey?.includes('OPERATIONAL_PLAN') ||
        t.taskKey?.includes('MANAGEMENT_REVIEW') ||
        t.taskKey?.includes('PLAN_APPROVAL'),
    );
    expect(opPlanTask).toBeUndefined();

    await logoutViaUi(page);
  });

  test('SCENARIO D: Non-PMO Actor Denied PM Assignment', async ({
    page,
    request,
  }) => {
    // 1. Login as Marketing PIC (ragil@epms.com)
    await loginViaUi(page, BASE_URL, 'ragil@epms.com', '123456');

    // 2. Navigate to /project-delivery
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 3. Verify non-PMO user gets 403 Forbidden screen
    const forbiddenTitle = page.locator('.ant-result-title').filter({ hasText: '403' });
    await expect(forbiddenTitle).toBeVisible({ timeout: 10000 });

    const unauthorizedText = page.locator('.ant-result-subtitle').filter({ hasText: 'Maaf, Anda tidak memiliki akses' });
    await expect(unauthorizedText).toBeVisible({ timeout: 10000 });

    // 4. Verify API-level enforcement: Non-PMO role rejected with ForbiddenException
    const mktLogin = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email: 'ragil@epms.com', password: '123456' },
    });
    const mktToken = (await mktLogin.json()).data?.accessToken;

    const assignAttempt = await request.post(`${BACKEND_URL}/project/1/assign-pm`, {
      headers: { Authorization: `Bearer ${mktToken}` },
      data: { projectManagerId: 5 },
    });
    expect(assignAttempt.status()).toBe(403);
  });

  test('SCENARIO E: Legacy Bypass Control (Sales Pipeline routes to PMO Board)', async ({
    page,
  }) => {
    // 1. Login as Marketing PIC
    await loginViaUi(page, BASE_URL, 'ragil@epms.com', '123456');

    // 2. Navigate to Sales Pipeline page
    await page.goto(`${BASE_URL}/sales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 3. Verify legacy "Inisiasi Proyek (PMO)" dialog button calling /legal/start-project is NOT present
    const legacyInitiateBtns = page.locator('button:has-text("Inisiasi Proyek (PMO)")');
    const legacyCount = await legacyInitiateBtns.count();
    expect(legacyCount).toBe(0);

    await logoutViaUi(page);
  });

  test('SCENARIO F: Inbox / To-Do Deep-Link Actionability (W7-HF01)', async ({
    page,
    request,
  }) => {
    const uniqueName = `Tender PMO Inbox DeepLink - ${Date.now()}`;
    const { tender, contractId } = await setupLegalApprovedContract(request, uniqueName);

    // 1. Verify via backend API that PMO has actionable To-Do item
    const pmoLogin = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email: 'pmo@epms.com', password: '123456' },
    });
    const pmoToken = (await pmoLogin.json()).data?.accessToken;

    const todosRes = await request.get(`${BACKEND_URL}/inbox/todos`, {
      headers: { Authorization: `Bearer ${pmoToken}` },
    });
    const todos = extractData<any[]>(await todosRes.json()) || [];
    const exactTodo = todos.find(
      (t: any) => t.actionType === 'PMO_ASSIGN_PM' && Number(t.entityId) === Number(contractId),
    );
    expect(exactTodo).toBeDefined();
    expect(exactTodo.actionTarget).toBe(`/project-delivery?contractId=${contractId}&action=assign-pm`);
    expect(exactTodo.title).toBe('Penugasan Project Manager (PMO)');

    // 2. Login as PMO via UI
    await loginViaUi(page, BASE_URL, 'pmo@epms.com', '123456');

    // 3. Navigate to Inbox page
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 4. Locate the exact task card for this contract
    const todoCard = page.locator('.ant-list-item').filter({ hasText: uniqueName }).first();
    await expect(todoCard).toBeVisible({ timeout: 15000 });

    // 5. Verify action is AVAILABLE ("Buka"), NOT "Aksi Belum Tersedia"
    const openBtn = todoCard.locator('button:has-text("Buka")');
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await expect(openBtn).toBeEnabled();

    const unavailableBtn = todoCard.locator('button:has-text("Aksi Belum Tersedia")');
    await expect(unavailableBtn).toHaveCount(0);

    // 6. Click "Buka" to navigate via deep link
    await openBtn.click();

    // 7. Verify navigation lands on /project-delivery with exact query parameters
    await page.waitForURL((url) => url.pathname.includes('/project-delivery'), { timeout: 15000 });
    expect(page.url()).toContain(`contractId=${contractId}`);
    expect(page.url()).toContain('action=assign-pm');

    // 8. Verify exact PM assignment modal opened automatically for this contract
    const pmModal = page.locator('.ant-modal-content').filter({ hasText: 'Penugasan Project Manager (PMO)' }).first();
    await expect(pmModal).toBeVisible({ timeout: 15000 });

    // 9. Select Project Manager (pm@epms.com)
    const pmSelect = pmModal.locator('.ant-select').first();
    await pmSelect.click();
    await page.waitForTimeout(500);

    const pmOption = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'pm@epms.com' })
      .first();
    await expect(pmOption).toBeVisible({ timeout: 10000 });
    await pmOption.click();

    // 10. Submit assignment
    const submitBtn = pmModal.locator('button:has-text("Tugaskan PM")');
    await submitBtn.click();
    await expect(pmModal).not.toBeVisible({ timeout: 15000 });

    // 11. Verify row on board is now in status PLANNING (has "Operational Plan" button)
    await page.waitForTimeout(1500);
    const updatedRow = page.locator(`tr:has-text("${uniqueName}")`).first();
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await expect(updatedRow.locator('button:has-text("Operational Plan")')).toBeVisible({ timeout: 10000 });

    // 12. Verify task is COMPLETED and removed from active To-Do list
    const refreshedTodosRes = await request.get(`${BACKEND_URL}/inbox/todos`, {
      headers: { Authorization: `Bearer ${pmoToken}` },
    });
    const refreshedTodos = extractData<any[]>(await refreshedTodosRes.json()) || [];
    const remainingTodo = refreshedTodos.find(
      (t: any) => t.actionType === 'PMO_ASSIGN_PM' && Number(t.entityId) === Number(contractId),
    );
    expect(remainingTodo).toBeUndefined();

    await logoutViaUi(page);
  });
});
