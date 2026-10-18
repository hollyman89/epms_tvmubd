import fs from 'fs';
import path from 'path';

describe('EPMS — MOBILE-UX-R1 Strict Benchmark Implementation Verification', () => {
  const mainLayoutPath = path.resolve(__dirname, '../../components/MainLayout.tsx');
  const notificationBellPath = path.resolve(__dirname, '../../components/NotificationBell.tsx');
  const dashboardPagePath = path.resolve(__dirname, '../../components/DashboardPage.tsx');
  const dashboardCssPath = path.resolve(__dirname, '../../components/DashboardPage.module.css');

  const mainLayoutContent = fs.readFileSync(mainLayoutPath, 'utf8');
  const notificationBellContent = fs.readFileSync(notificationBellPath, 'utf8');
  const dashboardPageContent = fs.readFileSync(dashboardPagePath, 'utf8');
  const dashboardCssContent = fs.readFileSync(dashboardCssPath, 'utf8');

  describe('Objective A: Mobile Header', () => {
    it('removes EPMS logo from mobile header while keeping hamburger on the left', () => {
      // Mobile header should not render the logo image in the top Header bar
      expect(mainLayoutContent).not.toMatch(/\{isMobile\s*&&\s*<img[^>]*epms-logo/);
      expect(mainLayoutContent).not.toMatch(/\{isMobile\s*&&\s*\(\s*<img[^>]*epms-logo/);

      // Hamburger button remains present in the left header container
      expect(mainLayoutContent).toContain('MenuOutlined');
      expect(mainLayoutContent).toContain('aria-label="Menu"');
      expect(mainLayoutContent).toContain('setDrawerOpen(true)');
    });

    it('preserves desktop EPMS logo in Sider brand header', () => {
      // Desktop sider still renders brand logo
      expect(mainLayoutContent).toContain('brandHeader');
      expect(mainLayoutContent).toContain('src="/epms-logo.png"');
    });

    it('preserves notification bell and avatar on the right of header', () => {
      expect(mainLayoutContent).toContain('<NotificationBell />');
      expect(mainLayoutContent).toContain('Avatar');
    });
  });

  describe('Objective B: Mobile Pusat Aktivitas', () => {
    it('renders a mobile sheet / Drawer with placement="bottom"', () => {
      expect(notificationBellContent).toContain('Drawer');
      expect(notificationBellContent).toContain('placement="bottom"');
    });

    it('includes a drag handle indicator, clean header, and close button in the mobile sheet', () => {
      expect(notificationBellContent).toContain('CloseOutlined');
      expect(notificationBellContent).toContain('borderRadius: 2, backgroundColor: \'#cbd5e1\'');
      expect(notificationBellContent).toContain('setOpen(false)');
    });

    it('renders clean tabs with dynamic counts for Tugas and Notifikasi', () => {
      expect(notificationBellContent).toContain('{INBOX_TABS.TODO}');
      expect(notificationBellContent).toContain('{todoCount}');
      expect(notificationBellContent).toContain('{INBOX_TABS.NOTIFICATIONS}');
      expect(notificationBellContent).toContain('{unreadNotificationCount}');
    });

    it('removes the extra floating green badge from popover title', () => {
      // Ensure popover title does not have the extra green badge
      expect(notificationBellContent).not.toMatch(/INBOX_PAGE_CONFIG\.TITLE\}<\/Text>\s*\{unreadNotificationCount\s*>\s*0\s*&&\s*<Badge/);
    });

    it('renders mobile cards with badges, metadata context, and navigation chevrons', () => {
      expect(notificationBellContent).toContain('renderMobileTodoCard');
      expect(notificationBellContent).toContain('renderMobileNotificationCard');
      expect(notificationBellContent).toContain('RightOutlined');
      expect(notificationBellContent).toContain('FileTextOutlined');
      expect(notificationBellContent).toContain('backgroundColor: \'#fef2f2\'');
    });

    it('renders full-width bottom CTA "Lihat Semua Pusat Aktivitas"', () => {
      expect(notificationBellContent).toContain('UnorderedListOutlined');
      expect(notificationBellContent).toContain('Lihat Semua {INBOX_PAGE_CONFIG.TITLE}');
      expect(notificationBellContent).toContain('backgroundColor: \'#eff6ff\'');
    });

    it('preserves desktop Popover when not mobile', () => {
      expect(notificationBellContent).toContain('<Popover');
      expect(notificationBellContent).toContain('content={popoverContent}');
    });
  });

  describe('Objective C: Ringkasan Hari Ini', () => {
    it('removes any decorative photo, landscape, or mountain background image', () => {
      expect(dashboardPageContent).not.toMatch(/background(-image)?:\s*url\(/i);
      expect(dashboardCssContent).not.toMatch(/background(-image)?:\s*url\(/i);
      expect(dashboardCssContent).not.toContain('mountain');
      expect(dashboardCssContent).not.toContain('landscape');
    });

    it('uses clean white card presentation with subtle border and shadow', () => {
      expect(dashboardCssContent).toContain('.mobileSummaryCard');
      expect(dashboardCssContent).toContain('background-color: #ffffff');
      expect(dashboardCssContent).toContain('border: 1px solid #e2e8f0');
      expect(dashboardCssContent).toContain('border-radius: 16px');
    });

    it('displays dynamic data from existing state (no hardcoded mock values)', () => {
      expect(dashboardPageContent).toContain('Tugas Terlambat');
      expect(dashboardPageContent).toContain('{overdueTasksCount}');
      expect(dashboardPageContent).toContain('Tugas Menunggu Persetujuan Anda');
      expect(dashboardPageContent).toContain('{pendingTasksCount}');
      expect(dashboardPageContent).toContain('Proyek Aktif');
      expect(dashboardPageContent).toContain('{activeProjectsCount}');
      expect(dashboardPageContent).toContain('Nilai Proyek');
      expect(dashboardPageContent).toContain('{portfolioValueText}');
    });

    it('renders personalized time-aware greeting on mobile with semantic identity composition', () => {
      expect(dashboardPageContent).toContain('{greetingPrefix}');
      expect(dashboardPageContent).toContain('greetingIdentity.greetingName');
      expect(dashboardPageContent).toContain('greetingIdentity.greetingSecondaryTitle');
      expect(dashboardCssContent).toContain('.mobileGreeting');
    });

    it('is scoped to mobile only (< 768px) and hidden on desktop', () => {
      expect(dashboardCssContent).toContain('.mobileHeroSection {');
      expect(dashboardCssContent).toContain('display: none;');
      expect(dashboardCssContent).toContain('@media (max-width: 767px)');
      expect(dashboardCssContent).toContain('display: block;');
    });
  });

  describe('MOBILE-UX-R1B: Greeting Semantic Micro-Correction', () => {
    // Dynamic import to verify unit logic directly
    const { composeMobileGreetingIdentity, isRoleEquivalent } = require('../../components/DashboardPage');

    it('CASE 1: fullName = "Budi Santoso", role/title = "DIRECTOR" shows name once and title once (never "Director, Direktur")', () => {
      const res = composeMobileGreetingIdentity({
        fullName: 'Budi Santoso',
        roles: ['DIRECTOR'],
      });
      expect(res.greetingName).toBe('Budi Santoso');
      expect(res.greetingSecondaryTitle).toBe('Direktur');
      expect(res.greetingName).not.toBe(res.greetingSecondaryTitle);
    });

    it('CASE 2: name exists but title is absent renders name correctly with null secondary', () => {
      const res = composeMobileGreetingIdentity({
        fullName: 'Budi Santoso',
        roles: [],
      });
      expect(res.greetingName).toBe('Budi Santoso');
      expect(res.greetingSecondaryTitle).toBeNull();
    });

    it('CASE 3: only role available renders valid non-duplicated fallback (no duplicate role/title)', () => {
      // 3a: only role in roles array
      const resRoleOnly = composeMobileGreetingIdentity({
        roles: ['DIRECTOR'],
      });
      expect(resRoleOnly.greetingName).toBe('Direktur');
      expect(resRoleOnly.greetingSecondaryTitle).toBeNull();

      // 3b: name is literally the role (e.g. name = "Director", roles = ["DIRECTOR"])
      const resNameEqualsRole = composeMobileGreetingIdentity({
        name: 'Director',
        roles: ['DIRECTOR'],
      });
      expect(resNameEqualsRole.greetingName).toBe('Direktur');
      expect(resNameEqualsRole.greetingSecondaryTitle).toBeNull();

      // 3c: email prefix is literally role (e.g. director@epms.com)
      const resEmailRole = composeMobileGreetingIdentity({
        email: 'director@epms.com',
        roles: ['DIRECTOR'],
      });
      expect(resEmailRole.greetingName).toBe('Direktur');
      expect(resEmailRole.greetingSecondaryTitle).toBeNull();
    });

    it('CASE 4: no identity field provides safe neutral rendering without undefined or null strings', () => {
      const resEmpty = composeMobileGreetingIdentity({});
      expect(resEmpty.greetingName).toBe('User');
      expect(resEmpty.greetingSecondaryTitle).toBeNull();

      const resNull = composeMobileGreetingIdentity(null);
      expect(resNull.greetingName).toBe('User');
      expect(resNull.greetingSecondaryTitle).toBeNull();
    });

    it('CASE 5: existing Dashboard and mobile benchmark behavior remains unchanged', () => {
      expect(dashboardPageContent).toContain('mobileHeroSection');
      expect(dashboardPageContent).toContain('Ringkasan Hari Ini');
      expect(dashboardCssContent).toContain('.mobileSummaryCard');
    });
  });
});
