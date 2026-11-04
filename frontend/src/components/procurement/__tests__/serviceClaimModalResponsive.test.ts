import React from 'react';
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * EPMS — SERVICE CLAIM MODAL P2 RESPONSIVE TESTS
 *
 * Verifies responsive UI/UX architecture for ServiceClaimModal.tsx & ServiceClaimModal.module.css:
 * 1. Responsive modal width constraint and viewport safety (< 100vw).
 * 2. Dedicated CSS Module existence and coverage of required responsive classes.
 * 3. Coexistence of Desktop Table View (.desktopTableView) and Mobile Cards View (.mobileCardsView).
 * 4. Ant Design responsive grid props (xs, sm, md) on Header Context and Balance Cards.
 * 5. Ant Design responsive form columns (xs=24, sm=12, md=8) in Create/Edit mode.
 * 6. Responsive Descriptions column mapping ({ xs: 1, sm: 1, md: 2 }) in Detail and Verification views.
 * 7. Decision action groups with mobile full-width touch targets.
 * 8. Preservation of P0/P1 RBAC role gating predicates across both view presentations.
 */

describe('ServiceClaimModal P2 Responsive UI/UX Remediation Suite', () => {
  const componentPath = path.resolve(__dirname, '../ServiceClaimModal.tsx');
  const stylesheetPath = path.resolve(__dirname, '../ServiceClaimModal.module.css');

  const componentSource = fs.readFileSync(componentPath, 'utf8');
  const stylesheetSource = fs.readFileSync(stylesheetPath, 'utf8');

  describe('1. CSS Module & Stylesheet Architecture', () => {
    it('should have dedicated ServiceClaimModal.module.css with required responsive classes', () => {
      expect(fs.existsSync(stylesheetPath)).toBe(true);
      expect(stylesheetSource).toContain('.serviceClaimModal');
      expect(stylesheetSource).toContain('.modalBody');
      expect(stylesheetSource).toContain('.desktopTableView');
      expect(stylesheetSource).toContain('.mobileCardsView');
      expect(stylesheetSource).toContain('.claimCard');
      expect(stylesheetSource).toContain('.itemCard');
      expect(stylesheetSource).toContain('.totalBanner');
      expect(stylesheetSource).toContain('.modalFooterActions');
      expect(stylesheetSource).toContain('.decisionActionGroup');
    });

    it('should declare mobile media query breakpoints <= 640px and <= 380px in CSS module', () => {
      expect(stylesheetSource).toContain('@media (max-width: 640px)');
      expect(stylesheetSource).toContain('@media (max-width: 380px)');
      // Desktop table hidden on mobile, mobile cards shown
      expect(stylesheetSource).toMatch(/\.desktopTableView\s*\{\s*display:\s*none/);
      expect(stylesheetSource).toMatch(/\.mobileCardsView\s*\{\s*display:\s*flex/);
    });

    it('should enforce touch target sizes >= 38px on mobile in CSS module', () => {
      expect(stylesheetSource).toContain('min-height: 38px');
    });
  });

  describe('2. Modal Container Responsiveness', () => {
    it('should import and apply responsive styles in ServiceClaimModal.tsx', () => {
      expect(componentSource).toContain("import styles from './ServiceClaimModal.module.css'");
      expect(componentSource).toContain('className={styles.serviceClaimModal}');
      expect(componentSource).toContain("style={{ maxWidth: 'calc(100vw - 16px)'");
      expect(componentSource).toContain('className={styles.modalBody}');
    });
  });

  describe('3. Header Context & Balance Metrics Responsive Grid', () => {
    it('should use responsive grid props xs={24} sm={12} md={6} in Header Context', () => {
      expect(componentSource).toContain('<Col xs={24} sm={12} md={6} className={styles.contextCol}>');
      expect(componentSource).toContain('className={styles.headerContext}');
      expect(componentSource).toContain('className={styles.contextLabel}');
      expect(componentSource).toContain('className={styles.contextValuePo}');
    });

    it('should use responsive grid props xs={12} sm={12} md={6} in Balance Overview cards', () => {
      expect(componentSource).toContain('<Col xs={12} sm={12} md={6}>');
      expect(componentSource).toContain('className={styles.balanceOverviewGrid}');
      expect(componentSource).toContain('className={styles.metricCard}');
      expect(componentSource).toContain('className={styles.metricLabel}');
      expect(componentSource).toContain('className={styles.metricValue}');
    });
  });

  describe('4. List View: Dual Presentation (Table vs Cards)', () => {
    it('should render both desktopTableView and mobileCardsView in LIST mode', () => {
      expect(componentSource).toContain('<div className={styles.desktopTableView}>');
      expect(componentSource).toContain('<div className={styles.mobileCardsView}>');
      expect(componentSource).toContain('className={styles.claimCard}');
      expect(componentSource).toContain('className={styles.claimCardHeader}');
      expect(componentSource).toContain('className={styles.claimCardNumber}');
      expect(componentSource).toContain('className={styles.claimCardGrid}');
      expect(componentSource).toContain('className={styles.claimCardActions}');
    });

    it('should provide gated action buttons inside mobile claim cards', () => {
      // Must maintain canManageClaims, canVerifyCommercial, and canVerifyTechnical
      expect(componentSource).toContain("(claim.status === 'DRAFT' || claim.status === 'NEEDS_REVISION') && canManageClaims");
      expect(componentSource).toContain("claim.status === 'PM_VERIFIED' && canVerifyCommercial");
      expect(componentSource).toContain("claim.status === 'SUBMITTED' && canVerifyTechnical");
    });
  });

  describe('5. Create / Edit Mode: Responsive Form & Item Cards', () => {
    it('should use responsive grid props xs={24} sm={12} md={8} for form fields', () => {
      expect(componentSource).toContain('<Col xs={24} sm={12} md={8}>');
    });

    it('should enforce full width on inputs in form', () => {
      expect(componentSource).toContain("DatePicker.RangePicker style={{ width: '100%' }}");
      expect(componentSource).toContain("DatePicker style={{ width: '100%' }}");
      expect(componentSource).toContain("InputNumber\n                              min={0}\n                              step={0.1}\n                              style={{ width: '100%' }}");
    });

    it('should render mobileCardsView for draft items in Create/Edit mode', () => {
      expect(componentSource).toContain('className={styles.itemCard}');
      expect(componentSource).toContain('className={styles.itemCardTitle}');
      expect(componentSource).toContain('className={styles.itemCardGrid}');
      expect(componentSource).toContain('className={styles.itemCardInputGroup}');
      expect(componentSource).toContain('className={styles.totalBanner}');
      expect(componentSource).toContain('className={styles.modalFooterActions}');
    });
  });

  describe('6. Detail & Verification Modes: Responsive Descriptions & Actions', () => {
    it('should use responsive column prop { xs: 1, sm: 1, md: 2 } on Descriptions', () => {
      const descriptionsOccurrences = (componentSource.match(/column=\{\{ xs: 1, sm: 1, md: 2 \}\}/g) || []).length;
      expect(descriptionsOccurrences).toBeGreaterThanOrEqual(3); // Detail, Verify Commercial, Verify Technical
    });

    it('should wrap decision buttons and footer actions with responsive container classes', () => {
      expect(componentSource).toContain('className={styles.decisionActionGroup}');
      expect(componentSource).toContain('className={styles.detailActionGroup}');
    });
  });

  describe('7. P0/P1 RBAC & Safety Invariant Preservation', () => {
    it('should preserve all role predicates and zero backend mutations', () => {
      expect(componentSource).toContain("const canManageClaims = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);");
      expect(componentSource).toContain("const canVerifyCommercial = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);");
      expect(componentSource).toContain("const canVerifyTechnical = isSuperAdmin || (isProjectManager && !isPurchasingOrProcurement);");
    });
  });
});
