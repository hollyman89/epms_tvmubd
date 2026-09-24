import { test, expect } from '@playwright/test';
import {
  convertFlatWbsToTree,
  convertBackendTreeToUiNodes,
  convertUiNodesToSavePayload,
  recomputeWbsHierarchy,
  WbsNodeItem,
} from '../src/components/project/WbsTreeTableModal';
import { computeScheduledLeafWbsIds } from '../src/components/project/PmOperationalPlanReviewModal';

test.describe('WBS-1 — Persistent WBS ID Preservation Specification', () => {
  // Mock backend rows as loaded from database (GET /projects/:id/wbs)
  const existingDbRows = [
    {
      id: 101,
      projectId: 100829,
      code: '1.0',
      name: 'Persiapan & Perizinan',
      level: 1,
      weightPercentage: 40,
      description: 'Site survey dan perizinan',
      parentWbsId: null,
    },
    {
      id: 102,
      projectId: 100829,
      code: '1.1',
      name: 'Survey Jalur',
      level: 2,
      weightPercentage: 20,
      description: 'Survey rute fiber',
      parentWbsId: 101,
    },
    {
      id: 103,
      projectId: 100829,
      code: '1.2',
      name: 'Pengurusan Izin PU',
      level: 2,
      weightPercentage: 20,
      description: 'Izin galian PU',
      parentWbsId: 101,
    },
    {
      id: 104,
      projectId: 100829,
      code: '2.0',
      name: 'Pengadaan & Penarikan',
      level: 1,
      weightPercentage: 60,
      description: 'Material dan instalasi',
      parentWbsId: null,
    },
  ];

  test('Test A: Load existing WBS preserves dbId from database rows', () => {
    const tree = convertFlatWbsToTree(existingDbRows);
    expect(tree).toHaveLength(2);

    const root1 = tree[0];
    expect(root1.dbId).toBe(101);
    expect(root1.code).toBe('1.0');
    expect(root1.children).toHaveLength(2);
    expect(root1.children![0].dbId).toBe(102);
    expect(root1.children![0].code).toBe('1.1');
    expect(root1.children![1].dbId).toBe(103);
    expect(root1.children![1].code).toBe('1.2');

    const root2 = tree[1];
    expect(root2.dbId).toBe(104);
    expect(root2.code).toBe('2.0');

    // Also test nested backend tree adapter (convertBackendTreeToUiNodes)
    const nestedBackend = [
      {
        id: 201,
        code: '1.0',
        name: 'Root Node',
        level: 1,
        weightPercentage: 100,
        children: [
          {
            id: 202,
            code: '1.1',
            name: 'Child Node',
            level: 2,
            weightPercentage: 100,
          },
        ],
      },
    ];
    const uiNodes = convertBackendTreeToUiNodes(nestedBackend);
    expect(uiNodes[0].dbId).toBe(201);
    expect(uiNodes[0].children![0].dbId).toBe(202);
  });

  test('Test B: Edit existing WBS maintains dbId and maps to payload.id = existing DB ID', () => {
    const tree = convertFlatWbsToTree(existingDbRows);

    // Simulate user editing node 1.1 in UI
    const editedTree = tree.map((root) => {
      if (root.dbId === 101) {
        return {
          ...root,
          children: (root.children || []).map((child) => {
            if (child.dbId === 102) {
              return {
                ...child,
                name: 'Survey Jalur (Updated Name)',
                weightPercentage: 25,
              };
            }
            return child;
          }),
        };
      }
      return root;
    });

    const payload = convertUiNodesToSavePayload(editedTree);
    expect(payload[0].id).toBe(101);
    expect(payload[0].children[0].id).toBe(102);
    expect(payload[0].children[0].name).toBe('Survey Jalur (Updated Name)');
    expect(payload[0].children[0].weightPercentage).toBe(25);
    expect(payload[0].children[1].id).toBe(103);
    expect(payload[1].id).toBe(104);
  });

  test('Test C: Reorder WBS preserves dbId on respective nodes', () => {
    const tree = convertFlatWbsToTree(existingDbRows);
    expect(tree[0].dbId).toBe(101);
    expect(tree[1].dbId).toBe(104);

    // Reorder root nodes (swap 1.0 and 2.0)
    const reorderedTree = [tree[1], tree[0]];
    const recomputed = recomputeWbsHierarchy(reorderedTree);

    // Now first root is node 104 with new code 1.0
    expect(recomputed[0].dbId).toBe(104);
    expect(recomputed[0].code).toBe('1.0');

    // Second root is node 101 with new code 2.0
    expect(recomputed[1].dbId).toBe(101);
    expect(recomputed[1].code).toBe('2.0');

    // Children of node 101 still belong to node 101 and have their persistent dbIds
    expect(recomputed[1].children![0].dbId).toBe(102);
    expect(recomputed[1].children![0].code).toBe('2.1');
    expect(recomputed[1].children![1].dbId).toBe(103);
    expect(recomputed[1].children![1].code).toBe('2.2');

    // Payload preserves correct IDs
    const payload = convertUiNodesToSavePayload(recomputed);
    expect(payload[0].id).toBe(104);
    expect(payload[1].id).toBe(101);
    expect(payload[1].children[0].id).toBe(102);
  });

  test('Test D: Rename / recompute code preserves dbId', () => {
    const tree = convertFlatWbsToTree(existingDbRows);

    // Renumbering / recomputing hierarchy must keep dbIds intact
    const recomputed = recomputeWbsHierarchy(tree);
    expect(recomputed[0].dbId).toBe(101);
    expect(recomputed[0].children![0].dbId).toBe(102);
    expect(recomputed[0].children![1].dbId).toBe(103);
    expect(recomputed[1].dbId).toBe(104);
  });

  test('Test E: Add new WBS node has dbId undefined and payload.id absent', () => {
    const tree = convertFlatWbsToTree(existingDbRows);

    // Add new child under node 101
    const newNode: WbsNodeItem = {
      id: `wbs-${Date.now()}-abcde`,
      dbId: undefined, // Truly new UI node
      code: '',
      name: 'Testing FO Baru',
      level: 2,
      weightPercentage: 10,
      description: 'Pekerjaan baru',
      parentId: '101',
      children: [],
    };

    const treeWithNew = tree.map((root) => {
      if (root.dbId === 101) {
        return {
          ...root,
          children: [...(root.children || []), newNode],
        };
      }
      return root;
    });

    const recomputed = recomputeWbsHierarchy(treeWithNew);
    const addedChild = recomputed[0].children![2];

    expect(addedChild.name).toBe('Testing FO Baru');
    expect(addedChild.code).toBe('1.3');
    expect(addedChild.dbId).toBeUndefined();

    // Payload check
    const payload = convertUiNodesToSavePayload(recomputed);
    const payloadAdded = payload[0].children[2];
    expect(payloadAdded.name).toBe('Testing FO Baru');
    expect(payloadAdded.id).toBeUndefined(); // MUST be undefined so backend INSERTs
  });

  test('Test F: Save payload differentiates UPDATE (id: number) vs INSERT (id: undefined)', () => {
    const mixedNodes: WbsNodeItem[] = [
      {
        id: '101',
        dbId: 101,
        code: '1.0',
        name: 'Existing Root',
        level: 1,
        weightPercentage: 50,
        children: [
          {
            id: '102',
            dbId: 102,
            code: '1.1',
            name: 'Existing Child',
            level: 2,
            weightPercentage: 25,
            children: [],
          },
          {
            id: 'wbs-temp-12345',
            dbId: undefined,
            code: '1.2',
            name: 'New Child To Insert',
            level: 2,
            weightPercentage: 25,
            children: [],
          },
        ],
      },
      {
        id: 'wbs-temp-99999',
        dbId: undefined,
        code: '2.0',
        name: 'New Root To Insert',
        level: 1,
        weightPercentage: 50,
        children: [],
      },
    ];

    const payload = convertUiNodesToSavePayload(mixedNodes);

    // Node 101 -> UPDATE (has id: 101)
    expect(payload[0].id).toBe(101);
    expect(payload[0].code).toBe('1.0');

    // Child 102 -> UPDATE (has id: 102)
    expect(payload[0].children[0].id).toBe(102);
    expect(payload[0].children[0].code).toBe('1.1');

    // Child 1.2 -> INSERT (id is undefined)
    expect(payload[0].children[1].id).toBeUndefined();
    expect(payload[0].children[1].code).toBe('1.2');

    // Node 2.0 -> INSERT (id is undefined)
    expect(payload[1].id).toBeUndefined();
    expect(payload[1].code).toBe('2.0');
  });

  test('Test G: No duplicate insert for existing code (existing code keeps persistent id)', () => {
    // Before fix: payload id was undefined for existing node '1.0'
    // Resulted in QueryFailedError: Duplicate entry '100829-1.0' for key 'uk_wbs_project_code'
    // With fix: existing node '1.0' strictly produces payload.id = 101
    const tree = convertFlatWbsToTree(existingDbRows);
    const payload = convertUiNodesToSavePayload(tree);

    const code1Node = payload.find((p) => p.code === '1.0');
    expect(code1Node).toBeDefined();
    expect(code1Node.id).toBe(101); // Identifies as UPDATE on existing row 101, never blank INSERT
  });
});

test.describe('P2.1-A.1 — Schedule <-> Leaf WBS Matching & Cardinality', () => {
  const leaves = [
    { id: '101', dbId: 101, code: '1.1' },
    { id: '102', dbId: 102, code: '1.2' },
  ];

  test('Test H1: 1 leaf + 1 valid task -> scheduled', () => {
    const schedules: any[] = [
      { id: 1, wbsNodeId: '101', name: 'Task 1.1', startDate: '2026-09-20', endDate: '2026-09-25' },
    ];
    const scheduledIds = computeScheduledLeafWbsIds([leaves[0]], schedules);
    expect(scheduledIds.size).toBe(1);
    expect(scheduledIds.has('101')).toBe(true);
  });

  test('Test H2: 1 leaf + multiple tasks (one without date, one valid) -> scheduled', () => {
    const schedules: any[] = [
      { id: 1, wbsNodeId: '101', name: 'Task 1.1 Unscheduled', startDate: null, endDate: null },
      { id: 2, wbsNodeId: '101', name: 'Task 1.1 Scheduled', startDate: '2026-09-20', endDate: '2026-09-25' },
    ];
    // Previously .find() returned the first task (unscheduled) and failed.
    // With .some(), it inspects all tasks and correctly marks leaf 101 as scheduled.
    const scheduledIds = computeScheduledLeafWbsIds([leaves[0]], schedules);
    expect(scheduledIds.size).toBe(1);
    expect(scheduledIds.has('101')).toBe(true);
  });

  test('Test H3: 1 leaf + all tasks invalid dates -> unscheduled', () => {
    const schedules: any[] = [
      { id: 1, wbsNodeId: '101', name: 'Task 1.1 Draft 1', startDate: null, endDate: null },
      { id: 2, wbsNodeId: '101', name: 'Task 1.1 Inverted', startDate: '2026-09-25', endDate: '2026-09-20' },
    ];
    const scheduledIds = computeScheduledLeafWbsIds([leaves[0]], schedules);
    expect(scheduledIds.size).toBe(0);
    expect(scheduledIds.has('101')).toBe(false);
  });

  test('Test H4: Standalone milestone not linked to leaf -> not counted as leaf deliverable', () => {
    const schedules: any[] = [
      { id: 99, wbsNodeId: null, wbsCode: null, isMilestone: true, type: 'MILESTONE', startDate: '2026-09-25' },
    ];
    const scheduledIds = computeScheduledLeafWbsIds([leaves[0]], schedules);
    expect(scheduledIds.size).toBe(0);
  });

  test('Test H5: Multiple leaves with multiple tasks + milestones -> exact unique leaf cardinality', () => {
    const schedules: any[] = [
      // Leaf 101 has two tasks (both scheduled)
      { id: 1, wbsNodeId: '101', startDate: '2026-09-20', endDate: '2026-09-22' },
      { id: 2, wbsNodeId: '101', startDate: '2026-09-23', endDate: '2026-09-25' },
      // Leaf 102 has one milestone linked by wbsCode
      { id: 3, wbsCode: '1.2', isMilestone: true, startDate: '2026-09-26' },
      // Standalone milestone
      { id: 4, isMilestone: true, startDate: '2026-09-30' },
    ];
    const scheduledIds = computeScheduledLeafWbsIds(leaves, schedules);
    expect(scheduledIds.size).toBe(2);
    expect(scheduledIds.has('101')).toBe(true);
    expect(scheduledIds.has('102')).toBe(true);
  });
});
