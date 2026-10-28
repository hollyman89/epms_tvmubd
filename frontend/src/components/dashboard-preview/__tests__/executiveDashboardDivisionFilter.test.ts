import fs from 'fs';
import path from 'path';
import { DashboardService } from '../../../services/dashboard.service';
import { apiClient } from '../../../lib/axios';

jest.mock('../../../lib/axios');

describe('CP1: Executive Dashboard Division Filter Frontend Contract', () => {
  const previewPath = path.resolve(__dirname, '../ExecutiveDashboardPreview.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(previewPath, 'utf8');
  });

  describe('1. Division Selector UI Component Contract', () => {
    test('Must contain an interactive division select element with accessible id', () => {
      expect(content).toContain('id="executive-division-select"');
      expect(content).toContain('executive-division-select');
    });

    test('Must not contain a static hardcoded non-interactive division div', () => {
      // Must not be a plain static non-interactive text node without select or dynamic options
      expect(content).not.toMatch(/<div className=\{styles\.controlPill\}>\s*<ApartmentOutlined[^>]*\/>\s*<span>Semua Divisi<\/span>\s*<DownOutlined/);
    });

    test('Must bind selectedDivision state to the select element', () => {
      expect(content).toContain('value={selectedDivision}');
      expect(content).toContain('onChange={(e) => handleDivisionChange(e.target.value)}');
    });

    test('Must load authorized divisions from DashboardService.getAuthorizedDivisions', () => {
      expect(content).toContain('DashboardService.getAuthorizedDivisions()');
    });
  });

  describe('2. Division Error Handling & Negative Testing Protection (DF-12)', () => {
    test('Must render alert banner when divisionError is present', () => {
      expect(content).toContain('divisionErrorBanner');
      expect(content).toContain('role="alert"');
      expect(content).toContain('Kembali ke Semua Divisi');
    });

    test('Must clear error and return to ALL DIVISIONS on reset', () => {
      expect(content).toContain('handleClearDivision');
      expect(content).toContain("setSelectedDivision('ALL')");
    });
  });

  describe('3. DashboardService Division Contract Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('getExecutiveSummary should append divisionId when provided and not ALL', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          statusCode: 200,
          data: {
            meta: { division: { id: 'DIV_01', name: 'Divisi 01' } },
          },
        },
      });

      await DashboardService.getExecutiveSummary({
        period: 'YEAR_TO_DATE',
        divisionId: 'DIV_01',
      });

      expect(apiClient.get).toHaveBeenCalledWith('/dashboard/executive-summary?period=YEAR_TO_DATE&divisionId=DIV_01');
    });

    test('getExecutiveSummary should not append divisionId when undefined or ALL', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          statusCode: 200,
          data: { meta: {} },
        },
      });

      await DashboardService.getExecutiveSummary({
        period: 'YEAR_TO_DATE',
      });

      expect(apiClient.get).toHaveBeenCalledWith('/dashboard/executive-summary?period=YEAR_TO_DATE');
    });

    test('getAuthorizedDivisions should call /dashboard/divisions and return payload', async () => {
      const mockPayload = {
        availableDivisions: [{ id: 'ALL', name: 'Semua Divisi', code: 'ALL', isDefault: true }],
        subDivisionEnabled: false,
        governanceStatus: 'DIVISION ALLOCATION RULE NOT VERIFIED',
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { statusCode: 200, data: mockPayload },
      });

      const res = await DashboardService.getAuthorizedDivisions();
      expect(apiClient.get).toHaveBeenCalledWith('/dashboard/divisions');
      expect(res.availableDivisions[0].id).toBe('ALL');
      expect(res.governanceStatus).toBe('DIVISION ALLOCATION RULE NOT VERIFIED');
    });

    test('getAuthorizedDivisions should gracefully fallback on network error', async () => {
      (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      const res = await DashboardService.getAuthorizedDivisions();
      expect(res.availableDivisions[0].id).toBe('ALL');
      expect(res.governanceStatus).toBe('DIVISION ALLOCATION RULE NOT VERIFIED');
      expect(res.subDivisionEnabled).toBe(false);
    });
  });
});
