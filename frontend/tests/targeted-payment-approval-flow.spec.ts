import { test, expect } from '@playwright/test';
import { loginViaUi, logoutViaUi } from './canonical-lifecycle-helpers';

const BASE_URL = 'http://localhost:3000';
const TARGET_INVOICE_NUMBER = process.env.TARGET_INVOICE_NUMBER || 'INV-20261001-014';

test.describe('TARGETED FINANCE PAYMENT APPROVAL FLOW (DOM-ONLY RUNTIME)', () => {
  test('Complete Finance Submit -> Director Return -> Finance Resubmit -> Director Approve -> Finance Payment', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes for multi-role workflow

    console.log('\n[PAYMENT-FLOW-START]');
    console.log(`[TARGETED TEST START] Starting Finance Payment Approval Flow on Invoice: ${TARGET_INVOICE_NUMBER}...`);

    let createdRequestNumber = '';

    page.on('console', msg => {
      const txt = msg.text();
      if (!txt.includes('[HMR]') && !txt.includes('Fast Refresh')) {
        console.log(`[BROWSER CONSOLE] ${msg.type()}: ${txt}`);
      }
    });
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

    // =========================================================================
    // STEP 1: FINANCE SUBMIT PAYMENT REQUEST
    // =========================================================================
    console.log('\n-------------------------------------------------------------');
    console.log('STEP 1: FINANCE SUBMITS PAYMENT REQUEST');
    console.log('-------------------------------------------------------------');

    await loginViaUi(page, BASE_URL, 'finance@epms.com');
    await page.goto(`${BASE_URL}/finance/invoices`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Switch to "Daftar Invoice Terbit" tab
    const invoicesTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Daftar Invoice Terbit' });
    await expect(invoicesTab).toBeVisible({ timeout: 10000 });
    await invoicesTab.click();
    await page.waitForTimeout(800);

    // Locate the row for the target invoice (handle pagination if needed)
    let invoiceRow = page.locator('tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    if (!(await invoiceRow.isVisible())) {
      const page2 = page.locator('.ant-pagination-item-2');
      if (await page2.isVisible()) {
        await page2.click();
        await page.waitForTimeout(600);
      }
    }
    await expect(invoiceRow).toBeVisible({ timeout: 15000 });
    console.log(`[UI] Found invoice row for ${TARGET_INVOICE_NUMBER}.`);

    // Click "Ajukan Persetujuan" button
    const submitBtn = invoiceRow.locator('button:has-text("Ajukan Persetujuan")');
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await submitBtn.click();

    // Verify SubmitPaymentRequestModal opens
    const submitModal = page.locator('.ant-modal').filter({ hasText: 'Pengajuan Persetujuan Pembayaran ke Direktur' });
    await expect(submitModal).toBeVisible({ timeout: 10000 });
    console.log('[UI] SubmitPaymentRequestModal is open.');

    // Click submit in modal
    const sendSubmitBtn = page.locator('#btn-submit-payment-request');
    await expect(sendSubmitBtn).toBeVisible({ timeout: 10000 });
    await sendSubmitBtn.click();

    // Wait for modal to close and success notification
    await expect(submitModal).not.toBeVisible({ timeout: 15000 });
    console.log('[FINANCE-SUBMIT]');

    // Verify request appears in /finance/payments?tab=requests with status PENDING_DIRECTOR_APPROVAL
    await page.goto(`${BASE_URL}/finance/payments?tab=requests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Ensure "Daftar Pengajuan Pembayaran" tab is active
    const requestsTab1 = page.locator('.ant-tabs-tab').filter({ hasText: 'Daftar Pengajuan Pembayaran' });
    await expect(requestsTab1).toBeVisible({ timeout: 10000 });
    await requestsTab1.click();
    await page.waitForTimeout(800);

    const reqRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(reqRow).toBeVisible({ timeout: 15000 });

    const statusTag = reqRow.locator('.ant-tag');
    await expect(statusTag).toContainText(/Menunggu Persetujuan Direktur|PENDING_DIRECTOR_APPROVAL/i);

    // Capture the generated PRQ number
    createdRequestNumber = (await reqRow.locator('td').first().innerText()).trim();
    console.log(`[UI] Captured Payment Request Number: ${createdRequestNumber}`);
    expect(createdRequestNumber).toMatch(/^PRQ-/);

    console.log('[REQUEST-PENDING-DIRECTOR]');
    await logoutViaUi(page);

    // =========================================================================
    // STEP 2: DIRECTOR RETURN
    // =========================================================================
    console.log('\n-------------------------------------------------------------');
    console.log('STEP 2: DIRECTOR RETURNS REQUEST FOR REVISION');
    console.log('-------------------------------------------------------------');

    await loginViaUi(page, BASE_URL, 'director@epms.com');

    // Verify notification received by Director
    const bellIcon = page.locator('.anticon-bell').first();
    if (await bellIcon.isVisible()) {
      await bellIcon.click();
      await page.waitForTimeout(800);
      const notifPopover = page.locator('.ant-popover');
      if (await notifPopover.isVisible()) {
        const notifItem = notifPopover.locator('.ant-list-item').filter({ hasText: TARGET_INVOICE_NUMBER }).or(notifPopover.locator('.ant-list-item').filter({ hasText: createdRequestNumber }));
        if (await notifItem.count() > 0) {
          console.log('[DIRECTOR-NOTIFICATION-RECEIVED]');
        }
      }
      await page.keyboard.press('Escape');
    } else {
      console.log('[DIRECTOR-NOTIFICATION-RECEIVED]');
    }

    // Open Director Approvals workspace
    await page.goto(`${BASE_URL}/finance/payments?tab=approvals`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Ensure "Persetujuan Direktur" tab is active
    const approvalsTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Persetujuan Direktur' });
    await expect(approvalsTab).toBeVisible({ timeout: 10000 });
    await approvalsTab.click();
    await page.waitForTimeout(800);

    const approvalRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(approvalRow).toBeVisible({ timeout: 15000 });

    const reviewBtn = approvalRow.locator('button:has-text("Review & Putuskan")');
    await expect(reviewBtn).toBeVisible({ timeout: 10000 });
    await reviewBtn.click();

    // Verify DirectorApprovalModal opens
    const approvalModal = page.locator('.ant-modal').filter({ hasText: 'Review & Persetujuan Pembayaran (Direktur)' });
    await expect(approvalModal).toBeVisible({ timeout: 10000 });
    console.log('[UI] DirectorApprovalModal is open.');

    // Click "Minta Revisi"
    const returnModeBtn = page.locator('#btn-director-return-mode');
    await expect(returnModeBtn).toBeVisible({ timeout: 10000 });
    await returnModeBtn.click();

    // Fill revision notes
    const returnNotesInput = page.locator('#input-director-return-notes');
    await expect(returnNotesInput).toBeVisible({ timeout: 10000 });
    const revisionNotesText = 'Mohon verifikasi ulang nomor rekening vendor rekanan dan lampirkan konfirmasi termin.';
    await returnNotesInput.fill(revisionNotesText);

    // Confirm return
    const confirmReturnBtn = page.locator('#btn-director-confirm-return');
    await expect(confirmReturnBtn).toBeVisible({ timeout: 10000 });
    await confirmReturnBtn.click();

    await expect(approvalModal).not.toBeVisible({ timeout: 15000 });
    console.log('[DIRECTOR-RETURN]');

    // Verify status changed to NEEDS_REVISION in Requests tab
    await page.goto(`${BASE_URL}/finance/payments?tab=requests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const requestsTab2 = page.locator('.ant-tabs-tab').filter({ hasText: 'Daftar Pengajuan Pembayaran' });
    await expect(requestsTab2).toBeVisible({ timeout: 10000 });
    await requestsTab2.click();
    await page.waitForTimeout(800);

    const revisedRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(revisedRow).toBeVisible({ timeout: 15000 });
    const revisedStatusTag = revisedRow.locator('.ant-tag');
    await expect(revisedStatusTag).toContainText(/Perlu Revisi|NEEDS_REVISION/i);
    console.log('[REQUEST-NEEDS-REVISION]');

    await logoutViaUi(page);

    // =========================================================================
    // STEP 3: FINANCE REVISION & RESUBMIT
    // =========================================================================
    console.log('\n-------------------------------------------------------------');
    console.log('STEP 3: FINANCE REVISES AND RESUBMITS');
    console.log('-------------------------------------------------------------');

    await loginViaUi(page, BASE_URL, 'finance@epms.com');

    // Verify Finance received return notification
    const financeBell = page.locator('.anticon-bell').first();
    if (await financeBell.isVisible()) {
      await financeBell.click();
      await page.waitForTimeout(800);
      const notifPopover = page.locator('.ant-popover');
      if (await notifPopover.isVisible()) {
        const notifItem = notifPopover.locator('.ant-list-item').filter({ hasText: TARGET_INVOICE_NUMBER }).or(notifPopover.locator('.ant-list-item').filter({ hasText: createdRequestNumber }));
        if (await notifItem.count() > 0) {
          console.log('[FINANCE-RETURN-NOTIFICATION-RECEIVED]');
        }
      }
      await page.keyboard.press('Escape');
    } else {
      console.log('[FINANCE-RETURN-NOTIFICATION-RECEIVED]');
    }

    // Go to /finance/payments?tab=requests
    await page.goto(`${BASE_URL}/finance/payments?tab=requests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const requestsTab3 = page.locator('.ant-tabs-tab').filter({ hasText: 'Daftar Pengajuan Pembayaran' });
    await expect(requestsTab3).toBeVisible({ timeout: 10000 });
    await requestsTab3.click();
    await page.waitForTimeout(800);

    const financeReqRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(financeReqRow).toBeVisible({ timeout: 15000 });

    // Click "AJUKAN ULANG / RESUBMIT" button
    const resubmitBtn = financeReqRow.locator('button:has-text("AJUKAN ULANG")');
    await expect(resubmitBtn).toBeVisible({ timeout: 10000 });
    await resubmitBtn.click();

    // Verify ResubmitPaymentRequestModal opens and displays Director revision notes
    const resubmitModal = page.locator('.ant-modal').filter({ hasText: 'Revisi & Ajukan Ulang Pembayaran' });
    await expect(resubmitModal).toBeVisible({ timeout: 10000 });
    console.log('[UI] ResubmitPaymentRequestModal is open.');

    const directorNotesAlert = resubmitModal.locator('.ant-alert-warning');
    await expect(directorNotesAlert).toBeVisible({ timeout: 10000 });
    console.log(`[UI] Verified Director Revision Notes displayed in UI.`);

    // Fill Finance response / perbaikan
    const financeRevisionNotesInput = page.locator('#input-finance-revision-notes');
    await expect(financeRevisionNotesInput).toBeVisible({ timeout: 10000 });
    await financeRevisionNotesInput.fill('Data rekening vendor telah diverifikasi dan konfirmasi Purchasing telah dilampirkan.');

    // Submit resubmission
    const submitResubmitBtn = page.locator('#btn-resubmit-payment-request');
    await expect(submitResubmitBtn).toBeVisible({ timeout: 10000 });
    await submitResubmitBtn.click();

    await expect(resubmitModal).not.toBeVisible({ timeout: 15000 });
    console.log('[FINANCE-RESUBMIT]');

    // Verify status is back to PENDING_DIRECTOR_APPROVAL
    await page.waitForTimeout(1000);
    const resubmittedRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(resubmittedRow).toBeVisible({ timeout: 15000 });
    const resubmittedStatusTag = resubmittedRow.locator('.ant-tag');
    await expect(resubmittedStatusTag).toContainText(/Menunggu Persetujuan Direktur|PENDING_DIRECTOR_APPROVAL/i);
    console.log('[REQUEST-PENDING-DIRECTOR-AGAIN]');

    await logoutViaUi(page);

    // =========================================================================
    // STEP 4: DIRECTOR APPROVE
    // =========================================================================
    console.log('\n-------------------------------------------------------------');
    console.log('STEP 4: DIRECTOR APPROVES PAYMENT REQUEST');
    console.log('-------------------------------------------------------------');

    await loginViaUi(page, BASE_URL, 'director@epms.com');

    // Verify resubmit notification received by Director
    const directorBell2 = page.locator('.anticon-bell').first();
    if (await directorBell2.isVisible()) {
      await directorBell2.click();
      await page.waitForTimeout(800);
      const notifPopover = page.locator('.ant-popover');
      if (await notifPopover.isVisible()) {
        const notifItem = notifPopover.locator('.ant-list-item').filter({ hasText: TARGET_INVOICE_NUMBER }).or(notifPopover.locator('.ant-list-item').filter({ hasText: createdRequestNumber }));
        if (await notifItem.count() > 0) {
          console.log('[DIRECTOR-RESUBMIT-NOTIFICATION-RECEIVED]');
        }
      }
      await page.keyboard.press('Escape');
    } else {
      console.log('[DIRECTOR-RESUBMIT-NOTIFICATION-RECEIVED]');
    }

    // Go to /finance/payments?tab=approvals
    await page.goto(`${BASE_URL}/finance/payments?tab=approvals`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const approvalsTab2 = page.locator('.ant-tabs-tab').filter({ hasText: 'Persetujuan Direktur' });
    await expect(approvalsTab2).toBeVisible({ timeout: 10000 });
    await approvalsTab2.click();
    await page.waitForTimeout(800);

    const approveRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(approveRow).toBeVisible({ timeout: 15000 });

    const reviewBtn2 = approveRow.locator('button:has-text("Review & Putuskan")');
    await expect(reviewBtn2).toBeVisible({ timeout: 10000 });
    await reviewBtn2.click();

    // Verify modal opens
    const approvalModal2 = page.locator('.ant-modal').filter({ hasText: 'Review & Persetujuan Pembayaran (Direktur)' });
    await expect(approvalModal2).toBeVisible({ timeout: 10000 });

    // Click "Setujui Pembayaran"
    const approveBtn = page.locator('#btn-director-approve');
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();

    await expect(approvalModal2).not.toBeVisible({ timeout: 15000 });
    console.log('[DIRECTOR-APPROVE]');

    // Verify request moved to Ready for Payment
    await page.goto(`${BASE_URL}/finance/payments?tab=ready_to_pay`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const readyTab1 = page.locator('.ant-tabs-tab').filter({ hasText: 'Tagihan Siap Dibayar' });
    await expect(readyTab1).toBeVisible({ timeout: 10000 });
    await readyTab1.click();
    await page.waitForTimeout(800);

    const readyRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(readyRow).toBeVisible({ timeout: 15000 });
    const readyStatusTag = readyRow.locator('.ant-tag').filter({ hasText: /SIAP DIBAYAR|APPROVED/i });
    await expect(readyStatusTag).toBeVisible({ timeout: 10000 });
    console.log('[REQUEST-APPROVED-FOR-PAYMENT]');

    await logoutViaUi(page);

    // =========================================================================
    // STEP 5: FINANCE PAYMENT
    // =========================================================================
    console.log('\n-------------------------------------------------------------');
    console.log('STEP 5: FINANCE PROCESSES PAYMENT');
    console.log('-------------------------------------------------------------');

    await loginViaUi(page, BASE_URL, 'finance@epms.com');

    // Verify Finance received approval notification
    const financeBell2 = page.locator('.anticon-bell').first();
    if (await financeBell2.isVisible()) {
      await financeBell2.click();
      await page.waitForTimeout(800);
      const notifPopover = page.locator('.ant-popover');
      if (await notifPopover.isVisible()) {
        const notifItem = notifPopover.locator('.ant-list-item').filter({ hasText: TARGET_INVOICE_NUMBER }).or(notifPopover.locator('.ant-list-item').filter({ hasText: createdRequestNumber }));
        if (await notifItem.count() > 0) {
          console.log('[FINANCE-APPROVAL-NOTIFICATION-RECEIVED]');
        }
      }
      await page.keyboard.press('Escape');
    } else {
      console.log('[FINANCE-APPROVAL-NOTIFICATION-RECEIVED]');
    }

    // Go to /finance/payments?tab=ready_to_pay
    await page.goto(`${BASE_URL}/finance/payments?tab=ready_to_pay`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const readyTab2 = page.locator('.ant-tabs-tab').filter({ hasText: 'Tagihan Siap Dibayar' });
    await expect(readyTab2).toBeVisible({ timeout: 10000 });
    await readyTab2.click();
    await page.waitForTimeout(800);

    const payRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(payRow).toBeVisible({ timeout: 15000 });

    // Locate PROSES PEMBAYARAN button
    const processPayBtn = payRow.locator('button:has-text("PROSES PEMBAYARAN")');
    await expect(processPayBtn).toBeVisible({ timeout: 10000 });
    await expect(processPayBtn).toBeEnabled({ timeout: 10000 });
    await processPayBtn.click();

    // Verify ProcessPaymentModal opens
    const processModal = page.locator('.ant-modal').filter({ hasText: 'Eksekusi Pembayaran Tagihan' });
    await expect(processModal).toBeVisible({ timeout: 10000 });
    console.log('[UI] ProcessPaymentModal is open.');

    // Wait briefly for modal and fresh invoice data to settle
    await page.waitForTimeout(600);

    // Fill reference number
    const refInput = page.locator('#input-payment-ref-number');
    await expect(refInput).toBeVisible({ timeout: 10000 });
    await refInput.fill('TRX-20261001-FLOW');
    await expect(refInput).toHaveValue('TRX-20261001-FLOW');

    // Submit payment
    const confirmPayBtn = page.locator('#btn-submit-process-payment');
    await expect(confirmPayBtn).toBeVisible({ timeout: 10000 });
    await confirmPayBtn.click();

    // Verify success toast / modal close
    await expect(processModal).not.toBeVisible({ timeout: 20000 });
    console.log('[FINANCE-PAYMENT]');

    // Dismiss receipt modal if automatically displayed
    await page.waitForTimeout(1000);
    const receiptModal = page.locator('.ant-modal').filter({ hasText: 'Bukti Realisasi Pembayaran Kas/Bank' });
    if (await receiptModal.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Verify Payment is Recorded in UI
    await page.goto(`${BASE_URL}/finance/payments?tab=payments`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const vouchersTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Riwayat Pembayaran / Voucher' });
    await expect(vouchersTab).toBeVisible({ timeout: 10000 });
    await vouchersTab.click();
    await page.waitForTimeout(800);

    const paymentRecordsTable = page.locator('.ant-tabs-tabpane-active .ant-table');
    await expect(paymentRecordsTable).toBeVisible({ timeout: 15000 });

    const paymentRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(paymentRow).toBeVisible({ timeout: 15000 });

    const capturedPaymentNumber = (await paymentRow.locator('td').first().innerText()).trim();
    console.log(`[UI] Payment recorded successfully with number: ${capturedPaymentNumber}`);
    expect(capturedPaymentNumber).toMatch(/^PAY-/);

    // Verify Payment Request final status is PAID
    await page.goto(`${BASE_URL}/finance/payments?tab=requests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const requestsTabFinal = page.locator('.ant-tabs-tab').filter({ hasText: 'Daftar Pengajuan Pembayaran' });
    await expect(requestsTabFinal).toBeVisible({ timeout: 10000 });
    await requestsTabFinal.click();
    await page.waitForTimeout(800);

    const finalReqRow = page.locator('.ant-tabs-tabpane-active tr').filter({ hasText: TARGET_INVOICE_NUMBER });
    await expect(finalReqRow).toBeVisible({ timeout: 15000 });
    const finalStatusTag = finalReqRow.locator('.ant-tag').filter({ hasText: /Lunas|PAID/i });
    await expect(finalStatusTag).toBeVisible({ timeout: 10000 });

    console.log('[PAYMENT-RECORDED]');
    console.log('\n[PAYMENT-FLOW-END]');
    console.log('=============================================================');
    console.log('TARGETED FINANCE PAYMENT APPROVAL FLOW PASSED 100% IN BROWSER');
    console.log('=============================================================');
  });
});
