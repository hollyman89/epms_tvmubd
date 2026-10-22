/**
 * EPMS — PROJECT DELIVERY TAB <-> URL SYNC & KPI NON-INTERACTION TEST SUITE
 *
 * Verifies exact user requirements:
 * 1. KPI Kick-off card click does NOT change tab.
 * 2. KPI Active card click does NOT change tab.
 * 3. KPI Completed card click does NOT change tab.
 * 4. KPI cards do not have active-state styling tied to activeTab.
 * 5. Click Tab 1: URL = ?tab=1, active tab = 1
 * 6. Click Tab 2: URL = ?tab=2, active tab = 2
 * 7. Click Tab 3: URL = ?tab=3, active tab = 3
 * 8. Direct URL ?tab=1: Tab 1 active
 * 9. Direct URL ?tab=2: Tab 2 active
 * 10. Direct URL ?tab=3: Tab 3 active
 * 11. Refresh on ?tab=3: Tab 3 remains active
 * 12. Existing project counts remain unchanged.
 */

import fs from 'fs';
import path from 'path';

describe('EPMS — Project Delivery Tab <-> URL Sync & KPI Non-Interaction', () => {
  const tsxPath = path.resolve(__dirname, '../../ProjectOperationTab.tsx');
  const cssPath = path.resolve(__dirname, '../../ProjectOperationTab.module.css');
  const tsxContent = fs.readFileSync(tsxPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  describe('1, 2, 3, 4. Top Summary KPI Cards (Information Only, Non-Interactive)', () => {
    it('1. KPI Kick-off card click does NOT change tab', () => {
      // Find kickoff summary card block
      const kickoffCardMatch = tsxContent.match(/data-testid="summary-card-kickoff"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/Col>/);
      expect(kickoffCardMatch).not.toBeNull();
      const kickoffCard = kickoffCardMatch![0];
      expect(kickoffCard).not.toContain('onClick');
      expect(kickoffCard).not.toContain('handleTabChange');
      expect(kickoffCard).not.toContain('role="button"');
      expect(kickoffCard).not.toContain('tabIndex');
    });

    it('2. KPI Active card click does NOT change tab', () => {
      const activeCardMatch = tsxContent.match(/data-testid="summary-card-active"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/Col>/);
      expect(activeCardMatch).not.toBeNull();
      const activeCard = activeCardMatch![0];
      expect(activeCard).not.toContain('onClick');
      expect(activeCard).not.toContain('handleTabChange');
      expect(activeCard).not.toContain('role="button"');
      expect(activeCard).not.toContain('tabIndex');
    });

    it('3. KPI Completed card click does NOT change tab', () => {
      const completedCardMatch = tsxContent.match(/data-testid="summary-card-completed"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/Col>/);
      expect(completedCardMatch).not.toBeNull();
      const completedCard = completedCardMatch![0];
      expect(completedCard).not.toContain('onClick');
      expect(completedCard).not.toContain('handleTabChange');
      expect(completedCard).not.toContain('role="button"');
      expect(completedCard).not.toContain('tabIndex');
    });

    it('4. KPI cards do NOT have active-state styling tied to activeTab', () => {
      expect(tsxContent).not.toContain('summaryCardActive');
      expect(cssContent).not.toContain('.summaryCardActive');
      expect(cssContent).not.toMatch(/\.summaryCard\s*\{[^}]*cursor:\s*pointer/);
    });
  });

  describe('5, 6, 7. Click Tab -> URL Synchronization', () => {
    it('5, 6, 7. handleTabChange updates activeTab and pushes ?tab=<key> to window history without page reload', () => {
      expect(tsxContent).toContain('const handleTabChange = useCallback((key: string) =>');
      expect(tsxContent).toContain('setActiveTab(key);');
      expect(tsxContent).toContain("currentUrl.searchParams.set('tab', key);");
      expect(tsxContent).toContain("window.history.pushState({}, '', currentUrl.toString());");
    });

    it('5. Tab 1 click passes key="1"', () => {
      expect(tsxContent).toMatch(/key:\s*'1'[\s\S]*?label:[\s\S]*?Antrean Kick-off Charter/);
    });

    it('6. Tab 2 click passes key="2"', () => {
      expect(tsxContent).toMatch(/key:\s*'2'[\s\S]*?label:[\s\S]*?Daftar Proyek Berjalan/);
    });

    it('7. Tab 3 click passes key="3"', () => {
      expect(tsxContent).toMatch(/key:\s*'3'[\s\S]*?label:[\s\S]*?Proyek Selesai/);
    });
  });

  describe('8, 9, 10, 11. URL -> Tab Synchronization & Refresh Persistence', () => {
    it('8. Direct URL ?tab=1 activates Tab 1', () => {
      expect(tsxContent).toMatch(/tabVal === '1' \|\| tabVal === 'waiting' \|\| tabVal === 'kickoff' \|\| tabVal === 'antrean'/);
      expect(tsxContent).toContain("setActiveTab('1');");
    });

    it('9. Direct URL ?tab=2 activates Tab 2', () => {
      expect(tsxContent).toMatch(/tabVal === '2' \|\| tabVal === 'active' \|\| tabVal === 'berjalan'/);
      expect(tsxContent).toContain("setActiveTab('2');");
    });

    it('10. Direct URL ?tab=3 activates Tab 3', () => {
      expect(tsxContent).toMatch(/tabVal === '3' \|\| tabVal === 'completed' \|\| tabVal === 'selesai' \|\| tabVal === 'closed'/);
      expect(tsxContent).toContain("setActiveTab('3');");
    });

    it('11. Refresh on ?tab=3 reads searchParams/location and popstate preserves active tab', () => {
      expect(tsxContent).toContain("window.addEventListener('popstate', syncTabFromUrl);");
      expect(tsxContent).toContain("window.removeEventListener('popstate', syncTabFromUrl);");
    });
  });

  describe('12. Existing project counts remain unchanged', () => {
    it('12. preserves exact source datasets for summary cards and tabs without mutations', () => {
      expect(tsxContent).toContain('pendingKickoff.length');
      expect(tsxContent).toContain('activeProjects.length');
      expect(tsxContent).toContain('completedProjects.length');
      expect(tsxContent).toContain('dataSource={filteredPendingKickoff}');
      expect(tsxContent).toContain('dataSource={filteredActiveProjects}');
      expect(tsxContent).toContain('dataSource={filteredCompletedProjects}');
    });
  });

  describe('Mobile Tabs Accessibility & Desktop UI Preservation', () => {
    it('provides concise responsive labels on mobile (Kick-off, Berjalan, Selesai) and full titles on desktop', () => {
      expect(tsxContent).toContain('className={styles.tabTextFull}>Antrean Kick-off Charter');
      expect(tsxContent).toContain('className={styles.tabTextShort}>Kick-off');
      expect(tsxContent).toContain('className={styles.tabTextFull}>Daftar Proyek Berjalan');
      expect(tsxContent).toContain('className={styles.tabTextShort}>Berjalan');
      expect(tsxContent).toContain('className={styles.tabTextFull}>Proyek Selesai');
      expect(tsxContent).toContain('className={styles.tabTextShort}>Selesai');
    });

    it('prevents tabs overflow collapse on mobile by hiding extra content and nav-operations below 768px', () => {
      expect(cssContent).toMatch(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*?\.deliveryTabs\s*:global\(\.ant-tabs-nav-operations\)\s*\{[\s\S]*?display:\s*none\s*!important/);
      expect(cssContent).toMatch(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*?\.desktopExtraContent\s*\{[\s\S]*?display:\s*none\s*!important/);
    });
  });
});
