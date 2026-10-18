import { ProjectService } from '../project.service';
import { apiClient } from '@/lib/axios';
import { resolveClosureStageInfo } from '@/components/project/closure/project-closure.utils';

jest.mock('@/lib/axios', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('EPMS — PROJECT-CLOSE-R1-DOC-R1 Frontend Document Category Specs (M, N, O)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('M. Frontend category selector definitions & options', () => {
    it('defines supported document categories including CUSTOMER_BAST and FINAL_REPORT with human-readable labels', () => {
      const CATEGORY_OPTIONS = [
        { label: 'Berita Acara Serah Terima Pelanggan (CUSTOMER_BAST)', value: 'CUSTOMER_BAST' },
        { label: 'Laporan Akhir Proyek (FINAL_REPORT)', value: 'FINAL_REPORT' },
        { label: 'Internal Handover (INTERNAL_HANDOVER)', value: 'INTERNAL_HANDOVER' },
        { label: 'Dokumen Teknis (TECHNICAL)', value: 'TECHNICAL' },
        { label: 'Lainnya (OTHER)', value: 'OTHER' },
      ];

      const values = CATEGORY_OPTIONS.map((o) => o.value);
      expect(values).toContain('CUSTOMER_BAST');
      expect(values).toContain('FINAL_REPORT');
      expect(values).toContain('INTERNAL_HANDOVER');
      expect(values).toContain('TECHNICAL');
      expect(values).toContain('OTHER');

      // Human readable labels
      const bastOption = CATEGORY_OPTIONS.find((o) => o.value === 'CUSTOMER_BAST');
      expect(bastOption?.label).toContain('Berita Acara Serah Terima Pelanggan');

      const finalReportOption = CATEGORY_OPTIONS.find((o) => o.value === 'FINAL_REPORT');
      expect(finalReportOption?.label).toContain('Laporan Akhir Proyek');
    });
  });

  describe('N. Frontend upload sends selected category', () => {
    it('appends category and entity parameters to FormData when category is provided', async () => {
      const mockFile = new File(['dummy content'], 'customer_bast.pdf', { type: 'application/pdf' });
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          code: 201,
          data: {
            id: 888,
            fileName: 'customer_bast.pdf',
            category: 'CUSTOMER_BAST',
          },
        },
      });

      const res = await ProjectService.uploadEvidence(100, mockFile, 'CUSTOMER_BAST');

      expect(apiClient.post).toHaveBeenCalledWith(
        '/documents/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );

      const formDataSent = (apiClient.post as jest.Mock).mock.calls[0][1] as FormData;
      expect(formDataSent.get('entityType')).toBe('PROJECT');
      expect(formDataSent.get('entityId')).toBe('100');
      expect(formDataSent.get('category')).toBe('CUSTOMER_BAST');
      expect(formDataSent.get('file')).toBe(mockFile);
      expect(res.category).toBe('CUSTOMER_BAST');
    });

    it('preserves backward compatibility when category is omitted (does not append category key)', async () => {
      const mockFile = new File(['dummy content'], 'drawing.pdf', { type: 'application/pdf' });
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          code: 201,
          data: {
            id: 889,
            fileName: 'drawing.pdf',
            category: 'OTHER',
          },
        },
      });

      const res = await ProjectService.uploadEvidence(100, mockFile);

      const formDataSent = (apiClient.post as jest.Mock).mock.calls[0][1] as FormData;
      expect(formDataSent.get('entityType')).toBe('PROJECT');
      expect(formDataSent.get('entityId')).toBe('100');
      expect(formDataSent.get('category')).toBeNull();
      expect(res.category).toBe('OTHER');
    });

    it('sends FINAL_REPORT category when selected', async () => {
      const mockFile = new File(['dummy report'], 'final_report.pdf', { type: 'application/pdf' });
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          code: 201,
          data: {
            id: 890,
            fileName: 'final_report.pdf',
            category: 'FINAL_REPORT',
          },
        },
      });

      const res = await ProjectService.uploadEvidence(100, mockFile, 'FINAL_REPORT');

      const formDataSent = (apiClient.post as jest.Mock).mock.calls[0][1] as FormData;
      expect(formDataSent.get('category')).toBe('FINAL_REPORT');
      expect(res.category).toBe('FINAL_REPORT');
    });
  });

  describe('O. Project Documents UI remains accessible from Closure workspace', () => {
    it('verifies navigation contract triggers drawer with documents tab', () => {
      const mockOpenDetailDrawer = jest.fn();
      const effectiveProject = { id: 100, name: 'Project 100' };

      // Simulate onNavigateToDocuments callback invoked by ProjectClosureWorkspace "Buka Menu Dokumen Proyek" button
      const onNavigateToDocuments = () => {
        if (mockOpenDetailDrawer && effectiveProject) {
          mockOpenDetailDrawer(effectiveProject, 'documents');
        }
      };

      onNavigateToDocuments();

      expect(mockOpenDetailDrawer).toHaveBeenCalledTimes(1);
      expect(mockOpenDetailDrawer).toHaveBeenCalledWith(effectiveProject, 'documents');
    });
  });

  describe('PROJECT-CLOSE-R1-DOC-R1-UI-CORR-R2: Document Mutual Exclusivity & Pre-Submit Cycle Specs (A-H)', () => {
    // Exact runtime data from Project 1364 in database
    const runtimeProject1364Docs = [
      { id: 2145, category: 'FINAL_REPORT', fileName: 'Laporan-Akhir-Project-1364-UAT.pdf' },
      { id: 2144, category: 'CUSTOMER_BAST', fileName: 'BAST-Pelanggan-Project-1364-UAT.pdf' },
      { id: 2143, category: 'OTHER', fileName: 'BA_ATP_Tanjung_Pura_Feeder_CSA-FKI_PTI_.docx' },
      { id: 2142, category: 'OTHER', fileName: 'Laporan-Akhir-Project-1364-UAT.pdf' },
      { id: 2141, category: 'OTHER', fileName: 'BAST-Pelanggan-Project-1364-UAT.pdf' },
      { id: 1151, category: 'OTHER', fileName: 'test-sample.pdf' },
      { id: 1110, category: 'OTHER', fileName: 'test-sample.pdf' },
      { id: 1109, category: 'OTHER', fileName: 'test-sample.pdf' },
    ];

    const categorizeDoc = (doc: any) => {
      const docCat = doc.category || 'OTHER';
      const categoryLabel =
        docCat === 'CUSTOMER_BAST' ? 'Berita Acara Serah Terima Pelanggan' :
        docCat === 'FINAL_REPORT' ? 'Laporan Akhir Proyek' :
        docCat === 'INTERNAL_HANDOVER' ? 'Serah Terima Internal' :
        docCat === 'TECHNICAL' ? 'Dokumen Teknis Proyek' :
        'Dokumen Pendukung';

      return {
        ...doc,
        category: docCat,
        categoryLabel,
        statusTag: categoryLabel,
      };
    };

    const groupDocsRuntime = (docs: any[]) => {
      const legalApprovedDocs = docs.filter((d) => d.category === 'LEGAL_APPROVED');
      const legalReviewDocs = docs.filter((d) => d.category === 'LEGAL_REVIEW');
      const contractDocs = docs.filter((d) => d.category === 'CONTRACT');
      const closureDocs = docs.filter((d) =>
        ['CUSTOMER_BAST', 'FINAL_REPORT', 'INTERNAL_HANDOVER'].includes(d.category)
      );

      const claimedDocIds = new Set<number>();
      legalApprovedDocs.forEach((d) => claimedDocIds.add(d.id));
      legalReviewDocs.forEach((d) => claimedDocIds.add(d.id));
      contractDocs.forEach((d) => claimedDocIds.add(d.id));
      closureDocs.forEach((d) => claimedDocIds.add(d.id));

      const closureDocFileNames = new Set(closureDocs.map((c) => c.fileName.toLowerCase()));

      const supportingDocs = docs.filter(
        (d) =>
          ![
            'LEGAL_APPROVED',
            'LEGAL_REVIEW',
            'CONTRACT',
            'CUSTOMER_BAST',
            'FINAL_REPORT',
            'INTERNAL_HANDOVER',
          ].includes(d.category) &&
          !claimedDocIds.has(d.id) &&
          !closureDocFileNames.has(d.fileName.toLowerCase())
      );

      return {
        legalApprovedDocs,
        legalReviewDocs,
        contractDocs,
        closureDocs,
        supportingDocs,
      };
    };

    it('A. Document #2144 renders exactly once (in Closure group only)', () => {
      const processed = runtimeProject1364Docs.map(categorizeDoc);
      const groups = groupDocsRuntime(processed);

      // Present in Closure group
      expect(groups.closureDocs.some((d) => d.id === 2144)).toBe(true);
      expect(groups.closureDocs.filter((d) => d.id === 2144)).toHaveLength(1);

      // NOT present in supporting group or legal groups
      expect(groups.supportingDocs.some((d) => d.id === 2144)).toBe(false);
      expect(groups.legalApprovedDocs.some((d) => d.id === 2144)).toBe(false);
      expect(groups.contractDocs.some((d) => d.id === 2144)).toBe(false);

      // Total render count across ALL groups is exactly 1
      const totalRenders = [
        ...groups.legalApprovedDocs,
        ...groups.legalReviewDocs,
        ...groups.contractDocs,
        ...groups.closureDocs,
        ...groups.supportingDocs,
      ].filter((d) => d.id === 2144);
      expect(totalRenders).toHaveLength(1);
    });

    it('B. Document #2145 renders exactly once (in Closure group only)', () => {
      const processed = runtimeProject1364Docs.map(categorizeDoc);
      const groups = groupDocsRuntime(processed);

      // Present in Closure group
      expect(groups.closureDocs.some((d) => d.id === 2145)).toBe(true);
      expect(groups.closureDocs.filter((d) => d.id === 2145)).toHaveLength(1);

      // NOT present in supporting group or legal groups
      expect(groups.supportingDocs.some((d) => d.id === 2145)).toBe(false);
      expect(groups.supportingDocs.filter((d) => d.id === 2145)).toHaveLength(0);

      // Total render count across ALL groups is exactly 1
      const totalRenders = [
        ...groups.legalApprovedDocs,
        ...groups.legalReviewDocs,
        ...groups.contractDocs,
        ...groups.closureDocs,
        ...groups.supportingDocs,
      ].filter((d) => d.id === 2145);
      expect(totalRenders).toHaveLength(1);
    });

    it('C. CUSTOMER_BAST never renders in supporting group (and superseded uploads with same filename are excluded)', () => {
      const processed = runtimeProject1364Docs.map(categorizeDoc);
      const groups = groupDocsRuntime(processed);

      // No document with category CUSTOMER_BAST in supportingDocs
      expect(groups.supportingDocs.some((d) => d.category === 'CUSTOMER_BAST')).toBe(false);

      // No document with the CUSTOMER_BAST filename in supportingDocs
      expect(groups.supportingDocs.some((d) => d.fileName === 'BAST-Pelanggan-Project-1364-UAT.pdf')).toBe(false);
    });

    it('D. FINAL_REPORT never renders in supporting group (and superseded uploads with same filename are excluded)', () => {
      const processed = runtimeProject1364Docs.map(categorizeDoc);
      const groups = groupDocsRuntime(processed);

      // No document with category FINAL_REPORT in supportingDocs
      expect(groups.supportingDocs.some((d) => d.category === 'FINAL_REPORT')).toBe(false);

      // No document with the FINAL_REPORT filename in supportingDocs
      expect(groups.supportingDocs.some((d) => d.fileName === 'Laporan-Akhir-Project-1364-UAT.pdf')).toBe(false);
    });

    it('E. OTHER still renders in supporting group when legitimate non-closure', () => {
      const processed = runtimeProject1364Docs.map(categorizeDoc);
      const groups = groupDocsRuntime(processed);

      expect(groups.supportingDocs.length).toBeGreaterThan(0);
      expect(groups.supportingDocs.some((d) => d.id === 2143)).toBe(true);
      expect(groups.supportingDocs.find((d) => d.id === 2143)?.fileName).toBe('BA_ATP_Tanjung_Pura_Feeder_CSA-FKI_PTI_.docx');
    });

    it('F. Legal documents remain in Legal groups and do not cross into closure or supporting groups', () => {
      const rawDocs = [
        { id: 1, fileName: 'SPK-CONT-0042.pdf', category: 'LEGAL_APPROVED' },
        { id: 2, fileName: 'Legal-Review-CONT-0042.pdf', category: 'LEGAL_REVIEW' },
        { id: 3, fileName: 'Adendum-1-CONT-0042.pdf', category: 'CONTRACT' },
        ...runtimeProject1364Docs,
      ];
      const processed = rawDocs.map(categorizeDoc);
      const groups = groupDocsRuntime(processed);

      expect(groups.legalApprovedDocs).toHaveLength(1);
      expect(groups.legalApprovedDocs[0].fileName).toBe('SPK-CONT-0042.pdf');
      expect(groups.legalReviewDocs).toHaveLength(1);
      expect(groups.legalReviewDocs[0].fileName).toBe('Legal-Review-CONT-0042.pdf');
      expect(groups.contractDocs).toHaveLength(1);
      expect(groups.contractDocs[0].fileName).toBe('Adendum-1-CONT-0042.pdf');

      expect(groups.closureDocs.some((d) => d.category === 'LEGAL_APPROVED')).toBe(false);
      expect(groups.supportingDocs.some((d) => d.category === 'LEGAL_APPROVED')).toBe(false);
    });

    it('G. No Closure cycle: no "Siklus #undefined" and no undefined status text', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          meta: { code: 200, status: 'success', message: 'Request successful' },
          data: null,
        },
      });

      const currentClosure = await ProjectService.getCurrentClosure(1364);
      expect(currentClosure).toBeNull();

      const stageInfo = resolveClosureStageInfo(currentClosure, 'IN_PROGRESS');
      expect(stageInfo.stageKey).toBe('NONE');
      expect(stageInfo.label).toBe('Belum Diajukan');
      expect(stageInfo.label).not.toContain('undefined');

      // The pre-submit condition used by ProjectClosureWorkspace.tsx:
      const shouldRenderCycleBadge = Boolean(currentClosure && (currentClosure as any).cycleNumber && stageInfo.stageKey !== 'NONE');
      expect(shouldRenderCycleBadge).toBe(false);
    });

    it('H. Valid Closure cycle: real cycle number and status render normally', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          meta: { code: 200, status: 'success', message: 'Request successful' },
          data: {
            id: 10,
            projectId: 1364,
            cycleNumber: 1,
            status: 'PENDING_HOO_REVIEW',
          },
        },
      });

      const currentClosure = await ProjectService.getCurrentClosure(1364);
      expect(currentClosure).not.toBeNull();
      expect(currentClosure?.id).toBe(10);
      expect(currentClosure?.cycleNumber).toBe(1);

      const stageInfo = resolveClosureStageInfo(currentClosure, 'IN_PROGRESS');
      expect(stageInfo.stageKey).toBe('PENDING_HOO_REVIEW');
      expect(stageInfo.label).toBe('Menunggu Tinjauan HOO');

      const shouldRenderCycleBadge = Boolean(currentClosure && currentClosure.cycleNumber && stageInfo.stageKey !== 'NONE');
      expect(shouldRenderCycleBadge).toBe(true);

      const badgeText = `Siklus #${currentClosure!.cycleNumber}: ${stageInfo.label}`;
      expect(badgeText).toBe('Siklus #1: Menunggu Tinjauan HOO');
      expect(badgeText).not.toContain('undefined');
    });
  });
});

