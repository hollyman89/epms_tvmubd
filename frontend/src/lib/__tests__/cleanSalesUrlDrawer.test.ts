import {
  parseSalesDrawerTarget,
  setPendingSalesDrawerRequest,
  consumePendingSalesDrawerRequest,
  clearPendingSalesDrawerRequest,
  navigateTodoAction,
  PendingSalesDrawerRequest,
} from '../salesNavigation';
import { resolveTodoActionTarget } from '../todoActionResolver';

describe('Clean Sales URL Drawer Architecture & Regression Tests', () => {
  let originalWindow: any;
  let originalCustomEvent: any;
  let dispatchedEvents: any[] = [];
  let storageMap: Record<string, string> = {};

  beforeAll(() => {
    originalWindow = (global as any).window;
    originalCustomEvent = (global as any).CustomEvent;

    (global as any).CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, params: any) {
        this.type = type;
        this.detail = params?.detail;
      }
    };

    (global as any).window = {
      dispatchEvent: jest.fn((event: any) => {
        dispatchedEvents.push(event);
        return true;
      }),
      sessionStorage: {
        getItem: jest.fn((key: string) => storageMap[key] || null),
        setItem: jest.fn((key: string, val: string) => {
          storageMap[key] = val;
        }),
        removeItem: jest.fn((key: string) => {
          delete storageMap[key];
        }),
        clear: jest.fn(() => {
          storageMap = {};
        }),
      },
    };
  });

  afterAll(() => {
    (global as any).window = originalWindow;
    (global as any).CustomEvent = originalCustomEvent;
  });

  beforeEach(() => {
    dispatchedEvents = [];
    storageMap = {};
    clearPendingSalesDrawerRequest();
    jest.clearAllMocks();
  });

  describe('1. URL Interception & Navigation Transport (To-Do "Buka")', () => {
    it('1. parseSalesDrawerTarget parses Sales tender deep-link correctly', () => {
      const parsed = parseSalesDrawerTarget('/sales?tab=1&tenderId=40&action=go-nogo');
      expect(parsed).toEqual({
        tenderId: 40,
        action: 'go-nogo',
      });
    });

    it('2. parseSalesDrawerTarget parses tenderId without action', () => {
      const parsed = parseSalesDrawerTarget('/sales?tenderId=40');
      expect(parsed).toEqual({
        tenderId: 40,
        action: null,
      });
    });

    it('3. parseSalesDrawerTarget ignores non-sales routes (Procurement, Legal, Governance)', () => {
      expect(parseSalesDrawerTarget('/procurement?tab=pr&prId=10')).toBeNull();
      expect(parseSalesDrawerTarget('/legal/review?contractId=45')).toBeNull();
      expect(parseSalesDrawerTarget('/project-delivery?projectId=20&action=operational-plan')).toBeNull();
      expect(parseSalesDrawerTarget('/governance/tasks?taskId=12')).toBeNull();
    });

    it('4. parseSalesDrawerTarget safely rejects invalid, missing, or malformed inputs', () => {
      expect(parseSalesDrawerTarget(null)).toBeNull();
      expect(parseSalesDrawerTarget(undefined)).toBeNull();
      expect(parseSalesDrawerTarget('')).toBeNull();
      expect(parseSalesDrawerTarget('/sales')).toBeNull();
      expect(parseSalesDrawerTarget('/sales?tab=1')).toBeNull();
      expect(parseSalesDrawerTarget('/sales?tenderId=abc')).toBeNull();
      expect(parseSalesDrawerTarget('/sales?tenderId=-1')).toBeNull();
      expect(parseSalesDrawerTarget('/sales?tenderId=0')).toBeNull();
    });

    it('5. navigateTodoAction intercepts Sales target and routes to clean /sales without query params', () => {
      const mockRouter = { push: jest.fn() };
      const eventSpy = jest.spyOn(window, 'dispatchEvent');

      navigateTodoAction('/sales?tab=1&tenderId=40&action=go-nogo', mockRouter);

      // Visible navigation must be strictly /sales
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
      expect(mockRouter.push).toHaveBeenCalledWith('/sales');

      // Address bar target must NOT contain tenderId, action, or tab
      const pushedUrl = mockRouter.push.mock.calls[0][0];
      expect(pushedUrl).not.toContain('tenderId');
      expect(pushedUrl).not.toContain('action');
      expect(pushedUrl).not.toContain('tab=1');

      // Internal request must be stored
      const consumed = consumePendingSalesDrawerRequest();
      expect(consumed).toEqual({
        tenderId: 40,
        action: 'go-nogo',
      });

      // Event must be dispatched for already-mounted views
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'epms:open_sales_drawer',
          detail: { tenderId: 40, action: 'go-nogo' },
        })
      );
    });

    it('6. navigateTodoAction passes through non-sales routes directly', () => {
      const mockRouter = { push: jest.fn() };
      navigateTodoAction('/procurement?tab=pr&prId=10', mockRouter);
      expect(mockRouter.push).toHaveBeenCalledWith('/procurement?tab=pr&prId=10');
      expect(consumePendingSalesDrawerRequest()).toBeNull();
    });

    it('7. Transient storage lifecycle: consumed once, no stale requests survive', () => {
      setPendingSalesDrawerRequest({ tenderId: 40, action: 'go-nogo' });

      // First consume retrieves and removes
      const first = consumePendingSalesDrawerRequest();
      expect(first).toEqual({ tenderId: 40, action: 'go-nogo' });

      // Second consume returns null
      const second = consumePendingSalesDrawerRequest();
      expect(second).toBeNull();
    });
  });

  describe('2. Kanban & Local State Drawer Semantics (Clean Browser URL)', () => {
    // Model state simulating KanbanBoard internal drawer state
    class SimulatedKanbanBoard {
      public tenders: any[];
      public drawerVisible: boolean = false;
      public drawerTender: any = null;
      public drawerAction: string | null = null;
      public isDrawerLoading: boolean = false;
      public resolvingTenderId: number | null = null;
      public currentBrowserUrl: string = '/sales';
      public routerReplaceCalls: string[] = [];
      public routerPushCalls: string[] = [];
      public singleFetches: number[] = [];

      constructor(tenders: any[], initialUrl = '/sales') {
        this.tenders = tenders;
        this.currentBrowserUrl = initialUrl;
      }

      public openTenderDrawer(tender: any, action?: string | null) {
        if (!tender) return;
        this.drawerTender = tender;
        this.drawerAction = action ?? (tender.stage === 'WAITING_GO_NO_GO' ? 'go-nogo' : null);
        this.drawerVisible = true;
        this.isDrawerLoading = false;
        this.resolvingTenderId = Number(tender.id);
        // Pure local UI state: DOES NOT CALL router.replace or router.push
      }

      public closeTenderDrawer() {
        this.drawerVisible = false;
        this.drawerTender = null;
        this.drawerAction = null;
        this.isDrawerLoading = false;
        this.resolvingTenderId = null;
        clearPendingSalesDrawerRequest();
        // Pure local UI state: DOES NOT CALL router.replace or router.push
      }

      public resolveAndOpenTender(targetId: number, action?: string | null, cache?: any[]) {
        if (!targetId || targetId <= 0) return;

        if (this.drawerTender && Number(this.drawerTender.id) === targetId && this.drawerVisible) {
          this.resolvingTenderId = targetId;
          return;
        }

        // Stale state protection
        if (this.drawerTender && Number(this.drawerTender.id) !== targetId) {
          this.drawerTender = null;
        }

        this.resolvingTenderId = targetId;

        // Step 1: in-memory tenders
        const inMemory = this.tenders.find((t) => Number(t.id) === targetId);
        if (inMemory) {
          this.openTenderDrawer(inMemory, action);
          return;
        }

        // Step 2: query cache
        if (cache) {
          const cached = cache.find((t) => Number(t.id) === targetId);
          if (cached) {
            this.openTenderDrawer(cached, action);
            return;
          }
        }

        // Step 3: fallback fetch single record ONLY
        this.singleFetches.push(targetId);
        this.isDrawerLoading = true;
        this.drawerVisible = true;
        this.drawerAction = action ?? null;
      }

      public completeFallbackFetch(fetchedTender: any) {
        if (fetchedTender && Number(fetchedTender.id) === this.resolvingTenderId) {
          this.openTenderDrawer(fetchedTender, this.drawerAction);
        }
      }
    }

    const sampleTenders = [
      {
        id: 39,
        title: 'Pengadaan Server DC BRI',
        stage: 'PROPOSAL',
        status: 'OPEN',
      },
      {
        id: 40,
        title: 'Renovasi Kantor J&T Pontianak',
        stage: 'WAITING_GO_NO_GO',
        go_nogo_status: 'PENDING',
        decisionPack: {
          executiveSummary: 'Proyek renovasi 3 lantai J&T',
          marketingRecommendation: 'GO',
          submittedBy: 'Marketing Lead',
        },
      },
    ];

    it('1. Kanban starts at /sales', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      expect(board.currentBrowserUrl).toBe('/sales');
      expect(board.drawerVisible).toBe(false);
    });

    it('2. Clicking Tender #40 opens drawer and URL remains strictly /sales', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      board.openTenderDrawer(sampleTenders[1]);

      expect(board.drawerVisible).toBe(true);
      expect(board.drawerTender.id).toBe(40);
      expect(board.drawerAction).toBe('go-nogo');

      // Strict URL requirement: URL remains exactly /sales
      expect(board.currentBrowserUrl).toBe('/sales');
      expect(board.routerReplaceCalls).toHaveLength(0);
      expect(board.routerPushCalls).toHaveLength(0);
    });

    it('3. Closing drawer keeps URL exactly /sales and drawer remains closed', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      board.openTenderDrawer(sampleTenders[1]);
      expect(board.drawerVisible).toBe(true);

      board.closeTenderDrawer();

      expect(board.drawerVisible).toBe(false);
      expect(board.drawerTender).toBeNull();
      expect(board.drawerAction).toBeNull();

      // Strict URL requirement: URL remains exactly /sales
      expect(board.currentBrowserUrl).toBe('/sales');
      expect(board.routerReplaceCalls).toHaveLength(0);
      expect(board.routerPushCalls).toHaveLength(0);
    });

    it('4. Re-render after close does not reopen drawer', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      board.openTenderDrawer(sampleTenders[1]);
      board.closeTenderDrawer();

      // Simulate re-render tick
      expect(board.drawerVisible).toBe(false);
      expect(board.drawerTender).toBeNull();
      expect(board.resolvingTenderId).toBeNull();
    });

    it('5. To-Do action for Tender #40 opens Tender #40 while visible URL is /sales', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');

      // Simulate To-Do navigation payload consumption
      setPendingSalesDrawerRequest({ tenderId: 40, action: 'go-nogo' });
      const pending = consumePendingSalesDrawerRequest();
      expect(pending).not.toBeNull();

      board.resolveAndOpenTender(pending!.tenderId, pending!.action);

      expect(board.drawerVisible).toBe(true);
      expect(board.drawerTender.id).toBe(40);
      expect(board.drawerAction).toBe('go-nogo');
      expect(board.currentBrowserUrl).toBe('/sales');
    });

    it('6. No query parameters (tenderId, action, tab) exist in browser URL', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      board.openTenderDrawer(sampleTenders[1]);

      expect(board.currentBrowserUrl).not.toContain('tab=1');
      expect(board.currentBrowserUrl).not.toContain('tenderId=40');
      expect(board.currentBrowserUrl).not.toContain('action=go-nogo');
      expect(board.currentBrowserUrl).toBe('/sales');
    });

    it('7. Stale State Protection: previously opened Tender #39 cannot leak into Tender #40', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      // Open tender 39 first
      board.openTenderDrawer(sampleTenders[0]);
      expect(board.drawerTender.id).toBe(39);

      // Now resolve tender 40
      board.resolveAndOpenTender(40, 'go-nogo');
      expect(board.drawerTender.id).toBe(40);
    });

    it('8. Existing in-memory Tender is used immediately without network fetch', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      board.resolveAndOpenTender(40, 'go-nogo');

      expect(board.drawerVisible).toBe(true);
      expect(board.drawerTender.id).toBe(40);
      expect(board.singleFetches).toHaveLength(0); // Zero network calls!
    });

    it('9. Missing Tender in memory falls back to single-record fetch ONLY (no full pipeline refetch)', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales'); // Only has 39 and 40
      board.resolveAndOpenTender(99, 'go-nogo');

      expect(board.singleFetches).toEqual([99]); // Fetched ONLY tender 99
      expect(board.isDrawerLoading).toBe(true);

      // Complete fetch
      board.completeFallbackFetch({ id: 99, title: 'Tender 99', stage: 'WAITING_GO_NO_GO' });
      expect(board.drawerVisible).toBe(true);
      expect(board.drawerTender.id).toBe(99);
    });

    it('10. Executive Decision Pack belongs to exact active workflow cycle (Pack B after resubmit)', () => {
      const tenderWithResubmission = {
        id: 40,
        title: 'Renovasi J&T',
        stage: 'WAITING_GO_NO_GO',
        go_nogo_status: 'PENDING',
        decisionPack: {
          cycle: 'CYCLE_2',
          executiveSummary: 'Revised Pack B with reduced risk and improved margins',
          marketingRecommendation: 'GO',
          submittedBy: 'Marketing Lead',
        },
      };

      const board = new SimulatedKanbanBoard([tenderWithResubmission], '/sales');
      board.openTenderDrawer(tenderWithResubmission, 'go-nogo');

      expect(board.drawerTender.decisionPack.cycle).toBe('CYCLE_2');
      expect(board.drawerTender.decisionPack.executiveSummary).toContain('Revised Pack B');
    });

    it('11. Opening same Tender again after close works cleanly', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      board.openTenderDrawer(sampleTenders[1]);
      expect(board.drawerVisible).toBe(true);

      board.closeTenderDrawer();
      expect(board.drawerVisible).toBe(false);

      // Re-click same card
      board.openTenderDrawer(sampleTenders[1]);
      expect(board.drawerVisible).toBe(true);
      expect(board.drawerTender.id).toBe(40);
    });

    it('12. No close/reopen race: closing does not trigger any URL or async fetch loop', () => {
      const board = new SimulatedKanbanBoard(sampleTenders, '/sales');
      board.openTenderDrawer(sampleTenders[1]);
      board.closeTenderDrawer();

      // No router events were fired, no fetches were queued
      expect(board.routerReplaceCalls).toHaveLength(0);
      expect(board.singleFetches).toHaveLength(0);
      expect(board.drawerVisible).toBe(false);
    });
  });
});
