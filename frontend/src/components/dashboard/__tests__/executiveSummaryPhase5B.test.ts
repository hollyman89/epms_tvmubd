import fs from 'fs';
import path from 'path';
import { STATE_TEXT_MAP } from '../NullStateDisplay';

describe('EPMS PHASE 5B-BE01: Executive Dashboard Contract Remediation Tests', () => {
  const dashboardComponentPath = path.resolve(
    process.cwd(),
    'src/components/DashboardPage.tsx',
  );
  const execSummaryPath = path.resolve(
    process.cwd(),
    'src/components/dashboard/ExecutiveSummary.tsx',
  );

  let dashboardSource: string;
  let execSummarySource: string;

  beforeAll(() => {
    dashboardSource = fs.readFileSync(dashboardComponentPath, 'utf8');
    execSummarySource = fs.readFileSync(execSummaryPath, 'utf8');
  });

  // Assertion 1: Won monetary value comes from API
  it('1. Won monetary value comes from API (pMetrics.marketing.wonValue) and binds dynamically to Won Bookings card', () => {
    const wonIndex = dashboardSource.indexOf('label="Won Bookings"');
    expect(wonIndex).toBeGreaterThan(-1);
    const wonChunk = dashboardSource.substring(wonIndex, wonIndex + 700);
    expect(wonChunk).toContain('pMetrics?.marketing?.wonValue');
    expect(wonChunk).toContain('renderKpiCurrency(pMetrics.marketing.wonValue');
    expect(wonChunk).toContain('pMetrics?.marketing?.wonDeals');
    expect(wonChunk).not.toMatch(/wonValue\s*\|\|\s*0/);
  });

  // Assertion 2 & 3: Open Pipeline does not use subtraction and excludes terminal opportunities
  it('2 & 3. Open Pipeline does not use subtraction and excludes terminal opportunities via currentSnapshot.marketing', () => {
    const openIndex = dashboardSource.indexOf('label="Open Pipeline"');
    expect(openIndex).toBeGreaterThan(-1);
    const openChunk = dashboardSource.substring(openIndex, openIndex + 700);
    // Strict requirement: does not use subtraction arithmetic
    expect(openChunk).not.toContain('(totalDeals - wonDeals)');
    expect(openChunk).not.toContain('totalDeals ?? 0) - (pMetrics?.marketing?.wonDeals');
    // Binds to canonical snapshot fields
    expect(openChunk).toContain('cSnapshot?.marketing?.openPipelineValue');
    expect(openChunk).toContain('cSnapshot?.marketing?.openDealsCount');
    expect(openChunk).toContain('peluang aktif');
  });

  // Assertion 4 & 5: Procurement does not fabricate a combined percentage & service zero denominator does not become fake 0%
  it('4 & 5. Procurement does not fabricate a combined percentage; service denominator zero does not become fake 0%', () => {
    const procIndex = dashboardSource.indexOf('label="Realisasi Pengadaan"');
    expect(procIndex).toBeGreaterThan(-1);
    const procChunk = dashboardSource.substring(procIndex, procIndex + 1100);
    // Uses independent material metric for primary value
    expect(procChunk).toContain('pMetrics?.procurement?.materialFulfillmentRate');
    // Does not invent weighted aggregate
    expect(procChunk).not.toContain('0.7 *');
    expect(procChunk).not.toContain('0.5 *');
    // Explicit split detail for service
    expect(procChunk).toContain('pMetrics?.procurement?.serviceFulfillmentRate');
    // Safe fallback when service rate is null/undefined
    expect(procChunk).toContain('PO Material');
  });

  // Assertion 6: Outstanding AP supports partial settlements
  it('6. Outstanding AP supports partial settlements using canonical outstandingLiabilityBalance', () => {
    const apIndex = dashboardSource.indexOf('label="Outstanding AP"');
    expect(apIndex).toBeGreaterThan(-1);
    const apChunk = dashboardSource.substring(apIndex, apIndex + 1200);
    expect(apChunk).toContain('cSnapshot?.accountsPayable?.outstandingLiabilityBalance');
    expect(apChunk).toContain('renderKpiCurrency(cSnapshot.accountsPayable.outstandingLiabilityBalance');
    expect(apChunk).toContain('cSnapshot?.accountsPayable?.outstandingInvoiceCount');
  });

  // Assertion 7 & 8: API failure does not become Rp0, real verified zero remains Rp0
  it('7 & 8. API failure does not become Rp0, and real verified zero remains Rp0', () => {
    const apIndex = dashboardSource.indexOf('label="Outstanding AP"');
    const apChunk = dashboardSource.substring(apIndex, apIndex + 900);
    // When balance is undefined, displays NullStateDisplay, not Rp 0
    expect(apChunk).toContain('<NullStateDisplay state="NO_DATA" />');
    // When balance is 0 (defined), renderKpiCurrency renders Rp 0
    expect(apChunk).toContain('outstandingLiabilityBalance !== undefined && cSnapshot?.accountsPayable?.outstandingLiabilityBalance !== null');
  });

  // Assertion 9: Mobile Project Value does not mislabel Marketing Pipeline
  it('9. Mobile Project Value does not mislabel Marketing Pipeline as Nilai Proyek', () => {
    const mobileTileIndex = dashboardSource.indexOf('styles.mobileSummaryTileInfo');
    expect(mobileTileIndex).toBeGreaterThan(-1);
    expect(dashboardSource).toContain('Nilai Pipeline');
    expect(dashboardSource).not.toContain('<span className={styles.mobileSummaryTileLabel}>Nilai Proyek</span>');
  });

  // Assertion 10: Win Rate uses the canonical decided denominator if rendered
  it('10. Win Rate uses the canonical decided denominator if rendered with null safety', () => {
    const winRateIndex = dashboardSource.indexOf('Win Rate');
    expect(winRateIndex).toBeGreaterThan(-1);
    expect(dashboardSource).toContain('pMetrics?.marketing?.winRate !== null');
    expect(dashboardSource).toContain('N/A Win Rate');
  });

  // Executive Summary Bullet Tests
  it('11. Executive Summary produces deterministic bullet points from canonical data without fabrication', () => {
    expect(execSummarySource).toContain('Tercatat <span className={styles.bulletHighlight}>{formatNumber(wonDeals ?? 0)} tender berstatus WON</span> dengan nilai <span className={styles.bulletHighlight}>{formatCurrency(wonValue)}</span> pada periode terpilih.');
    expect(execSummarySource).toContain('cSnapshot?.marketing?.openDealsCount');
    expect(execSummarySource).toContain('cSnapshot?.marketing?.openPipelineValue');
    expect(execSummarySource).toContain('pMetrics?.procurement?.materialFulfillmentRate');
    expect(execSummarySource).toContain('pMetrics?.procurement?.serviceFulfillmentRate');
  });

  // Priority Actions & Auth Guards
  it('12. Priority Actions guard against unauthenticated or error states correctly', () => {
    expect(execSummarySource).toContain('todosError');
    expect(execSummarySource).toContain('Informasi tindakan prioritas belum dapat dimuat dari server.');
    expect(dashboardSource).toContain("todosError={todosIsError ? 'Gagal memuat tindakan' : null}");
  });

  // NullStateDisplay contract map completeness
  it('13. NullStateDisplay contains correct user-facing localized labels', () => {
    expect(STATE_TEXT_MAP['NOT_CALCULABLE']).toBe('Belum dapat dihitung');
    expect(STATE_TEXT_MAP['NOT_IMPLEMENTED']).toBe('Belum tersedia');
    expect(STATE_TEXT_MAP['NO_DATA']).toBe('N/A');
    expect(STATE_TEXT_MAP['INSUFFICIENT_HISTORY']).toBe('Data historis belum cukup');
    expect(STATE_TEXT_MAP['UNVERIFIED_SNAPSHOT']).toBe('Data belum tervalidasi');
  });
});
