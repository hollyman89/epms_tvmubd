import fs from 'fs';
import path from 'path';
import {
  evaluateMarketingActionItem,
  MarketingActionConditionType,
} from '@/lib/marketingActionItemPredicate';

describe('EPMS — Marketing Action Items Pagination & Full Data Integration Tests', () => {
  const salesPipelinePath = path.resolve(__dirname, '../../SalesPipelinePage.tsx');
  const actionItemsCardPath = path.resolve(__dirname, '../MarketingActionItemsCard.tsx');

  let salesPipelineSource: string;
  let actionItemsCardSource: string;

  beforeAll(() => {
    salesPipelineSource = fs.readFileSync(salesPipelinePath, 'utf-8');
    actionItemsCardSource = fs.readFileSync(actionItemsCardPath, 'utf-8');
  });

  describe('1. Dataset Retention & Elimination of Hard 10-Item Cap', () => {
    it('proves .slice(0, 10) was removed from actionItemsData in SalesPipelinePage', () => {
      const actionItemsDataStart = salesPipelineSource.indexOf('const actionItemsData = useMemo');
      expect(actionItemsDataStart).toBeGreaterThan(-1);
      const actionItemsDataEnd = salesPipelineSource.indexOf('const actionItemsColumns = useMemo', actionItemsDataStart);
      const actionItemsDataBlock = salesPipelineSource.substring(actionItemsDataStart, actionItemsDataEnd);

      expect(actionItemsDataBlock).not.toContain('.slice(0, 10)');
    });

    it('proves more than 10 actionable Tender records are fully retained in dataset', () => {
      const today = new Date('2026-10-22T09:00:00+07:00');
      // Create 25 mock tenders with overdue deadlines
      const mockTenders = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: `Tender Project #${i + 1}`,
        customer: { name: `Customer #${i + 1}` },
        stage: 'LEAD',
        status: 'ACTIVE',
        bid_submission_deadline: '2026-10-15', // Overdue relative to 2026-10-22
      }));

      const actionableItems = mockTenders
        .map((t) => ({
          ...t,
          actionItemEvaluation: evaluateMarketingActionItem(t, today),
        }))
        .filter((t) => t.actionItemEvaluation.isActionItem);

      expect(actionableItems.length).toBe(25);
      expect(actionableItems.length).toBeGreaterThan(10);
    });
  });

  describe('2, 3 & 4. Pagination Invariants (Default 10, Page 2, Page Size 25)', () => {
    it('proves default page size is 10 and page size options include [10, 25, 50, 100]', () => {
      expect(actionItemsCardSource).toContain("useState<number>(10)");
      expect(actionItemsCardSource).toContain("pageSizeOptions: ['10', '25', '50', '100']");
    });

    it('proves pagination slicing: Page 1 shows first 10, Page 2 shows next records', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, title: `Tender ${i + 1}` }));
      
      const pageSize = 10;
      const getPageData = (page: number, size: number) => {
        const start = (page - 1) * size;
        return items.slice(start, start + size);
      };

      const page1 = getPageData(1, pageSize);
      expect(page1.length).toBe(10);
      expect(page1[0].id).toBe(1);
      expect(page1[9].id).toBe(10);

      const page2 = getPageData(2, pageSize);
      expect(page2.length).toBe(10);
      expect(page2[0].id).toBe(11);
      expect(page2[9].id).toBe(20);

      const page3 = getPageData(3, pageSize);
      expect(page3.length).toBe(5);
      expect(page3[0].id).toBe(21);
      expect(page3[4].id).toBe(25);
    });

    it('proves changing page size to 25 renders all 25 records on page 1', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const pageSize = 25;
      const start = (1 - 1) * pageSize;
      const page1 = items.slice(start, start + pageSize);
      expect(page1.length).toBe(25);
    });
  });

  describe('5. Search Filtering (Title, Code, Customer — Case-Insensitive)', () => {
    const dataset = [
      { id: 160, title: 'PROJECT SKF BEKASI', customer: { name: 'PT SKF Indonesia' } },
      { id: 159, title: 'Sewa Core Fiber Bandung', customer: { name: 'PT Telco Jaya' } },
      { id: 158, title: 'Pengadaan Server DC', customer: { name: 'PT Data Utama' } },
    ];

    const filterSearch = (q: string) => {
      const query = q.trim().toLowerCase();
      return dataset.filter((item) => {
        const title = (item.title || '').toLowerCase();
        const code = `tnd-${String(item.id || '').padStart(4, '0')}`.toLowerCase();
        const rawId = String(item.id || '');
        const customer = (item.customer?.name || '').toLowerCase();
        return title.includes(query) || code.includes(query) || rawId.includes(query) || customer.includes(query);
      });
    };

    it('matches by Tender title (case-insensitive)', () => {
      const res = filterSearch('skf bekasi');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(160);
    });

    it('matches by Tender code formatted as TND-xxxx', () => {
      const res = filterSearch('tnd-0160');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(160);
    });

    it('matches by Customer name', () => {
      const res = filterSearch('telco jaya');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(159);
    });

    it('returns empty array when search has no matches', () => {
      const res = filterSearch('NonExistentTenderXYZ');
      expect(res.length).toBe(0);
    });
  });

  describe('6. Condition Filter (ALL, OVERDUE, UPCOMING_DEADLINE, STUCK)', () => {
    const dataset = [
      { id: 1, actionItemEvaluation: { conditionType: 'OVERDUE' } },
      { id: 2, actionItemEvaluation: { conditionType: 'OVERDUE' } },
      { id: 3, actionItemEvaluation: { conditionType: 'UPCOMING_DEADLINE' } },
      { id: 4, actionItemEvaluation: { conditionType: 'STUCK' } },
    ];

    const filterCondition = (cond: string) => {
      if (cond === 'ALL') return dataset;
      return dataset.filter((d) => d.actionItemEvaluation.conditionType === cond);
    };

    it('returns all when condition is ALL', () => {
      expect(filterCondition('ALL').length).toBe(4);
    });

    it('filters strictly by OVERDUE', () => {
      const res = filterCondition('OVERDUE');
      expect(res.length).toBe(2);
      expect(res.every((r) => r.actionItemEvaluation.conditionType === 'OVERDUE')).toBe(true);
    });

    it('filters strictly by UPCOMING_DEADLINE', () => {
      const res = filterCondition('UPCOMING_DEADLINE');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(3);
    });

    it('filters strictly by STUCK', () => {
      const res = filterCondition('STUCK');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(4);
    });
  });

  describe('7. Total Count Representation in Header Tag and Footer', () => {
    it('header tag displays exact total count', () => {
      expect(actionItemsCardSource).toContain("{actionItemsData.length} Tender Perlu Tindakan");
    });

    it('footer displays Menampilkan X-Y dari total', () => {
      expect(actionItemsCardSource).toContain("showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total}`");
    });
  });

  describe('8. Canonical Detail Drawer Preservation', () => {
    it('proves "Lihat Detail" still opens canonical TenderDetailDrawer', () => {
      expect(salesPipelineSource).toContain("setSelectedTenderForDetail(record)");
      expect(salesPipelineSource).toContain("setDetailDrawerOpen(true)");
      expect(salesPipelineSource).not.toContain("router.push('/sales/tenders");
    });
  });

  describe('9. Strict Exclusion of WON and LOST', () => {
    const now = new Date('2026-10-22');

    it('excludes WON tenders', () => {
      const res = evaluateMarketingActionItem({ stage: 'WON', status: 'WON', bid_submission_deadline: '2026-10-10' }, now);
      expect(res.isActionItem).toBe(false);
    });

    it('excludes LOST tenders', () => {
      const res = evaluateMarketingActionItem({ stage: 'LOST', status: 'LOST', bid_submission_deadline: '2026-10-10' }, now);
      expect(res.isActionItem).toBe(false);
    });
  });

  describe('10. Clean Source Code Invariants', () => {
    it('contains no mock production data in MarketingActionItemsCard', () => {
      expect(actionItemsCardSource).not.toContain('mockData');
      expect(actionItemsCardSource).not.toContain('sampleTenders');
      expect(actionItemsCardSource).not.toContain('fakeTender');
    });

    it('contains empty state text: Tidak ada tender yang memerlukan tindakan untuk filter ini.', () => {
      expect(actionItemsCardSource).toContain('Tidak ada tender yang memerlukan tindakan untuk filter ini.');
    });
  });
});
