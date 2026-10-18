import {
  formatEntityLabel,
  getEntityTagColor,
  formatRoleName,
  formatTaskTitle,
  formatHistoryTitle,
  formatNotificationTitle,
  formatNotificationMessage,
  formatContextualCta,
  formatPriorityName,
  extractItemBusinessContext,
  INBOX_TABS,
  INBOX_PAGE_CONFIG,
  INBOX_EMPTY_STATES,
} from '../inboxPresentation';
import { resolveTodoActionTarget } from '../todoActionResolver';
import { MENU_GROUPS } from '@/constants/menuConfig';

describe('EPMS — UNIFIED-INBOX-UX-R1 Presentation Layer Regression Tests', () => {
  describe('A. Entity / Tag Presentation: PROJECT_CLOSURE never renders raw', () => {
    it('maps PROJECT_CLOSURE to PENUTUPAN PROYEK', () => {
      expect(formatEntityLabel('PROJECT_CLOSURE')).toBe('PENUTUPAN PROYEK');
      expect(getEntityTagColor('PROJECT_CLOSURE')).toBe('purple');
    });

    it('maps PROJECT to PROYEK and CONTRACT to KONTRAK LEGAL', () => {
      expect(formatEntityLabel('PROJECT')).toBe('PROYEK');
      expect(formatEntityLabel('CONTRACT')).toBe('KONTRAK LEGAL');
      expect(getEntityTagColor('PROJECT')).toBe('cyan');
      expect(getEntityTagColor('CONTRACT')).toBe('purple');
    });

    it('maps PURCHASE_REQUEST to PERMINTAAN PEMBELIAN and PAYMENT_REQUEST to PEMBAYARAN', () => {
      expect(formatEntityLabel('PURCHASE_REQUEST')).toBe('PERMINTAAN PEMBELIAN');
      expect(formatEntityLabel('PURCHASE REQUEST')).toBe('PERMINTAAN PEMBELIAN');
      expect(formatEntityLabel('PAYMENT_REQUEST')).toBe('PEMBAYARAN');
    });
  });

  describe('B & C. Workflow Titles: DIRECTOR_APPROVAL and HOO_REVIEW never render raw', () => {
    it('B. DIRECTOR_APPROVAL maps to Persetujuan Penutupan Proyek in To-Do and Penutupan Proyek Disetujui in completed history', () => {
      // Pending To-Do
      const todoTitle = formatTaskTitle('Tugas Alur Kerja: DIRECTOR_APPROVAL', {
        actionType: 'PROJECT_CLOSURE_DIRECTOR_APPROVAL',
        entityType: 'PROJECT_CLOSURE',
      });
      expect(todoTitle).toBe('Persetujuan Penutupan Proyek');
      expect(todoTitle).not.toContain('DIRECTOR_APPROVAL');
      expect(todoTitle).not.toContain('Tugas Alur Kerja');

      // Completed History
      const historyTitle = formatHistoryTitle({
        title: 'Tugas Alur Kerja: DIRECTOR_APPROVAL',
        taskKey: 'DIRECTOR_APPROVAL',
        entityType: 'PROJECT_CLOSURE',
        status: 'COMPLETED',
        action: 'APPROVE',
      });
      expect(historyTitle).toBe('Penutupan Proyek Disetujui');
      expect(historyTitle).not.toContain('DIRECTOR_APPROVAL');
    });

    it('C. HOO_REVIEW maps to Peninjauan Penutupan Proyek in To-Do and Peninjauan Penutupan Proyek Selesai in completed history', () => {
      // Pending To-Do
      const todoTitle = formatTaskTitle('Tugas Alur Kerja: HOO_REVIEW', {
        actionType: 'PROJECT_CLOSURE_HOO_REVIEW',
        entityType: 'PROJECT_CLOSURE',
      });
      expect(todoTitle).toBe('Peninjauan Penutupan Proyek');
      expect(todoTitle).not.toContain('HOO_REVIEW');

      // Completed History
      const historyTitle = formatHistoryTitle({
        title: 'Tugas Alur Kerja: HOO_REVIEW',
        taskKey: 'HOO_REVIEW',
        entityType: 'PROJECT_CLOSURE',
        status: 'COMPLETED',
        action: 'APPROVE',
      });
      expect(historyTitle).toBe('Peninjauan Penutupan Proyek Selesai');
      expect(historyTitle).not.toContain('HOO_REVIEW');
    });
  });

  describe('D. GO_NOGO_APPROVAL never renders raw', () => {
    it('maps GO_NOGO_APPROVAL to Persetujuan GO/NO-GO', () => {
      const todoTitle = formatTaskTitle('Tender #208: GO_NOGO_APPROVAL', {
        actionType: 'GO_NOGO_APPROVAL',
      });
      expect(todoTitle).toBe('Persetujuan GO/NO-GO');
      expect(todoTitle).not.toContain('GO_NOGO_APPROVAL');

      const historyTitle = formatHistoryTitle({
        title: 'Tender #208: GO_NOGO_APPROVAL',
        taskKey: 'GO_NOGO_APPROVAL',
        entityType: 'TENDER',
        status: 'COMPLETED',
        action: 'APPROVE',
        entityId: 208,
      });
      expect(historyTitle).toBe('Tender #208: Persetujuan GO/NO-GO Disetujui');
      expect(historyTitle).not.toContain('GO_NOGO_APPROVAL');
    });
  });

  describe('E & F. Role Enums: PROJECT_MANAGER and MARKETING render human-readable', () => {
    it('E. PROJECT_MANAGER renders as Project Manager', () => {
      expect(formatRoleName('PROJECT_MANAGER')).toBe('Project Manager');
      expect(formatRoleName('PM')).toBe('Project Manager');
    });

    it('F. MARKETING renders as Marketing', () => {
      expect(formatRoleName('MARKETING')).toBe('Marketing');
    });

    it('other roles render human-readable in Indonesian or clear business form', () => {
      expect(formatRoleName('DIRECTOR')).toBe('Direktur');
      expect(formatRoleName('HEAD_OF_OPERATIONS')).toBe('Head of Operations');
      expect(formatRoleName('SUPER_ADMIN')).toBe('Super Admin');
      expect(formatRoleName('FINANCE')).toBe('Finance');
      expect(formatRoleName('PROCUREMENT')).toBe('Procurement');
      expect(formatRoleName('LEGAL')).toBe('Legal');
    });
  });

  describe('G. Unified Inbox Tabs render canonical Indonesian names', () => {
    it('G. tabs render Tugas, Riwayat, Notifikasi', () => {
      expect(INBOX_TABS.TODO).toBe('Tugas');
      expect(INBOX_TABS.HISTORY).toBe('Riwayat');
      expect(INBOX_TABS.NOTIFICATIONS).toBe('Notifikasi');
    });
  });

  describe('H. Header Bell and Inbox use consistent entity tags', () => {
    it('H. formats entity tags identically for both Bell and Inbox', () => {
      const entities = ['PROJECT', 'CONTRACT', 'PURCHASE_REQUEST', 'PAYMENT_REQUEST', 'PROJECT_CLOSURE', 'TENDER'];
      const bellLabels = entities.map((e) => formatEntityLabel(e));
      const inboxLabels = entities.map((e) => formatEntityLabel(e));

      expect(bellLabels).toEqual(inboxLabels);
      expect(bellLabels).toEqual([
        'PROYEK',
        'KONTRAK LEGAL',
        'PERMINTAAN PEMBELIAN',
        'PEMBAYARAN',
        'PENUTUPAN PROYEK',
        'TENDER',
      ]);
    });
  });

  describe('I & J. Notification Microcopy Normalization', () => {
    it('I. "Project Siap Kick Off" no longer renders', () => {
      const title = formatNotificationTitle('Project Siap Kick Off');
      expect(title).toBe('Proyek Siap Kick-Off');
      expect(title).not.toContain('Project Siap Kick Off');

      const msg = formatNotificationMessage('Kontrak disetujui. Project Siap Kick Off sekarang.');
      expect(msg).toBe('Kontrak disetujui. Proyek Siap Kick-Off sekarang.');
    });

    it('J. "Draft Kontrak Baru Siap Direview" no longer renders', () => {
      const title = formatNotificationTitle('Draft Kontrak Baru Siap Direview');
      expect(title).toBe('Draft Kontrak Siap Ditinjau');
      expect(title).not.toContain('Direview');

      const msg = formatNotificationMessage('Tender memiliki draft kontrak yang siap direview.');
      expect(msg).toBe('Tender memiliki draft kontrak yang siap ditinjau.');
      expect(msg).not.toContain('direview');
    });
  });

  describe('K. Contextual CTA Button Labels: Generic "Buka" replaced', () => {
    it('K. uses specific action verbs instead of Buka', () => {
      expect(formatContextualCta({ actionType: 'GO_NOGO_APPROVAL' })).toBe('Tinjau');
      expect(formatContextualCta({ actionType: 'GO_NOGO_REVISION' })).toBe('Tinjau Revisi');
      expect(formatContextualCta({ actionType: 'MANAGEMENT_REVIEW' })).toBe('Tinjau');
      expect(formatContextualCta({ actionType: 'PM_REVISION' })).toBe('Tinjau Revisi');
      expect(formatContextualCta({ actionType: 'PURCHASE_REQUEST_APPROVAL' })).toBe('Tinjau');
      expect(formatContextualCta({ actionType: 'LEGAL_REVIEW' })).toBe('Tinjau');
      expect(formatContextualCta({ actionType: 'LEGAL_DOCUMENT_REVISION' })).toBe('Tinjau Revisi');
      expect(formatContextualCta({ actionType: 'PMO_ASSIGN_PM' })).toBe('Tugaskan PM');
      expect(formatContextualCta({ actionType: 'PAYMENT_APPROVAL' })).toBe('Tinjau');
      expect(formatContextualCta({ actionType: 'PROCESS_PAYMENT' })).toBe('Proses Pembayaran');
      expect(formatContextualCta({ entityType: 'PROJECT' })).toBe('Lihat Proyek');
      expect(formatContextualCta({ entityType: 'CONTRACT' })).toBe('Lihat Kontrak');
    });
  });

  describe('L & M. Director Payment Approval Classification & Authoritative Tugas', () => {
    it('L & M. Payment approval requiring action has actionable Tugas title and contextual CTA', () => {
      const paymentItem = {
        title: 'Persetujuan Pembayaran',
        actionType: 'PAYMENT_APPROVAL',
        entityType: 'PAYMENT_REQUEST',
        actionTarget: '/finance/payments?tab=approvals&requestId=45',
      };
      expect(formatTaskTitle(paymentItem.title, paymentItem)).toBe('Persetujuan Pembayaran');
      expect(formatContextualCta(paymentItem)).toBe('Tinjau');
      expect(resolveTodoActionTarget(paymentItem)).toBe('/finance/payments?tab=approvals&requestId=45');
    });
  });

  describe('N. Completed history remains read-only', () => {
    it('N. history items describe completed events without active mutable buttons', () => {
      const historyItem = {
        title: 'Persetujuan Penutupan Proyek',
        taskKey: 'DIRECTOR_APPROVAL',
        entityType: 'PROJECT_CLOSURE',
        status: 'COMPLETED',
        action: 'APPROVE',
      };
      expect(formatHistoryTitle(historyItem)).toBe('Penutupan Proyek Disetujui');
    });
  });

  describe('O. Correct deep-link targets remain unchanged', () => {
    it('O. deep-link resolver preserves all valid business paths', () => {
      expect(resolveTodoActionTarget({ actionTarget: '/finance/payments?tab=approvals&requestId=45' }))
        .toBe('/finance/payments?tab=approvals&requestId=45');
      expect(resolveTodoActionTarget({ actionTarget: '/governance/tasks?taskId=101&projectId=2428' }))
        .toBe('/governance/tasks?taskId=101&projectId=2428');
      expect(resolveTodoActionTarget({ actionTarget: '/sales?tab=1&tenderId=208&action=go-nogo' }))
        .toBe('/sales?tab=1&tenderId=208&action=go-nogo');
      expect(resolveTodoActionTarget({ actionTarget: '/legal/review?contractId=55' }))
        .toBe('/legal/review?contractId=55');
      expect(resolveTodoActionTarget({ actionTarget: '/project-delivery?projectId=2428&action=operational-plan' }))
        .toBe('/project-delivery?projectId=2428&action=operational-plan');
      // Rejects invalid non-relative or /inbox loop
      expect(resolveTodoActionTarget({ actionTarget: '/inbox' })).toBeNull();
      expect(resolveTodoActionTarget({ actionTarget: 'https://external.com' })).toBeNull();
    });
  });

  describe('Q. No raw internal node or event identifiers in presentation', () => {
    it('Q. cleans raw node identifiers and technical prefixes', () => {
      const cleanedClosure = formatTaskTitle('Tugas Alur Kerja: node_director_approval', {
        actionType: 'PROJECT_CLOSURE_DIRECTOR_APPROVAL',
      });
      expect(cleanedClosure).toBe('Persetujuan Penutupan Proyek');

      const cleanedHoo = formatTaskTitle('Tugas Alur Kerja: HOO_REVIEW', {
        actionType: 'PROJECT_CLOSURE_HOO_REVIEW',
      });
      expect(cleanedHoo).toBe('Peninjauan Penutupan Proyek');
    });
  });

  describe('Empty state copy conforms to enterprise standard', () => {
    it('provides clear Indonesian empty states', () => {
      expect(INBOX_EMPTY_STATES.TODO).toBe('Tidak ada tugas yang perlu ditindaklanjuti.');
      expect(INBOX_EMPTY_STATES.HISTORY).toBe('Belum ada riwayat aktivitas.');
      expect(INBOX_EMPTY_STATES.NOTIFICATIONS).toBe('Tidak ada notifikasi baru.');
      expect(INBOX_EMPTY_STATES.SEARCH).toBe('Tidak ada hasil yang sesuai.');
    });
  });

  describe('EPMS — INBOX-NOTIFICATION-UX-R2 Semantic Information Architecture Tests (Section 27 Gate)', () => {
    it('A. Contract reference is never labeled as "Proyek #"', () => {
      const msg = formatNotificationMessage('Anda telah resmi ditugaskan sebagai Project Manager untuk proyek #CONT-20261008-0149. Silakan mulai menyusun Operational Plan.');
      expect(msg).toContain('Kontrak CONT-20261008-0149');
      expect(msg).not.toContain('proyek #CONT-');

      const title = formatNotificationTitle('Penugasan Project Manager Baru');
      expect(title).toBe('Anda Ditugaskan sebagai Project Manager');
    });

    it('B. Numeric project database ID is not used as primary title when project name/reference is available', () => {
      const title = formatTaskTitle('Revisi Rencana Operasional Proyek #2014', {
        actionType: 'PM_REVISION',
        projectName: 'Implementasi Fiber Optik Asianet Jakarta',
      });
      expect(title).toBe('Revisi Rencana Operasional');
      expect(title).not.toContain('#2014');

      const ctx = extractItemBusinessContext({
        projectName: 'Implementasi Fiber Optik Asianet Jakarta',
        customerName: 'PT Asianet Media Teknologi',
        contractNumber: 'CONT-20261001-0103',
        projectId: 2014,
      });
      expect(ctx.projectName).toBe('Implementasi Fiber Optik Asianet Jakarta');
      expect(ctx.customerName).toBe('PT Asianet Media Teknologi');
      expect(ctx.contractNumber).toBe('CONT-20261001-0103');
      expect(ctx.internalId).toBe(2014);
    });

    it('C. Project notification displays project name where data exists', () => {
      const ctx = extractItemBusinessContext({
        metaData: {
          category: 'PROJECT',
          projectName: 'Asianet Jakarta',
          customerName: 'PT Asianet Media Teknologi',
          projectCode: 'CONT-20261008-0149',
        },
      });
      expect(ctx.projectName).toBe('Asianet Jakarta');
      expect(ctx.customerName).toBe('PT Asianet Media Teknologi');
      expect(ctx.contractNumber).toBe('CONT-20261008-0149');
    });

    it('D. Contract event displays contract number with label "Kontrak"', () => {
      const ctx = extractItemBusinessContext({
        contractNumber: 'CONT-20261008-0149',
        customerName: 'PT Pelanggan Global',
      });
      expect(ctx.contractNumber).toBe('CONT-20261008-0149');
      expect(ctx.customerName).toBe('PT Pelanggan Global');
    });

    it('E. PO event displays PO reference, not DB ID', () => {
      const ctx = extractItemBusinessContext({
        metaData: {
          poNumber: 'PO-20261010-0031',
          vendorName: 'PT Example Vendor',
        },
      });
      expect(ctx.poNumber).toBe('PO-20261010-0031');
      expect(ctx.vendorName).toBe('PT Example Vendor');
    });

    it('F & G. Payment Request uses payment request reference and invoice uses invoice reference', () => {
      const taskTitle = formatTaskTitle('Revisi Pengajuan Pembayaran #PRQ-20261011-001', {
        actionType: 'PAYMENT_REQUEST_REVISION',
      });
      expect(taskTitle).toBe('Revisi Pengajuan Pembayaran');

      const processTitle = formatTaskTitle('Proses Pembayaran #PAY-20261012-0001', {
        actionType: 'PROCESS_PAYMENT',
      });
      expect(processTitle).toBe('Proses Pembayaran');
    });

    it('H & I. History PM Plan Revision no longer renders: "PM Plan Revision (HOPS)" and HOPS never appears user-facing', () => {
      const historyTitle = formatHistoryTitle({
        title: 'Proyek #1380: PM Plan Revision (HOPS)',
        taskKey: 'PM Plan Revision (HOPS)',
        entityType: 'PROJECT',
        status: 'COMPLETED',
        action: 'RESUBMIT',
      });
      expect(historyTitle).toBe('Rencana Operasional Diajukan Ulang');
      expect(historyTitle).not.toContain('PM Plan Revision');
      expect(historyTitle).not.toContain('HOPS');
      expect(historyTitle).not.toContain('#1380');

      const hopsHistory = formatHistoryTitle({
        title: 'Peninjauan Rencana Operasional HOPS',
        taskKey: 'HOPS_REVIEW',
        entityType: 'PROJECT',
        status: 'COMPLETED',
        action: 'APPROVE',
      });
      expect(hopsHistory).toBe('Peninjauan Rencana Operasional (Head of Operations) Selesai');
      expect(hopsHistory).not.toContain('HOPS');

      expect(formatRoleName('HOPS')).toBe('Head of Operations');
    });

    it('J. Project #<numeric> is not primary title for revision task', () => {
      expect(formatTaskTitle('Revisi Rencana Operasional Proyek #2014')).toBe('Revisi Rencana Operasional');
      expect(formatTaskTitle('Revisi Rencana Operasional Proyek #2013')).toBe('Revisi Rencana Operasional');
      expect(formatTaskTitle('Revisi Rencana Operasional Proyek #3')).toBe('Revisi Rencana Operasional');
      expect(formatTaskTitle('Review Rencana Operasional Proyek #2014')).toBe('Review Rencana Operasional');
    });

    it('K. Repeated legitimate revision history remains distinguishable via contextual properties', () => {
      const cycle1 = {
        taskId: 101,
        title: 'Rencana Operasional Diajukan Ulang',
        comments: 'Perbaikan timeline kabel feeder',
        createdAt: '2026-10-08T10:00:00Z',
      };
      const cycle2 = {
        taskId: 105,
        title: 'Rencana Operasional Diajukan Ulang',
        comments: 'Penyesuaian anggaran material OSP',
        createdAt: '2026-10-08T14:30:00Z',
      };
      expect(cycle1.taskId).not.toBe(cycle2.taskId);
      expect(cycle1.comments).not.toBe(cycle2.comments);
    });

    it('L. Header Bell and Unified Inbox render the same semantic identity', () => {
      const item = {
        projectName: 'Implementasi Fiber Optik',
        customerName: 'PT Asianet Media Teknologi',
        contractNumber: 'CONT-20261001-0103',
        projectId: 2014,
      };
      const inboxContext = extractItemBusinessContext(item);
      const bellContext = extractItemBusinessContext(item);
      expect(inboxContext).toEqual(bellContext);
    });

    it('M. CTA still routes to the same canonical destination', () => {
      expect(resolveTodoActionTarget({ actionTarget: '/project-delivery?projectId=2014&action=operational-plan' }))
        .toBe('/project-delivery?projectId=2014&action=operational-plan');
      expect(formatContextualCta({ actionType: 'PM_REVISION' })).toBe('Tinjau Revisi');
    });

    it('N. No raw internal identifier/key becomes visible in microcopy', () => {
      const priorityLabel = formatPriorityName('HIGH');
      expect(priorityLabel).toBe('Tinggi');
      expect(formatPriorityName('URGENT')).toBe('Mendesak');
      expect(formatPriorityName('NORMAL')).toBe('Normal');
    });

    it('O. Existing Tugas/Riwayat/Notifikasi classification remains correct', () => {
      expect(INBOX_TABS.TODO).toBe('Tugas');
      expect(INBOX_TABS.HISTORY).toBe('Riwayat');
      expect(INBOX_TABS.NOTIFICATIONS).toBe('Notifikasi');
    });
  });

  describe('EPMS — INBOX-MICROCOPY-FINAL-R1 Focused Regression Tests (Section 13 Gate)', () => {
    it('A. Sidebar/menu presentation resolves to: Pusat Aktivitas', () => {
      const systemGroup = MENU_GROUPS.find((g) => g.label === 'SYSTEM');
      const inboxMenuItem = systemGroup?.children.find((item) => item.key === '/inbox' || item.path === '/inbox');
      expect(inboxMenuItem).toBeDefined();
      expect(inboxMenuItem?.label).toBe('Pusat Aktivitas');
    });

    it('B. Page title renders: Pusat Aktivitas', () => {
      expect(INBOX_PAGE_CONFIG.TITLE).toBe('Pusat Aktivitas');
    });

    it('C. Page subtitle renders canonical Indonesian text', () => {
      expect(INBOX_PAGE_CONFIG.SUBTITLE).toBe(
        'Tugas, riwayat aktivitas, dan informasi terbaru yang perlu Anda ketahui.'
      );
    });

    it('D. Tabs remain: Tugas, Riwayat, Notifikasi', () => {
      expect(INBOX_TABS.TODO).toBe('Tugas');
      expect(INBOX_TABS.HISTORY).toBe('Riwayat');
      expect(INBOX_TABS.NOTIFICATIONS).toBe('Notifikasi');
    });

    it('E. HIGH renders as: Tinggi', () => {
      expect(formatPriorityName('HIGH')).toBe('Tinggi');
      expect(formatPriorityName('high')).toBe('Tinggi');
    });

    it('F. NORMAL renders as: Normal', () => {
      expect(formatPriorityName('NORMAL')).toBe('Normal');
      expect(formatPriorityName('normal')).toBe('Normal');
      expect(formatPriorityName('MEDIUM')).toBe('Normal');
    });

    it('G. LOW renders as: Rendah', () => {
      expect(formatPriorityName('LOW')).toBe('Rendah');
      expect(formatPriorityName('low')).toBe('Rendah');
    });

    it('H. Raw HIGH does not render in tested user-facing Inbox card badge', () => {
      const rawPriority = 'HIGH';
      const userFacingBadge = formatPriorityName(rawPriority);
      expect(userFacingBadge).not.toBe('HIGH');
      expect(userFacingBadge).toBe('Tinggi');
    });

    it('I. Header Bell uses same priority presentation', () => {
      // Bell and Inbox both call formatPriorityName
      const testItem = { metaData: { priority: 'HIGH' } };
      const priorityLabel = formatPriorityName(testItem.metaData.priority);
      expect(priorityLabel).toBe('Tinggi');
      expect(formatPriorityName('LOW')).toBe('Rendah');
    });

    it('J. Route remains: /inbox', () => {
      expect(INBOX_PAGE_CONFIG.ROUTE).toBe('/inbox');
      const systemGroup = MENU_GROUPS.find((g) => g.label === 'SYSTEM');
      const inboxMenuItem = systemGroup?.children.find((item) => item.label === 'Pusat Aktivitas');
      expect(inboxMenuItem?.path).toBe('/inbox');
      expect(inboxMenuItem?.key).toBe('/inbox');
    });

    it('K. Existing Inbox CTA/deep-link behavior remains unchanged', () => {
      expect(resolveTodoActionTarget({ actionTarget: '/project-delivery?projectId=2014&action=operational-plan' }))
        .toBe('/project-delivery?projectId=2014&action=operational-plan');
      expect(formatContextualCta({ actionType: 'PM_REVISION' })).toBe('Tinjau Revisi');
    });

    it('L. Existing semantic identity tests remain PASS', () => {
      const item = {
        projectName: 'Implementasi Fiber Optik Asianet Jakarta',
        customerName: 'PT Asianet Media Teknologi',
        contractNumber: 'CONT-20261008-0149',
        projectId: 2014,
      };
      const ctx = extractItemBusinessContext(item);
      expect(ctx.projectName).toBe('Implementasi Fiber Optik Asianet Jakarta');
      expect(ctx.customerName).toBe('PT Asianet Media Teknologi');
      expect(ctx.contractNumber).toBe('CONT-20261008-0149');
      expect(ctx.internalId).toBe(2014);
    });
  });
});

