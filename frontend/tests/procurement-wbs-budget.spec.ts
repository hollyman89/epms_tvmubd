import { test, expect } from '@playwright/test';

test.describe('Procurement WBS Budget Validation E2E Flow', () => {
  test('Login as Admin, create PR exceeding WBS budget, and assert toast/error alert', async ({ page }) => {
    // 1. Login sebagai Admin
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin@tvmubd.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    // Pastikan login berhasil dan di-redirect ke Dashboard / Sales
    await page.waitForTimeout(1000);

    // 2. Navigasi ke /procurement/pr/create
    await page.goto('http://localhost:3000/procurement/pr/create');
    await page.waitForLoadState('networkidle');

    // 3. Isi Form PR dengan Nilai Melebihi Budget WBS
    // Select Project / WBS jika ada
    const projectSelect = page.locator('.ant-select').first();
    if (await projectSelect.isVisible()) {
      await projectSelect.click();
      await page.waitForTimeout(300);
      const option = page.locator('.ant-select-item-option').first();
      if (await option.isVisible()) {
        await option.click();
      }
    }

    // Input total estimated amount misal Rp 999.000.000.000 (Sangat melebihi budget)
    const amountInput = page.locator('input[id*="totalEstimatedAmount"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill('999000000000');
    }

    // Input item name & price
    const itemNameInput = page.locator('input[placeholder*="Nama"]').first();
    if (await itemNameInput.isVisible()) {
      await itemNameInput.fill('Server Supercomputer Exceeding Budget');
    }

    // 4. Klik Submit Form
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    // 5. Assert bahwa toast / alert / modal error muncul dengan teks sisa anggaran / terlampaui
    await page.waitForTimeout(1000);
    const bodyText = await page.innerText('body');
    const hasErrorAlert = bodyText.includes('Sisa anggaran') || 
                          bodyText.includes('Terlampaui') || 
                          bodyText.includes('mencukupi') ||
                          bodyText.includes('Gagal');

    expect(hasErrorAlert).toBeTruthy();
  });
});
