import { CANONICAL_TYPOGRAPHY, CANONICAL_SEMANTIC_COLORS } from '@/constants/theme';
import fs from 'fs';
import path from 'path';

describe('PRE-W10 UIUX-VA-F2: Common Typography, Header & KPI Standardization', () => {
  describe('Canonical Design Tokens Foundation', () => {
    it('exports canonical typography scale conforming to VA-F2 baseline', () => {
      expect(CANONICAL_TYPOGRAPHY.pageTitle.fontSize).toBe('24px');
      expect(CANONICAL_TYPOGRAPHY.pageTitle.fontWeight).toBe(600);
      expect(CANONICAL_TYPOGRAPHY.pageTitle.lineHeight).toBe('32px');
      expect(CANONICAL_TYPOGRAPHY.pageTitle.color).toBe('#0f172a');

      expect(CANONICAL_TYPOGRAPHY.pageSubtitle.fontSize).toBe('13px');
      expect(CANONICAL_TYPOGRAPHY.pageSubtitle.fontWeight).toBe(400);
      expect(CANONICAL_TYPOGRAPHY.pageSubtitle.color).toBe('#64748b');

      expect(CANONICAL_TYPOGRAPHY.sectionTitle.fontSize).toBe('16px');
      expect(CANONICAL_TYPOGRAPHY.sectionTitle.fontWeight).toBe(600);

      expect(CANONICAL_TYPOGRAPHY.kpiLabel.fontSize).toBe('13px');
      expect(CANONICAL_TYPOGRAPHY.kpiLabel.fontWeight).toBe(500);

      expect(CANONICAL_TYPOGRAPHY.kpiValue.fontSize).toBe('22px');
      expect(CANONICAL_TYPOGRAPHY.kpiValue.fontWeight).toBe(700);
      expect(CANONICAL_TYPOGRAPHY.kpiValue.fontVariantNumeric).toBe('tabular-nums');
    });

    it('exports controlled semantic colors conforming to VA-F2 rules', () => {
      expect(CANONICAL_SEMANTIC_COLORS.primary).toBe('#1677ff');
      expect(CANONICAL_SEMANTIC_COLORS.success).toBe('#52c41a');
      expect(CANONICAL_SEMANTIC_COLORS.warning).toBe('#fa8c16');
      expect(CANONICAL_SEMANTIC_COLORS.danger).toBe('#f5222d');
      expect(CANONICAL_SEMANTIC_COLORS.neutral).toBe('#64748b');
      expect(CANONICAL_SEMANTIC_COLORS.neutralDark).toBe('#0f172a');
    });
  });

  describe('Project Delivery Color Noise Elimination', () => {
    it('verifies absence of decorative linear-gradient on Project Delivery page title', () => {
      const projectDeliveryPagePath = path.resolve(
        process.cwd(),
        'src/app/(dashboard)/project-delivery/page.tsx'
      );
      const content = fs.readFileSync(projectDeliveryPagePath, 'utf8');

      expect(content).not.toContain('linear-gradient');
      expect(content).toContain("fontSize: '24px'");
      expect(content).toContain('fontWeight: 600');
      expect(content).toContain("lineHeight: '32px'");
      expect(content).toContain("color: '#0f172a'");
    });

    it('verifies Project Delivery Kickoff button uses canonical primary blue, not purple', () => {
      const projectOpTabPath = path.resolve(
        process.cwd(),
        'src/components/ProjectOperationTab.tsx'
      );
      const content = fs.readFileSync(projectOpTabPath, 'utf8');

      // Purples #7c3aed and #722ed1 should be completely absent
      expect(content).not.toContain('#7c3aed');
      expect(content).not.toContain('#722ed1');

      // Kickoff button should use canonical #1677ff
      expect(content).toContain("backgroundColor: '#1677ff'");
    });

    it('verifies Project Delivery preserves status meanings without semantic drift', () => {
      const projectOpTabPath = path.resolve(
        process.cwd(),
        'src/components/ProjectOperationTab.tsx'
      );
      const content = fs.readFileSync(projectOpTabPath, 'utf8');

      // Status labels remain unchanged
      expect(content).toContain('MENUNGGU KICKOFF PM');
      expect(content).toContain('PERLU REVISI PM');
      expect(content).toContain('REVIEW HEAD OF OPS');
      expect(content).toContain('REVIEW PROCUREMENT');
      expect(content).toContain('REVIEW FINANCE');
      expect(content).toContain('REVIEW DIRECTOR');
    });
  });

  describe('Reports Page Normalization', () => {
    it('verifies reports title has been normalized from 30px/800 to canonical 24px/600', () => {
      const reportsPagePath = path.resolve(
        process.cwd(),
        'src/app/(dashboard)/reports/page.tsx'
      );
      const content = fs.readFileSync(reportsPagePath, 'utf8');

      expect(content).toContain("fontSize: '24px'");
      expect(content).toContain('fontWeight: 600');
      expect(content).toContain("lineHeight: '32px'");
      expect(content).toContain("color: '#0f172a'");
      expect(content).toContain("fontSize: '13px'");
    });
  });
});
