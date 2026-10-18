import {
  formatCurrency,
  formatNumber,
  formatQuantity,
  formatQuantityWithUom,
  formatDate,
  formatDateTime,
  formatPercentage,
  EMPTY_FALLBACK,
} from '../formatters';

describe('Canonical Presentation Formatters (UIUX-ROOT-03)', () => {
  describe('formatCurrency', () => {
    // 1. valid currency
    it('1. formats valid currency in canonical Rp id-ID format', () => {
      expect(formatCurrency(1500000)).toBe('Rp 1.500.000');
      expect(formatCurrency('25000000')).toBe('Rp 25.000.000');
      expect(formatCurrency(968916000)).toBe('Rp 968.916.000');
    });

    // 2. zero currency
    it('2. formats zero currency safely as Rp 0', () => {
      expect(formatCurrency(0)).toBe('Rp 0');
      expect(formatCurrency('0')).toBe('Rp 0');
    });

    // 3. null currency
    it('3. returns canonical fallback for null currency', () => {
      expect(formatCurrency(null)).toBe(EMPTY_FALLBACK);
    });

    // 4. undefined currency
    it('4. returns canonical fallback for undefined currency', () => {
      expect(formatCurrency(undefined)).toBe(EMPTY_FALLBACK);
      expect(formatCurrency('')).toBe(EMPTY_FALLBACK);
    });

    // 5. invalid numeric input safe
    it('5. returns fallback safely for invalid numeric inputs without throwing or producing Rp NaN', () => {
      expect(formatCurrency(NaN)).toBe(EMPTY_FALLBACK);
      expect(formatCurrency('not-a-number')).toBe(EMPTY_FALLBACK);
      expect(formatCurrency(null, { fallback: 'Belum ada' })).toBe('Belum ada');
    });
  });

  describe('formatDate', () => {
    // 6. valid date
    it('6. formats valid date strings as DD MMM YYYY', () => {
      expect(formatDate('2026-10-01')).toBe('01 Okt 2026');
      expect(formatDate('2026-05-15')).toBe('15 Mei 2026');
    });

    // 7. missing date
    it('7. returns canonical fallback for missing/null/undefined date', () => {
      expect(formatDate(null)).toBe(EMPTY_FALLBACK);
      expect(formatDate(undefined)).toBe(EMPTY_FALLBACK);
      expect(formatDate('')).toBe(EMPTY_FALLBACK);
      expect(formatDate('invalid-date')).toBe(EMPTY_FALLBACK);
    });

    // 9. Indonesian month label
    it('9. accurately maps all Indonesian month labels', () => {
      expect(formatDate('2026-01-10')).toContain('Jan');
      expect(formatDate('2026-02-10')).toContain('Feb');
      expect(formatDate('2026-03-10')).toContain('Mar');
      expect(formatDate('2026-04-10')).toContain('Apr');
      expect(formatDate('2026-05-10')).toContain('Mei');
      expect(formatDate('2026-06-10')).toContain('Jun');
      expect(formatDate('2026-07-10')).toContain('Jul');
      expect(formatDate('2026-08-10')).toContain('Agu');
      expect(formatDate('2026-09-10')).toContain('Sep');
      expect(formatDate('2026-10-10')).toContain('Okt');
      expect(formatDate('2026-11-10')).toContain('Nov');
      expect(formatDate('2026-12-10')).toContain('Des');
    });
  });

  describe('formatDateTime', () => {
    // 8. date-time
    it('8. formats date-time as DD MMM YYYY, HH:mm', () => {
      const dt = new Date(2026, 9, 1, 10, 30); // 1 Okt 2026, 10:30
      expect(formatDateTime(dt)).toBe('01 Okt 2026, 10:30');
      expect(formatDateTime(null)).toBe(EMPTY_FALLBACK);
    });
  });

  describe('formatQuantity & formatQuantityWithUom', () => {
    // 10. quantity + UoM
    it('10. formats quantity with UoM cleanly without raw null or undefined', () => {
      expect(formatQuantityWithUom(6000, 'Meter')).toBe('6.000 Meter');
      expect(formatQuantityWithUom(2, 'Unit')).toBe('2 Unit');
      expect(formatQuantityWithUom(100, 'PCS')).toBe('100 PCS');
      expect(formatQuantityWithUom(15.5, 'Kg')).toBe('15,5 Kg');
    });

    // 11. missing quantity safe
    it('11. returns fallback safely when quantity is null/undefined/missing', () => {
      expect(formatQuantityWithUom(null, 'Meter')).toBe(EMPTY_FALLBACK);
      expect(formatQuantityWithUom(undefined, 'Unit')).toBe(EMPTY_FALLBACK);
      expect(formatQuantityWithUom(NaN, 'Unit')).toBe(EMPTY_FALLBACK);
      expect(formatQuantityWithUom(10, null)).toBe('10');
      expect(formatQuantityWithUom(10, undefined, { defaultUom: 'Unit' })).toBe('10 Unit');
    });
  });

  describe('formatPercentage', () => {
    // 12. percentage precision
    it('12. formats percentages with deterministic precision and exact calculation preserved', () => {
      expect(formatPercentage(15)).toBe('15%');
      expect(formatPercentage(17.5)).toBe('17,5%');
      expect(formatPercentage(100)).toBe('100%');
      expect(formatPercentage(49.76)).toBe('49,76%');
      expect(formatPercentage(92.4, { decimals: 1 })).toBe('92,4%');
      expect(formatPercentage(78.8, { decimals: 1 })).toBe('78,8%');
      expect(formatPercentage(-5.2, { decimals: 1 })).toBe('-5,2%');
      expect(`+${formatPercentage(43.8, { decimals: 1 })}`).toBe('+43,8%');
      expect(formatPercentage(null)).toBe(EMPTY_FALLBACK);
      expect(formatPercentage(undefined)).toBe(EMPTY_FALLBACK);
      expect(formatPercentage(NaN)).toBe(EMPTY_FALLBACK);
      expect(formatPercentage('invalid-percentage')).toBe(EMPTY_FALLBACK);
    });
  });

  describe('formatNumber', () => {
    it('formats plain numbers in id-ID locale', () => {
      expect(formatNumber(1500000)).toBe('1.500.000');
      expect(formatNumber(968916000)).toBe('968.916.000');
      expect(formatNumber(1234.56, { decimals: 2 })).toBe('1.234,56');
      expect(formatNumber(null)).toBe(EMPTY_FALLBACK);
    });
  });
});
