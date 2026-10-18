import {
  getMonitoringHealthDisplay,
  formatPp,
  formatPercent,
  getWorkPackageHealthDisplay,
  computeSvgChartLayout,
  CurvePoint,
} from '../progress-monitoring.utils';

describe('Progress Monitoring & S-Curve Presentation (PROJECT-EXEC-F2-F3C)', () => {
  describe('getMonitoringHealthDisplay', () => {
    it('maps AHEAD to LEBIH CEPAT with green tone', () => {
      const res = getMonitoringHealthDisplay('AHEAD');
      expect(res.label).toBe('LEBIH CEPAT');
      expect(res.color).toBe('#16A34A');
    });

    it('maps ON_PLAN to SESUAI RENCANA with blue tone', () => {
      const res = getMonitoringHealthDisplay('ON_PLAN');
      expect(res.label).toBe('SESUAI RENCANA');
      expect(res.color).toBe('#2563EB');
    });

    it('maps BEHIND to TERLAMBAT with red tone', () => {
      const res = getMonitoringHealthDisplay('BEHIND');
      expect(res.label).toBe('TERLAMBAT');
      expect(res.color).toBe('#DC2626');
    });

    it('maps null or undefined to BELUM TERSEDIA', () => {
      expect(getMonitoringHealthDisplay(null).label).toBe('BELUM TERSEDIA');
      expect(getMonitoringHealthDisplay(undefined).label).toBe('BELUM TERSEDIA');
    });

    it('does NOT emit AT RISK or WARNING', () => {
      expect(getMonitoringHealthDisplay('AHEAD').label).not.toBe('AT RISK');
      expect(getMonitoringHealthDisplay('BEHIND').label).not.toBe('WARNING');
    });
  });

  describe('formatPp and formatPercent formatting', () => {
    it('formats percentage points with explicit positive sign', () => {
      expect(formatPp(8.5)).toBe('+8.5 pp');
      expect(formatPp(0)).toBe('0.0 pp');
      expect(formatPp(-8.0)).toBe('-8.0 pp');
      expect(formatPp(null)).toBe('N/A');
      expect(formatPp(undefined)).toBe('N/A');
    });

    it('formats percentage values with truth formatting', () => {
      expect(formatPercent(43)).toBe('43.0%');
      expect(formatPercent(99.99)).toBe('100.0%');
      expect(formatPercent(0)).toBe('0.0%');
      expect(formatPercent(null)).toBe('N/A');
    });
  });

  describe('getWorkPackageHealthDisplay', () => {
    it('computes work package health from variance pp with epsilon 0.05', () => {
      expect(getWorkPackageHealthDisplay(2.5).label).toBe('LEBIH CEPAT');
      expect(getWorkPackageHealthDisplay(-3.0).label).toBe('TERLAMBAT');
      expect(getWorkPackageHealthDisplay(0.02).label).toBe('SESUAI RENCANA');
      expect(getWorkPackageHealthDisplay(-0.04).label).toBe('SESUAI RENCANA');
      expect(getWorkPackageHealthDisplay(null).label).toBe('BELUM TERSEDIA');
    });
  });

  describe('computeSvgChartLayout for deterministic S-Curve rendering', () => {
    it('returns null if points array is empty or undefined', () => {
      expect(computeSvgChartLayout([])).toBeNull();
    });

    it('computes planPath and actualPath for valid full history points', () => {
      const points: CurvePoint[] = [
        { date: '2026-10-01', plannedProgress: 0, actualProgress: 0 },
        { date: '2026-10-02', plannedProgress: 25, actualProgress: 20 },
        { date: '2026-10-03', plannedProgress: 50, actualProgress: 45 },
        { date: '2026-10-04', plannedProgress: 75, actualProgress: 70 },
        { date: '2026-10-05', plannedProgress: 100, actualProgress: 95 },
      ];

      const layout = computeSvgChartLayout(points);
      expect(layout).not.toBeNull();
      if (!layout) return;

      expect(layout.planPath).toContain('M ');
      expect(layout.planPath).toContain(' L ');
      expect(layout.actualPath).toContain('M ');
      expect(layout.actualPoints.length).toBe(5);
      expect(layout.tickIndices.length).toBeLessThanOrEqual(6);
    });

    it('handles partial actual history gracefully without interpolating fake points', () => {
      const points: CurvePoint[] = [
        { date: '2026-10-01', plannedProgress: 0, actualProgress: 0 },
        { date: '2026-10-02', plannedProgress: 50, actualProgress: 35 },
        { date: '2026-10-03', plannedProgress: 100, actualProgress: null }, // Future date
      ];

      const layout = computeSvgChartLayout(points);
      expect(layout).not.toBeNull();
      if (!layout) return;

      // Plan has all 3 points
      expect(layout.planPath.split(' L ').length).toBe(3);
      // Actual only has 2 points
      expect(layout.actualPoints.length).toBe(2);
      expect(layout.actualPath.split(' L ').length).toBe(2);
    });

    it('returns empty actualPath when no actual history is available', () => {
      const points: CurvePoint[] = [
        { date: '2026-10-01', plannedProgress: 0, actualProgress: null },
        { date: '2026-10-02', plannedProgress: 50, actualProgress: null },
        { date: '2026-10-03', plannedProgress: 100, actualProgress: null },
      ];

      const layout = computeSvgChartLayout(points);
      expect(layout).not.toBeNull();
      if (!layout) return;

      expect(layout.planPath).toBeTruthy();
      expect(layout.actualPath).toBe('');
      expect(layout.actualPoints.length).toBe(0);
    });
  });
});
