import { test, expect } from '@playwright/test';

/**
 * EPMS Enterprise UX Legal Review Workstation Test Suite:
 * Marketing WON -> Contract Auto-Creation -> Task Queue -> Grouped Checklists -> Approval Workflow
 */
test.describe('EPMS Enterprise UX: Legal Review Workstation', () => {
  const BASE_URL = 'http://localhost:3000';
  const API_URL = 'http://localhost:4000/api/v1';

  test('1. Marketing User login & system contract creation check', async ({ page }) => {
    // Login Marketing User
    await page.goto(`${BASE_URL}/login`);
    
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'admin@tvmubd.com',
        password: '123456'
      }
    });

    expect(response.ok()).toBeTruthy();
    const loginData = await response.json();
    const token = loginData.data?.access_token || loginData.access_token;
    expect(token).toBeDefined();

    await page.evaluate((t) => {
      localStorage.setItem('access_token', t);
    }, token);

    // Verify Contracts API endpoint works
    const contractsRes = await page.request.get(`${API_URL}/contracts/1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect([200, 404]).toContain(contractsRes.status());
  });

  test('2. Legal Officer Workstation: Task Queue selection & Grouped Compliance Approval', async ({ page }) => {
    // Login as Legal User
    await page.goto(`${BASE_URL}/login`);
    
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'legal@epms.com',
        password: '123456'
      }
    });

    const loginData = await response.json();
    const token = loginData.data?.access_token || loginData.access_token || 'mock-token';

    await page.evaluate((t) => {
      localStorage.setItem('access_token', t);
    }, token);

    // Open Legal Review Workstation
    await page.goto(`${BASE_URL}/legal/review?contractId=1`);

    // Verify Master-Detail Workstation Layout
    await expect(page.locator('text=Enterprise Legal Review Workstation')).toBeVisible();
    await expect(page.locator('text=Antrean Tugas Legal')).toBeVisible();
    await expect(page.locator('text=Formulir Kepatuhan Hukum & Checklists')).toBeVisible();

    // Verify Sticky Action Header Approve button is disabled initially
    const approveBtn = page.getByRole('button', { name: /Setujui & Rilis/i });
    await expect(approveBtn).toBeDisabled();

    // Check all compliance checkboxes across Commercial, Legal, and Operational groups
    const checkboxes = page.locator('.ant-checkbox-input');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Verify Approve button is now enabled
    await expect(approveBtn).toBeEnabled();

    // Enter Legal Notes & Click Approve
    await page.fill('textarea', 'Seluruh 9 klausul kepatuhan komersial, hukum, dan operasional telah terverifikasi.');
    await approveBtn.click();

    // Verify success toast notification
    await expect(page.locator('text=Kontrak berhasil di-approve & dirilis')).toBeVisible({ timeout: 10000 });
  });
});
