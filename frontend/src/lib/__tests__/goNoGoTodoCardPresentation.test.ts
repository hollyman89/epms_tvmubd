import { TodoItem } from '@/services/inbox.service';
import { resolveTodoActionTarget } from '../todoActionResolver';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/**
 * Presentation helper mapping model data to UI display properties for Unified Inbox cards.
 * Mirroring InboxPage and NotificationBell presentation logic.
 */
export function getTodoCardDisplayProps(item: TodoItem) {
  const isGoNoGoApproval = item.actionType === 'GO_NOGO_APPROVAL';
  const isGoNoGoRevision = item.actionType === 'GO_NOGO_REVISION';
  const isGoNoGo = isGoNoGoApproval || isGoNoGoRevision;

  // 1. Labels
  const entityLabel = isGoNoGo ? 'Tender' : item.entityType;
  const roleLabel = isGoNoGoApproval ? 'Director' : isGoNoGoRevision ? 'Marketing' : item.assignedRole;
  const showStatusTag = !isGoNoGo;

  // 2. Title
  const title = isGoNoGoApproval
    ? 'Persetujuan GO / NO-GO'
    : isGoNoGoRevision
    ? 'Revisi GO / NO-GO'
    : item.title;

  // 3. Business Context Lines
  const projectName = isGoNoGo ? item.projectName : undefined;
  const customerLine = isGoNoGo && item.customerName ? `Customer: ${item.customerName}` : undefined;
  const submitterLine = isGoNoGoApproval && item.submittedByName ? `Diajukan oleh: ${item.submittedByName}` : undefined;
  const returnedByLine = isGoNoGoRevision && item.returnedByName ? `Dikembalikan oleh: ${item.returnedByName}` : undefined;
  const returnReasonLine = isGoNoGoRevision && item.returnReason ? `Alasan: ${item.returnReason}` : undefined;
  const regularDescription = !isGoNoGo ? item.description : undefined;

  // 4. Timestamp & CTA
  const relativeTimestamp = dayjs(item.createdAt).fromNow();
  const actionTarget = resolveTodoActionTarget(item);
  const ctaLabel = actionTarget ? 'Buka' : 'Aksi Belum Tersedia';

  return {
    isGoNoGo,
    isGoNoGoApproval,
    isGoNoGoRevision,
    entityLabel,
    roleLabel,
    showStatusTag,
    title,
    projectName,
    customerLine,
    submitterLine,
    returnedByLine,
    returnReasonLine,
    regularDescription,
    relativeTimestamp,
    ctaLabel,
    actionTarget,
  };
}

describe('GO_NOGO_APPROVAL To-Do Card Business Context Presentation', () => {
  const mockGoNoGoTodo: TodoItem = {
    todoId: 'wf-50',
    sourceType: 'WORKFLOW_TASK',
    sourceId: '50',
    taskId: 50,
    entityType: 'TENDER',
    entityId: 33,
    assignedRole: 'DIRECTOR',
    actionType: 'GO_NOGO_APPROVAL',
    actionTarget: '/sales?tab=1&tenderId=33&action=go-nogo',
    title: 'Persetujuan GO / NO-GO',
    status: 'PENDING',
    createdAt: '2026-09-25T14:00:00.000Z',
    projectName: 'Project Gudang Jakarta Selatan',
    customerName: 'J&T Express',
    submittedByName: 'Lukas Kurniawan',
  };

  it('1. Displays user-friendly labels: Tender and Director', () => {
    const props = getTodoCardDisplayProps(mockGoNoGoTodo);
    expect(props.entityLabel).toBe('Tender');
    expect(props.roleLabel).toBe('Director');
    expect(props.showStatusTag).toBe(false); // Internal status enum PENDING is hidden
  });

  it('2. Title is exactly "Persetujuan GO / NO-GO" without Tender ID', () => {
    const props = getTodoCardDisplayProps(mockGoNoGoTodo);
    expect(props.title).toBe('Persetujuan GO / NO-GO');
    expect(props.title).not.toContain('Tender #33');
    expect(props.title).not.toContain('33');
  });

  it('3. Displays Project Name from authoritative backend data', () => {
    const props = getTodoCardDisplayProps(mockGoNoGoTodo);
    expect(props.projectName).toBe('Project Gudang Jakarta Selatan');
  });

  it('4. Displays Customer line with prefix: "Customer: <Customer Name>"', () => {
    const props = getTodoCardDisplayProps(mockGoNoGoTodo);
    expect(props.customerLine).toBe('Customer: J&T Express');
  });

  it('5. Displays Submitter line with prefix: "Diajukan oleh: <Actual Submitter Name>"', () => {
    const props = getTodoCardDisplayProps(mockGoNoGoTodo);
    expect(props.submitterLine).toBe('Diajukan oleh: Lukas Kurniawan');
  });

  it('6. Uses relative timestamp and keeps CTA as "Buka"', () => {
    const props = getTodoCardDisplayProps(mockGoNoGoTodo);
    expect(props.relativeTimestamp).toBeDefined();
    expect(props.ctaLabel).toBe('Buka');
    expect(props.actionTarget).toBe('/sales?tab=1&tenderId=33&action=go-nogo');
  });

  it('7. Negative assertions: does NOT expose workflow internals or enums', () => {
    const props = getTodoCardDisplayProps(mockGoNoGoTodo);

    // Title must not contain internal taskKey or IDs
    expect(props.title).not.toBe('GO_NOGO_APPROVAL');
    expect(props.title).not.toContain('node_director_approval');
    expect(props.title).not.toContain('instance_17');

    // Status enum hidden from labels
    expect(props.showStatusTag).toBe(false);
  });
});

describe('GO_NOGO_REVISION To-Do Card Business Context Presentation', () => {
  const mockRevisionTodo: TodoItem = {
    todoId: 'wf-59',
    sourceType: 'WORKFLOW_TASK',
    sourceId: '59',
    taskId: 59,
    entityType: 'TENDER',
    entityId: 34,
    assignedRole: 'MARKETING',
    actionType: 'GO_NOGO_REVISION',
    actionTarget: '/sales?tab=1&tenderId=34&action=go-nogo',
    title: 'Revisi GO / NO-GO',
    status: 'PENDING',
    createdAt: '2026-09-25T15:00:00.000Z',
    projectName: 'Renovasi Kantor HQ J&T Indonesia',
    customerName: 'J&T Express',
    returnedByName: 'Budi Director',
    returnReason: 'masih salah nominalnya',
  };

  it('1. Displays user-friendly labels: Tender and Marketing', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);
    expect(props.entityLabel).toBe('Tender');
    expect(props.roleLabel).toBe('Marketing');
    expect(props.showStatusTag).toBe(false);
  });

  it('2. Title is exactly "Revisi GO / NO-GO" without Tender ID', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);
    expect(props.title).toBe('Revisi GO / NO-GO');
    expect(props.title).not.toContain('Tender #34');
    expect(props.title).not.toContain('34');
    expect(props.title).not.toBe('Revisi GO / NO GO: Tender #34');
  });

  it('3. Displays Project Name from authoritative backend data', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);
    expect(props.projectName).toBe('Renovasi Kantor HQ J&T Indonesia');
  });

  it('4. Displays Customer line: "Customer: <Customer Name>"', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);
    expect(props.customerLine).toBe('Customer: J&T Express');
  });

  it('5. Displays Return Actor line: "Dikembalikan oleh: <Actual Return Actor Name>"', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);
    expect(props.returnedByLine).toBe('Dikembalikan oleh: Budi Director');
  });

  it('6. Displays Return Reason line: "Alasan: <Actual Return Reason>"', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);
    expect(props.returnReasonLine).toBe('Alasan: masih salah nominalnya');
  });

  it('7. Uses relative timestamp and keeps CTA as "Buka"', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);
    expect(props.relativeTimestamp).toBeDefined();
    expect(props.ctaLabel).toBe('Buka');
    expect(props.actionTarget).toBe('/sales?tab=1&tenderId=34&action=go-nogo');
  });

  it('8. Negative assertions: does NOT expose workflow internals or enums', () => {
    const props = getTodoCardDisplayProps(mockRevisionTodo);

    expect(props.title).not.toBe('GO_NOGO_REVISION');
    expect(props.title).not.toContain('node_marketing_revision');
    expect(props.title).not.toContain('instance_21');
    expect(props.showStatusTag).toBe(false);
  });

  it('9. Fallback Rule: Missing fields do not render fake or guessed values', () => {
    const partialTodo: TodoItem = {
      todoId: 'wf-60',
      sourceType: 'WORKFLOW_TASK',
      sourceId: '60',
      taskId: 60,
      entityType: 'TENDER',
      entityId: 35,
      assignedRole: 'MARKETING',
      actionType: 'GO_NOGO_REVISION',
      actionTarget: '/sales?tab=1&tenderId=35&action=go-nogo',
      title: 'Revisi GO / NO-GO',
      status: 'PENDING',
      createdAt: '2026-09-25T15:00:00.000Z',
      projectName: 'Tender Incomplete',
      // customerName missing
      // returnedByName missing
      // returnReason missing
    };

    const props = getTodoCardDisplayProps(partialTodo);
    expect(props.projectName).toBe('Tender Incomplete');
    expect(props.customerLine).toBeUndefined();
    expect(props.returnedByLine).toBeUndefined();
    expect(props.returnReasonLine).toBeUndefined();
  });

  it('10. Preserves existing layout and tags for unrelated To-Do types (e.g. PURCHASE_REQUEST_APPROVAL)', () => {
    const prTodo: TodoItem = {
      todoId: 'wf-10',
      sourceType: 'WORKFLOW_TASK',
      sourceId: '10',
      taskId: 10,
      entityType: 'PURCHASE_REQUEST',
      entityId: 5,
      assignedRole: 'PROCUREMENT',
      actionType: 'PURCHASE_REQUEST_APPROVAL',
      actionTarget: '/procurement?tab=pr&prId=5',
      title: 'Review & Persetujuan Purchase Request #5',
      description: 'Pengadaan Material Beton',
      status: 'PENDING',
      createdAt: '2026-09-25T12:00:00.000Z',
    };

    const props = getTodoCardDisplayProps(prTodo);
    expect(props.isGoNoGo).toBe(false);
    expect(props.entityLabel).toBe('PURCHASE_REQUEST');
    expect(props.roleLabel).toBe('PROCUREMENT');
    expect(props.showStatusTag).toBe(true);
    expect(props.title).toBe('Review & Persetujuan Purchase Request #5');
    expect(props.regularDescription).toBe('Pengadaan Material Beton');
    expect(props.projectName).toBeUndefined();
    expect(props.customerLine).toBeUndefined();
    expect(props.submitterLine).toBeUndefined();
    expect(props.returnedByLine).toBeUndefined();
    expect(props.returnReasonLine).toBeUndefined();
  });
});
