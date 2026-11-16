import fs from 'fs';
import path from 'path';

describe('KPI Reports Page Phase A Contract & Runtime Binding Verification', () => {
  const reportsPagePath = path.resolve(__dirname, '../page.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(reportsPagePath, 'utf8');
  });

  describe('1. Growth Status Binding & Obsolete momGrowthType Elimination', () => {
    test('Must bind growthStatus from backend analytics response', () => {
      expect(content).toMatch(/growthStatus:\s*analyticsData\?\.kpi\?\.growthStatus/);
    });

    test('Must not contain obsolete momGrowthType references', () => {
      expect(content).not.toContain('momGrowthType');
    });

    test('Must explicitly handle NO_PRIOR_BASELINE with factual no-comparison message', () => {
      expect(content).toContain("growthStatus === 'NO_PRIOR_BASELINE'");
      expect(content).toContain('Tidak ada pembanding periode sebelumnya');
    });

    test('Must not default missing growth status to GROWTH', () => {
      expect(content).not.toMatch(/growthStatus:\s*analyticsData\?\.kpi\?\.growthStatus\s*\?\?\s*['"]GROWTH['"]/);
    });
  });

  describe('2. Null momGrowth & MoM Percentage Rendering', () => {
    test('Null momGrowth is guarded and never coerced to 100%', () => {
      expect(content).toMatch(/kpi\.momGrowth\s*!==\s*null/);
      expect(content).not.toContain('momGrowth = 1');
      expect(content).not.toContain('100.0% Pertumbuhan MoM');
    });

    test('Dynamic growthPeriodLabel is used instead of hardcoded MoM', () => {
      expect(content).toContain("kpi.growthPeriodLabel || 'MoM'");
    });
  });

  describe('3. Win Rate Decided Outcome Formula & Label Accuracy', () => {
    test('Win Rate card renders actual decided counts and unratified tag', () => {
      expect(content).toContain('{kpi.wonDeals} Menang / {kpi.wonDeals + kpi.lostDeals} Diputus');
      expect(content).toContain('Target Belum Disahkan');
    });

    test('Must not contain misleading 0 Won / 0 Closed label pattern', () => {
      expect(content).not.toContain('0 Won / 0 Closed');
      expect(content).not.toContain('Closed)');
    });

    test('Preserves null winRate as explicit Belum ada data', () => {
      expect(content).toContain("kpi.winRate !== null ? `${safeToFixed(kpi.winRate * 100, 1)}%` : 'Belum ada data'");
      expect(content).toContain('Belum ada tender diputus (Won/Lost)');
    });
  });

  describe('4. Missing Data & Unratified Target Compliance', () => {
    test('References DEC-BI-04 for executive targets and SLAs', () => {
      expect(content).toContain('DEC-BI-04');
      expect(content).not.toContain('DEC-BI-05');
    });

    test('Missing formatIDR amounts render Belum tersedia rather than Rp 0', () => {
      expect(content).toContain("if (amount === null || amount === undefined) return 'Belum tersedia';");
    });
  });
});
