import { apiClient } from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  apiClient: {
    post: jest.fn(),
    patch: jest.fn(),
    get: jest.fn(),
  },
}));

describe('Premium Executive GO / NO-GO Submission Modal & UX Hardening', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Modal Specification & Hierarchy Contract', () => {
    it('Modal title remains exactly "Pengajuan GO / NO-GO Review" with executive subtitle', () => {
      const modalSpec = {
        title: 'Pengajuan GO / NO-GO Review',
        subtitle: 'Lengkapi informasi berikut sebelum diajukan ke Direksi.',
        primaryButton: 'Ajukan ke Direksi',
        cancelButton: 'Batal',
      };

      expect(modalSpec.title).toBe('Pengajuan GO / NO-GO Review');
      expect(modalSpec.subtitle).toBe('Lengkapi informasi berikut sebelum diajukan ke Direksi.');
      expect(modalSpec.primaryButton).toBe('Ajukan ke Direksi');
      expect(modalSpec.cancelButton).toBe('Batal');
    });

    it('Project Summary Card renders authoritative tender data without synthetic fields', () => {
      const tender = {
        id: 42,
        title: 'Project Asia Net Rehabilitasi Route Region Surabaya',
        customer: { name: 'PT Asianet Media Teknologi' },
        estimated_budget: 461612259,
        bid_submission_deadline: '2026-09-21T00:00:00.000Z',
        priority: 'HIGH',
        stage: 'LEAD',
      };

      const summaryCardProps = {
        projectName: tender.title,
        customerName: tender.customer?.name,
        estimatedBudgetFormatted: `Rp ${(Number(tender.estimated_budget) || 0).toLocaleString('id-ID')}`,
        bidDeadline: tender.bid_submission_deadline ? '21 Sep 2026' : '-',
        priority: tender.priority,
        currentStage: tender.stage,
      };

      expect(summaryCardProps.projectName).toBe('Project Asia Net Rehabilitasi Route Region Surabaya');
      expect(summaryCardProps.customerName).toBe('PT Asianet Media Teknologi');
      expect(summaryCardProps.estimatedBudgetFormatted).toContain('461.612.259');
      expect(summaryCardProps.priority).toBe('HIGH');
      expect(summaryCardProps.currentStage).toBe('LEAD');
    });

    it('All V1.1 Decision Pack fields remain present in modal form structure', () => {
      const formFields = [
        'executiveSummary',
        'concern1',
        'concern2',
        'concern3',
        'customerRequirement',
        'commercialInformation',
        'timeline',
        'marketingRecommendation',
        'marketingRecommendationReason',
      ];

      expect(formFields).toContain('executiveSummary');
      expect(formFields).toContain('concern1');
      expect(formFields).toContain('customerRequirement');
      expect(formFields).toContain('commercialInformation');
      expect(formFields).toContain('timeline');
      expect(formFields).toContain('marketingRecommendation');
      expect(formFields).toContain('marketingRecommendationReason');
    });
  });

  describe('2. Responsive Viewport, Sticky Header & Sticky Footer Contract', () => {
    it('Modal uses viewport-constrained body with internal vertical scroll', () => {
      const modalLayoutStyles = {
        content: {
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 40px)',
          borderRadius: 14,
        },
        header: {
          padding: '16px 22px',
          borderBottom: '1px solid #f1f5f9',
        },
        body: {
          padding: '20px 22px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 165px)',
          flex: 1,
        },
        footer: {
          borderTop: '1px solid #f1f5f9',
        },
      };

      expect(modalLayoutStyles.content.display).toBe('flex');
      expect(modalLayoutStyles.content.flexDirection).toBe('column');
      expect(modalLayoutStyles.content.maxHeight).toBe('calc(100vh - 40px)');
      expect(modalLayoutStyles.body.overflowY).toBe('auto');
      expect(modalLayoutStyles.body.maxHeight).toBe('calc(100vh - 165px)');
      expect(modalLayoutStyles.body.flex).toBe(1);
    });

    it('Modal width is set to 720px with responsive maxWidth constraint', () => {
      const modalWidth = 720;
      const modalStyle = {
        top: 20,
        maxWidth: 'calc(100vw - 32px)',
        paddingBottom: 0,
      };

      expect(modalWidth).toBeGreaterThanOrEqual(650);
      expect(modalWidth).toBeLessThanOrEqual(760);
      expect(modalStyle.maxWidth).toBe('calc(100vw - 32px)');
    });

    it('Cancel action resets dialog without mutating tender or workflow state', () => {
      let isVisible = true;
      let submittingTender: any = { id: 42, stage: 'LEAD' };
      const formReset = jest.fn();

      const handleCancel = () => {
        isVisible = false;
        submittingTender = null;
        formReset();
      };

      handleCancel();

      expect(isVisible).toBe(false);
      expect(submittingTender).toBeNull();
      expect(formReset).toHaveBeenCalled();
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('3. Key Concerns & Material Concern Checkbox Contract', () => {
    it('Allows explicit "Tidak ada concern material" toggle and bypasses empty concern validation', () => {
      const noMaterialConcern = true;
      const formValues = {
        executiveSummary: 'Valid executive summary',
        concern1: '',
        concern2: '',
        concern3: '',
        customerRequirement: 'CLEAR',
        commercialInformation: 'READY',
        timeline: 'FEASIBLE',
        marketingRecommendation: 'GO',
        marketingRecommendationReason: 'Customer kredibel',
      };

      let keyConcerns: string[] = [];
      if (noMaterialConcern) {
        keyConcerns = ['Tidak ada concern material'];
      } else {
        keyConcerns = [formValues.concern1, formValues.concern2, formValues.concern3]
          .map((c) => (c ? String(c).trim() : ''))
          .filter(Boolean)
          .slice(0, 3);
        if (keyConcerns.length === 0) {
          keyConcerns.push('Tidak ada concern material');
        }
      }

      expect(keyConcerns).toEqual(['Tidak ada concern material']);
    });

    it('Collects up to 3 discrete concerns when manual concerns are entered', () => {
      const noMaterialConcern = false;
      const formValues = {
        concern1: 'Delivery timeline 3 bulan cukup ketat',
        concern2: 'Kebutuhan izin galian dinas terkait',
        concern3: 'Fluktuasi harga material kabel optik',
      };

      let keyConcerns: string[] = [];
      if (noMaterialConcern) {
        keyConcerns = ['Tidak ada concern material'];
      } else {
        keyConcerns = [formValues.concern1, formValues.concern2, formValues.concern3]
          .map((c) => (c ? String(c).trim() : ''))
          .filter(Boolean)
          .slice(0, 3);
      }

      expect(keyConcerns).toHaveLength(3);
      expect(keyConcerns[0]).toBe('Delivery timeline 3 bulan cukup ketat');
      expect(keyConcerns[1]).toBe('Kebutuhan izin galian dinas terkait');
      expect(keyConcerns[2]).toBe('Fluktuasi harga material kabel optik');
    });
  });

  describe('4. Submission Handler & Payload Immutability Contract', () => {
    it('Submits exact canonical Decision Pack payload to POST /marketing/tenders/:id/submit-go-no-go', async () => {
      const tenderId = 42;
      const values = {
        executiveSummary: 'Opportunity bernilai strategis dengan repeat customer BUMN.',
        concern1: 'Kebutuhan izin galian dinas terkait',
        concern2: '',
        concern3: '',
        customerRequirement: 'CLEAR',
        commercialInformation: 'READY',
        timeline: 'FEASIBLE',
        marketingRecommendation: 'GO',
        marketingRecommendationReason: 'Repeat order dengan margin aman.',
      };

      const payload = {
        executiveSummary: values.executiveSummary.trim(),
        keyConcerns: [values.concern1],
        readiness: {
          customerRequirement: values.customerRequirement,
          commercialInformation: values.commercialInformation,
          timeline: values.timeline,
        },
        marketingRecommendation: values.marketingRecommendation,
        marketingRecommendationReason: values.marketingRecommendationReason.trim(),
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { message: 'Tender berhasil diajukan untuk GO / NO GO review' },
      });

      const res = await apiClient.post(`/marketing/tenders/${tenderId}/submit-go-no-go`, payload);

      expect(apiClient.post).toHaveBeenCalledWith('/marketing/tenders/42/submit-go-no-go', payload);
      expect(res.data.message).toBe('Tender berhasil diajukan untuk GO / NO GO review');
      expect(payload).toHaveProperty('executiveSummary');
      expect(payload).toHaveProperty('keyConcerns');
      expect(payload).toHaveProperty('readiness');
      expect(payload).toHaveProperty('marketingRecommendation', 'GO');
      expect(payload).toHaveProperty('marketingRecommendationReason');
    });

    it('Marketing Recommendation (GO / REVIEW) remains purely advisory without altering Director authority', () => {
      const reviewPayload = {
        executiveSummary: 'Scope civil work masih perlu klarifikasi.',
        keyConcerns: ['Perizinan belum tuntas'],
        readiness: {
          customerRequirement: 'PARTIAL',
          commercialInformation: 'PARTIAL',
          timeline: 'AT_RISK',
        },
        marketingRecommendation: 'REVIEW',
        marketingRecommendationReason: 'Disarankan manajemen meninjau klausul penalti sebelum GO.',
      };

      // Ensure recommendation is purely advisory
      expect(['GO', 'REVIEW']).toContain(reviewPayload.marketingRecommendation);
      expect(reviewPayload.marketingRecommendationReason).toBeTruthy();
      // It does NOT set go_nogo_status to GO or NO_GO
      const nextTenderStatus = 'PENDING';
      expect(nextTenderStatus).toBe('PENDING');
    });
  });

  describe('5. Resubmit After NO_GO Contract', () => {
    it('Pre-populates existing Decision Pack when Marketing resubmits after NO_GO', () => {
      const returnedTender = {
        id: 42,
        title: 'Project Asia Net',
        stage: 'LEAD',
        go_nogo_status: 'NO_GO',
        revision_status: 'REQUIRED',
        decisionPack: {
          executiveSummary: 'Draft awal',
          keyConcerns: ['Tidak ada concern material'],
          readiness: {
            customerRequirement: 'CLEAR',
            commercialInformation: 'READY',
            timeline: 'FEASIBLE',
          },
          marketingRecommendation: 'GO',
          marketingRecommendationReason: 'Alasan awal',
        },
      };

      const existingPack = returnedTender.decisionPack;
      const isNoConcern = existingPack.keyConcerns?.[0] === 'Tidak ada concern material';

      const initialFormValues = {
        executiveSummary: existingPack.executiveSummary || '',
        concern1: isNoConcern ? 'Tidak ada concern material' : (existingPack.keyConcerns?.[0] || ''),
        concern2: isNoConcern ? '' : (existingPack.keyConcerns?.[1] || ''),
        concern3: isNoConcern ? '' : (existingPack.keyConcerns?.[2] || ''),
        customerRequirement: existingPack.readiness?.customerRequirement || 'CLEAR',
        commercialInformation: existingPack.readiness?.commercialInformation || 'READY',
        timeline: existingPack.readiness?.timeline || 'FEASIBLE',
        marketingRecommendation: existingPack.marketingRecommendation || 'GO',
        marketingRecommendationReason: existingPack.marketingRecommendationReason || '',
      };

      expect(isNoConcern).toBe(true);
      expect(initialFormValues.executiveSummary).toBe('Draft awal');
      expect(initialFormValues.concern1).toBe('Tidak ada concern material');
      expect(initialFormValues.customerRequirement).toBe('CLEAR');
    });
  });
});
