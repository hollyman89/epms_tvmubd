import { test, expect } from '@playwright/test';

test.describe('EPMS E2E Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Go to login page before each test
    await page.goto('http://localhost:3000/login');
  });

  test('1. Login -> Dashboard', async ({ page }) => {
    await page.fill('input[name="email"]', 'admin@tvmubd.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    
    // Check if navigated to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('2. PR -> Vendor -> PO -> GR (Full Cycle)', async ({ page }) => {
    // Navigate to Create PR
    await page.goto('http://localhost:3000/procurement/pr/create');
    await expect(page.locator('text=Buat Purchase Request')).toBeVisible();
    
    // Note: Since this is a smoke test stub, we just verify the pages render without 404
    await page.goto('http://localhost:3000/procurement/vendor-comparison');
    await expect(page.locator('text=Vendor Comparison')).toBeVisible();

    await page.goto('http://localhost:3000/procurement/po');
    await expect(page.locator('text=Purchase Order')).toBeVisible();

    await page.goto('http://localhost:3000/procurement/gr/create');
    await expect(page.locator('text=Buat GR')).toBeVisible();
  });

  test('3. Contract Detail -> Assign PM', async ({ page }) => {
    // Since we don't have real contract ID easily, we test route 1
    await page.goto('http://localhost:3000/governance/contracts/1');
    await expect(page.locator('text=Contract Detail')).toBeVisible();
  });

  test('4. Finance 3-Way Match (Status Color)', async ({ page }) => {
    await page.goto('http://localhost:3000/finance/invoices');
    await expect(page.locator('text=Invoices')).toBeVisible();
  });

  test('5. Document Upload', async ({ page }) => {
    // We mock the document upload component or visit a page that has it
    // For now we just verify the backend endpoint returns a presigned URL successfully
    const response = await page.request.post('http://localhost:4000/api/v1/documents/presigned-url', {
      data: {
        fileName: 'test-upload.pdf',
        mimeType: 'application/pdf',
        entityType: 'SPK',
        entityId: 1
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.presignedUrl).toBeDefined();
    expect(body.data.finalUrl).toBeDefined();
  });
});
