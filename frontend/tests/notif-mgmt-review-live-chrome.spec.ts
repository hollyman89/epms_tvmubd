import { test, expect, Page } from '@playwright/test';
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

const E2E_PASSWORD: string = process.env.E2E_TEST_PASSWORD as string;
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

const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence/notif-mgmt-review-f1');
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
    console.warn(`[WARN] Could not copy evidence to brain dir: ${err}`);
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

async function getUnreadCount(request: any, token: string): Promise<number> {
  const res = await request.get(`${BACKEND_URL}/notifications/count/unread`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  return Number(json.data?.data?.count ?? json.data?.count ?? 0);
}

test.describe.serial('EPMS — NOTIF-MGMT-REVIEW-F1: Visible Google Chrome Acceptance', () => {
  test.setTimeout(300000); // 5 minutes

  let testProjectId: number = 0;
  let testProjectCode: string = '';
  let testFixtureName: string = '';
  let testContractId: number = 0;
  let testWbsNodeId: number = 0;

  let initialHooUnread: number = 0;
  let initialProcUnread: number = 0;
  let hooTaskId: number = 0;
  let procTaskId: number = 0;

  test('STEP 1: Create Controlled Valid Project Fixture via Official APIs (4/4 Pillars READY)', async ({
    request,
  }) => {
    testFixtureName = `NOTIF-MGMT-REV-${Date.now()}`;
    console.log(`\n>>> [FIXTURE] Creating fresh valid fixture: ${testFixtureName}`);

    const mkt = await apiToken(request, MARKETING_EMAIL);
    const dir = await apiToken(request, DIRECTOR_EMAIL);
    const legal = await apiToken(request, LEGAL_EMAIL);
    const pmo = await apiToken(request, PMO_EMAIL);
    const pm = await apiToken(request, PM_EMAIL);
    const hoo = await apiToken(request, HOO_EMAIL);
    const proc = await apiToken(request, PROCUREMENT_EMAIL);

    // Record baseline unread counts before any workflow transitions
    initialHooUnread = await getUnreadCount(request, hoo.token);
    initialProcUnread = await getUnreadCount(request, proc.token);
    console.log(`[BASELINE] HOO Initial Unread Count: ${initialHooUnread}`);
    console.log(`[BASELINE] Procurement Initial Unread Count: ${initialProcUnread}`);

    // 1. Marketing creates tender
    const tRes = await request.post(`${BACKEND_URL}/marketing/tenders`, {
      headers: { Authorization: `Bearer ${mkt.token}` },
      data: {
        customerId: 8,
        projectName: testFixtureName,
        estimatedBudget: 450000000,
        expectedClosingDate: '2026-12-31',
        bidSubmissionDeadline: '2026-12-31',
        marketingPicId: mkt.userId,
      },
    });
    expect(tRes.status()).toBe(201);
    const tender = extractData<any>(await tRes.json());
    const tenderId = tender.id;

    // 2. Submit Go/No-Go
    const gRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tenderId}/submit-go-no-go`, {
      headers: { Authorization: `Bearer ${mkt.token}` },
      data: {
        executiveSummary: 'Management Review Notification Acceptance Fixture',
        readiness: { customerRequirement: 'CLEAR', commercialInformation: 'READY', timeline: 'FEASIBLE' },
        marketingRecommendation: 'GO',
        marketingRecommendationReason: 'Automated acceptance test',
      },
    });
    expect([200, 201]).toContain(gRes.status());

    // 3. Director GO
    const goRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tenderId}/go-no-go`, {
      headers: { Authorization: `Bearer ${dir.token}` },
      data: { decision: 'GO' },
    });
    expect([200, 201]).toContain(goRes.status());

    // 4. Upload SPK
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
    expect(testContractId).toBeGreaterThan(0);

    // 5. Legal APPROVE via Workflow Task
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
    const legalInstanceId = legalTask.workflowInstanceId || legalTask.workflowInstance?.id;
    const legRes = await request.post(
      `${BACKEND_URL}/workflow/instances/${legalInstanceId}/tasks/${legalTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${legal.token}` },
        data: { action: 'APPROVE', reason: 'Approved SPK for PM assignment' },
      }
    );
    expect([200, 201]).toContain(legRes.status());

    // 6. PMO assigns PM via Workflow Task
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
    const pmoInstanceId = pmoTask.workflowInstanceId || pmoTask.workflowInstance?.id;
    const assignRes = await request.post(
      `${BACKEND_URL}/workflow/instances/${pmoInstanceId}/tasks/${pmoTask.id}/complete`,
      {
        headers: { Authorization: `Bearer ${pmo.token}` },
        data: {
          action: 'ASSIGN_PM',
          contextUpdate: { project_manager_id: 2 },
        },
      }
    );
    expect([200, 201]).toContain(assignRes.status());

    // Resolve the newly created project for PM 2 via official operational-board API
    const boardRes = await request.get(`${BACKEND_URL}/project/operational-board`, {
      headers: { Authorization: `Bearer ${pm.token}` },
    });
    expect(boardRes.status()).toBe(200);
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
    expect(testProjectCode).toBeTruthy();
    console.log(`[FIXTURE] Project created via workflow: ID ${testProjectId} (${testProjectCode})`);

    // 7. PM saves WBS (100% complete)
    const wbsRes = await request.put(`${BACKEND_URL}/project/${testProjectId}/wbs-tree`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        nodes: [{ code: '1.0', name: 'Scope Deliverable 100%', level: 1, weightPercentage: 100 }],
      },
    });
    expect([200, 201]).toContain(wbsRes.status());
    const wbsJson = extractData<any>(await wbsRes.json());
    testWbsNodeId = Number(wbsJson?.[0]?.id || 1);

    // 8. PM saves Cost Estimate
    const costRes = await request.put(`${BACKEND_URL}/project/${testProjectId}/cost-estimate`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        categories: [{ categoryKey: 'MATERIAL', mode: 'DIRECT', directSubtotal: 25000000 }],
        pmNotes: 'Direct material costs',
      },
    });
    expect([200, 201]).toContain(costRes.status());

    // 9. PM saves Schedule
    const schedRes = await request.put(`${BACKEND_URL}/project/${testProjectId}/schedule`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        tasks: [
          {
            wbsId: testWbsNodeId,
            name: 'Main Deliverable Task',
            startDate: '2026-11-01',
            endDate: '2026-11-20',
            progress: 0,
          },
        ],
      },
    });
    expect([200, 201]).toContain(schedRes.status());

    // 10. PM saves Initial Condition
    const condRes = await request.put(`${BACKEND_URL}/project/${testProjectId}/initial-condition`, {
      headers: { Authorization: `Bearer ${pm.token}` },
      data: {
        conditionStatus: 'NORMAL',
        locationCondition: 'Site clear and ready for operations',
        initialConstraints: 'None',
        initialRisks: 'None',
      },
    });
    expect([200, 201]).toContain(condRes.status());
    console.log('[FIXTURE] 4/4 Pillars READY confirmed. Ready for PM submission.');
  });

  test('STEP 2: LIVE FLOW A — PM Submits Management Review (routes to HOO)', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [LIVE FLOW A] PM submitting Management Review via UI...');
    await loginViaUi(page, BASE_URL, PM_EMAIL, E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const row = page.locator('tr', { hasText: testProjectCode }).first();
    await expect(row).toBeVisible({ timeout: 15000 });

    const openBtn = row.locator('button:has-text("Operational Plan")').first();
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    const planModal = page
      .locator('.ant-modal-content')
      .filter({ hasText: 'PM Operational Plan Workspace' })
      .first();
    await expect(planModal).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Verify 4/4 READY tag is visible
    const readyTag = planModal.locator('text=4/4 READY').first();
    await expect(readyTag).toBeVisible({ timeout: 10000 });

    // Submit for Management Review
    const submitBtn = planModal.locator('button:has-text("Ajukan untuk Management Review")').first();
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    const confirmSubmitModal = page
      .locator('.ant-modal-content')
      .filter({ hasText: 'Ajukan Operational Plan untuk Review' })
      .first();
    await expect(confirmSubmitModal).toBeVisible({ timeout: 10000 });

    const confirmBtn = confirmSubmitModal
      .locator('button:has-text("Konfirmasi & Ajukan ke Head of Operations")')
      .first();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    await expect(
      page.locator('.ant-message-success', {
        hasText: 'Operational Plan berhasil diajukan untuk Management Review',
      }).first()
    ).toBeVisible({ timeout: 15000 });

    await captureEvidence(page, '01_pm_submit_management_review.png');
    console.log('[LIVE FLOW A PASS] PM successfully submitted Management Review.');

    // Close plan modal if open so modal overlay doesn't block header dropdown
    const closePlanModalBtn = planModal.locator('.ant-modal-close').first();
    if (await closePlanModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closePlanModalBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(planModal).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await logoutViaUi(page);

    // Wait for OutboxRelay tick (cron runs every 5 seconds)
    console.log('[WAIT] Awaiting OutboxRelay publication (7 seconds)...');
    await page.waitForTimeout(7000);

    // Query backend to resolve the created HOO task ID
    const hoo = await apiToken(request, HOO_EMAIL);
    const tasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${hoo.token}` },
    });
    expect(tasksRes.status()).toBe(200);
    const tasksList = extractData<any[]>(await tasksRes.json()) || [];
    const myHooTask = tasksList.find((t: any) => Number(t.workflowInstance?.entityId) === testProjectId);
    expect(myHooTask).toBeDefined();
    hooTaskId = Number(myHooTask.id);
    console.log(`[LIVE FLOW A] Authoritative HOO Task ID: ${hooTaskId}`);
  });

  test('STEP 3: LIVE FLOW A — Verify HOO Notification, Bell +1, and Deep-Link', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [LIVE FLOW A] Verifying HOO Notification & Bell Update in Google Chrome...');
    const hoo = await apiToken(request, HOO_EMAIL);

    // Verify Backend unread count = initial + 1
    const newHooUnread = await getUnreadCount(request, hoo.token);
    console.log(`[VERIFY] HOO Unread Count: Before=${initialHooUnread}, After=${newHooUnread}`);
    expect(newHooUnread).toBe(initialHooUnread + 1);

    // Login as HOO in real Google Chrome
    await loginViaUi(page, BASE_URL, HOO_EMAIL, E2E_PASSWORD);
    await page.goto(`${BASE_URL}/project-delivery`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify Notification Bell Badge in header
    const bellBadge = page.locator('header .ant-badge-count, .ant-badge .ant-badge-count').first();
    await expect(bellBadge).toBeVisible({ timeout: 10000 });
    const badgeText = await bellBadge.innerText();
    console.log(`[VERIFY] HOO Header Bell Badge rendered text: "${badgeText}"`);
    // Badge is either numeric string or '99+' (if total unread >= 100)
    if (newHooUnread > 99) {
      expect(badgeText).toBe('99+');
    } else {
      expect(badgeText).toBe(String(newHooUnread));
    }
    await captureEvidence(page, '02_hoo_bell_unread_incremented.png');

    // Open Unified Inbox
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // 1. Verify To-Do tab: actionable task exists
    const todoTab = page.locator('.ant-tabs-tab', { hasText: 'To-Do' }).first();
    await todoTab.click();
    await page.waitForTimeout(1000);

    const todoRow = page.locator('tr, .ant-list-item').filter({ hasText: `#${testProjectId}` }).first();
    await expect(todoRow).toBeVisible({ timeout: 15000 });
    await expect(todoRow).toContainText('Review Rencana Operasional Proyek');
    console.log('[VERIFY] HOO To-Do task verified.');

    // 2. Verify Notifications tab: informational notification exists
    const notifTab = page.locator('.ant-tabs-tab', { hasText: 'Notifications' }).first();
    await notifTab.click();
    await page.waitForTimeout(1000);

    const notifRow = page.locator('tr, .ant-list-item').filter({ hasText: testProjectCode }).first();
    await expect(notifRow).toBeVisible({ timeout: 15000 });
    await expect(notifRow).toContainText('Review Rencana Operasional Proyek');
    console.log('[VERIFY] HOO Informational Notification verified.');

    await captureEvidence(page, '03_hoo_inbox_todo_and_notification.png');

    // 3. Test Deep-Link Navigation
    const deepLinkUrl = `${BASE_URL}/governance/tasks?taskId=${hooTaskId}&projectId=${testProjectId}`;
    console.log(`[DEEP-LINK] Navigating to canonical target: ${deepLinkUrl}`);
    await page.goto(deepLinkUrl, { waitUntil: 'domcontentloaded' });

    // Verify Governance Review Modal auto-opens via canonical deep-link
    const reviewModal = page
      .locator('.ant-modal-content')
      .filter({ hasText: 'Tugas Persetujuan Proyek' })
      .first();
    await expect(reviewModal).toBeVisible({ timeout: 25000 });

    await page.waitForTimeout(1500);
    await captureEvidence(page, '04_hoo_governance_review_opened.png');
    console.log('[LIVE FLOW A PASS] HOO notification, bell +1, To-Do, and deep-link verified successfully.');
  });

  test('STEP 4: LIVE FLOW B — HOO Approves & Forwards to Procurement', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [LIVE FLOW B] HOO Approving Review and forwarding to Procurement...');
    await loginViaUi(page, BASE_URL, HOO_EMAIL, E2E_PASSWORD);
    await page.goto(`${BASE_URL}/governance/tasks?taskId=${hooTaskId}&projectId=${testProjectId}`, {
      waitUntil: 'domcontentloaded',
    });

    const reviewModal = page
      .locator('.ant-modal-content')
      .filter({ hasText: 'Tugas Persetujuan Proyek' })
      .first();
    await expect(reviewModal).toBeVisible({ timeout: 25000 });

    const setujuiBtn = reviewModal.locator('button:has-text("Setujui")').first();
    await expect(setujuiBtn).toBeVisible({ timeout: 10000 });
    await setujuiBtn.click();

    const confirmModal = page
      .locator('.ant-modal-content')
      .filter({ hasText: 'Setujui Rencana Operasional?' })
      .first();
    await expect(confirmModal).toBeVisible({ timeout: 10000 });

    const konfirmasiBtn = confirmModal.locator('button:has-text("Konfirmasi Persetujuan")');
    await expect(konfirmasiBtn).toBeVisible({ timeout: 10000 });
    await konfirmasiBtn.click();

    await expect(confirmModal).not.toBeVisible({ timeout: 20000 });
    await expect(reviewModal).not.toBeVisible({ timeout: 20000 });

    await captureEvidence(page, '05_hoo_approved_forwarded.png');
    console.log('[LIVE FLOW B PASS] HOO approval executed. Advances to Procurement Review.');

    await logoutViaUi(page);

    // Wait for OutboxRelay tick
    console.log('[WAIT] Awaiting OutboxRelay publication for node_procurement_review (7 seconds)...');
    await page.waitForTimeout(7000);

    // Query backend to resolve the created Procurement task ID
    const proc = await apiToken(request, PROCUREMENT_EMAIL);
    const tasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${proc.token}` },
    });
    expect(tasksRes.status()).toBe(200);
    const tasksList = extractData<any[]>(await tasksRes.json()) || [];
    const myProcTask = tasksList.find((t: any) => Number(t.workflowInstance?.entityId) === testProjectId);
    expect(myProcTask).toBeDefined();
    procTaskId = Number(myProcTask.id);
    console.log(`[LIVE FLOW B] Authoritative Procurement Task ID: ${procTaskId}`);
  });

  test('STEP 5: LIVE FLOW B — Verify Procurement Notification, Bell +1, and Deep-Link', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [LIVE FLOW B] Verifying Procurement Notification & Bell Update in Google Chrome...');
    const proc = await apiToken(request, PROCUREMENT_EMAIL);

    // Verify Backend unread count = initial + 1
    const newProcUnread = await getUnreadCount(request, proc.token);
    console.log(`[VERIFY] Procurement Unread Count: Before=${initialProcUnread}, After=${newProcUnread}`);
    expect(newProcUnread).toBe(initialProcUnread + 1);

    // Login as Procurement in real Google Chrome
    await loginViaUi(page, BASE_URL, PROCUREMENT_EMAIL, E2E_PASSWORD);
    await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify Notification Bell Badge in header
    const bellBadge = page.locator('header .ant-badge-count, .ant-badge .ant-badge-count').first();
    await expect(bellBadge).toBeVisible({ timeout: 10000 });
    const badgeText = await bellBadge.innerText();
    console.log(`[VERIFY] Procurement Header Bell Badge text: "${badgeText}"`);
    if (newProcUnread > 99) {
      expect(badgeText).toBe('99+');
    } else {
      expect(badgeText).toBe(String(newProcUnread));
    }

    await captureEvidence(page, '06_procurement_bell_unread_incremented.png');

    // Open Unified Inbox
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // 1. Verify To-Do tab: actionable Procurement task exists
    const todoTab = page.locator('.ant-tabs-tab', { hasText: 'To-Do' }).first();
    await todoTab.click();
    await page.waitForTimeout(1000);

    const todoRow = page.locator('tr, .ant-list-item').filter({ hasText: `#${testProjectId}` }).first();
    await expect(todoRow).toBeVisible({ timeout: 15000 });
    await expect(todoRow).toContainText('Review Rencana Operasional Proyek');
    console.log('[VERIFY] Procurement To-Do task verified.');

    // 2. Verify Notifications tab: informational notification exists
    const notifTab = page.locator('.ant-tabs-tab', { hasText: 'Notifications' }).first();
    await notifTab.click();
    await page.waitForTimeout(1000);

    const notifRow = page.locator('tr, .ant-list-item').filter({ hasText: testProjectCode }).first();
    await expect(notifRow).toBeVisible({ timeout: 15000 });
    await expect(notifRow).toContainText('Review Rencana Operasional Proyek');
    console.log('[VERIFY] Procurement Informational Notification verified.');

    await captureEvidence(page, '07_procurement_inbox_todo_and_notification.png');

    // 3. Test Deep-Link Navigation
    const deepLinkUrl = `${BASE_URL}/governance/tasks?taskId=${procTaskId}&projectId=${testProjectId}`;
    console.log(`[DEEP-LINK] Navigating to canonical target: ${deepLinkUrl}`);
    await page.goto(deepLinkUrl, { waitUntil: 'domcontentloaded' });

    // Verify Governance Review Modal auto-opens via canonical deep-link
    const reviewModal = page
      .locator('.ant-modal-content')
      .filter({ hasText: 'Tugas Persetujuan Proyek' })
      .first();
    await expect(reviewModal).toBeVisible({ timeout: 25000 });

    await page.waitForTimeout(1500);
    await captureEvidence(page, '08_procurement_governance_review_opened.png');
    console.log('[LIVE FLOW B PASS] Procurement notification, bell +1, To-Do, and deep-link verified successfully.');
  });

  test('STEP 6: READ STATE — Verify Notification Read Transition & Bell Decrement', async ({
    page,
    request,
  }) => {
    console.log('\n>>> [READ STATE] Marking Procurement notification as read...');
    const proc = await apiToken(request, PROCUREMENT_EMAIL);

    await loginViaUi(page, BASE_URL, PROCUREMENT_EMAIL, E2E_PASSWORD);
    // Navigate to Inbox Notifications
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const notifTab = page.locator('.ant-tabs-tab', { hasText: 'Notifications' }).first();
    await notifTab.click();
    await page.waitForTimeout(1000);

    // Find the notification row for this project
    const notifRow = page.locator('tr, .ant-list-item').filter({ hasText: testProjectCode }).first();
    await expect(notifRow).toBeVisible({ timeout: 15000 });

    // Mark as read by clicking the notification item (triggers markAsRead in InboxPage)
    await notifRow.click();
    await page.waitForTimeout(2500);

    // Verify unread count decreases back to baseline
    const updatedProcUnread = await getUnreadCount(request, proc.token);
    console.log(`[READ STATE] Procurement Unread Count after mark read: ${updatedProcUnread}`);
    expect(updatedProcUnread).toBe(initialProcUnread);

    await captureEvidence(page, '09_procurement_notification_marked_read.png');
    console.log('[READ STATE PASS] Unread -> Read transition verified; bell count decremented accurately.');
  });

  test('STEP 7: IDEMPOTENCY & ZERO DUPLICATES VERIFICATION', async ({ request }) => {
    console.log('\n>>> [IDEMPOTENCY] Verifying zero duplicate notifications in database/API...');
    const hoo = await apiToken(request, HOO_EMAIL);
    const proc = await apiToken(request, PROCUREMENT_EMAIL);

    // Fetch notifications for HOO
    const hooNotifRes = await request.get(`${BACKEND_URL}/notifications`, {
      headers: { Authorization: `Bearer ${hoo.token}` },
    });
    expect(hooNotifRes.status()).toBe(200);
    const hooNotifs = extractData<any[]>(await hooNotifRes.json()) || [];
    const matchingHooNotifs = hooNotifs.filter(
      (n: any) => n.metaData?.projectId === testProjectId && n.metaData?.nodeId === 'node_hops_review'
    );
    console.log(`[IDEMPOTENCY] Total HOO notifications for Project ${testProjectId}: ${matchingHooNotifs.length}`);
    expect(matchingHooNotifs.length).toBe(1);

    // Fetch notifications for Procurement
    const procNotifRes = await request.get(`${BACKEND_URL}/notifications`, {
      headers: { Authorization: `Bearer ${proc.token}` },
    });
    expect(procNotifRes.status()).toBe(200);
    const procNotifs = extractData<any[]>(await procNotifRes.json()) || [];
    const matchingProcNotifs = procNotifs.filter(
      (n: any) => n.metaData?.projectId === testProjectId && n.metaData?.nodeId === 'node_procurement_review'
    );
    console.log(`[IDEMPOTENCY] Total Procurement notifications for Project ${testProjectId}: ${matchingProcNotifs.length}`);
    expect(matchingProcNotifs.length).toBe(1);

    console.log('[IDEMPOTENCY PASS] Exactly 1 notification per intended recipient; zero duplicates.');
  });
});
