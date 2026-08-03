import { test, expect } from '@playwright/test';

test.describe('EPMS SIT Verification Tests (4 Fixed Critical Issues)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Login sebagai Legal Staff
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'legal@epms.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sales**');
  });

  test('TC-UX-001: Tab State Persistence on Refresh (?tab=APPROVED)', async ({ page }) => {
    // Navigasi ke halaman Legal Review
    await page.goto('http://localhost:3000/legal/review');
    await expect(page).toHaveURL(/.*legal\/review/);

    // Klik tab 'Disetujui' (APPROVED)
    const approvedTab = page.locator('.ant-tabs-tab', { hasText: 'Disetujui' });
    await expect(approvedTab).toBeVisible();
    await approvedTab.click();

    // Verifikasi URL query parameter berubah menjadi ?tab=APPROVED
    await expect(page).toHaveURL(/.*tab=APPROVED/);

    // Lakukan Reload / Refresh F5
    await page.reload();

    // Verifikasi URL & State Tab setelah refresh: Tab 'Disetujui' HARUS TETAP AKTIF
    await expect(page).toHaveURL(/.*tab=APPROVED/);
    const activeTab = page.locator('.ant-tabs-tab-active');
    await expect(activeTab).toContainText('Disetujui');
  });

  test('TC-PF-001: Tree-Shaked Bundle & Prefetch Integrity Check', async ({ page }) => {
    let has404Chunk = false;

    // Monitor network response untuk memastikan tidak ada chunk JS 404
    page.on('response', (response) => {
      if (response.url().includes('_next/static') && response.status() === 404) {
        has404Chunk = true;
      }
    });

    await page.goto('http://localhost:3000/sales');
    await page.waitForLoadState('networkidle');

    // Memastikan tidak ada 404 chunk error pada Next.js static asset
    expect(has404Chunk).toBeFalsy();

    // Mengukur Performance Navigation Timing TTI
    const loadTimeMs = await page.evaluate(() => {
      const timing = performance.timing;
      return timing.loadEventEnd - timing.navigationStart;
    });

    console.log(`Page Load Time (TTI Proxy): ${loadTimeMs}ms`);
    expect(loadTimeMs).toBeLessThan(3000); // Harus di bawah 3 detik
  });
});
