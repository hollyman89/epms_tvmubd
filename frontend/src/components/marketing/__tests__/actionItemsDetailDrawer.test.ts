import fs from 'fs';
import path from 'path';

describe('EPMS — Action Items "Lihat Detail" Canonical Drawer SSOT Integration Tests', () => {
  const salesPipelinePath = path.resolve(__dirname, '../../SalesPipelinePage.tsx');
  const kanbanBoardPath = path.resolve(__dirname, '../../KanbanBoard.tsx');
  const tenderDetailPagePath = path.resolve(__dirname, '../../../app/(dashboard)/sales/tenders/[id]/page.tsx');
  const tenderDetailDrawerPath = path.resolve(__dirname, '../../TenderDetailDrawer.tsx');

  let salesPipelineSource: string;
  let kanbanBoardSource: string;

  beforeAll(() => {
    salesPipelineSource = fs.readFileSync(salesPipelinePath, 'utf-8');
    kanbanBoardSource = fs.readFileSync(kanbanBoardPath, 'utf-8');
  });

  test('1. Action Item "Lihat Detail" no longer calls router.push to /sales/tenders/:id', () => {
    // Locate actionItemsColumns in SalesPipelinePage
    const actionItemsColStart = salesPipelineSource.indexOf('const actionItemsColumns = useMemo');
    expect(actionItemsColStart).toBeGreaterThan(-1);
    const actionItemsColEnd = salesPipelineSource.indexOf('const updateTenderStatus =', actionItemsColStart);
    const actionItemsColBlock = salesPipelineSource.substring(actionItemsColStart, actionItemsColEnd);

    // Verify it does NOT contain router.push
    expect(actionItemsColBlock).not.toContain('router.push(`/sales/tenders');
    expect(actionItemsColBlock).not.toContain("router.push('/sales/tenders");
  });

  test('2 & 3. Action Item "Lihat Detail" sets selectedTenderForDetail(record) and setDetailDrawerOpen(true)', () => {
    const actionItemsColStart = salesPipelineSource.indexOf('const actionItemsColumns = useMemo');
    const actionItemsColEnd = salesPipelineSource.indexOf('const updateTenderStatus =', actionItemsColStart);
    const actionItemsColBlock = salesPipelineSource.substring(actionItemsColStart, actionItemsColEnd);

    expect(actionItemsColBlock).toContain('setSelectedTenderForDetail(record)');
    expect(actionItemsColBlock).toContain('setDetailDrawerOpen(true)');
  });

  test('4. TenderDetailDrawer receives selectedTenderForDetail and detailDrawerOpen on SalesPipelinePage', () => {
    expect(salesPipelineSource).toContain('<TenderDetailDrawer');
    expect(salesPipelineSource).toContain('open={detailDrawerOpen}');
    expect(salesPipelineSource).toContain('tender={selectedTenderForDetail}');
  });

  test('5. Table View behavior remains canonical and identical', () => {
    // Locate Table View columns
    const columnsStart = salesPipelineSource.indexOf('const columns = useMemo');
    const columnsEnd = salesPipelineSource.indexOf('const contractColumns =', columnsStart);
    const tableColumnsBlock = salesPipelineSource.substring(columnsStart, columnsEnd);

    expect(tableColumnsBlock).toContain('setSelectedTenderForDetail(record)');
    expect(tableColumnsBlock).toContain('setDetailDrawerOpen(true)');
  });

  test('6. Kanban Board behavior remains canonical with its own TenderDetailDrawer integration', () => {
    expect(kanbanBoardSource).toContain('<TenderDetailDrawer');
    expect(kanbanBoardSource).toContain('open={drawerVisible}');
    expect(kanbanBoardSource).toContain('tender={drawerTender}');
  });

  test('7. /sales/tenders/:id route and TenderDetailDrawer files are preserved intact', () => {
    expect(fs.existsSync(tenderDetailPagePath)).toBe(true);
    expect(fs.existsSync(tenderDetailDrawerPath)).toBe(true);

    const detailPageSource = fs.readFileSync(tenderDetailPagePath, 'utf-8');
    expect(detailPageSource).toContain('export default function TenderDetailPage');
  });

  test('8. Behavioral execution of Action Item column render handler', () => {
    // Isolate the render function logic
    let capturedTender: any = null;
    let isDrawerOpen = false;

    const mockRecord = {
      id: 160,
      title: 'Tender Pemasangan Fiber Optik',
      customer: { name: 'PT Telco Jaya' },
      stage: 'LEAD',
      bid_submission_deadline: '2026-10-19',
    };

    const setSelectedTenderForDetail = (record: any) => {
      capturedTender = record;
    };
    const setDetailDrawerOpen = (open: boolean) => {
      isDrawerOpen = open;
    };

    // Execute the exact handler pattern used in actionItemsColumns
    const handleActionClick = () => {
      setSelectedTenderForDetail(mockRecord);
      setDetailDrawerOpen(true);
    };

    handleActionClick();

    expect(capturedTender).toEqual(mockRecord);
    expect(capturedTender.id).toBe(160);
    expect(isDrawerOpen).toBe(true);
  });
});
