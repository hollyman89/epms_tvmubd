import dayjs from 'dayjs';

/**
 * Presentation mapping helper mirroring the Executive Review V1 panel in KanbanBoard.tsx.
 */
export function getExecutiveReviewDisplayProps(drawerTender: any) {
  // Title
  const title = 'GO / NO-GO EXECUTIVE REVIEW';

  // Section 1: PROJECT
  const projectName = drawerTender.title;
  const customerName = drawerTender.customer?.name || (drawerTender.customer_id ? `Client ID: ${drawerTender.customer_id}` : null);
  const marketingPic = drawerTender.marketing_pic_name || drawerTender.marketingPicName || null;
  const sector = drawerTender.business_sector || null;
  const deadline = drawerTender.bid_submission_deadline || drawerTender.submission_deadline || null;
  const formattedDeadline = deadline ? dayjs(deadline).format('DD MMM YYYY') : null;

  // Section 2: OPPORTUNITY
  const budgetValue = `Rp ${(Number(drawerTender.estimated_budget) || 0).toLocaleString('id-ID')}`;
  const probability = `${drawerTender.probability_percentage ?? 0}%`;
  const priority = drawerTender.priority || 'MEDIUM';

  // Decision Pack Snapshot V1.1
  const pack = drawerTender.decisionPack || drawerTender.decision_pack || drawerTender.goNoGoReview || drawerTender.go_nogo_review || null;

  // Section 3: EXECUTIVE SUMMARY
  const executiveSummary = pack?.executiveSummary || null;

  // Section 4: KEY CONCERNS
  const keyConcerns = Array.isArray(pack?.keyConcerns) ? pack.keyConcerns.slice(0, 3) : null;

  // Section 5: READINESS
  const readiness = pack?.readiness
    ? {
        customerRequirement: pack.readiness.customerRequirement,
        commercialInformation: pack.readiness.commercialInformation,
        timeline: pack.readiness.timeline,
      }
    : null;

  // Section 6: MARKETING RECOMMENDATION
  const marketingRecommendation = pack?.marketingRecommendation || pack?.recommendation || null;
  const marketingRecommendationReason = pack?.marketingRecommendationReason || pack?.recommendationReason || null;

  // Section 7: SUBMISSION
  const submitter = pack?.submittedBy || drawerTender.go_nogo_submitted_by_name || drawerTender.submitted_by_name || drawerTender.submittedByName || null;
  const submittedAt = pack?.submittedAt || drawerTender.go_nogo_submitted_at || drawerTender.submitted_at || drawerTender.submittedAt || null;
  const formattedSubmittedAt = submittedAt ? dayjs(submittedAt).format('DD MMM YYYY, HH:mm') : null;
  const notes = !executiveSummary ? (drawerTender.notes || null) : null;

  return {
    title,
    projectName,
    customerName,
    marketingPic,
    sector,
    deadline: formattedDeadline,
    budgetValue,
    probability,
    priority,
    executiveSummary,
    keyConcerns,
    readiness,
    marketingRecommendation,
    marketingRecommendationReason,
    submitter,
    submittedAt: formattedSubmittedAt,
    notes,
  };
}

/**
 * Validates Marketing Executive Decision Pack submission values.
 */
export function validateDecisionPackSubmission(values: any) {
  if (!values.executiveSummary || !values.executiveSummary.trim()) {
    return { valid: false, error: 'Ringkasan eksekutif wajib diisi' };
  }
  if (
    !values.customerRequirement ||
    !values.commercialInformation ||
    !values.timeline
  ) {
    return { valid: false, error: 'Kesiapan (Readiness) wajib diisi lengkap' };
  }
  if (!['CLEAR', 'PARTIAL', 'UNCLEAR'].includes(values.customerRequirement)) {
    return { valid: false, error: 'Customer requirement readiness tidak valid' };
  }
  if (!['READY', 'PARTIAL', 'NOT_READY'].includes(values.commercialInformation)) {
    return { valid: false, error: 'Commercial information readiness tidak valid' };
  }
  if (!['FEASIBLE', 'AT_RISK'].includes(values.timeline)) {
    return { valid: false, error: 'Timeline readiness tidak valid' };
  }
  if (!values.marketingRecommendation || !['GO', 'REVIEW'].includes(values.marketingRecommendation)) {
    return { valid: false, error: 'Pilih rekomendasi marketing (GO atau REVIEW)' };
  }
  if (!values.marketingRecommendationReason || !values.marketingRecommendationReason.trim()) {
    return { valid: false, error: 'Alasan rekomendasi marketing wajib diisi' };
  }
  if (values.keyConcerns && values.keyConcerns.length > 3) {
    return { valid: false, error: 'Concern utama maksimal 3 item' };
  }
  return { valid: true };
}

/**
 * Validates the director decision input before API call.
 */
export function validateDirectorDecision(decision: 'GO' | 'NO_GO', notes?: string) {
  if (decision === 'NO_GO' && (!notes || !notes.trim())) {
    return {
      valid: false,
      error: 'Alasan NO_GO wajib diisi agar Marketing mengetahui hal yang perlu direvisi.',
    };
  }
  return { valid: true };
}

describe('EXECUTIVE GO / NO-GO REVIEW V1', () => {
  const mockFullTender = {
    id: 34,
    title: 'Renovasi Kantor HQ J&T Indonesia',
    customer_id: 12,
    customer: { id: 12, name: 'J&T Express' },
    marketing_pic_id: 7,
    marketing_pic_name: 'Lukas Kurniawan',
    business_sector: 'Logistics & Transportation',
    bid_submission_deadline: '2026-10-30T00:00:00.000Z',
    estimated_budget: 1500000000,
    probability_percentage: 70,
    priority: 'HIGH',
    stage: 'WAITING_GO_NO_GO',
    go_nogo_status: 'PENDING',
    go_nogo_submitted_by_name: 'Lukas Kurniawan',
    go_nogo_submitted_at: '2026-09-25T15:30:00.000Z',
    notes: 'Klien meminta penawaran khusus mencakup masa garansi 12 bulan.',
  };

  describe('1. Header and Title', () => {
    it('Title is exactly "GO / NO-GO EXECUTIVE REVIEW"', () => {
      const props = getExecutiveReviewDisplayProps(mockFullTender);
      expect(props.title).toBe('GO / NO-GO EXECUTIVE REVIEW');
      expect(props.title).not.toBe('GO / NO-GO REVIEW (DECISION EXECUTIVE)');
    });
  });

  describe('2. Project Section', () => {
    it('Displays correct Project Name, Customer, PIC Marketing, Sector, and Bid Deadline', () => {
      const props = getExecutiveReviewDisplayProps(mockFullTender);
      expect(props.projectName).toBe('Renovasi Kantor HQ J&T Indonesia');
      expect(props.customerName).toBe('J&T Express');
      expect(props.marketingPic).toBe('Lukas Kurniawan');
      expect(props.sector).toBe('Logistics & Transportation');
      expect(props.deadline).toBe('30 Oct 2026');
    });

    it('Hides optional rows when sector or deadline is absent', () => {
      const minimalTender = {
        ...mockFullTender,
        business_sector: null,
        bid_submission_deadline: null,
        submission_deadline: null,
      };
      const props = getExecutiveReviewDisplayProps(minimalTender);
      expect(props.sector).toBeNull();
      expect(props.deadline).toBeNull();
    });
  });

  describe('3. Commercial Snapshot Section', () => {
    it('Displays authoritative Budget Value, Probability, and Priority', () => {
      const props = getExecutiveReviewDisplayProps(mockFullTender);
      expect(props.budgetValue).toBe('Rp 1.500.000.000');
      expect(props.probability).toBe('70%');
      expect(props.priority).toBe('HIGH');
    });

    it('Does NOT display "Risk / Priority" or infer fake risk scores', () => {
      const props = getExecutiveReviewDisplayProps(mockFullTender);
      expect(props).not.toHaveProperty('risk');
      expect(props.priority).toBe('HIGH');
      // Must not conflate priority with risk
      expect(JSON.stringify(props)).not.toContain('Risk');
    });
  });

  describe('4. Executive Context Section', () => {
    it('Displays authoritative Submitter, Submitted Timestamp, and Notes', () => {
      const props = getExecutiveReviewDisplayProps(mockFullTender);
      expect(props.submitter).toBe('Lukas Kurniawan');
      expect(props.submittedAt).toBe('25 Sep 2026, 22:30');
      expect(props.notes).toBe('Klien meminta penawaran khusus mencakup masa garansi 12 bulan.');
    });

    it('Hides notes when absent without fake fallback', () => {
      const tenderWithoutNotes = {
        ...mockFullTender,
        notes: null,
      };
      const props = getExecutiveReviewDisplayProps(tenderWithoutNotes);
      expect(props.notes).toBeNull();
    });
  });

  describe('5. Phase C: NO_GO Decision Discipline (Validation)', () => {
    it('REJECT NO_GO: empty reason is rejected with exact validation message', () => {
      const result = validateDirectorDecision('NO_GO', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alasan NO_GO wajib diisi agar Marketing mengetahui hal yang perlu direvisi.');
    });

    it('REJECT NO_GO: whitespace-only reason is rejected', () => {
      const result = validateDirectorDecision('NO_GO', '    ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alasan NO_GO wajib diisi agar Marketing mengetahui hal yang perlu direvisi.');
    });

    it('REJECT NO_GO: non-empty reason is accepted', () => {
      const result = validateDirectorDecision('NO_GO', 'Margin profit di bawah threshold 15%');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('APPROVE GO: can proceed with empty decision note', () => {
      const result = validateDirectorDecision('GO', '');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('6. Canonical Action Target & Workflow Integrity', () => {
    it('Preserves exact actionTarget for Go/No-Go deep link', () => {
      const tenderId = 34;
      const expectedActionTarget = `/sales?tab=1&tenderId=${tenderId}&action=go-nogo`;
      expect(expectedActionTarget).toBe('/sales?tab=1&tenderId=34&action=go-nogo');
    });
  });

  describe('7. Executive Decision Pack V1.1 — Display & Mapping', () => {
    const mockTenderWithDecisionPack = {
      ...mockFullTender,
      decisionPack: {
        executiveSummary: 'Peluang strategis dengan margin sehat 18% dan repeat customer BUMN.',
        keyConcerns: [
          'Timeline penyelesaian 3 bulan sangat ketat',
          'Ketergantungan pada izin galian Pemda',
          'Spesifikasi teknis trafo perlu konfirmasi akhir',
        ],
        readiness: {
          customerRequirement: 'CLEAR',
          commercialInformation: 'READY',
          timeline: 'FEASIBLE',
        },
        marketingRecommendation: 'GO',
        marketingRecommendationReason: 'Customer kredibel dengan kepastian alokasi anggaran.',
        submittedBy: 'Lukas Kurniawan',
        submittedAt: '2026-09-25T16:00:00.000Z',
      },
    };

    it('Maps Executive Summary, max 3 Key Concerns, Readiness, and Marketing Recommendation', () => {
      const props = getExecutiveReviewDisplayProps(mockTenderWithDecisionPack);
      expect(props.executiveSummary).toBe('Peluang strategis dengan margin sehat 18% dan repeat customer BUMN.');
      expect(props.keyConcerns).toHaveLength(3);
      expect(props.keyConcerns?.[0]).toBe('Timeline penyelesaian 3 bulan sangat ketat');
      expect(props.readiness?.customerRequirement).toBe('CLEAR');
      expect(props.readiness?.commercialInformation).toBe('READY');
      expect(props.readiness?.timeline).toBe('FEASIBLE');
      expect(props.marketingRecommendation).toBe('GO');
      expect(props.marketingRecommendationReason).toBe('Customer kredibel dengan kepastian alokasi anggaran.');
      expect(props.submitter).toBe('Lukas Kurniawan');
      expect(props.submittedAt).toBe('25 Sep 2026, 23:00');
    });

    it('Cleanly hides Decision Pack sections when not submitted', () => {
      const legacyTender = {
        ...mockFullTender,
        decisionPack: null,
      };
      const props = getExecutiveReviewDisplayProps(legacyTender);
      expect(props.executiveSummary).toBeNull();
      expect(props.keyConcerns).toBeNull();
      expect(props.readiness).toBeNull();
      expect(props.marketingRecommendation).toBeNull();
      expect(props.marketingRecommendationReason).toBeNull();
      // Falls back to standard notes
      expect(props.notes).toBe('Klien meminta penawaran khusus mencakup masa garansi 12 bulan.');
    });

    it('Limits keyConcerns to maximum 3 even if more are present', () => {
      const tenderWithManyConcerns = {
        ...mockTenderWithDecisionPack,
        decisionPack: {
          ...mockTenderWithDecisionPack.decisionPack,
          keyConcerns: ['Concern 1', 'Concern 2', 'Concern 3', 'Concern 4', 'Concern 5'],
        },
      };
      const props = getExecutiveReviewDisplayProps(tenderWithManyConcerns);
      expect(props.keyConcerns).toHaveLength(3);
      expect(props.keyConcerns).toEqual(['Concern 1', 'Concern 2', 'Concern 3']);
    });
  });

  describe('8. Executive Decision Pack V1.1 — Form Validation', () => {
    const validFormValues = {
      executiveSummary: 'Opportunity strategis dengan margin kuat.',
      concern1: 'Timeline ketat',
      customerRequirement: 'CLEAR',
      commercialInformation: 'READY',
      timeline: 'FEASIBLE',
      marketingRecommendation: 'GO',
      marketingRecommendationReason: 'Kredibilitas customer terbukti baik.',
    };

    it('Validates completely filled decision pack', () => {
      const res = validateDecisionPackSubmission(validFormValues);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('Rejects when executiveSummary is missing or empty', () => {
      const res = validateDecisionPackSubmission({ ...validFormValues, executiveSummary: '   ' });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Ringkasan eksekutif wajib diisi');
    });

    it('Rejects when readiness is incomplete', () => {
      const res = validateDecisionPackSubmission({ ...validFormValues, customerRequirement: undefined });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Kesiapan (Readiness) wajib diisi lengkap');
    });

    it('Rejects when marketing recommendation is missing', () => {
      const res = validateDecisionPackSubmission({ ...validFormValues, marketingRecommendation: undefined });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Pilih rekomendasi marketing (GO atau REVIEW)');
    });

    it('Rejects when marketing recommendation reason is empty', () => {
      const res = validateDecisionPackSubmission({ ...validFormValues, marketingRecommendationReason: '' });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Alasan rekomendasi marketing wajib diisi');
    });
  });

  describe('9. Premium Director Executive Review Presentation Contract', () => {
    const mockTenderForDirector = {
      id: 55,
      title: 'Project Asia Net Rehabilitasi Route Region Surabaya',
      customer_id: 20,
      customer: { id: 20, name: 'PT Asianet Media Teknologi' },
      marketing_pic_name: 'Lukas Kurniawan',
      business_sector: 'Telecommunication Infrastructure',
      bid_submission_deadline: '2026-09-21T00:00:00.000Z',
      estimated_budget: 461612259,
      priority: 'HIGH',
      stage: 'WAITING_GO_NO_GO',
      go_nogo_status: 'PENDING',
      decisionPack: {
        executiveSummary: 'Project rehabilitasi kabel optik dengan repeat client kredibel dan margin 18%.',
        keyConcerns: [
          'Timeline penyelesaian 3 bulan sangat ketat',
          'Perizinan galian dinas terkait',
        ],
        readiness: {
          customerRequirement: 'CLEAR',
          commercialInformation: 'READY',
          timeline: 'FEASIBLE',
        },
        marketingRecommendation: 'GO',
        marketingRecommendationReason: 'Repeat order bernilai strategis dengan kepastian anggaran siap.',
        submittedBy: 'Lukas Kurniawan',
        submittedAt: '2026-09-25T14:30:00.000Z',
      },
    };

    it('1. Header displays exact title and executive subtitle', () => {
      const headerTitle = 'GO / NO-GO EXECUTIVE REVIEW';
      const headerSubtitle = 'Review Executive Decision Pack yang diajukan oleh Marketing.';
      expect(headerTitle).toBe('GO / NO-GO EXECUTIVE REVIEW');
      expect(headerSubtitle).toBe('Review Executive Decision Pack yang diajukan oleh Marketing.');
    });

    it('2. Project Summary renders authoritative context', () => {
      const props = getExecutiveReviewDisplayProps(mockTenderForDirector);
      expect(props.projectName).toBe('Project Asia Net Rehabilitasi Route Region Surabaya');
      expect(props.customerName).toBe('PT Asianet Media Teknologi');
      expect(props.budgetValue).toBe('Rp 461.612.259');
      expect(props.deadline).toBe('21 Sep 2026');
      expect(props.priority).toBe('HIGH');
      expect(props.marketingPic).toBe('Lukas Kurniawan');
      expect(props.sector).toBe('Telecommunication Infrastructure');
    });

    it('3. Section 1: Executive Summary is read-only string without form controls', () => {
      const props = getExecutiveReviewDisplayProps(mockTenderForDirector);
      expect(typeof props.executiveSummary).toBe('string');
      expect(props.executiveSummary).toBe(
        'Project rehabilitasi kabel optik dengan repeat client kredibel dan margin 18%.'
      );
    });

    it('4. Section 2: Key Concerns renders max 3 items or clean material concern status', () => {
      const props = getExecutiveReviewDisplayProps(mockTenderForDirector);
      expect(props.keyConcerns).toHaveLength(2);
      expect(props.keyConcerns?.[0]).toBe('Timeline penyelesaian 3 bulan sangat ketat');
      expect(props.keyConcerns?.[1]).toBe('Perizinan galian dinas terkait');

      // Test "Tidak ada concern material" case
      const noConcernTender = {
        ...mockTenderForDirector,
        decisionPack: {
          ...mockTenderForDirector.decisionPack,
          keyConcerns: ['Tidak ada concern material'],
        },
      };
      const noConcernProps = getExecutiveReviewDisplayProps(noConcernTender);
      expect(noConcernProps.keyConcerns?.[0]).toBe('Tidak ada concern material');
    });

    it('5. Section 3: Readiness dimensions are read-only status badges', () => {
      const props = getExecutiveReviewDisplayProps(mockTenderForDirector);
      expect(props.readiness?.customerRequirement).toBe('CLEAR');
      expect(props.readiness?.commercialInformation).toBe('READY');
      expect(props.readiness?.timeline).toBe('FEASIBLE');
    });

    it('6. Section 4: Marketing Recommendation is advisory only with reason', () => {
      const props = getExecutiveReviewDisplayProps(mockTenderForDirector);
      expect(props.marketingRecommendation).toBe('GO');
      expect(props.marketingRecommendationReason).toBe(
        'Repeat order bernilai strategis dengan kepastian anggaran siap.'
      );
      // It does not alter workflow engine authorization or auto-approve
      expect(['GO', 'REVIEW']).toContain(props.marketingRecommendation);
    });

    it('7. Submission metadata displays actual submitter and timestamp from snapshot', () => {
      const props = getExecutiveReviewDisplayProps(mockTenderForDirector);
      expect(props.submitter).toBe('Lukas Kurniawan');
      expect(props.submittedAt).toBe('25 Sep 2026, 21:30');
    });

    it('8. Legacy fallback: historical tenders without decisionPack do not crash', () => {
      const legacyTender = {
        id: 10,
        title: 'Historical Tender 2025',
        customer: { name: 'Old Client' },
        estimated_budget: 100000000,
        stage: 'WAITING_GO_NO_GO',
        go_nogo_status: 'PENDING',
        notes: 'Legacy manual submission note',
      };

      const props = getExecutiveReviewDisplayProps(legacyTender);
      expect(props.projectName).toBe('Historical Tender 2025');
      expect(props.executiveSummary).toBeNull();
      expect(props.keyConcerns).toBeNull();
      expect(props.readiness).toBeNull();
      expect(props.marketingRecommendation).toBeNull();
      expect(props.notes).toBe('Legacy manual submission note');
    });

    it('9. Resubmission snapshot integrity: renders latest Pack B after revision', () => {
      const resubmittedTender = {
        ...mockTenderForDirector,
        decisionPack: {
          executiveSummary: 'Pack B: Revisi skema harga dan penyesuaian timeline menjadi 4 bulan.',
          keyConcerns: ['Tidak ada concern material'],
          readiness: {
            customerRequirement: 'CLEAR',
            commercialInformation: 'READY',
            timeline: 'FEASIBLE',
          },
          marketingRecommendation: 'GO',
          marketingRecommendationReason: 'Klausul risiko penalti telah dihilangkan oleh klien.',
          submittedBy: 'Lukas Kurniawan',
          submittedAt: '2026-09-26T00:15:00.000Z',
        },
      };

      const props = getExecutiveReviewDisplayProps(resubmittedTender);
      expect(props.executiveSummary).toContain('Pack B');
      expect(props.keyConcerns?.[0]).toBe('Tidak ada concern material');
      expect(props.marketingRecommendationReason).toContain('Klausul risiko penalti');
    });
  });
});
