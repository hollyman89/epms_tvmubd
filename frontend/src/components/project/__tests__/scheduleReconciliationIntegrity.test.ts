import {
  buildSaveProjectSchedulePayload,
  reconcileScheduleWithWbs,
  ScheduleTaskItem,
  extractPersistedWbsArray,
  assertPersistedWbsNodesHaveDbIds,
} from '../ScheduleGanttTab';
import { convertBackendTreeToUiNodes } from '../WbsTreeTableModal';

describe('R9.1B-OP-FIX PHASE 1: Schedule Persistence & WBS ID Reconciliation (OP-01 + OP-04)', () => {
  /**
   * TEST 1 — NEW WBS + SCHEDULE SAME SESSION
   * Create new WBS node with temporary frontend ID.
   * Create Schedule task referencing that node.
   * Persist WBS -> Receive permanent DB ID.
   * Reconcile Schedule reference -> Persist Schedule.
   * ASSERT: Schedule payload contains the task.
   * ASSERT: Schedule payload uses permanent WBS ID.
   * ASSERT: task is NOT silently filtered.
   */
  describe('TEST 1 — NEW WBS + SCHEDULE SAME SESSION', () => {
    it('should reconcile temporary WBS client ID to permanent database ID and include task in payload', () => {
      const tempWbsId = 'wbs-1790551755417-temp1';
      const wbsCode = '1.1';
      const taskName = 'Pengadaan & Instalasi Fiber Optic';

      // 1. New WBS node created client-side with temp ID
      const preSaveWbsNodes = [
        { id: tempWbsId, code: wbsCode },
      ];

      // 2. Schedule task referencing that temporary WBS node
      const currentScheduleData: ScheduleTaskItem[] = [
        {
          id: undefined,
          wbsNodeId: tempWbsId,
          wbsCode: wbsCode,
          name: taskName,
          type: 'TASK',
          isMilestone: false,
          startDate: '2026-09-01',
          endDate: '2026-09-15',
          duration: 14,
          progress: 0,
          status: 'PLANNED',
        },
      ];

      // 3. WBS is persisted, receiving permanent DB ID (e.g., 1402)
      const permanentDbId = 1402;
      const activeWbsLeaves = [
        {
          id: String(permanentDbId),
          code: wbsCode,
          name: taskName,
        },
      ];

      // 4. Build schedule save payload using reconciled WBS leaves & pre-save mapping
      const result = buildSaveProjectSchedulePayload(
        currentScheduleData,
        activeWbsLeaves,
        'Catatan Jadwal PM',
        preSaveWbsNodes
      );

      // ASSERT: Payload validation passes
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.payload).toBeDefined();

      // ASSERT: Schedule payload contains the task (NOT silently filtered)
      expect(result.payload!.tasks).toHaveLength(1);

      const taskPayload = result.payload!.tasks[0];
      // ASSERT: Schedule payload uses permanent database WBS ID
      expect(taskPayload.wbsId).toBe(permanentDbId);
      expect(taskPayload.name).toBe(taskName);
      expect(taskPayload.startDate).toBe('2026-09-01');
      expect(taskPayload.endDate).toBe('2026-09-15');
      expect(taskPayload.isMilestone).toBe(false);

      // ASSERT: in-memory reconciled tasks reflect permanent WBS ID
      expect(result.reconciledTasks).toHaveLength(1);
      expect(result.reconciledTasks[0].wbsNodeId).toBe(String(permanentDbId));
    });
  });

  /**
   * TEST 2 — UNRESOLVED WBS REFERENCE
   * Create Schedule task with WBS reference that cannot be reconciled.
   * ASSERT: Schedule persistence is blocked.
   * ASSERT: clear error is produced.
   * ASSERT: save payload is invalid / not produced with a reduced payload.
   */
  describe('TEST 2 — UNRESOLVED WBS REFERENCE', () => {
    it('should block persistence and produce an explicit error when WBS reference cannot be reconciled', () => {
      const orphanTempId = 'wbs-non-existent-999';

      const currentScheduleData: ScheduleTaskItem[] = [
        {
          id: undefined,
          wbsNodeId: orphanTempId,
          wbsCode: '99.99', // Non-existent WBS code
          name: 'Orphan Schedule Task',
          type: 'TASK',
          isMilestone: false,
          startDate: '2026-09-01',
          endDate: '2026-09-15',
          duration: 14,
          progress: 0,
          status: 'PLANNED',
        },
      ];

      // Active WBS tree has no matching leaf
      const activeWbsLeaves = [
        {
          id: '1501',
          code: '1.1',
          name: 'Pekerjaan Pondasi',
        },
      ];

      const result = buildSaveProjectSchedulePayload(
        currentScheduleData,
        activeWbsLeaves,
        undefined,
        []
      );

      // ASSERT: Persistence is BLOCKED
      expect(result.valid).toBe(false);
      // ASSERT: Clear error is produced
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/tidak dapat dipetakan ke ID WBS database/i);
      // ASSERT: Payload is NOT generated / save is aborted
      expect(result.payload).toBeUndefined();
    });
  });

  /**
   * TEST 3 — NO SILENT EMPTY PAYLOAD
   * Given one visible Schedule row:
   * ASSERT: save flow cannot transform 1 intended task into 0 persisted tasks without explicit failure.
   */
  describe('TEST 3 — NO SILENT EMPTY PAYLOAD', () => {
    it('should fail closed instead of returning tasks: [] when visible schedule tasks cannot resolve', () => {
      const currentScheduleData: ScheduleTaskItem[] = [
        {
          id: undefined,
          wbsNodeId: 'wbs-unpersisted-abc',
          wbsCode: '1.2',
          name: 'Instalasi Server Rak',
          type: 'TASK',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          duration: 9,
          progress: 0,
          status: 'PLANNED',
        },
      ];

      // Leaves exist, but none match the unpersisted task's code
      const mismatchedLeaves = [
        { id: '2001', code: '2.1', name: 'Testing & Commissioning' },
      ];

      const result = buildSaveProjectSchedulePayload(
        currentScheduleData,
        mismatchedLeaves
      );

      // Under the old bug, scheduleData.filter(!isNaN(Number(item.wbsNodeId)))
      // would produce tasks: [] and silently succeed.
      // Under the new contract, this MUST be rejected fail-closed.
      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('tidak dapat dipetakan ke ID WBS database');
    });

    it('should allow empty tasks payload ONLY when scheduleData is legitimately empty', () => {
      const result = buildSaveProjectSchedulePayload([], []);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.tasks).toEqual([]);
    });
  });

  /**
   * TEST 4 — RELOAD PERSISTENCE
   * After valid save:
   * reload/re-fetch.
   * ASSERT: Schedule task exists.
   * ASSERT: Start Date retained.
   * ASSERT: End Date retained.
   * ASSERT: valid WBS relationship retained.
   */
  describe('TEST 4 — RELOAD PERSISTENCE', () => {
    it('should retain task identity, dates, duration, and permanent WBS relationship across reload reconciliation', () => {
      const permanentWbsId = 1402;
      const wbsCode = '1.1';
      const wbsLeaves = [
        {
          id: String(permanentWbsId),
          code: wbsCode,
          name: 'Pengadaan & Instalasi Fiber Optic',
        },
      ];

      // Simulated server response after reload (e.g. ProjectService.getProjectSchedule)
      const fetchedServerTasks: ScheduleTaskItem[] = [
        {
          id: 501,
          wbsNodeId: String(permanentWbsId),
          wbsCode: wbsCode,
          name: 'Pengadaan & Instalasi Fiber Optic',
          type: 'TASK',
          isMilestone: false,
          startDate: '2026-09-01',
          endDate: '2026-09-15',
          duration: 14,
          progress: 0,
          status: 'PLANNED',
        },
      ];

      // Reconcile on reload with fetched server tasks as savedDraft
      const reloadedSchedule = reconcileScheduleWithWbs(
        wbsLeaves,
        fetchedServerTasks,
        [] // fresh load without dirty client tasks
      );

      // ASSERT: Schedule task exists
      expect(reloadedSchedule).toHaveLength(1);
      const reloadedTask = reloadedSchedule[0];

      // ASSERT: Identity retained
      expect(reloadedTask.id).toBe(501);
      expect(reloadedTask.name).toBe('Pengadaan & Instalasi Fiber Optic');

      // ASSERT: Start Date retained
      expect(reloadedTask.startDate).toBe('2026-09-01');

      // ASSERT: End Date retained
      expect(reloadedTask.endDate).toBe('2026-09-15');

      // ASSERT: Duration retained
      expect(reloadedTask.duration).toBe(14);

      // ASSERT: Valid permanent WBS relationship retained
      expect(reloadedTask.wbsNodeId).toBe(String(permanentWbsId));
      expect(reloadedTask.wbsCode).toBe(wbsCode);
    });
  });
});

describe('R9.1B-OP-FIX PHASE 1B: WBS Response Envelope & Persisted ID Reconciliation (OP-04)', () => {
  /**
   * TEST 1 — RESPONSE ENVELOPE
   * Given saveWbsTree response shaped as:
   * {
   *   statusCode,
   *   message,
   *   data: [persisted nodes]
   * }
   * ASSERT: persisted WBS array is extracted correctly.
   */
  describe('TEST 1 — RESPONSE ENVELOPE EXTRACTION', () => {
    it('should extract persisted WBS array from standard NestJS response envelope', () => {
      const serverResponse = {
        statusCode: 200,
        message: 'Struktur WBS untuk Proyek #PRJ-2026-0037 berhasil disimpan secara atomik',
        data: [
          {
            id: 2253,
            projectId: 1359,
            code: '1.0',
            name: 'Pekerjaan Persiapan',
            level: 1,
            weightPercentage: 100,
            children: [],
          },
        ],
      };

      const extracted = extractPersistedWbsArray(serverResponse);
      expect(Array.isArray(extracted)).toBe(true);
      expect(extracted).toHaveLength(1);
      expect(extracted![0].id).toBe(2253);
      expect(extracted![0].code).toBe('1.0');
    });

    it('should extract persisted WBS array from double-nested Axios response envelope', () => {
      const axiosDoubleNested = {
        data: {
          statusCode: 200,
          message: 'Struktur WBS untuk Proyek #PRJ-2026-0037 berhasil disimpan secara atomik',
          data: [
            {
              id: 2253,
              projectId: 1359,
              code: '1.0',
              name: 'Pekerjaan Persiapan',
              level: 1,
              weightPercentage: 100,
              children: [],
            },
          ],
        },
      };

      const extracted = extractPersistedWbsArray(axiosDoubleNested);
      expect(Array.isArray(extracted)).toBe(true);
      expect(extracted).toHaveLength(1);
      expect(extracted![0].id).toBe(2253);
    });

    it('should handle direct array without modification', () => {
      const directArray = [{ id: 2253, code: '1.0', name: 'Pekerjaan Persiapan' }];
      const extracted = extractPersistedWbsArray(directArray);
      expect(extracted).toBe(directArray);
    });
  });

  /**
   * TEST 2 — PERMANENT ID PROPAGATION
   * Given client temp WBS ID and persisted server node with matching deterministic identity,
   * ASSERT: Schedule reconciliation receives permanent DB ID.
   */
  describe('TEST 2 — PERMANENT ID PROPAGATION', () => {
    it('should propagate permanent DB ID from persisted WBS tree to Schedule task matching temp ID', () => {
      const tempWbsId = 'wbs-1790551755417-temp1';
      const wbsCode = '1.0';
      const permanentDbId = 2253;

      // Unpack envelope and convert to UI tree
      const serverResponse = {
        statusCode: 200,
        message: 'Saved',
        data: [
          {
            id: permanentDbId,
            code: wbsCode,
            name: 'Pekerjaan Persiapan',
            level: 1,
            weightPercentage: 100,
            children: [],
          },
        ],
      };

      const rawNodes = extractPersistedWbsArray(serverResponse);
      expect(rawNodes).not.toBeNull();
      const serverTree = convertBackendTreeToUiNodes(rawNodes!);
      expect(assertPersistedWbsNodesHaveDbIds(serverTree)).toBe(true);

      const activeLeaves = serverTree.map((n) => ({
        id: String(n.id),
        code: n.code,
        name: n.name,
      }));

      // Schedule task referencing temp ID
      const clientScheduleTasks: ScheduleTaskItem[] = [
        {
          wbsNodeId: tempWbsId,
          wbsCode: wbsCode,
          name: 'Pekerjaan Persiapan',
          type: 'TASK',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          duration: 9,
          progress: 0,
          status: 'PLANNED',
        },
      ];

      // Pre-save mapping from client temp ID to WBS code
      const preSaveMapping = [{ id: tempWbsId, code: wbsCode }];

      const result = buildSaveProjectSchedulePayload(
        clientScheduleTasks,
        activeLeaves,
        undefined,
        preSaveMapping
      );

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.reconciledTasks).toHaveLength(1);
      expect(result.reconciledTasks[0].wbsNodeId).toBe(String(permanentDbId));
      expect(result.payload!.tasks[0].wbsId).toBe(permanentDbId);
    });
  });

  /**
   * TEST 3 — SCHEDULE PAYLOAD
   * Given one Schedule task tied to newly-created WBS:
   * ASSERT: payload task count = 1
   * ASSERT: wbsId = positive permanent DB ID
   * ASSERT: no temp ID remains.
   */
  describe('TEST 3 — SCHEDULE PAYLOAD INTEGRITY', () => {
    it('should generate valid payload with count=1, positive permanent DB ID, and 0 temporary IDs', () => {
      const tempId = 'wbs-1790551755417-temp';
      const code = '1.0';
      const permanentDbId = 2253;

      const scheduleTasks: ScheduleTaskItem[] = [
        {
          wbsNodeId: tempId,
          wbsCode: code,
          name: 'Tugas Persiapan Lapangan',
          startDate: '2026-09-05',
          endDate: '2026-09-15',
          duration: 10,
          progress: 0,
          status: 'PLANNED',
        },
      ];

      const activeLeaves = [
        { id: String(permanentDbId), code, name: 'Tugas Persiapan Lapangan' },
      ];
      const preSaveMapping = [{ id: tempId, code }];

      const result = buildSaveProjectSchedulePayload(
        scheduleTasks,
        activeLeaves,
        'Notes',
        preSaveMapping
      );

      // ASSERT: payload task count = 1
      expect(result.valid).toBe(true);
      expect(result.payload!.tasks).toHaveLength(1);

      const task = result.payload!.tasks[0];
      // ASSERT: wbsId = positive permanent DB ID
      expect(task.wbsId).toBe(permanentDbId);
      expect(typeof task.wbsId).toBe('number');
      expect(task.wbsId).toBeGreaterThan(0);

      // ASSERT: no temp ID remains
      expect(String(task.wbsId)).not.toContain('wbs-');
      expect(result.reconciledTasks[0].wbsNodeId).toBe(String(permanentDbId));
      expect(result.reconciledTasks[0].wbsNodeId).not.toContain('wbs-');
    });
  });

  /**
   * TEST 4 — MALFORMED RESPONSE
   * Given malformed/unexpected saveWbsTree response:
   * ASSERT: Schedule persistence is blocked.
   * ASSERT: stale temp WBS tree is NOT used as if persistence succeeded.
   */
  describe('TEST 4 — MALFORMED WBS RESPONSE HANDLING', () => {
    it('should return null for malformed response envelopes ensuring fail-closed behavior', () => {
      expect(extractPersistedWbsArray(null)).toBeNull();
      expect(extractPersistedWbsArray(undefined)).toBeNull();
      expect(extractPersistedWbsArray({})).toBeNull();
      expect(extractPersistedWbsArray({ statusCode: 500, error: 'Internal Error' })).toBeNull();
      expect(extractPersistedWbsArray({ data: null })).toBeNull();
      expect(extractPersistedWbsArray({ data: { message: 'no array here' } })).toBeNull();
      expect(extractPersistedWbsArray('invalid string')).toBeNull();
    });

    it('should reject persisted nodes that lack valid positive database IDs', () => {
      const nodesWithTempIds = [
        { id: 'wbs-12345', code: '1.0', name: 'Node Without DB ID', children: [] },
      ];
      expect(assertPersistedWbsNodesHaveDbIds(nodesWithTempIds as any)).toBe(false);

      const nodesWithZeroId = [
        { id: '0', code: '1.0', name: 'Node With Zero ID', children: [] },
      ];
      expect(assertPersistedWbsNodesHaveDbIds(nodesWithZeroId as any)).toBe(false);

      const emptyNodes: any[] = [];
      expect(assertPersistedWbsNodesHaveDbIds(emptyNodes)).toBe(false);
    });

    it('should block Schedule persistence when WBS nodes only have temporary client IDs (stale fallback prevented)', () => {
      const clientScheduleTasks: ScheduleTaskItem[] = [
        {
          wbsNodeId: 'wbs-stale-temp-999',
          wbsCode: '1.0',
          name: 'Task with Stale WBS',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          duration: 9,
          progress: 0,
          status: 'PLANNED',
        },
      ];

      // If Schedule was erroneously passed stale temp WBS nodes:
      const staleTempLeaves = [
        { id: 'wbs-stale-temp-999', code: '1.0', name: 'Task with Stale WBS' },
      ];

      const result = buildSaveProjectSchedulePayload(
        clientScheduleTasks,
        staleTempLeaves
      );

      // ASSERT: Schedule persistence is BLOCKED fail-closed
      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toMatch(/tidak dapat dipetakan ke ID WBS database yang valid/i);
    });
  });
});

