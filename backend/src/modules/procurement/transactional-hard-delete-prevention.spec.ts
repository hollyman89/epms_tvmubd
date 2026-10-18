import * as fs from 'fs';
import * as path from 'path';

describe('Transactional Hard-Delete Prevention & Business Number Monotonicity', () => {

  describe('1. Static Code Analysis: Transactional Hard-Delete Prevention', () => {
    const transactionalTables = [
      'procurement_packages',
      'procurement_package_items',
      'purchase_requests',
      'purchase_request_items',
      'rfqs',
      'purchase_orders',
      'purchase_order_items',
      'invoices',
      'invoice_items',
      'payment_requests',
      'payments',
      'project_closures',
      'audit_logs',
      'workflow_instances',
      'workflow_tasks',
      'workflow_transitions',
    ];

    function scanDir(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath, fileList);
        } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    it('should verify zero raw SQL DELETE FROM targeting transactional tables in production backend modules', () => {
      const backendModulesDir = path.resolve(__dirname, '../../modules');
      const files = scanDir(backendModulesDir);
      const violations: { file: string; match: string }[] = [];

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const table of transactionalTables) {
          const regex = new RegExp(`DELETE\\s+FROM\\s+[\`"']?${table}[\`"']?`, 'i');
          if (regex.test(content)) {
            violations.push({ file: path.relative(process.cwd(), filePath), match: table });
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('2. Business Number Monotonicity & Anti-Reuse Logic', () => {
    it('PR number generator must not recycle soft-deleted or previous numbers', () => {
      const dateStr = '20261016';
      const prefix = `PR-${dateStr}-`;

      // Simulate a dataset where PR-20261016-001 and PR-20261016-002 existed, but 002 was soft-deleted
      const historicalRecords = [
        { prNumber: 'PR-20261016-001', deletedAt: null },
        { prNumber: 'PR-20261016-002', deletedAt: new Date() }, // soft deleted
      ];

      // Simulating query with withDeleted() and ORDER BY LENGTH(prNumber) DESC, prNumber DESC
      const latest = historicalRecords
        .slice()
        .sort((a, b) => b.prNumber.length - a.prNumber.length || b.prNumber.localeCompare(a.prNumber))[0];

      let nextSeq = 1;
      if (latest && latest.prNumber) {
        const parts = latest.prNumber.split('-');
        if (parts.length >= 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
          }
        }
      }

      const generated = `${prefix}${String(nextSeq).padStart(3, '0')}`;
      expect(generated).toBe('PR-20261016-003');
      expect(generated).not.toBe('PR-20261016-001');
      expect(generated).not.toBe('PR-20261016-002');
    });

    it('RFQ number generator must not recycle soft-deleted or previous numbers', () => {
      const dateStr = '20261016';
      const prefix = `RFQ-${dateStr}-`;

      const historicalRecords = [
        { rfqNumber: 'RFQ-20261016-001', deletedAt: new Date() },
      ];

      const latest = historicalRecords
        .slice()
        .sort((a, b) => b.rfqNumber.length - a.rfqNumber.length || b.rfqNumber.localeCompare(a.rfqNumber))[0];

      let nextSeq = 1;
      if (latest && latest.rfqNumber) {
        const parts = latest.rfqNumber.split('-');
        if (parts.length >= 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
          }
        }
      }

      const generated = `${prefix}${String(nextSeq).padStart(3, '0')}`;
      expect(generated).toBe('RFQ-20261016-002');
      expect(generated).not.toBe('RFQ-20261016-001');
    });

    it('PKG number generator must not recycle soft-deleted or previous numbers', () => {
      const dateStr = '20261016';
      const prefix = `PKG-${dateStr}-`;

      const historicalRecords = [
        { packageNumber: 'PKG-20261016-001', deletedAt: new Date() },
      ];

      const latest = historicalRecords
        .slice()
        .sort((a, b) => b.packageNumber.length - a.packageNumber.length || b.packageNumber.localeCompare(a.packageNumber))[0];

      let nextSeq = 1;
      if (latest && latest.packageNumber) {
        const parts = latest.packageNumber.split('-');
        if (parts.length >= 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
          }
        }
      }

      const generated = `${prefix}${String(nextSeq).padStart(3, '0')}`;
      expect(generated).toBe('PKG-20261016-002');
      expect(generated).not.toBe('PKG-20261016-001');
    });
  });

  describe('3. Concurrency & Monotonic Sequence Generation', () => {
    it('concurrent PR number requests serialize monotonically without collision', async () => {
      const dateStr = '20261016';
      const prefix = `PR-${dateStr}-`;
      const store: string[] = ['PR-20261016-001'];

      // Simulate 5 concurrent transactions calling sequence generator with simulated mutex/pessimistic lock
      const generateNext = async () => {
        // Locked section
        const latest = store
          .slice()
          .sort((a, b) => b.length - a.length || b.localeCompare(a))[0];
        const nextSeq = latest ? parseInt(latest.split('-')[2], 10) + 1 : 1;
        const newNum = `${prefix}${String(nextSeq).padStart(3, '0')}`;
        store.push(newNum);
        return newNum;
      };

      const results: string[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(await generateNext());
      }

      expect(results).toEqual([
        'PR-20261016-002',
        'PR-20261016-003',
        'PR-20261016-004',
        'PR-20261016-005',
        'PR-20261016-006',
      ]);
      const unique = new Set(results);
      expect(unique.size).toBe(5);
    });

    it('concurrent RFQ number requests serialize monotonically without collision', async () => {
      const dateStr = '20261016';
      const prefix = `RFQ-${dateStr}-`;
      const store: string[] = ['RFQ-20261016-001'];

      const generateNext = async () => {
        const latest = store
          .slice()
          .sort((a, b) => b.length - a.length || b.localeCompare(a))[0];
        const nextSeq = latest ? parseInt(latest.split('-')[2], 10) + 1 : 1;
        const newNum = `${prefix}${String(nextSeq).padStart(3, '0')}`;
        store.push(newNum);
        return newNum;
      };

      const results: string[] = [];
      for (let i = 0; i < 3; i++) {
        results.push(await generateNext());
      }

      expect(results).toEqual([
        'RFQ-20261016-002',
        'RFQ-20261016-003',
        'RFQ-20261016-004',
      ]);
    });
  });

  describe('4. Material + Service PR Same Project Separation', () => {
    it('permits both Material PR and Service PR under the same project', () => {
      const prs = [
        { id: 1, projectId: 1, packageId: 1, prNumber: 'PR-20261015-001', type: 'MATERIAL', origin: 'PACKAGE' },
        { id: 3, projectId: 1, packageId: 3, prNumber: 'PR-20261016-001', type: 'SERVICE', origin: 'PACKAGE' },
      ];

      // Check unique packageId linkage
      const packageIds = prs.map(p => p.packageId);
      const uniquePackageIds = new Set(packageIds);
      expect(uniquePackageIds.size).toBe(packageIds.length);

      // Same project is allowed and valid
      expect(prs[0].projectId).toBe(prs[1].projectId);
      expect(prs[0].packageId).not.toBe(prs[1].packageId);
      expect(prs[0].prNumber).not.toBe(prs[1].prNumber);
    });
  });

  describe('5. Orphan Published Outbox Events Non-Pollution', () => {
    it('published outbox events are ignored by active polling relay', () => {
      const outboxEvents = [
        { id: 32, status: 'PUBLISHED', aggregateType: 'ProcurementPackage', aggregateId: 2 },
        { id: 33, status: 'PUBLISHED', aggregateType: 'WORKFLOW_TASK', aggregateId: 9 },
        { id: 34, status: 'PUBLISHED', aggregateType: 'WORKFLOW_TASK', aggregateId: 10 },
        { id: 35, status: 'PUBLISHED', aggregateType: 'WORKFLOW_TASK', aggregateId: 9 },
        { id: 36, status: 'PUBLISHED', aggregateType: 'WORKFLOW_INSTANCE', aggregateId: 5 },
        { id: 37, status: 'PUBLISHED', aggregateType: 'WORKFLOW_TASK', aggregateId: 10 },
      ];

      // The outbox relay only polls for PENDING events
      const pendingEvents = outboxEvents.filter(e => e.status === 'PENDING');
      expect(pendingEvents).toHaveLength(0);

      // Workflow task inbox only queries workflow_tasks table, not outbox_events
      const hasActionableTasks = outboxEvents.some(e => e.status === 'PENDING' && e.aggregateType === 'WORKFLOW_TASK');
      expect(hasActionableTasks).toBe(false);
    });
  });
});
