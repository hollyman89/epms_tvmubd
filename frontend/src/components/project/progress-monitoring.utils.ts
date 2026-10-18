/**
 * progress-monitoring.utils.ts
 *
 * Pure presentation helpers & mathematical mappings for EPMS Progress & Monitoring + S-Curve.
 * Adheres strictly to PROJECT-EXEC-F2-F3C authoritative semantics.
 */

export interface HealthDisplay {
  label: string;
  color: string;
  dotColor: string;
}

export function getMonitoringHealthDisplay(health: string | null | undefined): HealthDisplay {
  if (!health) {
    return {
      label: 'BELUM TERSEDIA',
      color: '#94A3B8',
      dotColor: '#CBD5E1',
    };
  }

  switch (health) {
    case 'AHEAD':
      return {
        label: 'LEBIH CEPAT',
        color: '#16A34A',
        dotColor: '#22C55E',
      };
    case 'ON_PLAN':
      return {
        label: 'SESUAI RENCANA',
        color: '#2563EB',
        dotColor: '#3B82F6',
      };
    case 'BEHIND':
      return {
        label: 'TERLAMBAT',
        color: '#DC2626',
        dotColor: '#EF4444',
      };
    default:
      return {
        label: health,
        color: '#94A3B8',
        dotColor: '#CBD5E1',
      };
  }
}

export function formatPp(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'N/A';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)} pp`;
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'N/A';
  return `${val.toFixed(1)}%`;
}

export function getWorkPackageHealthDisplay(variance: number | null | undefined, epsilon = 0.05): HealthDisplay {
  if (variance === null || variance === undefined) {
    return {
      label: 'BELUM TERSEDIA',
      color: '#94A3B8',
      dotColor: '#CBD5E1',
    };
  }

  if (variance > epsilon) {
    return {
      label: 'LEBIH CEPAT',
      color: '#16A34A',
      dotColor: '#22C55E',
    };
  }
  if (variance < -epsilon) {
    return {
      label: 'TERLAMBAT',
      color: '#DC2626',
      dotColor: '#EF4444',
    };
  }
  return {
    label: 'SESUAI RENCANA',
    color: '#2563EB',
    dotColor: '#3B82F6',
  };
}

export interface CurvePoint {
  date: string;
  plannedProgress: number | null;
  actualProgress: number | null;
}

export interface SvgChartLayout {
  width: number;
  height: number;
  chartW: number;
  chartH: number;
  planPath: string;
  actualPath: string;
  actualPoints: Array<{ x: number; y: number; point: CurvePoint; index: number }>;
  tickIndices: number[];
}

export function computeSvgChartLayout(
  points: CurvePoint[],
  width = 1000,
  height = 280,
  padding = { top: 20, right: 30, bottom: 40, left: 50 }
): SvgChartLayout | null {
  if (!points || points.length === 0) return null;

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const n = points.length;

  const getX = (idx: number) => padding.left + (idx / Math.max(1, n - 1)) * chartW;
  const getY = (val: number) => padding.top + chartH - (Math.max(0, Math.min(100, val)) / 100) * chartH;

  const planCoords = points
    .map((p, i) => {
      if (p.plannedProgress === null) return null;
      return `${getX(i).toFixed(1)},${getY(p.plannedProgress).toFixed(1)}`;
    })
    .filter(Boolean);
  const planPath = planCoords.length > 0 ? `M ${planCoords.join(' L ')}` : '';

  const actualPoints: Array<{ x: number; y: number; point: CurvePoint; index: number }> = [];
  points.forEach((p, i) => {
    if (p.actualProgress !== null) {
      actualPoints.push({
        x: getX(i),
        y: getY(p.actualProgress),
        point: p,
        index: i,
      });
    }
  });

  const actualPath =
    actualPoints.length > 1
      ? `M ${actualPoints.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L ')}`
      : actualPoints.length === 1
      ? `M ${actualPoints[0].x.toFixed(1)},${actualPoints[0].y.toFixed(1)} L ${(actualPoints[0].x + 0.5).toFixed(1)},${actualPoints[0].y.toFixed(1)}`
      : '';

  const tickIndices: number[] = [];
  const maxTicks = Math.min(6, n);
  for (let k = 0; k < maxTicks; k++) {
    const idx = Math.round((k / (maxTicks - 1)) * (n - 1));
    if (!tickIndices.includes(idx)) tickIndices.push(idx);
  }

  return {
    width,
    height,
    chartW,
    chartH,
    planPath,
    actualPath,
    actualPoints,
    tickIndices,
  };
}
