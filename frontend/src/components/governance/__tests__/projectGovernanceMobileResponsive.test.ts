/**
 * EPMS — CROSS-ROLE MOBILE APPROVAL / MANAGEMENT REVIEW RESPONSIVE TEST SUITE
 *
 * Verifies:
 * 1. getStageNumber canonical stage derivation across all governance roles
 * 2. Mobile responsive CSS classes in ProjectGovernanceTaskCenter.module.css
 * 3. Mobile component architecture in ProjectGovernanceTaskCenter.tsx:
 *    - Responsive modal header structure
 *    - Mobile status & tahap card (Benchmark Screen 1)
 *    - Dual-mode desktop/mobile views for RAB, WBS, and Schedule
 *    - Touch-friendly action footer (Benchmark Screen 5)
 *    - Confirmation modal responsive constraints
 *    - Zero hardcoded mock/benchmark data in production source
 */

import fs from 'fs';
import path from 'path';
import { getStageNumber } from '../ProjectGovernanceTaskCenter';

describe('EPMS — Cross-Role Mobile Approval Responsive Architecture', () => {
  describe('Canonical Stage Number Derivation across Roles', () => {
    it('correctly maps Management Review stages to 1..5 scale', () => {
      // Stage 2: Head of Operations
      expect(getStageNumber('node_hops_review', false)).toBe(2);
      // Stage 3: Procurement
      expect(getStageNumber('node_procurement_review', false)).toBe(3);
      // Stage 4: Finance
      expect(getStageNumber('node_finance_review', false)).toBe(4);
      // Stage 5: Director
      expect(getStageNumber('node_director_approval', false)).toBe(5);
      // Initial / Start / Fallback
      expect(getStageNumber('node_start', false)).toBe(1);
      expect(getStageNumber(null, false)).toBe(1);
      expect(getStageNumber(undefined, false)).toBe(1);
    });

    it('correctly maps Project Closure stages to 1..2 scale', () => {
      // Stage 1: HOO Review
      expect(getStageNumber('node_hoo_review', true)).toBe(1);
      // Stage 2: Director Approval
      expect(getStageNumber('node_director_approval', true)).toBe(2);
      expect(getStageNumber('node_closure_director_approval', true)).toBe(2);
    });
  });

  describe('CSS Module Responsive Rules Verification', () => {
    const cssPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.module.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    it('contains responsive media query breakpoint for mobile viewports (<= 768px)', () => {
      expect(cssContent).toMatch(/@media\s*\(\s*max-width:\s*768px\s*\)/);
    });

    it('contains mobile modal shell constraints preventing horizontal overflow', () => {
      expect(cssContent).toContain('max-width: calc(100vw - 16px)');
      expect(cssContent).toContain('.modalHeaderContent');
      expect(cssContent).toContain('.modalHeaderTitle');
      expect(cssContent).toContain('.modalHeaderSubtitle');
    });

    it('contains mobile status and tahap card styles', () => {
      expect(cssContent).toContain('.mobileStatusTahapCard');
      expect(cssContent).toContain('.statusTahapHeader');
      expect(cssContent).toContain('.statusTahapBody');
      expect(cssContent).toContain('.stageNumberBadge');
    });

    it('defines dual-mode visibility classes (.desktopOnlyView and .mobileOnlyView)', () => {
      expect(cssContent).toContain('.desktopOnlyView');
      expect(cssContent).toContain('.mobileOnlyView');
      // desktopOnlyView hidden on mobile
      expect(cssContent).toMatch(/\.desktopOnlyView\s*\{[^}]*display:\s*none/);
      // mobileOnlyView hidden on desktop
      expect(cssContent).toMatch(/\.mobileOnlyView\s*\{[^}]*display:\s*none/);
    });

    it('contains mobile RAB accordion and item card styles', () => {
      expect(cssContent).toContain('.mobileRabCategoryCard');
      expect(cssContent).toContain('.mobileRabCategoryHeader');
      expect(cssContent).toContain('.mobileRabExpandedContent');
      expect(cssContent).toContain('.mobileRabItemCard');
    });

    it('contains mobile generic card item styles for WBS and Schedule', () => {
      expect(cssContent).toContain('.mobileCardItem');
      expect(cssContent).toContain('.mobileCardItemHeader');
    });

    it('contains responsive modal footer classes with 44px touch targets', () => {
      expect(cssContent).toContain('.modalFooterResponsive');
      expect(cssContent).toContain('.desktopFooterRow');
      expect(cssContent).toContain('.mobileFooterLayout');
      expect(cssContent).toContain('min-height: 44px');
    });

    it('contains ROI strip responsive block classes', () => {
      expect(cssContent).toContain('.roiMetricBlock');
      expect(cssContent).toContain('.roiDivider');
      expect(cssContent).toContain('.roiFormulaBlock');
    });
  });

  describe('Component Source Responsive Implementation Verification', () => {
    const tsxPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
    const tsxContent = fs.readFileSync(tsxPath, 'utf8');

    it('renders responsive modal header with title, subtitle, and badges', () => {
      expect(tsxContent).toContain('className={styles.modalHeaderContent}');
      expect(tsxContent).toContain('className={styles.modalHeaderTitle}');
      expect(tsxContent).toContain('className={styles.modalHeaderSubtitle}');
    });

    it('renders mobile status and tahap card with canonical stage progression', () => {
      expect(tsxContent).toContain('className={styles.mobileStatusTahapCard}');
      expect(tsxContent).toContain('Tahap {stageNumber} dari');
    });

    it('wraps Cost/RAB with desktop table and mobile accordion cards', () => {
      expect(tsxContent).toContain('className={styles.desktopOnlyView}');
      expect(tsxContent).toContain('className={styles.mobileOnlyView}');
      expect(tsxContent).toContain('className={styles.mobileRabCategoryCard}');
      expect(tsxContent).toContain('className={styles.mobileRabItemCard}');
      expect(tsxContent).toContain('toggleRabCategory');
    });

    it('wraps WBS with desktop tree and mobile item cards', () => {
      expect(tsxContent).toContain('className={styles.mobileCardItem}');
      expect(tsxContent).toContain('node.weightPercentage');
    });

    it('wraps Schedule with desktop table and mobile milestone cards', () => {
      expect(tsxContent).toContain('calculateScheduleDuration');
      expect(tsxContent).toContain('task.isMilestone');
    });

    it('renders responsive footer with dual desktop and mobile layouts', () => {
      expect(tsxContent).toContain('className={styles.modalFooterResponsive}');
      expect(tsxContent).toContain('className={styles.desktopFooterRow}');
      expect(tsxContent).toContain('className={styles.mobileFooterLayout}');
    });

    it('enforces responsive maxWidth on confirmation modals', () => {
      expect(tsxContent).toContain("style={{ maxWidth: 'calc(100vw - 24px)', margin: '12px auto' }}");
    });

    it('ensures zero hardcoded benchmark mock strings in production source', () => {
      // Must not contain hardcoded specimen data from the benchmark image
      expect(tsxContent).not.toContain('PROJECT ASIANET (PR26002041)');
      expect(tsxContent).not.toContain('PERCOBAAN 3 | CONT-20261020-0005');
      expect(tsxContent).not.toContain('Rp 248.944.140');
      expect(tsxContent).not.toContain('Rp 204.642.000');
      expect(tsxContent).not.toContain('Rp 44.302.140');
      expect(tsxContent).not.toContain('21,65%');
      expect(tsxContent).not.toContain('Kabel UTP Cat6');
      expect(tsxContent).not.toContain('Patch Panel 24 Port');
      expect(tsxContent).not.toContain('Network Switch');
    });
  });
});
