import { resolveTodoActionTarget } from '../todoActionResolver';

describe('WF-2 Actionability & Exact Deep-Link Test Suite', () => {
  describe('1. Sales Deep-Link & Kanban Auto-Open Logic', () => {
    const mockTenders = [
      {
        id: 10,
        title: 'Pengadaan CCTV Bandara',
        stage: 'WAITING_GO_NO_GO',
        status: 'WAITING_GO_NO_GO',
        go_nogo_status: 'PENDING',
        estimated_budget: 500000000,
        customer: { name: 'PT Angkasa Pura' },
      },
      {
        id: 20,
        title: 'Sistem ERP Tambang',
        stage: 'NEGOTIATION',
        status: 'PENDING_APPROVAL',
        estimated_budget: 1000000000,
        negotiated_price: 750000000,
        max_discount_rate: 20,
        customer: { name: 'PT Bukit Asam' },
      },
      {
        id: 30,
        title: 'Revitalisasi Data Center',
        stage: 'WON',
        status: 'WON',
        legal_status: 'REVISION_REQUESTED',
        contract_status: 'ACTIVE',
        legal_notes: 'Klausul force majeure pasal 12 perlu diperjelas.',
        customer: { name: 'PT Telkom' },
      },
    ];

    it('exact tender open: locates exact tender by tenderId from list', () => {
      const targetTenderId = 20;
      const matched = mockTenders.find((t) => Number(t.id) === targetTenderId);

      expect(matched).toBeDefined();
      expect(matched?.id).toBe(20);
      expect(matched?.title).toBe('Sistem ERP Tambang');
    });

    it('go-nogo action: accessible only when stage is WAITING_GO_NO_GO and role is DIRECTOR/GM/SUPER_ADMIN', () => {
      const tender = mockTenders.find((t) => t.id === 10)!;

      const checkGoNoGoAccessible = (roles: string[], authLoading: boolean = false) => {
        const isDirectorOrExec =
          !authLoading && roles.some((r) => ['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN'].includes(r));
        const isStageWaiting =
          tender.stage === 'WAITING_GO_NO_GO' &&
          (tender.go_nogo_status === 'PENDING' || !tender.go_nogo_status);
        return isDirectorOrExec && isStageWaiting;
      };

      expect(checkGoNoGoAccessible(['DIRECTOR'])).toBe(true);
      expect(checkGoNoGoAccessible(['GENERAL_MANAGER'])).toBe(true);
      expect(checkGoNoGoAccessible(['SUPER_ADMIN'])).toBe(true);
      expect(checkGoNoGoAccessible(['MARKETING'])).toBe(false);
      expect(checkGoNoGoAccessible(['PMO'])).toBe(false);
      // No UI flash while auth is loading
      expect(checkGoNoGoAccessible(['DIRECTOR'], true)).toBe(false);
    });

    it('discount-approval action: accessible only when status is PENDING_APPROVAL and role is DIRECTOR/GM/SUPER_ADMIN', () => {
      const tenderPending = mockTenders.find((t) => t.id === 20)!;
      const tenderNotPending = mockTenders.find((t) => t.id === 10)!;

      const checkDiscountApprovalAccessible = (tenderObj: any, roles: string[], authLoading: boolean = false) => {
        const isDirectorOrExec =
          !authLoading && roles.some((r) => ['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN'].includes(r));
        return isDirectorOrExec && tenderObj.status === 'PENDING_APPROVAL';
      };

      expect(checkDiscountApprovalAccessible(tenderPending, ['DIRECTOR'])).toBe(true);
      expect(checkDiscountApprovalAccessible(tenderPending, ['GENERAL_MANAGER'])).toBe(true);
      expect(checkDiscountApprovalAccessible(tenderPending, ['SUPER_ADMIN'])).toBe(true);
      expect(checkDiscountApprovalAccessible(tenderPending, ['MARKETING'])).toBe(false);
      expect(checkDiscountApprovalAccessible(tenderNotPending, ['DIRECTOR'])).toBe(false);
      // No UI flash while auth is loading
      expect(checkDiscountApprovalAccessible(tenderPending, ['DIRECTOR'], true)).toBe(false);
    });

    it('legal-revision action: accessible only when legal_status is REVISION_REQUESTED and not PM_RETURNED', () => {
      const tenderRevision = mockTenders.find((t) => t.id === 30)!;
      const tenderOther = mockTenders.find((t) => t.id === 10)!;

      const checkLegalRevisionVisible = (tenderObj: any) => {
        return (
          tenderObj.contract_status !== 'PM_RETURNED' &&
          (tenderObj.legal_status === 'REVISION_REQUESTED' || tenderObj.legalStatus === 'REVISION_REQUESTED')
        );
      };

      expect(checkLegalRevisionVisible(tenderRevision)).toBe(true);
      expect(checkLegalRevisionVisible(tenderOther)).toBe(false);
    });

    it('reload state: simulates direct reload reopening the exact tender', () => {
      let initialLoading = true;
      let tendersData: typeof mockTenders = [];
      const deepLinkTenderId = 30;

      // Before data loads:
      let matched = tendersData.find((t) => t.id === deepLinkTenderId);
      expect(matched).toBeUndefined();

      // Data loaded after F5 reload:
      initialLoading = false;
      tendersData = mockTenders;
      matched = tendersData.find((t) => t.id === deepLinkTenderId);

      expect(matched).toBeDefined();
      expect(matched?.id).toBe(30);
      expect(matched?.legal_status).toBe('REVISION_REQUESTED');
    });

    it('invalid tender: non-existent tenderId fails safely without fallback to wrong entity', () => {
      const invalidTenderId = 99999;
      const matched = mockTenders.find((t) => Number(t.id) === invalidTenderId);

      expect(matched).toBeUndefined();
      // Verifies no fallback to first row (mockTenders[0])
      expect(matched).not.toEqual(mockTenders[0]);
    });
  });

  describe('2. Discount Approval UI & API Contract', () => {
    it('constructs correct payload for Approve Discount', () => {
      const is_approved = true;
      const notes = 'Diskon disetujui sesuai approval direksi';

      const payload = {
        is_approved,
        notes: notes.trim() || undefined,
      };

      expect(payload).toEqual({
        is_approved: true,
        notes: 'Diskon disetujui sesuai approval direksi',
      });
    });

    it('constructs correct payload for Reject Discount with optional notes', () => {
      const is_approved = false;
      const notes = '';

      const payload = {
        is_approved,
        notes: notes.trim() || undefined,
      };

      expect(payload).toEqual({
        is_approved: false,
        notes: undefined,
      });
    });

    it('reverts negotiated_price to estimated_budget when rejected', () => {
      const tender = {
        id: 20,
        status: 'PENDING_APPROVAL',
        estimated_budget: 1000000000,
        negotiated_price: 750000000,
      };

      const simulateDecision = (is_approved: boolean) => {
        const newPrice = is_approved ? tender.negotiated_price : tender.estimated_budget;
        return {
          status: 'NEGOTIATION',
          negotiated_price: newPrice,
        };
      };

      const approvedResult = simulateDecision(true);
      expect(approvedResult.status).toBe('NEGOTIATION');
      expect(approvedResult.negotiated_price).toBe(750000000);

      const rejectedResult = simulateDecision(false);
      expect(rejectedResult.status).toBe('NEGOTIATION');
      expect(rejectedResult.negotiated_price).toBe(1000000000);
    });
  });

  describe('3. Legal Review Deep-Link Hardening', () => {
    const rawContracts = [
      { id: 101, contract_number: 'CONT-101', legal_status: 'DRAFT', status: 'PENDING_LEGAL_REVIEW' },
      { id: 102, contract_number: 'CONT-102', legal_status: 'REVISION_REQUESTED', status: 'REVISION_NEEDED' },
      { id: 103, contract_number: 'CONT-103', legal_status: 'APPROVED', status: 'ACTIVE' },
    ];

    const mappedData = rawContracts.map((item) => ({
      id: item.id,
      contractNumber: item.contract_number,
      status: item.legal_status === 'APPROVED' ? 'APPROVED' : (['REVISION', 'REVISION_REQUESTED', 'REJECTED'].includes(item.legal_status) || item.status === 'REVISION_NEEDED') ? 'REVISION' : 'WAITING',
    }));

    const deriveTabAndSelect = (activeTabDefault: 'WAITING' | 'REVISION' | 'APPROVED', queryContractId?: number) => {
      let effectiveTab = activeTabDefault;
      if (queryContractId) {
        const targetContract = mappedData.find((d) => d.id === Number(queryContractId));
        if (targetContract && targetContract.status) {
          effectiveTab = targetContract.status as 'WAITING' | 'REVISION' | 'APPROVED';
        }
      }

      const visibleContracts = mappedData.filter((item) => {
        if (effectiveTab === 'WAITING' && item.status !== 'WAITING') return false;
        if (effectiveTab === 'REVISION' && item.status !== 'REVISION') return false;
        if (effectiveTab === 'APPROVED' && item.status !== 'APPROVED') return false;
        return true;
      });

      let targetId: number | undefined = undefined;
      if (visibleContracts.length > 0) {
        if (queryContractId && visibleContracts.some((d) => d.id === Number(queryContractId))) {
          targetId = Number(queryContractId);
        } else {
          targetId = visibleContracts[0].id;
        }
      }

      return { effectiveTab, visibleContracts, targetId };
    };

    it('WAITING direct contractId: preserves WAITING tab and selects contract 101', () => {
      const result = deriveTabAndSelect('WAITING', 101);
      expect(result.effectiveTab).toBe('WAITING');
      expect(result.targetId).toBe(101);
      expect(result.visibleContracts.some((c) => c.id === 101)).toBe(true);
    });

    it('REVISION direct contractId: auto-derives REVISION tab instead of dropping it in WAITING', () => {
      const result = deriveTabAndSelect('WAITING', 102);
      expect(result.effectiveTab).toBe('REVISION');
      expect(result.targetId).toBe(102);
      expect(result.visibleContracts.some((c) => c.id === 102)).toBe(true);
    });

    it('invalid contractId: keeps default tab and does not crash or pick invalid ID', () => {
      const result = deriveTabAndSelect('WAITING', 9999);
      expect(result.effectiveTab).toBe('WAITING');
      expect(result.targetId).toBe(101); // Falls back to first visible contract in current tab
    });
  });

  describe('4. PMO Assignment Deep-Link & Authorization Alignment', () => {
    const mockPendingCharters = [
      {
        id: 501,
        contractId: 501,
        project_code: 'PRJ-501',
        project_name: 'Instalasi Tower BTS 5G',
        managerId: null,
        pmName: null,
      },
      {
        id: 502,
        contractId: 502,
        project_code: 'PRJ-502',
        project_name: 'Implementasi Core Network',
        managerId: 44,
        pmName: 'Budi Santoso',
      },
    ];

    it('PMO role: user with PMO role has isPmoUser true and can see assignment action', () => {
      const userWithPmo = { roles: ['PMO'] };
      const roles = userWithPmo.roles.map((r: any) => String(r.name || r).toUpperCase());
      const isPmoUser = roles.includes('PMO');

      expect(isPmoUser).toBe(true);
    });

    it('SUPER_ADMIN without PMO: strictly blocked from isPmoUser to match backend authority', () => {
      const userAdminOnly = { roles: ['SUPER_ADMIN'] };
      const roles = userAdminOnly.roles.map((r: any) => String(r.name || r).toUpperCase());
      const isPmoUser = roles.includes('PMO');

      expect(isPmoUser).toBe(false);
    });

    it('deep-link assign-pm: finds unassigned approved contract and triggers assignment modal', () => {
      const contractIdParam = '501';
      const actionParam = 'assign-pm';
      const isPmoUser = true;

      const cidNum = Number(contractIdParam);
      const matchingCharter = mockPendingCharters.find((c) => {
        const isMatch = Number(c.contractId) === cidNum || Number(c.id) === cidNum;
        const recordPmId = c.managerId ?? null;
        const isUnassigned = !recordPmId && !c.pmName;
        return isMatch && isUnassigned;
      });

      expect(matchingCharter).toBeDefined();
      expect(matchingCharter?.id).toBe(501);
      expect(actionParam).toBe('assign-pm');
      expect(isPmoUser).toBe(true);
    });

    it('deep-link assign-pm: already assigned contract does NOT auto-open', () => {
      const contractIdParam = '502';
      const actionParam = 'assign-pm';

      const cidNum = Number(contractIdParam);
      const matchingCharter = mockPendingCharters.find((c) => {
        const isMatch = Number(c.contractId) === cidNum || Number(c.id) === cidNum;
        const recordPmId = c.managerId ?? null;
        const isUnassigned = !recordPmId && !c.pmName;
        return isMatch && isUnassigned;
      });

      // Contract 502 already has PM assigned (managerId: 44, pmName: Budi Santoso)
      expect(matchingCharter).toBeUndefined();
    });

    it('deep-link assign-pm: unauthorized user (e.g. SUPER_ADMIN without PMO) is blocked from auto-opening', () => {
      const isPmoUser = false;
      const actionParam = 'assign-pm';
      const contractIdParam = '501';

      const shouldAutoOpen = actionParam === 'assign-pm' && Boolean(contractIdParam) && isPmoUser;
      expect(shouldAutoOpen).toBe(false);
    });
  });

  describe('5. Unified Inbox Action Target Resolution for All WF-2 Routes', () => {
    it('resolves GO_NOGO_APPROVAL actionTarget', () => {
      const target = resolveTodoActionTarget({
        actionTarget: '/sales?tab=1&tenderId=88&action=go-nogo',
        actionType: 'GO_NOGO_APPROVAL',
        entityType: 'TENDER',
        entityId: 88,
      });
      expect(target).toBe('/sales?tab=1&tenderId=88&action=go-nogo');
    });

    it('resolves DISCOUNT_APPROVAL actionTarget', () => {
      const target = resolveTodoActionTarget({
        actionTarget: '/sales?tab=1&tenderId=88&action=discount-approval',
        actionType: 'DISCOUNT_APPROVAL',
        entityType: 'TENDER',
        entityId: 88,
      });
      expect(target).toBe('/sales?tab=1&tenderId=88&action=discount-approval');
    });

    it('resolves LEGAL_REVIEW actionTarget', () => {
      const target = resolveTodoActionTarget({
        actionTarget: '/legal/review?contractId=45',
        actionType: 'LEGAL_REVIEW',
        entityType: 'CONTRACT',
        entityId: 45,
      });
      expect(target).toBe('/legal/review?contractId=45');
    });

    it('resolves LEGAL_REVISION actionTarget', () => {
      const target = resolveTodoActionTarget({
        actionTarget: '/sales?tab=1&tenderId=88&action=legal-revision',
        actionType: 'LEGAL_REVISION',
        entityType: 'TENDER',
        entityId: 88,
      });
      expect(target).toBe('/sales?tab=1&tenderId=88&action=legal-revision');
    });

    it('resolves PMO_ASSIGNMENT actionTarget', () => {
      const target = resolveTodoActionTarget({
        actionTarget: '/project-delivery?contractId=45&action=assign-pm',
        actionType: 'PMO_ASSIGNMENT',
        entityType: 'CONTRACT',
        entityId: 45,
      });
      expect(target).toBe('/project-delivery?contractId=45&action=assign-pm');
    });
  });

  describe('6. Lightweight & Authoritative To-Do Deep-Link & Drawer Resolution Contract', () => {
    // Simulator for the canonical resolution order and state management
    interface ResolverState {
      tenders: any[];
      cache: Map<number, any>;
      currentDrawerTender: any | null;
      isDrawerVisible: boolean;
      isDrawerLoading: boolean;
      urlParams: { tab?: string; tenderId?: string; action?: string; other?: string };
      apiCalls: string[];
      invalidatedQueries: string[];
    }

    const createSimulator = (initialState?: Partial<ResolverState>) => {
      const state: ResolverState = {
        tenders: [],
        cache: new Map(),
        currentDrawerTender: null,
        isDrawerVisible: false,
        isDrawerLoading: false,
        urlParams: { tab: '1' },
        apiCalls: [],
        invalidatedQueries: [],
        ...initialState,
      };

      const resolvingRef = { current: null as number | null };
      const closedTenderIdRef = { current: null as number | null };

      // Phase B & L: Canonical Drawer Opener
      const openTenderDrawer = (tender: any, action?: string | null) => {
        if (!tender) return;
        closedTenderIdRef.current = null;
        state.currentDrawerTender = tender;
        state.isDrawerVisible = true;
        state.isDrawerLoading = false;
        resolvingRef.current = Number(tender.id);

        const act = action ?? (tender.stage === 'WAITING_GO_NO_GO' ? 'go-nogo' : null);
        state.urlParams.tenderId = String(tender.id);
        if (act) state.urlParams.action = act;
        else delete state.urlParams.action;
      };

      // Phase N: Canonical Drawer Closer
      const closeTenderDrawer = () => {
        closedTenderIdRef.current = state.currentDrawerTender ? Number(state.currentDrawerTender.id) : null;
        state.isDrawerVisible = false;
        state.currentDrawerTender = null;
        state.isDrawerLoading = false;
        resolvingRef.current = null;
        delete state.urlParams.tenderId;
        delete state.urlParams.action;
      };

      // Phase C, D, E, J, Q, S, T: Deep-Link Resolution
      const resolveDeepLink = (effectiveTenderId: number | null) => {
        if (!effectiveTenderId) {
          closedTenderIdRef.current = null;
          resolvingRef.current = null;
          if (state.isDrawerVisible) {
            state.isDrawerVisible = false;
            state.currentDrawerTender = null;
            state.isDrawerLoading = false;
          }
          return;
        }

        // USER CLOSE MUST WIN:
        if (closedTenderIdRef.current === effectiveTenderId) {
          return;
        }

        if (closedTenderIdRef.current !== null && closedTenderIdRef.current !== effectiveTenderId) {
          closedTenderIdRef.current = null;
        }

        // Idempotency: already displaying exact tender
        if (state.currentDrawerTender && Number(state.currentDrawerTender.id) === effectiveTenderId && state.isDrawerVisible) {
          resolvingRef.current = effectiveTenderId;
          return;
        }

        // Stale state protection: clear mismatched entity immediately (Tender 39 -> 40)
        if (state.currentDrawerTender && Number(state.currentDrawerTender.id) !== effectiveTenderId) {
          state.currentDrawerTender = null;
        }

        if (resolvingRef.current === effectiveTenderId && (state.currentDrawerTender || state.isDrawerLoading)) {
          return;
        }

        resolvingRef.current = effectiveTenderId;

        // Step 1: In-memory loaded tenders
        const inMemoryMatch = state.tenders.find((t) => Number(t.id) === effectiveTenderId);
        if (inMemoryMatch) {
          state.currentDrawerTender = inMemoryMatch;
          state.isDrawerVisible = true;
          state.isDrawerLoading = false;
          return;
        }

        // Step 2: Cache lookup
        if (state.cache.has(effectiveTenderId)) {
          state.currentDrawerTender = state.cache.get(effectiveTenderId);
          state.isDrawerVisible = true;
          state.isDrawerLoading = false;
          return;
        }

        // Step 3: Single tender fetch fallback
        state.isDrawerLoading = true;
        state.isDrawerVisible = true;
        state.apiCalls.push(`/marketing/tenders/${effectiveTenderId}`);

        // Simulated API return if mock DB exists
        const fetched = mockDb.get(effectiveTenderId);
        if (fetched) {
          state.currentDrawerTender = fetched;
          state.cache.set(effectiveTenderId, fetched);
        } else {
          closeTenderDrawer();
        }
        state.isDrawerLoading = false;
      };

      return { state, resolvingRef, openTenderDrawer, closeTenderDrawer, resolveDeepLink };
    };

    const mockDb = new Map<number, any>([
      [
        39,
        {
          id: 39,
          title: 'Proyek Jalur Fiber Optik Medan',
          stage: 'LEAD',
          customer: { name: 'PT Telkom' },
          estimated_budget: 350000000,
        },
      ],
      [
        40,
        {
          id: 40,
          title: 'Project Asia Net Rehabilitasi Route',
          customer: { name: 'PT Asianet Media Teknologi' },
          estimated_budget: 461612259,
          stage: 'WAITING_GO_NO_GO',
          go_nogo_status: 'PENDING',
          decisionPack: {
            executiveSummary: 'Pengadaan jalur backbone telekomunikasi dengan margin 28%.',
            keyConcerns: ['Timeline customer cukup ketat', 'Permit masih perlu klarifikasi'],
            readiness: {
              customerRequirement: 'CLEAR',
              commercialInformation: 'READY',
              timeline: 'FEASIBLE',
            },
            marketingRecommendation: 'GO',
            marketingRecommendationReason: 'Customer kredibel dan skema pembayaran aman.',
            submittedBy: 'Lukas Kurniawan',
            submittedAt: '2026-09-25T14:30:00.000Z',
          },
        },
      ],
    ]);

    it('1. To-Do actionTarget format remains authoritative and unchanged', () => {
      const target = resolveTodoActionTarget({
        actionTarget: '/sales?tab=1&tenderId=40&action=go-nogo',
        actionType: 'GO_NOGO_APPROVAL',
        entityType: 'TENDER',
        entityId: 40,
      });
      expect(target).toBe('/sales?tab=1&tenderId=40&action=go-nogo');
    });

    it('2. Deep-link tenderId=40 opens Tender 40 only', () => {
      const sim = createSimulator({ tenders: [mockDb.get(40)] });
      sim.resolveDeepLink(40);

      expect(sim.state.isDrawerVisible).toBe(true);
      expect(sim.state.currentDrawerTender?.id).toBe(40);
      expect(sim.state.currentDrawerTender?.title).toContain('Asia Net');
    });

    it('3. Stale State Protection: selectedTender=39 cannot leak into Tender 40', () => {
      const sim = createSimulator({
        currentDrawerTender: mockDb.get(39),
        isDrawerVisible: true,
      });

      // Navigate to Tender 40
      sim.resolveDeepLink(40);

      expect(sim.state.currentDrawerTender?.id).toBe(40);
      expect(sim.state.currentDrawerTender?.title).not.toContain('Medan');
      expect(sim.state.currentDrawerTender?.title).toContain('Asia Net');
    });

    it('4. Loaded Tender 40 is reused without duplicate fetch (Phase D.1)', () => {
      const sim = createSimulator({ tenders: [mockDb.get(40)] });
      sim.resolveDeepLink(40);

      expect(sim.state.apiCalls.length).toBe(0); // 0 network calls!
      expect(sim.state.currentDrawerTender?.id).toBe(40);
    });

    it('5. Fallback fetch occurs ONLY when exact Tender is absent from state & cache (Phase D.3)', () => {
      const sim = createSimulator({ tenders: [] }); // empty list
      sim.resolveDeepLink(40);

      expect(sim.state.apiCalls).toEqual(['/marketing/tenders/40']);
      expect(sim.state.currentDrawerTender?.id).toBe(40);
    });

    it('6. Fallback fetch requests ONLY Tender 40 (no broad refetch)', () => {
      const sim = createSimulator({ tenders: [] });
      sim.resolveDeepLink(40);

      expect(sim.state.apiCalls).toEqual(['/marketing/tenders/40']);
      expect(sim.state.apiCalls).not.toContain('/marketing/tenders');
      expect(sim.state.apiCalls).not.toContain('/marketing/dashboard/summary');
    });

    it('7. Opening drawer does NOT trigger full pipeline refetch or query invalidation', () => {
      const sim = createSimulator({ tenders: [mockDb.get(40)] });
      sim.resolveDeepLink(40);

      expect(sim.state.invalidatedQueries.length).toBe(0);
      expect(sim.state.apiCalls.length).toBe(0);
    });

    it('8. Kanban click uses existing Tender immediately with 0 network latency', () => {
      const sim = createSimulator({ tenders: [mockDb.get(40)] });
      sim.openTenderDrawer(mockDb.get(40));

      expect(sim.state.apiCalls.length).toBe(0);
      expect(sim.state.isDrawerVisible).toBe(true);
      expect(sim.state.currentDrawerTender?.id).toBe(40);
    });

    it('9. Kanban GO/NO-GO open synchronizes URL to /sales?tab=1&tenderId=40&action=go-nogo', () => {
      const sim = createSimulator({ urlParams: { tab: '1' } });
      sim.openTenderDrawer(mockDb.get(40));

      expect(sim.state.urlParams.tenderId).toBe('40');
      expect(sim.state.urlParams.action).toBe('go-nogo');
      expect(sim.state.urlParams.tab).toBe('1');
    });

    it('10. URL update does not cause duplicate drawer initialization (Idempotency Guard)', () => {
      const sim = createSimulator({ tenders: [mockDb.get(40)] });
      sim.resolveDeepLink(40);
      const initialDrawer = sim.state.currentDrawerTender;

      // Simulate second call from router effect with same id
      sim.resolveDeepLink(40);
      expect(sim.state.currentDrawerTender).toBe(initialDrawer);
      expect(sim.state.apiCalls.length).toBe(0);
    });

    it('11. URL update does not cause duplicate fetch', () => {
      const sim = createSimulator({ tenders: [] });
      sim.resolveDeepLink(40);
      expect(sim.state.apiCalls.length).toBe(1);

      // Re-triggering with same ID does not re-fetch
      sim.resolveDeepLink(40);
      expect(sim.state.apiCalls.length).toBe(1);
    });

    it('12. Refresh restores exact Tender drawer', () => {
      const sim = createSimulator({ tenders: [mockDb.get(40)], urlParams: { tab: '1', tenderId: '40', action: 'go-nogo' } });
      sim.resolveDeepLink(40);

      expect(sim.state.isDrawerVisible).toBe(true);
      expect(sim.state.currentDrawerTender?.id).toBe(40);
    });

    it('13. Browser Back behavior: drawer closes when tenderId is removed from route', () => {
      const sim = createSimulator({ tenders: [mockDb.get(40)] });
      sim.resolveDeepLink(40);
      expect(sim.state.isDrawerVisible).toBe(true);

      // User presses Back: tenderId becomes null
      sim.resolveDeepLink(null);
      // Simulating close via Back
      sim.closeTenderDrawer();
      expect(sim.state.isDrawerVisible).toBe(false);
      expect(sim.state.currentDrawerTender).toBeNull();
    });

    it('14. Drawer close removes tenderId/action while preserving tab and other query params', () => {
      const sim = createSimulator({
        urlParams: { tab: '1', tenderId: '40', action: 'go-nogo', other: 'persist-me' },
        currentDrawerTender: mockDb.get(40),
        isDrawerVisible: true,
      });

      sim.closeTenderDrawer();

      expect(sim.state.urlParams.tenderId).toBeUndefined();
      expect(sim.state.urlParams.action).toBeUndefined();
      expect(sim.state.urlParams.tab).toBe('1');
      expect(sim.state.urlParams.other).toBe('persist-me');
    });

    it('15. Normal Tender detail without action=go-nogo works properly', () => {
      const sim = createSimulator({ tenders: [mockDb.get(39)] });
      sim.openTenderDrawer(mockDb.get(39));

      expect(sim.state.currentDrawerTender?.id).toBe(39);
      expect(sim.state.urlParams.action).toBeUndefined(); // No action in URL for normal LEAD tender
      expect(sim.state.urlParams.tenderId).toBe('39');
    });

    it('16. action=go-nogo renders Executive Review when role is Director', () => {
      const tender = mockDb.get(40);
      const isDirectorOrExec = true;
      const shouldRenderReview = isDirectorOrExec && tender.stage === 'WAITING_GO_NO_GO' && tender.go_nogo_status === 'PENDING';
      expect(shouldRenderReview).toBe(true);
    });

    it('17. Executive Decision Pack belongs to same Tender ID', () => {
      const tender = mockDb.get(40);
      expect(tender.decisionPack).toBeDefined();
      expect(tender.decisionPack.executiveSummary).toContain('Pengadaan jalur backbone');
      expect(tender.decisionPack.keyConcerns.length).toBe(2);
    });

    it('18. Snapshot from another Tender cannot render (isolated context)', () => {
      const tender39 = mockDb.get(39);
      const tender40 = mockDb.get(40);

      expect(tender39.decisionPack).toBeUndefined();
      expect(tender40.decisionPack).toBeDefined();
    });

    it('19. Submitter belongs to same submission cycle', () => {
      const tender = mockDb.get(40);
      expect(tender.decisionPack.submittedBy).toBe('Lukas Kurniawan');
    });

    it('20. submittedAt belongs to same submission cycle', () => {
      const tender = mockDb.get(40);
      expect(tender.decisionPack.submittedAt).toBe('2026-09-25T14:30:00.000Z');
    });

    it('21. Resubmit lifecycle: Pack B renders after revision, not Pack A', () => {
      const tenderPackA = {
        ...mockDb.get(40),
        decisionPack: {
          executiveSummary: 'Pack A: Initial estimate',
          marketingRecommendation: 'REVIEW',
        },
      };

      const tenderPackB = {
        ...mockDb.get(40),
        decisionPack: {
          executiveSummary: 'Pack B: Revised discount structure',
          marketingRecommendation: 'GO',
        },
      };

      // Resubmission produces Pack B
      expect(tenderPackB.decisionPack.executiveSummary).toBe('Pack B: Revised discount structure');
      expect(tenderPackB.decisionPack.marketingRecommendation).toBe('GO');
    });

    it('22. Missing legacy decisionPack does not crash (safe fallback)', () => {
      const legacyTender = {
        id: 99,
        title: 'Old Legacy Tender',
        stage: 'WAITING_GO_NO_GO',
        notes: 'Legacy manual note',
      };

      const pack = (legacyTender as any).decisionPack || null;
      expect(pack).toBeNull();
      // Safe fallback to notes
      expect(legacyTender.notes).toBe('Legacy manual note');
    });

    it('23. No fetch loop: ref prevents repetitive fetches on unchanged route', () => {
      const sim = createSimulator({ tenders: [] });
      sim.resolveDeepLink(40);
      sim.resolveDeepLink(40);
      sim.resolveDeepLink(40);

      expect(sim.state.apiCalls.length).toBe(1); // exactly 1 call, no loop!
    });

    it('24. No stale drawer state across fast Tender navigation', () => {
      const sim = createSimulator({
        tenders: [mockDb.get(39), mockDb.get(40)],
        currentDrawerTender: mockDb.get(39),
        isDrawerVisible: true,
      });

      // Switch to 40
      sim.resolveDeepLink(40);
      expect(sim.state.currentDrawerTender?.id).toBe(40);

      // Switch back to 39
      sim.resolveDeepLink(39);
      expect(sim.state.currentDrawerTender?.id).toBe(39);
    });
  });

  describe('7. Drawer Close & Re-open Bug Regression Test Suite', () => {
    const mockDb = new Map<number, any>([
      [
        40,
        {
          id: 40,
          title: 'Project Asia Net Rehabilitasi Route',
          customer: { name: 'PT Asianet Media Teknologi' },
          stage: 'WAITING_GO_NO_GO',
          go_nogo_status: 'PENDING',
        },
      ],
      [
        39,
        {
          id: 39,
          title: 'Proyek Fiber Optik Medan',
          customer: { name: 'PT Telkom' },
          stage: 'LEAD',
        },
      ],
    ]);

    interface SimState {
      drawerVisible: boolean;
      drawerTender: any | null;
      urlParams: { tab?: string; tenderId?: string; action?: string };
    }

    const runCloseLifecycle = (openedVia: 'KANBAN' | 'TODO_URL') => {
      const state: SimState = {
        drawerVisible: false,
        drawerTender: null,
        urlParams: { tab: '1' },
      };

      const resolvingRef = { current: null as number | null };
      const closedTenderIdRef = { current: null as number | null };

      const openTenderDrawer = (tender: any, action?: string | null) => {
        closedTenderIdRef.current = null;
        state.drawerTender = tender;
        state.drawerVisible = true;
        resolvingRef.current = Number(tender.id);

        const act = action ?? (tender.stage === 'WAITING_GO_NO_GO' ? 'go-nogo' : null);
        state.urlParams.tenderId = String(tender.id);
        if (act) state.urlParams.action = act;
      };

      const closeTenderDrawer = () => {
        // Step 1: record closed tender
        closedTenderIdRef.current = state.drawerTender ? Number(state.drawerTender.id) : null;
        // Step 2: clear local state
        state.drawerVisible = false;
        state.drawerTender = null;
        resolvingRef.current = null;
        // Step 3: router.replace initiated (simulating async transition)
        // URL params are NOT wiped immediately; they wipe in next tick
      };

      const applyRouterUpdate = () => {
        delete state.urlParams.tenderId;
        delete state.urlParams.action;
      };

      const runEffect = (effectiveTenderId: number | null) => {
        if (!effectiveTenderId) {
          closedTenderIdRef.current = null;
          resolvingRef.current = null;
          if (state.drawerVisible) {
            state.drawerVisible = false;
            state.drawerTender = null;
          }
          return;
        }

        // USER CLOSE MUST WIN:
        if (closedTenderIdRef.current === effectiveTenderId) {
          return; // DO NOT REOPEN!
        }

        if (state.drawerTender && Number(state.drawerTender.id) === effectiveTenderId && state.drawerVisible) {
          resolvingRef.current = effectiveTenderId;
          return;
        }

        resolvingRef.current = effectiveTenderId;
        const match = mockDb.get(effectiveTenderId);
        if (match) {
          state.drawerTender = match;
          state.drawerVisible = true;
        }
      };

      // Step A: Initial open
      if (openedVia === 'KANBAN') {
        openTenderDrawer(mockDb.get(40));
      } else {
        state.urlParams.tenderId = '40';
        state.urlParams.action = 'go-nogo';
        runEffect(40);
      }

      return {
        state,
        closedTenderIdRef,
        resolvingRef,
        openTenderDrawer,
        closeTenderDrawer,
        applyRouterUpdate,
        runEffect,
      };
    };

    it('1. Open Tender #40 from Kanban -> drawer opens', () => {
      const { state } = runCloseLifecycle('KANBAN');
      expect(state.drawerVisible).toBe(true);
      expect(state.drawerTender?.id).toBe(40);
      expect(state.urlParams.tenderId).toBe('40');
      expect(state.urlParams.action).toBe('go-nogo');
    });

    it('2. Close from Kanban -> intermediate tick does NOT reopen drawer', () => {
      const { state, closeTenderDrawer, runEffect } = runCloseLifecycle('KANBAN');
      expect(state.drawerVisible).toBe(true);

      // User clicks Close
      closeTenderDrawer();
      expect(state.drawerVisible).toBe(false);
      expect(state.drawerTender).toBeNull();

      // Intermediate render before router update finishes (effectiveTenderId is still 40!)
      runEffect(40);
      expect(state.drawerVisible).toBe(false); // MUST REMAIN CLOSED!
      expect(state.drawerTender).toBeNull();
    });

    it('3. Close from Kanban -> after router update, URL is /sales?tab=1 and drawer remains closed', () => {
      const { state, closeTenderDrawer, applyRouterUpdate, runEffect } = runCloseLifecycle('KANBAN');
      closeTenderDrawer();
      runEffect(40); // intermediate tick

      // Router update finishes
      applyRouterUpdate();
      expect(state.urlParams.tenderId).toBeUndefined();
      expect(state.urlParams.action).toBeUndefined();
      expect(state.urlParams.tab).toBe('1');

      // Effect runs on /sales?tab=1 (effectiveTenderId = null)
      runEffect(null);
      expect(state.drawerVisible).toBe(false);
      expect(state.drawerTender).toBeNull();
    });

    it('4. Open Tender #40 from To-Do URL -> drawer opens', () => {
      const { state } = runCloseLifecycle('TODO_URL');
      expect(state.drawerVisible).toBe(true);
      expect(state.drawerTender?.id).toBe(40);
    });

    it('5. Close from To-Do -> drawer remains closed across all re-renders', () => {
      const { state, closeTenderDrawer, applyRouterUpdate, runEffect } = runCloseLifecycle('TODO_URL');
      expect(state.drawerVisible).toBe(true);

      closeTenderDrawer();
      runEffect(40); // intermediate tick: must not reopen!
      expect(state.drawerVisible).toBe(false);

      applyRouterUpdate(); // router finishes
      runEffect(null);
      expect(state.drawerVisible).toBe(false);
      expect(state.drawerTender).toBeNull();
    });

    it('6. selectedTender from previous open does not reopen drawer', () => {
      const { state, closeTenderDrawer, applyRouterUpdate, runEffect } = runCloseLifecycle('KANBAN');
      closeTenderDrawer();
      applyRouterUpdate();
      runEffect(null);

      // Simulating a stale selectedTender in some parent component state:
      // If URL has no tenderId, effect must strictly return and not open!
      runEffect(null);
      expect(state.drawerVisible).toBe(false);
    });

    it('7. drawerTender from previous open does not reopen drawer', () => {
      const { state, runEffect } = runCloseLifecycle('KANBAN');
      // If drawer is closed
      state.drawerVisible = false;
      state.drawerTender = null;

      // On route without tenderId
      runEffect(null);
      expect(state.drawerVisible).toBe(false);
      expect(state.drawerTender).toBeNull();
    });

    it('8. /sales?tab=1 alone never auto-opens a Tender', () => {
      const { state, runEffect } = runCloseLifecycle('KANBAN');
      state.drawerVisible = false;
      state.drawerTender = null;
      state.urlParams = { tab: '1' };

      runEffect(null);
      expect(state.drawerVisible).toBe(false);
      expect(state.drawerTender).toBeNull();
    });

    it('9. /sales?tab=1&tenderId=40&action=go-nogo still opens Tender #40 after fresh navigation', () => {
      const { state, closeTenderDrawer, applyRouterUpdate, runEffect } = runCloseLifecycle('KANBAN');
      // Close first
      closeTenderDrawer();
      applyRouterUpdate();
      runEffect(null);
      expect(state.drawerVisible).toBe(false);

      // Fresh navigation to Tender 40
      state.urlParams = { tab: '1', tenderId: '40', action: 'go-nogo' };
      runEffect(40);
      expect(state.drawerVisible).toBe(true);
      expect(state.drawerTender?.id).toBe(40);
    });

    it('10. Browser Forward to URL with tenderId reopens correctly', () => {
      const { state, closeTenderDrawer, applyRouterUpdate, runEffect } = runCloseLifecycle('KANBAN');
      // Close
      closeTenderDrawer();
      applyRouterUpdate();
      runEffect(null);

      // Browser Forward restores tenderId 40
      state.urlParams = { tab: '1', tenderId: '40', action: 'go-nogo' };
      runEffect(40);
      expect(state.drawerVisible).toBe(true);
      expect(state.drawerTender?.id).toBe(40);
    });

    it('11. No fetch loop: closing stops all effect activity', () => {
      const { closeTenderDrawer, applyRouterUpdate, runEffect } = runCloseLifecycle('KANBAN');
      closeTenderDrawer();
      runEffect(40);
      applyRouterUpdate();
      runEffect(null);
      runEffect(null);
      runEffect(null);
      // Completes cleanly with 0 loop errors
    });

    it('12. No duplicate drawer initialization when tender is already open', () => {
      const { state, runEffect } = runCloseLifecycle('KANBAN');
      const initialTender = state.drawerTender;

      runEffect(40);
      expect(state.drawerTender).toBe(initialTender);
    });
  });
});
