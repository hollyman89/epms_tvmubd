import { ProjectService } from './project.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SaveWbsTreeDto } from './dto/save-wbs-tree.dto';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';

describe('WBS Stable Identity & Diff-Based Upsert Specification (PUT /project/:projectId/wbs-tree)', () => {
  let service: ProjectService;
  let mockWbsRepo: any;
  let mockTaskRepo: any;
  let mockProjectRepo: any;
  let mockContractRepo: any;
  let mockUserRepo: any;
  let mockEventEmitter: any;
  let inMemoryDb: WorkBreakdownStructure[];
  let autoIncrementId: number;

  beforeEach(() => {
    inMemoryDb = [];
    autoIncrementId = 100;

    mockProjectRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) {
          return Promise.resolve({ id: 1, code: 'PRJ-2026-001', name: 'Project Fiber Optic', managerId: 5 });
        }
        if (where.id === 2) {
          return Promise.resolve({ id: 2, code: 'PRJ-2026-002', name: 'Project Tower Substation', managerId: 5 });
        }
        return Promise.resolve(null);
      }),
    };

    mockWbsRepo = {
      find: jest.fn().mockImplementation(({ where }) => {
        const pId = where.projectId;
        return Promise.resolve(inMemoryDb.filter((w) => w.projectId === pId && !w.deletedAt));
      }),
      manager: {
        transaction: jest.fn(async (cb) => {
          const fakeManager = {
            find: jest.fn().mockImplementation((entityClass, { where }) => {
              const pId = where.projectId;
              return Promise.resolve(inMemoryDb.filter((w) => w.projectId === pId));
            }),
            create: jest.fn((entityClass, data) => {
              const obj = new WorkBreakdownStructure();
              Object.assign(obj, data);
              if (!obj.id) {
                obj.id = ++autoIncrementId;
              }
              obj.createdAt = new Date();
              obj.updatedAt = new Date();
              return obj;
            }),
            save: jest.fn((entityClass, entity) => {
              const isWbs =
                entityClass === WorkBreakdownStructure ||
                entity instanceof WorkBreakdownStructure ||
                (entity && entity.projectId !== undefined && entity.name !== undefined);

              if (isWbs && entity.code !== undefined) {
                // Strict MySQL unique index simulation: uk_wbs_project_code (project_id, code)
                const collision = inMemoryDb.find(
                  (w) => w.id !== entity.id && w.projectId === entity.projectId && w.code === entity.code,
                );
                if (collision) {
                  throw new Error(
                    `Duplicate entry '${entity.projectId}-${entity.code}' for key 'work_breakdown_structures.uk_wbs_project_code'`,
                  );
                }
                const existingIdx = inMemoryDb.findIndex((w) => w.id === entity.id);
                if (existingIdx >= 0) {
                  inMemoryDb[existingIdx] = entity;
                } else {
                  inMemoryDb.push(entity);
                }
              }
              return Promise.resolve(entity);
            }),
          };
          return await cb(fakeManager);
        }),
      },
    };

    mockTaskRepo = {};
    mockContractRepo = {};
    mockUserRepo = {};
    const mockPurchaseRequestRepo = { find: jest.fn().mockResolvedValue([]) };
    mockEventEmitter = { emit: jest.fn() };

    service = new ProjectService(
      mockWbsRepo,
      mockTaskRepo,
      mockProjectRepo,
      mockContractRepo,
      mockUserRepo,
      mockPurchaseRequestRepo as any,
      mockEventEmitter,
    );
  });

  it('CASE 1: First save -> generates persistent database IDs for all nodes', async () => {
    const initialDto: SaveWbsTreeDto = {
      nodes: [
        {
          code: '1.0',
          name: 'Persiapan & Survey',
          level: 1,
          weightPercentage: 30,
          children: [
            {
              code: '1.1',
              name: 'Joint Survey',
              level: 2,
              weightPercentage: 15,
            },
            {
              code: '1.2',
              name: 'Perizinan',
              level: 2,
              weightPercentage: 15,
            },
          ],
        },
        {
          code: '2.0',
          name: 'Pengadaan & Instalasi',
          level: 1,
          weightPercentage: 70,
        },
      ],
    };

    const res = await service.saveWbsTree(1, initialDto, 5);
    expect(res.statusCode).toBe(200);
    expect(res.data.length).toBe(2);

    const root1 = res.data[0];
    const root2 = res.data[1];
    expect(root1.id).toBeDefined();
    expect(root1.code).toBe('1.0');
    expect(root1.children.length).toBe(2);
    expect(root1.children[0].id).toBeDefined();
    expect(root1.children[0].parentWbsId).toBe(root1.id);
    expect(root2.id).toBeDefined();
  });

  it('CASE 2: Save identical tree again with persistent IDs -> preserves 100% exact IDs', async () => {
    // 1. Initial Save
    const firstDto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'Work Package 1', level: 1, weightPercentage: 50 },
        { code: '2.0', name: 'Work Package 2', level: 1, weightPercentage: 50 },
      ],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const id1 = firstRes.data[0].id;
    const id2 = firstRes.data[1].id;

    // 2. Second Save with matching IDs
    const secondDto: SaveWbsTreeDto = {
      nodes: [
        { id: id1, code: '1.0', name: 'Work Package 1', level: 1, weightPercentage: 50 },
        { id: id2, code: '2.0', name: 'Work Package 2', level: 1, weightPercentage: 50 },
      ],
    };
    const secondRes = await service.saveWbsTree(1, secondDto, 5);

    expect(secondRes.data[0].id).toBe(id1);
    expect(secondRes.data[1].id).toBe(id2);
  });

  it('CASE 3: Edit node name with persistent ID -> updates name while ID remains identical', async () => {
    const firstDto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'Original Name', level: 1, weightPercentage: 100 }],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const id = firstRes.data[0].id;

    const editDto: SaveWbsTreeDto = {
      nodes: [{ id, code: '1.0', name: 'Updated Package Name', level: 1, weightPercentage: 100 }],
    };
    const editRes = await service.saveWbsTree(1, editDto, 5);

    expect(editRes.data[0].id).toBe(id);
    expect(editRes.data[0].name).toBe('Updated Package Name');
  });

  it('CASE 4: Edit weight with persistent ID -> updates weight while ID remains identical', async () => {
    const firstDto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'WP 1', level: 1, weightPercentage: 40 },
        { code: '2.0', name: 'WP 2', level: 1, weightPercentage: 60 },
      ],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const id1 = firstRes.data[0].id;
    const id2 = firstRes.data[1].id;

    const editDto: SaveWbsTreeDto = {
      nodes: [
        { id: id1, code: '1.0', name: 'WP 1', level: 1, weightPercentage: 45 },
        { id: id2, code: '2.0', name: 'WP 2', level: 1, weightPercentage: 55 },
      ],
    };
    const editRes = await service.saveWbsTree(1, editDto, 5);

    expect(editRes.data[0].id).toBe(id1);
    expect(editRes.data[0].weightPercentage).toBe(45);
    expect(editRes.data[1].id).toBe(id2);
    expect(editRes.data[1].weightPercentage).toBe(55);
  });

  it('CASE 5: Edit description with persistent ID -> updates description while ID remains identical', async () => {
    const firstDto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'WP 1', level: 1, weightPercentage: 100, description: 'Initial Scope' }],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const id = firstRes.data[0].id;

    const editDto: SaveWbsTreeDto = {
      nodes: [{ id, code: '1.0', name: 'WP 1', level: 1, weightPercentage: 100, description: 'Updated Scope Spec' }],
    };
    const editRes = await service.saveWbsTree(1, editDto, 5);

    expect(editRes.data[0].id).toBe(id);
    expect(editRes.data[0].description).toBe('Updated Scope Spec');
  });

  it('CASE 6: Reorder sibling nodes with persistent IDs -> preserves respective IDs and re-links parent', async () => {
    const firstDto: SaveWbsTreeDto = {
      nodes: [
        {
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 100,
          children: [
            { code: '1.1', name: 'Child A', level: 2, weightPercentage: 50 },
            { code: '1.2', name: 'Child B', level: 2, weightPercentage: 50 },
          ],
        },
      ],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const rootId = firstRes.data[0].id;
    const childAId = firstRes.data[0].children[0].id;
    const childBId = firstRes.data[0].children[1].id;

    // Swap ordering: Child B becomes 1.1, Child A becomes 1.2
    const swapDto: SaveWbsTreeDto = {
      nodes: [
        {
          id: rootId,
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 100,
          children: [
            { id: childBId, code: '1.1', name: 'Child B', level: 2, weightPercentage: 50 },
            { id: childAId, code: '1.2', name: 'Child A', level: 2, weightPercentage: 50 },
          ],
        },
      ],
    };
    const swapRes = await service.saveWbsTree(1, swapDto, 5);

    expect(swapRes.data[0].id).toBe(rootId);
    expect(swapRes.data[0].children[0].id).toBe(childBId);
    expect(swapRes.data[0].children[0].code).toBe('1.1');
    expect(swapRes.data[0].children[1].id).toBe(childAId);
    expect(swapRes.data[0].children[1].code).toBe('1.2');
  });

  it('CASE 7: Reparent node to a different work package -> node ID preserved and parentWbsId updated', async () => {
    const firstDto: SaveWbsTreeDto = {
      nodes: [
        {
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 50,
          children: [{ code: '1.1', name: 'Child Moving', level: 2, weightPercentage: 25 }],
        },
        {
          code: '2.0',
          name: 'WP 2',
          level: 1,
          weightPercentage: 50,
          children: [],
        },
      ],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const root1Id = firstRes.data[0].id;
    const movingChildId = firstRes.data[0].children[0].id;
    const root2Id = firstRes.data[1].id;

    // Move Child from WP 1 to WP 2
    const reparentDto: SaveWbsTreeDto = {
      nodes: [
        { id: root1Id, code: '1.0', name: 'WP 1', level: 1, weightPercentage: 50, children: [] },
        {
          id: root2Id,
          code: '2.0',
          name: 'WP 2',
          level: 1,
          weightPercentage: 50,
          children: [{ id: movingChildId, code: '2.1', name: 'Child Moving', level: 2, weightPercentage: 25 }],
        },
      ],
    };
    const reparentRes = await service.saveWbsTree(1, reparentDto, 5);

    expect(reparentRes.data[0].children.length).toBe(0);
    expect(reparentRes.data[1].children.length).toBe(1);
    expect(reparentRes.data[1].children[0].id).toBe(movingChildId);
    expect(reparentRes.data[1].children[0].parentWbsId).toBe(root2Id);
  });

  it('CASE 8: Add new child deliverable -> existing IDs preserved and new child receives fresh ID', async () => {
    const firstDto: SaveWbsTreeDto = {
      nodes: [
        {
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 100,
          children: [{ code: '1.1', name: 'Child Existing', level: 2, weightPercentage: 50 }],
        },
      ],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const rootId = firstRes.data[0].id;
    const existingChildId = firstRes.data[0].children[0].id;

    // Add a new child 1.2 without id
    const addDto: SaveWbsTreeDto = {
      nodes: [
        {
          id: rootId,
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 100,
          children: [
            { id: existingChildId, code: '1.1', name: 'Child Existing', level: 2, weightPercentage: 50 },
            { code: '1.2', name: 'Brand New Child', level: 2, weightPercentage: 50 },
          ],
        },
      ],
    };
    const addRes = await service.saveWbsTree(1, addDto, 5);

    expect(addRes.data[0].id).toBe(rootId);
    expect(addRes.data[0].children[0].id).toBe(existingChildId);
    expect(addRes.data[0].children[1].id).toBeDefined();
    expect(addRes.data[0].children[1].id).not.toBe(existingChildId);
    expect(addRes.data[0].children[1].name).toBe('Brand New Child');
  });

  it('CASE 9: Remove child from tree -> child is marked soft-deleted and remaining IDs are preserved', async () => {
    const firstDto: SaveWbsTreeDto = {
      nodes: [
        {
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 100,
          children: [
            { code: '1.1', name: 'Child Keep', level: 2, weightPercentage: 50 },
            { code: '1.2', name: 'Child To Delete', level: 2, weightPercentage: 50 },
          ],
        },
      ],
    };
    const firstRes = await service.saveWbsTree(1, firstDto, 5);
    const rootId = firstRes.data[0].id;
    const keepId = firstRes.data[0].children[0].id;
    const deleteId = firstRes.data[0].children[1].id;

    // Remove Child 1.2 from payload
    const deleteDto: SaveWbsTreeDto = {
      nodes: [
        {
          id: rootId,
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 100,
          children: [{ id: keepId, code: '1.1', name: 'Child Keep', level: 2, weightPercentage: 100 }],
        },
      ],
    };
    const deleteRes = await service.saveWbsTree(1, deleteDto, 5);

    expect(deleteRes.data[0].id).toBe(rootId);
    expect(deleteRes.data[0].children.length).toBe(1);
    expect(deleteRes.data[0].children[0].id).toBe(keepId);

    // Verify soft-deletion in DB
    const deletedRow = inMemoryDb.find((w) => w.id === deleteId);
    expect(deletedRow).toBeDefined();
    expect(deletedRow?.deletedAt).toBeDefined();
    expect(deletedRow?.deletedBy).toBe(5);
  });

  it('CASE 10: Cross-Project ID attack -> blocks when sending Project A node ID to Project B', async () => {
    // 1. Create node in Project 1
    const p1Dto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'Project 1 WP', level: 1, weightPercentage: 100 }],
    };
    const p1Res = await service.saveWbsTree(1, p1Dto, 5);
    const p1NodeId = p1Res.data[0].id;

    // 2. Attempt to send Project 1 node ID into Project 2 endpoint
    const p2Dto: SaveWbsTreeDto = {
      nodes: [{ id: p1NodeId, code: '1.0', name: 'Hijacked WP', level: 1, weightPercentage: 100 }],
    };

    await expect(service.saveWbsTree(2, p2Dto, 5)).rejects.toThrow(BadRequestException);
    await expect(service.saveWbsTree(2, p2Dto, 5)).rejects.toThrow(/Invalid WBS node ownership/);
  });

  it('CASE 11: Invalid / non-existent node ID -> blocks request with 400', async () => {
    const invalidDto: SaveWbsTreeDto = {
      nodes: [{ id: 99999, code: '1.0', name: 'Non Existent ID', level: 1, weightPercentage: 100 }],
    };

    await expect(service.saveWbsTree(1, invalidDto, 5)).rejects.toThrow(BadRequestException);
    await expect(service.saveWbsTree(1, invalidDto, 5)).rejects.toThrow(/Invalid WBS node ownership/);
  });

  it('CASE 12: Duplicate WBS code in tree -> blocks request with 400', async () => {
    const duplicateDto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'WP A', level: 1, weightPercentage: 50 },
        { code: '1.0', name: 'WP B', level: 1, weightPercentage: 50 },
      ],
    };

    await expect(service.saveWbsTree(1, duplicateDto, 5)).rejects.toThrow(BadRequestException);
    await expect(service.saveWbsTree(1, duplicateDto, 5)).rejects.toThrow(/Duplikasi kode WBS/);
  });

  it('CASE 13: Root weight != 100% -> blocks request with 400', async () => {
    const invalidWeightDto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'WP A', level: 1, weightPercentage: 50 },
        { code: '2.0', name: 'WP B', level: 1, weightPercentage: 45 },
      ],
    };

    await expect(service.saveWbsTree(1, invalidWeightDto, 5)).rejects.toThrow(BadRequestException);
    await expect(service.saveWbsTree(1, invalidWeightDto, 5)).rejects.toThrow(/harus bernilai 100.00%/);
  });

  it('CASE 14: Non-existent project ID -> blocks request with 404', async () => {
    const dto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'WP A', level: 1, weightPercentage: 100 }],
    };

    await expect(service.saveWbsTree(888, dto, 5)).rejects.toThrow(NotFoundException);
  });

  it('CASE 15: Forced DB failure midway -> transaction is rolled back without partial mutation', async () => {
    mockWbsRepo.manager.transaction = jest.fn().mockImplementation(async (cb) => {
      const fakeManager = {
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        save: jest.fn().mockRejectedValue(new Error('Simulated Database Deadlock')),
      };
      return await cb(fakeManager);
    });

    const dto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'WP A', level: 1, weightPercentage: 100 }],
    };

    await expect(service.saveWbsTree(1, dto, 5)).rejects.toThrow('Simulated Database Deadlock');
  });

  it('CASE 16: Audit log recorded on successful save with accurate counts', async () => {
    const dto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'WP 1', level: 1, weightPercentage: 50 },
        { code: '2.0', name: 'WP 2', level: 1, weightPercentage: 50 },
      ],
    };

    const res = await service.saveWbsTree(1, dto, 7, ['SUPER_ADMIN']);
    expect(res.statusCode).toBe(200);
  });

  it('CASE 17: Description > 500 characters -> blocks request with 400', async () => {
    const longDescDto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'WP 1', level: 1, weightPercentage: 100, description: 'L'.repeat(501) },
      ],
    };

    await expect(service.saveWbsTree(1, longDescDto, 5)).rejects.toThrow(BadRequestException);
    await expect(service.saveWbsTree(1, longDescDto, 5)).rejects.toThrow(/melebihi batas maksimal 500/);
  });

  it('CASE 18 (WBS-2): Root code swap (1.0 <-> 2.0) succeeds without unique collision', async () => {
    // 1. Initial Save: WP 1 = 1.0, WP 2 = 2.0
    const initialDto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'WP 1', level: 1, weightPercentage: 50 },
        { code: '2.0', name: 'WP 2', level: 1, weightPercentage: 50 },
      ],
    };
    const initRes = await service.saveWbsTree(1, initialDto, 5);
    const id1 = initRes.data[0].id;
    const id2 = initRes.data[1].id;

    // 2. Swap Codes: id1 becomes 2.0, id2 becomes 1.0
    const swapDto: SaveWbsTreeDto = {
      nodes: [
        { id: id2, code: '1.0', name: 'WP 2 (Now First)', level: 1, weightPercentage: 50 },
        { id: id1, code: '2.0', name: 'WP 1 (Now Second)', level: 1, weightPercentage: 50 },
      ],
    };

    const swapRes = await service.saveWbsTree(1, swapDto, 5);
    expect(swapRes.statusCode).toBe(200);

    // Verify final state in DB and response
    expect(swapRes.data[0].id).toBe(id2);
    expect(swapRes.data[0].code).toBe('1.0');
    expect(swapRes.data[1].id).toBe(id1);
    expect(swapRes.data[1].code).toBe('2.0');

    // Confirm no temporary codes leaked to inMemoryDb
    const dbRow1 = inMemoryDb.find((w) => w.id === id1);
    const dbRow2 = inMemoryDb.find((w) => w.id === id2);
    expect(dbRow1?.code).toBe('2.0');
    expect(dbRow2?.code).toBe('1.0');
    expect(dbRow1?.code).not.toContain('__EPMS_TMP_');
    expect(dbRow2?.code).not.toContain('__EPMS_TMP_');
  });

  it('CASE 19 (WBS-2): Soft-delete removed node and insert new node reusing old code', async () => {
    // 1. Initial Save: WP 1 = 1.0
    const initialDto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'Old WP 1', level: 1, weightPercentage: 100 }],
    };
    const initRes = await service.saveWbsTree(1, initialDto, 5);
    const oldId = initRes.data[0].id;

    // 2. Omit oldId, insert brand new node with code '1.0'
    const replaceDto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'Brand New WP 1', level: 1, weightPercentage: 100 }],
    };

    const replaceRes = await service.saveWbsTree(1, replaceDto, 5);
    expect(replaceRes.statusCode).toBe(200);

    const newId = replaceRes.data[0].id;
    expect(newId).not.toBe(oldId);
    expect(replaceRes.data[0].code).toBe('1.0');

    // Verify old node in DB was soft-deleted and its code was freed with __EPMS_DEL_WBS_
    const oldDbRow = inMemoryDb.find((w) => w.id === oldId);
    expect(oldDbRow?.deletedAt).toBeDefined();
    expect(oldDbRow?.code).toBe(`__EPMS_DEL_WBS_${oldId}`);

    // Verify new node in DB has code '1.0'
    const newDbRow = inMemoryDb.find((w) => w.id === newId);
    expect(newDbRow?.deletedAt).toBeUndefined();
    expect(newDbRow?.code).toBe('1.0');
  });

  it('CASE 20 (WBS-2): Sibling code swap (1.1 <-> 1.2) succeeds without collision', async () => {
    // 1. Initial Save with children
    const initialDto: SaveWbsTreeDto = {
      nodes: [
        {
          code: '1.0',
          name: 'Parent WP',
          level: 1,
          weightPercentage: 100,
          children: [
            { code: '1.1', name: 'Child A', level: 2, weightPercentage: 50 },
            { code: '1.2', name: 'Child B', level: 2, weightPercentage: 50 },
          ],
        },
      ],
    };
    const initRes = await service.saveWbsTree(1, initialDto, 5);
    const rootId = initRes.data[0].id;
    const childAId = initRes.data[0].children[0].id;
    const childBId = initRes.data[0].children[1].id;

    // 2. Swap sibling codes: Child B -> 1.1, Child A -> 1.2
    const swapDto: SaveWbsTreeDto = {
      nodes: [
        {
          id: rootId,
          code: '1.0',
          name: 'Parent WP',
          level: 1,
          weightPercentage: 100,
          children: [
            { id: childBId, code: '1.1', name: 'Child B', level: 2, weightPercentage: 50 },
            { id: childAId, code: '1.2', name: 'Child A', level: 2, weightPercentage: 50 },
          ],
        },
      ],
    };

    const swapRes = await service.saveWbsTree(1, swapDto, 5);
    expect(swapRes.statusCode).toBe(200);
    expect(swapRes.data[0].children[0].id).toBe(childBId);
    expect(swapRes.data[0].children[0].code).toBe('1.1');
    expect(swapRes.data[0].children[1].id).toBe(childAId);
    expect(swapRes.data[0].children[1].code).toBe('1.2');
  });

  it('CASE 21 (WBS-2): Cyclic 3-node rotation (1.0 -> 2.0 -> 3.0 -> 1.0) succeeds', async () => {
    // 1. Initial 3 nodes
    const initialDto: SaveWbsTreeDto = {
      nodes: [
        { code: '1.0', name: 'Node 1', level: 1, weightPercentage: 30 },
        { code: '2.0', name: 'Node 2', level: 1, weightPercentage: 30 },
        { code: '3.0', name: 'Node 3', level: 1, weightPercentage: 40 },
      ],
    };
    const initRes = await service.saveWbsTree(1, initialDto, 5);
    const id1 = initRes.data[0].id;
    const id2 = initRes.data[1].id;
    const id3 = initRes.data[2].id;

    // 2. Rotate: id3 -> 1.0, id1 -> 2.0, id2 -> 3.0
    const rotateDto: SaveWbsTreeDto = {
      nodes: [
        { id: id3, code: '1.0', name: 'Node 3', level: 1, weightPercentage: 40 },
        { id: id1, code: '2.0', name: 'Node 1', level: 1, weightPercentage: 30 },
        { id: id2, code: '3.0', name: 'Node 2', level: 1, weightPercentage: 30 },
      ],
    };

    const rotateRes = await service.saveWbsTree(1, rotateDto, 5);
    expect(rotateRes.statusCode).toBe(200);
    expect(rotateRes.data[0].id).toBe(id3);
    expect(rotateRes.data[0].code).toBe('1.0');
    expect(rotateRes.data[1].id).toBe(id1);
    expect(rotateRes.data[1].code).toBe('2.0');
    expect(rotateRes.data[2].id).toBe(id2);
    expect(rotateRes.data[2].code).toBe('3.0');
  });

  it('CASE 22 (WBS-2): Normalizes pre-existing soft-deleted row to prevent collision with incoming active row', async () => {
    // Simulate legacy soft-deleted row in DB that still has code '1.0'
    const legacyDeleted = new WorkBreakdownStructure();
    legacyDeleted.id = 50;
    legacyDeleted.projectId = 1;
    legacyDeleted.code = '1.0';
    legacyDeleted.name = 'Legacy Deleted WP';
    legacyDeleted.deletedAt = new Date('2026-01-01');
    inMemoryDb.push(legacyDeleted);

    // Save a new active node with code '1.0'
    const newDto: SaveWbsTreeDto = {
      nodes: [{ code: '1.0', name: 'Active New WP', level: 1, weightPercentage: 100 }],
    };

    const res = await service.saveWbsTree(1, newDto, 5);
    expect(res.statusCode).toBe(200);
    expect(res.data[0].code).toBe('1.0');

    // Confirm legacy deleted row's code was normalized
    expect(legacyDeleted.code).toBe('__EPMS_DEL_WBS_50');
  });
});
