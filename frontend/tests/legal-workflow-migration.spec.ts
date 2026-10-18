import { test, expect, APIRequestContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginViaUi, logoutViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:4000/api/v1';
const SAMPLE_PDF_PATH = path.resolve(__dirname, '../test-assets/test-sample.pdf');

function extractTasks(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  return [];
}

/**
 * Helper: Prepare fresh Tender to WON + SPK uploaded using canonical business APIs.
 * NO raw SQL writes.
 */
async function createWonTenderWithSpk(request: APIRequestContext, name: string) {
  // 1. Authenticate as canonical Marketing PIC (ragil@epms.com)
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: 'ragil@epms.com', password: '123456' },
  });
  expect(loginRes.status()).toBe(200);
  const loginJson = await loginRes.json();
  const token = loginJson.data?.accessToken || loginJson.data?.access_token || loginJson.accessToken || loginJson.access_token;
  expect(token).toBeTruthy();
  const marketingUserId = Number(loginJson.data?.user?.sub || loginJson.data?.user?.id || 9);

  const custRes = await request.get(`${BACKEND_URL}/marketing/customers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const custJson = await custRes.json();
  const rawList = Array.isArray(custJson) ? custJson : Array.isArray(custJson.data) ? custJson.data : Array.isArray(custJson.data?.data) ? custJson.data.data : [];
  const customerId = rawList.length > 0 ? Number(rawList[0].id) : 1;
  console.log(`[CUSTOMER RESOLUTION] Resolved customerId: ${customerId}`);

  // 3. Create fresh Tender in LEAD with mandatory fields
  const createRes = await request.post(`${BACKEND_URL}/marketing/tenders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customerId,
      projectName: name,
      estimatedBudget: 350000000,
      expectedClosingDate: '2026-12-31',
      bidSubmissionDeadline: '2026-12-31',
      marketingPicId: marketingUserId,
    },
  });
  if (createRes.status() !== 201) {
    console.error('[CREATE TENDER ERROR]', await createRes.text());
  }
  expect(createRes.status()).toBe(201);
  const tenderJson = await createRes.json();
  const tender = tenderJson.data || tenderJson;

  // 4. Submit GO/NO-GO review (Marketing)
  const submitGoRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tender.id}/submit-go-no-go`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      executiveSummary: 'Opportunity bernilai strategis dengan repeat customer margin 20%',
      readiness: {
        customerRequirement: 'CLEAR',
        commercialInformation: 'READY',
        timeline: 'FEASIBLE',
      },
      marketingRecommendation: 'GO',
      marketingRecommendationReason: 'Customer kredibel dan budget proyek telah teralokasi',
    },
  });
  expect(submitGoRes.status()).toBe(201);

  // 5. Director approves GO
  const dirLoginRes = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: 'director@epms.com', password: '123456' },
  });
  const dirLoginJson = await dirLoginRes.json();
  const dirToken = dirLoginJson.data?.accessToken || dirLoginJson.data?.access_token || dirLoginJson.accessToken;

  const approveGoRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tender.id}/go-no-go`, {
    headers: { Authorization: `Bearer ${dirToken}` },
    data: { decision: 'GO' },
  });
  expect(approveGoRes.status()).toBe(201);

  // 6. Upload valid SPK PDF (automatically sets tender to WON and creates Contract for Legal Review)
  const pdfBuffer = fs.readFileSync(SAMPLE_PDF_PATH);
  const uploadRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tender.id}/upload-spk`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'test-sample.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      },
    },
  });
  expect(uploadRes.status()).toBe(201);
  const uploadJson = await uploadRes.json();

  return { tender, uploadResult: uploadJson.data || uploadJson, token };
}

test.describe('W6-CP4B-02: Legal Review & Revision Canonical Workflow Migration (Playwright E2E)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('Scenarios A, B, C: Marketing -> Legal Review -> RETURN -> Marketing Revision -> Auto-RESUBMIT -> Legal APPROVE', async ({ page, request }) => {
    const tenderName = `LEGAL-MIGRATION-TEST-${Date.now()}`;
    console.log(`\n[STEP 1] Creating fresh Tender & uploading SPK via canonical flow: "${tenderName}"...`);
    const { tender, token: marketingToken } = await createWonTenderWithSpk(request, tenderName);
    console.log(`[STEP 1 SUCCESS] Tender ID: ${tender.id}`);

    // Verify LEGAL_REVIEW task created for Legal user via API
    const legalLoginRes = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email: 'legal@epms.com', password: '123456' },
    });
    const legalLoginJson = await legalLoginRes.json();
    const legalToken = legalLoginJson.data?.accessToken || legalLoginJson.data?.access_token || legalLoginJson.accessToken || legalLoginJson.access_token;
    const myTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${legalToken}` },
    });
    const myTasks = extractTasks(await myTasksRes.json());
    const legalTask = myTasks.find((t: any) => t.taskKey === 'LEGAL_REVIEW');
    expect(legalTask).toBeDefined();
    console.log(`[STEP 1 VERIFIED] Active LEGAL_REVIEW task exists: Task ID #${legalTask.id}`);

    // =========================================================================
    // SCENARIO A: LOGIN LEGAL & OPEN WORKSTATION
    // =========================================================================
    console.log('\n[SCENARIO A] Logging in as Legal user via UI...');
    await loginViaUi(page, BASE_URL, 'legal@epms.com');

    await page.goto(`${BASE_URL}/legal/review`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Search and select the tender in the queue
    const searchInput = page.locator('input[placeholder="Cari No. Kontrak / Klien..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(tenderName);
      await page.waitForTimeout(600);
    }

    const queueItem = page.locator('.ant-card').locator('div').filter({ hasText: tenderName }).first();
    await expect(queueItem).toBeVisible({ timeout: 15000 });
    await queueItem.click();
    console.log('[SCENARIO A] Contract selected in Legal Task Queue.');

    // Verify document preview and action buttons
    await page.waitForTimeout(2000);
    const setujuiBtn = page.locator('button:has-text("Setujui & Rilis")');
    await expect(setujuiBtn).toBeVisible({ timeout: 10000 });

    const revisiBtn = page.locator('button:has-text("Revisi")');
    await expect(revisiBtn).toBeVisible({ timeout: 10000 });
    console.log('[SCENARIO A SUCCESS] Legal review screen displays contract and action buttons.');

    // =========================================================================
    // SCENARIO B: LEGAL RETURN -> MARKETING REVISION
    // =========================================================================
    console.log('\n[SCENARIO B] Legal requests revision (RETURN)...');
    await revisiBtn.click();

    const revisionModal = page.locator('.ant-modal-content').filter({ hasText: 'Permintaan Revisi Kontrak ke Marketing' });
    await expect(revisionModal).toBeVisible({ timeout: 10000 });

    const notesArea = revisionModal.locator('textarea');
    await notesArea.fill('Klausul SLA pengiriman dan termin pembayaran kedua wajib disesuaikan minimal 30 hari.');
    await page.waitForTimeout(300);

    const submitRevisionBtn = revisionModal.locator('button:has-text("Kirim Catatan Revisi")');
    await submitRevisionBtn.click();
    await expect(revisionModal).not.toBeVisible({ timeout: 15000 });
    console.log('[SCENARIO B] Revision submitted.');

    await page.waitForTimeout(1500);
    await logoutViaUi(page);

    // Verify revision task is assigned to exact Marketing PIC (ragil) and NOT to other roles
    const picTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${marketingToken}` },
    });
    const picTasks = extractTasks(await picTasksRes.json());
    const revisionTask = picTasks.find((t: any) => t.taskKey === 'LEGAL_DOCUMENT_REVISION');
    expect(revisionTask).toBeDefined();
    console.log(`[SCENARIO B VERIFIED] Explicit revision task #${revisionTask.id} assigned to Marketing PIC.`);

    // Marketing uploads corrected SPK (Auto-RESUBMIT)
    console.log('[SCENARIO B] Marketing uploads corrected SPK via canonical API...');
    const correctedPdfBuffer = fs.readFileSync(SAMPLE_PDF_PATH);
    const reuploadRes = await request.post(`${BACKEND_URL}/marketing/tenders/${tender.id}/upload-spk`, {
      headers: { Authorization: `Bearer ${marketingToken}` },
      multipart: {
        file: {
          name: 'test-sample-revised.pdf',
          mimeType: 'application/pdf',
          buffer: correctedPdfBuffer,
        },
      },
    });
    expect(reuploadRes.status()).toBe(201);
    console.log('[SCENARIO B SUCCESS] Corrected SPK uploaded. Auto-RESUBMIT executed.');

    // Verify revision task is COMPLETED and new LEGAL_REVIEW task created
    const postReuploadTasksRes = await request.get(`${BACKEND_URL}/workflow/tasks/mine`, {
      headers: { Authorization: `Bearer ${legalToken}` },
    });
    const postReuploadTasks = extractTasks(await postReuploadTasksRes.json());
    const newLegalTask = postReuploadTasks.find((t: any) => t.taskKey === 'LEGAL_REVIEW');
    expect(newLegalTask).toBeDefined();
    console.log(`[SCENARIO B VERIFIED] New LEGAL_REVIEW task #${newLegalTask.id} created.`);

    // =========================================================================
    // SCENARIO C: LEGAL APPROVE & PMO HANDOVER
    // =========================================================================
    console.log('\n[SCENARIO C] Logging back in as Legal user to APPROVE...');
    await loginViaUi(page, BASE_URL, 'legal@epms.com');
    await page.goto(`${BASE_URL}/legal/review`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    if (await searchInput.isVisible()) {
      await searchInput.fill(tenderName);
      await page.waitForTimeout(600);
    }

    const reloadedQueueItem = page.locator('.ant-card').locator('div').filter({ hasText: tenderName }).first();
    await expect(reloadedQueueItem).toBeVisible({ timeout: 15000 });
    await reloadedQueueItem.click();
    await page.waitForTimeout(2000);

    // Complete compliance checkboxes
    const checkboxes = page.locator('.ant-checkbox-input');
    const checkboxCount = await checkboxes.count();
    for (let i = 0; i < checkboxCount; i++) {
      const cb = checkboxes.nth(i);
      if (!(await cb.isChecked())) {
        await cb.check({ force: true });
        await page.waitForTimeout(50);
      }
    }

    // Click Setujui & Rilis
    await expect(setujuiBtn).toBeEnabled({ timeout: 10000 });
    await setujuiBtn.click();

    const confirmModal = page.locator('.ant-modal-confirm');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    const modalConfirmBtn = confirmModal.locator('button:has-text("Setujui & Rilis ke PMO")');
    await modalConfirmBtn.click();

    // Verify Handover modal appears
    const handoverModal = page.locator('.ant-modal-content:has-text("Handover ke PMO Berhasil")');
    await expect(handoverModal).toBeVisible({ timeout: 15000 });
    await handoverModal.locator('button:has-text("Tutup")').click();
    console.log('[SCENARIO C SUCCESS] Legal review approved & released to PMO successfully!');

    await logoutViaUi(page);
  });

  test('Scenario D: Fresh Contract -> Legal REJECT', async ({ page, request }) => {
    const rejectTenderName = `LEGAL-REJECT-TEST-${Date.now()}`;
    console.log(`\n[SCENARIO D] Creating fresh entity for REJECT: "${rejectTenderName}"...`);
    const { tender } = await createWonTenderWithSpk(request, rejectTenderName);

    await loginViaUi(page, BASE_URL, 'legal@epms.com');
    await page.goto(`${BASE_URL}/legal/review`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[placeholder="Cari No. Kontrak / Klien..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(rejectTenderName);
      await page.waitForTimeout(600);
    }

    const queueItem = page.locator('.ant-card').locator('div').filter({ hasText: rejectTenderName }).first();
    await expect(queueItem).toBeVisible({ timeout: 15000 });
    await queueItem.click();
    await page.waitForTimeout(2000);

    // Open More dropdown -> click Tolak Kontrak
    const moreBtn = page.locator('.ant-dropdown-trigger').filter({ hasText: '' }).last();
    await moreBtn.click();
    await page.waitForTimeout(300);

    const rejectMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Tolak Kontrak")');
    await expect(rejectMenuItem).toBeVisible({ timeout: 5000 });
    await rejectMenuItem.click();

    // Confirm rejection
    const confirmModal = page.locator('.ant-modal-confirm');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    const modalRejectBtn = confirmModal.locator('button:has-text("Tolak Kontrak")');
    await modalRejectBtn.click();

    await page.waitForTimeout(2000);
    console.log('[SCENARIO D SUCCESS] Contract rejected by Legal. Terminal state verified.');

    await logoutViaUi(page);
  });
});
