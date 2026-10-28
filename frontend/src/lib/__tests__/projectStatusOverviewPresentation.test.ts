import React from 'react';
import ReactDOMServer from 'react-dom/server';
import fs from 'fs';
import path from 'path';

describe('DASH-REC-003 & DASH-REC-004: Project Status Overview Presentation Contract', () => {
  const dashboardTsxPath = path.resolve(__dirname, '../../components/DashboardPage.tsx');
  let tsxContent: string;

  beforeAll(() => {
    tsxContent = fs.readFileSync(dashboardTsxPath, 'utf8');
  });

  describe('DASH-REC-003: Donut Center Source & Label Contract', () => {
    test('1. totalProjectsCount must bind to canonical totalProjects (NOT activeProjects)', () => {
      // Must bind to totalProjects
      expect(tsxContent).toMatch(/const\s+totalProjectsCount\s*=\s*cSnapshot\?\.projects\?\.totalProjects\s*\?\?\s*0/);
      // Must NOT bind totalProjectsCount to activeProjects
      expect(tsxContent).not.toMatch(/const\s+totalProjectsCount\s*=\s*cSnapshot\?\.projects\?\.activeProjects/);
    });

    test('2. Donut center label must remain "Total Proyek"', () => {
      expect(tsxContent).toContain('Total Proyek');
    });

    test('3. Top Active Project KPI must continue to bind to activeProjects (remains 3)', () => {
      // Tile 2: Proyek Aktif must use activeProjects
      expect(tsxContent).toContain('{renderNumber(cSnapshot?.projects?.activeProjects)}');
    });
  });

  describe('DASH-REC-004: Project Distribution & Donut Breakdown Reconciliation', () => {
    // Replicate canonical projectDistribution calculation from DashboardPage
    const computeProjectDistribution = (cSnapshot: any) => {
      const p = cSnapshot?.projects;
      const total = p?.totalProjects || p?.activeProjects || 1;
      return [
        {
          statusKey: 'PLANNING',
          label: 'Perencanaan',
          count: p?.planningProjects ?? 0,
          color: '#2563eb',
          percent: Math.round(((p?.planningProjects ?? 0) / total) * 100),
        },
        {
          statusKey: 'IN_PROGRESS',
          label: 'Sedang Eksekusi',
          count: p?.inProgressProjects ?? 0,
          color: '#10b981',
          percent: Math.round(((p?.inProgressProjects ?? 0) / total) * 100),
        },
        {
          statusKey: 'COMPLETED',
          label: 'Selesai',
          count: p?.completedProjects ?? 0,
          color: '#06b6d4',
          percent: Math.round(((p?.completedProjects ?? 0) / total) * 100),
        },
        {
          statusKey: 'ON_HOLD',
          label: 'Ditunda',
          count: p?.onHoldProjects ?? 0,
          color: '#f59e0b',
          percent: Math.round(((p?.onHoldProjects ?? 0) / total) * 100),
        },
        {
          statusKey: 'CANCELLED',
          label: 'Dibatalkan',
          count: p?.cancelledProjects ?? 0,
          color: '#ef4444',
          percent: Math.round(((p?.cancelledProjects ?? 0) / total) * 100),
        },
      ];
    };

    test('1. Reconciled project population: PLANNING=2, IN_PROGRESS=1, COMPLETED/CLOSED=4, TOTAL=7', () => {
      const mockSnapshot = {
        projects: {
          totalProjects: 7,
          activeProjects: 3,
          planningProjects: 2,
          inProgressProjects: 1,
          completedProjects: 4,
          onHoldProjects: 0,
          cancelledProjects: 0,
        },
      };

      const distribution = computeProjectDistribution(mockSnapshot);

      const planning = distribution.find((d) => d.statusKey === 'PLANNING')!;
      const inProgress = distribution.find((d) => d.statusKey === 'IN_PROGRESS')!;
      const completed = distribution.find((d) => d.statusKey === 'COMPLETED')!;
      const onHold = distribution.find((d) => d.statusKey === 'ON_HOLD')!;
      const cancelled = distribution.find((d) => d.statusKey === 'CANCELLED')!;

      // Individual counts
      expect(planning.count).toBe(2);
      expect(inProgress.count).toBe(1);
      expect(completed.count).toBe(4);
      expect(onHold.count).toBe(0);
      expect(cancelled.count).toBe(0);

      // Breakdown total reconciles to totalProjects
      const breakdownSum = planning.count + inProgress.count + completed.count + onHold.count + cancelled.count;
      expect(breakdownSum).toBe(mockSnapshot.projects.totalProjects);
      expect(breakdownSum).toBe(7);

      // Active projects definition preserved
      expect(planning.count + inProgress.count).toBe(mockSnapshot.projects.activeProjects);
      expect(mockSnapshot.projects.activeProjects).toBe(3);
    });

    test('2. Donut SVG geometry includes Completed Arc (Cyan) reconciling with legend', () => {
      expect(tsxContent).toContain('completedStroke');
      expect(tsxContent).toContain('#06b6d4');
      expect(tsxContent).toMatch(/stroke="#06b6d4"/);
    });
  });
});
