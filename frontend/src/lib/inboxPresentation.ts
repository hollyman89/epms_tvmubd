/**
 * Unified Inbox Presentation Helper (EPMS — UNIFIED-INBOX-UX-R1)
 *
 * Centralized presentation layer for Unified Inbox, Header Notification Bell,
 * To-Do cards, History cards, and Notification cards.
 *
 * Enforces:
 * - Professional Indonesian microcopy
 * - Consistent entity tags (PROYEK, KONTRAK LEGAL, PERMINTAAN PEMBELIAN, etc.)
 * - Human-readable roles (Project Manager, Head of Operations, Direktur, etc.)
 * - Business-facing task titles (no raw workflow keys or node IDs)
 * - Result-oriented history titles (Penutupan Proyek Disetujui, etc.)
 * - Context-specific CTA buttons (Tinjau, Tinjau Revisi, Lihat Proyek, etc.)
 * - Canonical tab labels (Tugas, Riwayat, Notifikasi)
 * - Enterprise-grade empty states
 *
 * Strictly presentation-only: preserves all internal identifiers, enums, and deep-links.
 */

import { StatusDomain } from './statusPresentation';

export const INBOX_TABS = {
  TODO: 'Tugas',
  HISTORY: 'Riwayat',
  NOTIFICATIONS: 'Notifikasi',
} as const;

export const INBOX_PAGE_CONFIG = {
  TITLE: 'Pusat Aktivitas',
  SUBTITLE: 'Tugas, riwayat aktivitas, dan informasi terbaru yang perlu Anda ketahui.',
  ROUTE: '/inbox',
} as const;

export const INBOX_EMPTY_STATES = {
  TODO: 'Tidak ada tugas yang perlu ditindaklanjuti.',
  HISTORY: 'Belum ada riwayat aktivitas.',
  NOTIFICATIONS: 'Tidak ada notifikasi baru.',
  SEARCH: 'Tidak ada hasil yang sesuai.',
} as const;

/**
 * 1. Entity / Tag Presentation
 * Align Header Bell and Inbox entity labels to canonical Indonesian terminology.
 */
export function formatEntityLabel(entityType?: string | null): string {
  if (!entityType) return 'UMUM';
  const raw = String(entityType).trim().toUpperCase();

  switch (raw) {
    case 'PROJECT':
    case 'PROYEK':
      return 'PROYEK';
    case 'CONTRACT':
    case 'KONTRAK':
    case 'KONTRAK LEGAL':
      return 'KONTRAK LEGAL';
    case 'PROJECT_CLOSURE':
    case 'PENUTUPAN_PROYEK':
    case 'PENUTUPAN PROYEK':
      return 'PENUTUPAN PROYEK';
    case 'PURCHASE_REQUEST':
    case 'PURCHASE REQUEST':
    case 'PR':
    case 'PERMINTAAN PEMBELIAN':
      return 'PERMINTAAN PEMBELIAN';
    case 'PAYMENT_REQUEST':
    case 'PAYMENT':
    case 'PEMBAYARAN':
      return 'PEMBAYARAN';
    case 'SERVICE_CLAIM':
    case 'SERVICE CLAIM':
    case 'KLAIM_JASA':
    case 'KLAIM JASA':
      return 'KLAIM JASA';
    case 'TENDER':
      return 'TENDER';
    case 'OPPORTUNITY':
      return 'OPPORTUNITY';
    default:
      return raw.replace(/_/g, ' ');
  }
}

/**
 * Tag color corresponding to canonical entity types.
 */
export function getEntityTagColor(entityType?: string | null): string {
  if (!entityType) return 'blue';
  const raw = String(entityType).trim().toUpperCase();

  switch (raw) {
    case 'PROJECT':
    case 'PROYEK':
      return 'cyan';
    case 'CONTRACT':
    case 'KONTRAK':
    case 'KONTRAK LEGAL':
      return 'purple';
    case 'PROJECT_CLOSURE':
    case 'PENUTUPAN_PROYEK':
    case 'PENUTUPAN PROYEK':
      return 'purple';
    case 'PURCHASE_REQUEST':
    case 'PURCHASE REQUEST':
    case 'PR':
    case 'PERMINTAAN PEMBELIAN':
      return 'orange';
    case 'PAYMENT_REQUEST':
    case 'PAYMENT':
    case 'PEMBAYARAN':
      return 'geekblue';
    case 'SERVICE_CLAIM':
    case 'SERVICE CLAIM':
    case 'KLAIM_JASA':
    case 'KLAIM JASA':
      return 'gold';
    case 'TENDER':
      return 'green';
    default:
      return 'blue';
  }
}

/**
 * 2. Actor / Role Presentation
 * Never display raw enum keys like PROJECT_MANAGER, HEAD_OF_OPERATIONS, etc.
 */
export function formatRoleName(role?: string | null): string {
  if (!role) return '';
  const raw = String(role).trim().toUpperCase();

  switch (raw) {
    case 'PROJECT_MANAGER':
    case 'PM':
      return 'Project Manager';
    case 'HEAD_OF_OPERATIONS':
    case 'HEAD_OF_OPS':
    case 'HOPS':
    case 'HOO':
      return 'Head of Operations';
    case 'DIRECTOR':
      return 'Direktur';
    case 'GENERAL_MANAGER':
    case 'GM':
      return 'General Manager';
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'MARKETING':
      return 'Marketing';
    case 'LEGAL':
      return 'Legal';
    case 'PROCUREMENT':
      return 'Procurement';
    case 'FINANCE':
      return 'Finance';
    case 'PMO':
      return 'PMO';
    default:
      return raw
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
  }
}

/**
 * 3. Task Title Presentation (Actionable To-Do)
 * Eliminates raw node IDs, raw enums, database numeric IDs, and technical "Tugas Alur Kerja: ..." prefixes.
 */
export function formatTaskTitle(
  title?: string | null,
  context?: {
    actionType?: string;
    entityType?: string;
    taskKey?: string;
    status?: string;
    projectName?: string;
  }
): string {
  const actionType = String(context?.actionType || '').toUpperCase();
  const rawTitle = String(title || '').trim();

  // Strip DB ID suffix from titles like "Revisi Rencana Operasional Proyek #2014" or "Review Rencana Operasional Proyek #1380"
  if (
    actionType === 'PM_REVISION' ||
    /^Revisi Rencana Operasional(\s*Proyek\s*#\d+)?$/i.test(rawTitle)
  ) {
    return 'Revisi Rencana Operasional';
  }

  if (
    actionType === 'MANAGEMENT_REVIEW' ||
    /^Review Rencana Operasional(\s*Proyek\s*#\d+)?$/i.test(rawTitle)
  ) {
    return 'Review Rencana Operasional';
  }

  // Specific domain task overrides
  if (actionType === 'GO_NOGO_APPROVAL' || rawTitle.includes('GO_NOGO_APPROVAL') || rawTitle === 'Persetujuan GO / NO-GO') {
    return 'Persetujuan GO/NO-GO';
  }
  if (actionType === 'GO_NOGO_REVISION' || rawTitle.includes('GO_NOGO_REVISION') || rawTitle === 'Revisi GO / NO-GO') {
    return 'Revisi GO/NO-GO';
  }
  if (
    actionType === 'PROJECT_CLOSURE_DIRECTOR_APPROVAL' ||
    (rawTitle.includes('DIRECTOR_APPROVAL') && (context?.entityType === 'PROJECT_CLOSURE' || rawTitle.includes('Penutupan'))) ||
    rawTitle === 'Persetujuan Penutupan Proyek' ||
    rawTitle.startsWith('Penutupan Proyek Menunggu Persetujuan') ||
    /^Persetujuan Penutupan Proyek/i.test(rawTitle)
  ) {
    return 'Penutupan Proyek Menunggu Persetujuan Anda';
  }
  if (
    actionType === 'PROJECT_CLOSURE_HOO_REVIEW' ||
    (rawTitle.includes('HOO_REVIEW') && (context?.entityType === 'PROJECT_CLOSURE' || rawTitle.includes('Penutupan'))) ||
    rawTitle === 'Peninjauan Penutupan Proyek' ||
    rawTitle.startsWith('Penutupan Proyek Menunggu Peninjauan') ||
    /^Review Penutupan Proyek/i.test(rawTitle)
  ) {
    return 'Penutupan Proyek Menunggu Peninjauan';
  }
  if (rawTitle.includes('DIRECTOR_APPROVAL')) {
    return 'Penutupan Proyek Menunggu Persetujuan Anda';
  }
  if (rawTitle.includes('HOO_REVIEW')) {
    return 'Penutupan Proyek Menunggu Peninjauan';
  }
  if (actionType === 'PAYMENT_APPROVAL' || rawTitle.includes('PAYMENT_APPROVAL')) {
    return 'Persetujuan Pembayaran';
  }
  if (actionType === 'PAYMENT_REQUEST_REVISION' || /^Revisi Pengajuan Pembayaran/i.test(rawTitle)) {
    return 'Revisi Pengajuan Pembayaran';
  }
  if (actionType === 'PROCESS_PAYMENT' || /^Proses Pembayaran/i.test(rawTitle)) {
    return 'Proses Pembayaran';
  }
  if (actionType === 'CREATE_INVOICE' || /^Buat Invoice/i.test(rawTitle)) {
    return rawTitle;
  }
  if (actionType === 'LEGAL_DOCUMENT_REVISION') {
    return 'Revisi Dokumen SPK / Kontrak';
  }
  if (actionType === 'LEGAL_REVIEW' || /^Review Kontrak(\s*#.+)?$/i.test(rawTitle)) {
    return 'Review Legal Kontrak';
  }
  if (actionType === 'PMO_ASSIGN_PM') {
    return 'Penugasan Project Manager';
  }
  if (actionType === 'PURCHASE_REQUEST_APPROVAL' || /^Review & Persetujuan Purchase Request/i.test(rawTitle)) {
    return 'Review & Persetujuan Purchase Request';
  }
  if (actionType === 'SERVICE_CLAIM_VERIFICATION' || rawTitle.includes('SERVICE_CLAIM_VERIFICATION')) {
    return 'Verifikasi Teknis Klaim Jasa';
  }
  if (actionType === 'SERVICE_CLAIM_COMMERCIAL_APPROVAL' || rawTitle.includes('SERVICE_CLAIM_COMMERCIAL_APPROVAL')) {
    return 'Persetujuan Komersial Klaim Jasa';
  }
  if (actionType === 'SERVICE_CLAIM_REVISION' || rawTitle.includes('SERVICE_CLAIM_REVISION')) {
    return 'Revisi Pengajuan Klaim Jasa';
  }
  if (
    actionType === 'PROJECT_CLOSURE_REVISION' ||
    rawTitle.includes('PROJECT_CLOSURE_REVISION') ||
    rawTitle === 'Revisi Penutupan Proyek' ||
    rawTitle.startsWith('Pengajuan Penutupan Proyek Perlu Diperbaiki') ||
    /^Revisi Penutupan Proyek/i.test(rawTitle)
  ) {
    return 'Pengajuan Penutupan Proyek Perlu Diperbaiki';
  }

  // Handle prefix "Tugas Alur Kerja: ..."
  if (rawTitle.startsWith('Tugas Alur Kerja:')) {
    const key = rawTitle.replace(/^Tugas Alur Kerja:\s*/, '').trim().toUpperCase();
    if (key === 'DIRECTOR_APPROVAL' || key === 'PROJECT_CLOSURE_DIRECTOR_APPROVAL') return 'Penutupan Proyek Menunggu Persetujuan Anda';
    if (key === 'HOO_REVIEW' || key === 'PROJECT_CLOSURE_HOO_REVIEW') return 'Penutupan Proyek Menunggu Peninjauan';
    if (key === 'PROJECT_CLOSURE_REVISION') return 'Pengajuan Penutupan Proyek Perlu Diperbaiki';
    if (key === 'GO_NOGO_APPROVAL') return 'Persetujuan GO/NO-GO';
    if (key === 'LEGAL_REVIEW') return 'Review Legal Kontrak';
    if (key === 'LEGAL_DOCUMENT_REVISION') return 'Revisi Dokumen SPK / Kontrak';
    if (key === 'PMO_ASSIGN_PM') return 'Penugasan Project Manager';
    if (key === 'PM_REVISION') return 'Revisi Rencana Operasional';
    if (key === 'HOPS_REVIEW') return 'Review Rencana Operasional';
    return key
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Remove generic "Proyek #\d+: " prefix if any remains
  const cleanTitle = rawTitle.replace(/^Proyek\s*#\d+:\s*/i, '');

  return cleanTitle;
}

/**
 * 4. Completed History Title Presentation (Riwayat)
 * Riwayat represents completed business events using past/result-oriented Indonesian.
 * Eliminates technical acronyms like HOPS and raw patterns like "Proyek #1380: PM Plan Revision (HOPS)".
 */
export function formatHistoryTitle(item: {
  title?: string | null;
  taskKey?: string | null;
  nodeId?: string | null;
  entityType?: string | null;
  status?: string | null;
  action?: string | null;
  entityId?: number | null;
}): string {
  const rawTitle = String(item.title || '').trim();
  const taskKey = String(item.taskKey || '').toUpperCase();
  const entityType = String(item.entityType || '').toUpperCase();
  const action = String(item.action || '').toUpperCase();
  const status = String(item.status || '').toUpperCase();
  const nodeId = String(item.nodeId || '').toUpperCase();

  // 1. PM Plan Revision / PM Revision
  // Must NOT render: "PM Plan Revision (HOPS)" or "Proyek #1380: PM Plan Revision (HOPS)"
  const isPmRevision =
    taskKey.includes('PM_REVISION') ||
    taskKey.includes('PM PLAN REVISION') ||
    rawTitle.includes('PM Plan Revision') ||
    rawTitle.includes('PM_REVISION') ||
    nodeId.includes('NODE_PM_REVISION');

  if (isPmRevision) {
    if (action === 'RETURN' || status === 'RETURNED') {
      return 'Rencana Operasional Dikembalikan';
    }
    return 'Rencana Operasional Diajukan Ulang';
  }

  // 2. Governance Management Review
  const isHopsReview =
    taskKey === 'HOPS_REVIEW' ||
    rawTitle.includes('HOPS') ||
    nodeId.includes('NODE_HOPS_REVIEW');

  if (isHopsReview) {
    if (action === 'RETURN' || status === 'RETURNED') {
      return 'Peninjauan Rencana Operasional (Head of Operations) Dikembalikan';
    }
    return 'Peninjauan Rencana Operasional (Head of Operations) Selesai';
  }

  if (taskKey === 'PROCUREMENT_REVIEW' || rawTitle.includes('PROCUREMENT_REVIEW') || nodeId.includes('NODE_PROCUREMENT_REVIEW')) {
    return 'Peninjauan Rencana Operasional (Procurement) Selesai';
  }

  if (taskKey === 'FINANCE_REVIEW' || rawTitle.includes('FINANCE_REVIEW') || nodeId.includes('NODE_FINANCE_REVIEW')) {
    return 'Peninjauan Rencana Operasional (Finance) Selesai';
  }

  // 3. Project Closure History
  const isClosure =
    entityType === 'PROJECT_CLOSURE' ||
    entityType === 'PENUTUPAN PROYEK' ||
    rawTitle.includes('PROJECT_CLOSURE') ||
    rawTitle.includes('Penutupan Proyek') ||
    rawTitle.includes('Peninjauan Penutupan') ||
    taskKey.includes('PROJECT_CLOSURE');

  if (isClosure) {
    const isReturn =
      action === 'RETURN' ||
      status === 'RETURNED' ||
      rawTitle.includes('Dikembalikan') ||
      rawTitle.includes('RETURN');

    const isHoo =
      taskKey.includes('HOO') ||
      taskKey.includes('HOPS') ||
      rawTitle.includes('HOO') ||
      rawTitle.includes('Peninjauan') ||
      nodeId.includes('HOO');

    const isDirector =
      taskKey.includes('DIRECTOR') ||
      rawTitle.includes('DIRECTOR') ||
      rawTitle.includes('Persetujuan') ||
      rawTitle.includes('Penutupan Proyek #') ||
      rawTitle.match(/^Penutupan Proyek\s*(#\d+)?$/i) ||
      nodeId.includes('DIRECTOR');

    const isSubmit =
      action === 'SUBMIT' ||
      rawTitle.includes('SUBMITTED') ||
      rawTitle.includes('SUBMIT') ||
      rawTitle.includes('Pengajuan');

    if (isHoo) {
      if (isReturn) {
        return 'Head of Operations mengembalikan pengajuan ke PM untuk diperbaiki.';
      }
      return 'Head of Operations menyetujui hasil peninjauan dan meneruskan pengajuan ke Direktur.';
    }

    if (isDirector) {
      if (isReturn) {
        return 'Direktur mengembalikan pengajuan ke PM untuk diperbaiki.';
      }
      return 'Direktur menyetujui penutupan proyek.';
    }

    if (isSubmit) {
      return 'PM mengajukan penutupan proyek.';
    }

    // Fallbacks
    if (isReturn) {
      return 'Head of Operations mengembalikan pengajuan ke PM untuk diperbaiki.';
    }
    return 'Direktur menyetujui penutupan proyek.';
  }

  // 4. Tender GO/NO-GO History
  if (taskKey === 'GO_NOGO_APPROVAL' || rawTitle.includes('GO_NOGO_APPROVAL')) {
    const tenderPrefix = item.entityId ? `Tender #${item.entityId}: ` : '';
    if (action === 'APPROVE' || status === 'COMPLETED' || status === 'APPROVED') {
      return `${tenderPrefix}Persetujuan GO/NO-GO Disetujui`;
    }
    if (action === 'REJECT' || status === 'REJECTED') {
      return `${tenderPrefix}Persetujuan GO/NO-GO Ditolak`;
    }
    if (action === 'RETURN' || status === 'RETURNED') {
      return `${tenderPrefix}Persetujuan GO/NO-GO Dikembalikan`;
    }
    return `${tenderPrefix}Persetujuan GO/NO-GO`;
  }

  // Clean raw "Tugas Alur Kerja: ..." prefix in history
  if (rawTitle.startsWith('Tugas Alur Kerja:')) {
    const key = rawTitle.replace(/^Tugas Alur Kerja:\s*/, '').trim().toUpperCase();
    if (key === 'DIRECTOR_APPROVAL' || key === 'PROJECT_CLOSURE_DIRECTOR_APPROVAL') return 'Direktur menyetujui penutupan proyek.';
    if (key === 'HOO_REVIEW' || key === 'PROJECT_CLOSURE_HOO_REVIEW') return 'Head of Operations menyetujui hasil peninjauan dan meneruskan pengajuan ke Direktur.';
    if (key === 'GO_NOGO_APPROVAL') return 'Persetujuan GO/NO-GO Disetujui';
    return key
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ') + ' Selesai';
  }

  // Strip raw event names if any leaked
  if (rawTitle.includes('PROJECT_CLOSURE_SUBMITTED')) return 'PM mengajukan penutupan proyek.';
  if (rawTitle.includes('PROJECT_CLOSURE_HOO_APPROVED')) return 'Head of Operations menyetujui hasil peninjauan dan meneruskan pengajuan ke Direktur.';
  if (rawTitle.includes('PROJECT_CLOSURE_DIRECTOR_APPROVED')) return 'Direktur menyetujui penutupan proyek.';

  // Strip raw "Proyek #\d+: " prefix from any other history title
  let cleaned = rawTitle.replace(/^Proyek\s*#\d+:\s*/i, '');
  cleaned = cleaned.replace(/\bHOPS\b/g, 'Head of Operations');

  return cleaned;
}

/**
 * 5. Informational Notification Microcopy Normalization
 * Replaces technical or informal wording in notifications and strips ambiguous "#" prefixes.
 */
export function formatNotificationTitle(title?: string | null): string {
  if (!title) return '';
  let cleaned = String(title).trim();

  // Project Closure Notification Titles
  if (/^Pengajuan Penutupan Proyek$/i.test(cleaned)) {
    cleaned = 'Pengajuan Penutupan Proyek Baru';
  }
  if (/^Persetujuan Penutupan Proyek Direktur$/i.test(cleaned) || /^Penutupan Proyek Menunggu Keputusan/i.test(cleaned)) {
    cleaned = 'Penutupan Proyek Menunggu Keputusan Anda';
  }
  if (/^Penutupan Proyek Dikembalikan$/i.test(cleaned)) {
    cleaned = 'Pengajuan Penutupan Proyek Dikembalikan';
  }

  // PM Assignment
  cleaned = cleaned.replace(/Penugasan Project Manager Baru/gi, 'Anda Ditugaskan sebagai Project Manager');

  // Kick-Off & Review
  cleaned = cleaned.replace(/Project Siap Kick Off/gi, 'Proyek Siap Kick-Off');
  cleaned = cleaned.replace(/Draft Kontrak Baru Siap Direview/gi, 'Draft Kontrak Siap Ditinjau');
  cleaned = cleaned.replace(/Siap Direview/gi, 'Siap Ditinjau');
  cleaned = cleaned.replace(/Persetujuan Pembayaran Dibutuhkan/gi, 'Pengajuan Pembayaran Diajukan');

  // Strip raw # from titles
  cleaned = cleaned.replace(/Proyek\s*#([A-Za-z0-9\-_]+)/gi, 'Proyek $1');
  cleaned = cleaned.replace(/Kontrak\s*#([A-Za-z0-9\-_]+)/gi, 'Kontrak $1');

  // General loanword replacements
  cleaned = cleaned.replace(/\bdireview\b/gi, 'ditinjau');
  cleaned = cleaned.replace(/\bdi approve\b/gi, 'disetujui');
  cleaned = cleaned.replace(/\bdi return\b/gi, 'dikembalikan');

  return cleaned;
}

export function formatNotificationMessage(message?: string | null): string {
  if (!message) return '';
  let cleaned = String(message);

  // Project Closure Message Normalization
  cleaned = cleaned.replace(
    /Penutupan proyek "([^"]+)" diajukan oleh PM dan membutuhkan review Head of Operations\./gi,
    (_, name) => {
      const proj = name && !name.startsWith('CONT-') && !name.match(/^Proyek\s*#\d+$/i)
        ? `proyek "${name}"`
        : 'proyek ini';
      return `PM telah mengajukan penutupan ${proj} untuk Anda tinjau.`;
    }
  );
  cleaned = cleaned.replace(
    /Penutupan proyek "([^"]+)" telah disetujui HOO dan menunggu persetujuan Direktur\./gi,
    (_, name) => {
      const proj = name && !name.startsWith('CONT-') && !name.match(/^Proyek\s*#\d+$/i)
        ? `proyek "${name}"`
        : 'proyek ini';
      return `Head of Operations telah meninjau penutupan ${proj} dan meneruskannya kepada Anda untuk keputusan akhir.`;
    }
  );
  cleaned = cleaned.replace(
    /Pengajuan penutupan proyek "([^"]+)" dikembalikan\.\s*Catatan:\s*(.+)/gi,
    (_, name, note) => {
      const proj = name && !name.startsWith('CONT-') && !name.match(/^Proyek\s*#\d+$/i)
        ? `proyek "${name}"`
        : 'proyek ini';
      return `Pengajuan penutupan ${proj} perlu diperbaiki. Catatan: ${note} Silakan lihat catatan reviewer dan ajukan kembali.`;
    }
  );
  cleaned = cleaned.replace(
    /Pengajuan penutupan proyek "([^"]+)" dikembalikan\./gi,
    (_, name) => {
      const proj = name && !name.startsWith('CONT-') && !name.match(/^Proyek\s*#\d+$/i)
        ? `proyek "${name}"`
        : 'proyek ini';
      return `Pengajuan penutupan ${proj} perlu diperbaiki. Silakan lihat catatan reviewer dan ajukan kembali.`;
    }
  );

  // PM Assignment message correction
  cleaned = cleaned.replace(
    /Anda telah resmi ditugaskan sebagai Project Manager untuk proyek\s*#(CONT-[A-Za-z0-9\-_]+)\.?\s*Silakan mulai menyusun (?:Operational Plan|rencana operasional proyek)\.?/gi,
    'Anda telah resmi ditugaskan sebagai Project Manager untuk proyek terkait Kontrak $1. Silakan mulai menyusun rencana operasional proyek.'
  );

  cleaned = cleaned.replace(
    /proyek\s*#(CONT-[A-Za-z0-9\-_]+)/gi,
    'Kontrak $1'
  );

  cleaned = cleaned.replace(/proyek\s*#(\d+)/gi, 'proyek ini');
  cleaned = cleaned.replace(/Proyek\s*\(ID:\s*\d+\)/gi, 'proyek ini');

  cleaned = cleaned.replace(/Operational Plan/gi, 'rencana operasional proyek');
  cleaned = cleaned.replace(/Project Siap Kick Off/gi, 'Proyek Siap Kick-Off');
  cleaned = cleaned.replace(/siap direview/gi, 'siap ditinjau');
  cleaned = cleaned.replace(/direview/gi, 'ditinjau');
  cleaned = cleaned.replace(/di approve/gi, 'disetujui');
  cleaned = cleaned.replace(/di return/gi, 'dikembalikan');

  return cleaned;
}

/**
 * 6. Structured Business Context Extractor
 * Extracts explicit Level 2 & Level 3 business context from items without string guessing.
 */
export interface StructuredBusinessContext {
  projectName?: string;
  customerName?: string;
  contractNumber?: string;
  poNumber?: string;
  vendorName?: string;
  invoiceNumber?: string;
  paymentRequestNumber?: string;
  internalId?: number | string;
}

export function extractItemBusinessContext(item: any): StructuredBusinessContext {
  if (!item) return {};

  const context: StructuredBusinessContext = {};

  if (item.projectName) {
    context.projectName = item.projectName;
  }
  if (item.customerName) {
    context.customerName = item.customerName;
  }
  if (item.contractNumber) {
    context.contractNumber = item.contractNumber;
  }
  if (item.vendorName) {
    context.vendorName = item.vendorName;
  }

  // Check metaData (e.g. notifications)
  if (item.metaData) {
    if (item.metaData.projectName && !context.projectName) {
      context.projectName = item.metaData.projectName;
    }
    if (item.metaData.customerName && !context.customerName) {
      context.customerName = item.metaData.customerName;
    }
    if (item.metaData.contractNumber && !context.contractNumber) {
      context.contractNumber = item.metaData.contractNumber;
    }
    if (item.metaData.projectCode) {
      if (String(item.metaData.projectCode).startsWith('CONT-')) {
        if (!context.contractNumber) context.contractNumber = item.metaData.projectCode;
      } else if (!context.projectName) {
        context.projectName = item.metaData.projectCode;
      }
    }
    if (item.metaData.poNumber) {
      context.poNumber = item.metaData.poNumber;
    }
    if (item.metaData.vendorName && !context.vendorName) {
      context.vendorName = item.metaData.vendorName;
    }
  }

  // Internal numeric ID (only secondary when useful, never for PROJECT_CLOSURE)
  const isClosureItem =
    item.entityType === 'PROJECT_CLOSURE' ||
    item.entityType === 'PENUTUPAN PROYEK' ||
    String(item.actionType || '').startsWith('PROJECT_CLOSURE') ||
    String(item.title || '').includes('Penutupan Proyek') ||
    String(item.title || '').includes('Peninjauan Penutupan') ||
    item.metaData?.category === 'PROJECT_CLOSURE' ||
    item.metaData?.reference_type === 'PROJECT_CLOSURE';

  if (!isClosureItem) {
    if (item.projectId) {
      context.internalId = item.projectId;
    } else if (item.entityType === 'PROJECT' && item.entityId && !context.internalId) {
      context.internalId = item.entityId;
    }
  }

  // Never leak raw "Proyek #123" or "CONT-..." as projectName
  if (context.projectName && (context.projectName.match(/^Proyek\s*#\d+$/i) || context.projectName.startsWith('CONT-'))) {
    if (context.projectName.startsWith('CONT-') && !context.contractNumber) {
      context.contractNumber = context.projectName;
    }
    context.projectName = undefined;
  }

  return context;
}

/**
 * 7. Human-Friendly Task Description Presenter
 * Answers:
 * 1. Apa yang terjadi?
 * 2. Proyek apa?
 * 3. Siapa yang melakukan tindakan sebelumnya?
 * 4. Apa yang harus dilakukan user sekarang?
 */
export function formatTaskDescription(item: {
  actionType?: string | null;
  entityType?: string | null;
  title?: string | null;
  projectName?: string | null;
  description?: string | null;
  returnedByName?: string | null;
  returnReason?: string | null;
  submittedByName?: string | null;
}): string {
  const actionType = String(item?.actionType || '').toUpperCase();
  const entityType = String(item?.entityType || '').toUpperCase();
  const rawTitle = String(item?.title || '').toUpperCase();

  const isClosure =
    entityType === 'PROJECT_CLOSURE' ||
    entityType === 'PENUTUPAN PROYEK' ||
    actionType.includes('PROJECT_CLOSURE') ||
    rawTitle.includes('PENUTUPAN PROYEK');

  if (isClosure) {
    const rawProjectName = item.projectName;
    const safeProjectName =
      rawProjectName &&
      !rawProjectName.match(/^Proyek\s*#\d+$/i) &&
      !rawProjectName.startsWith('CONT-')
        ? rawProjectName
        : undefined;
    const proj = safeProjectName ? `proyek "${safeProjectName}"` : 'proyek ini';

    if (
      actionType === 'PROJECT_CLOSURE_HOO_REVIEW' ||
      rawTitle.includes('HOO') ||
      rawTitle.includes('PENINJAUAN')
    ) {
      return `PM telah mengajukan penutupan ${proj}. Silakan tinjau kelengkapan pengajuan sebelum diteruskan ke Direktur.`;
    }

    if (
      actionType === 'PROJECT_CLOSURE_DIRECTOR_APPROVAL' ||
      rawTitle.includes('DIRECTOR') ||
      rawTitle.includes('PERSETUJUAN')
    ) {
      return `Head of Operations telah menyelesaikan peninjauan penutupan ${proj} dan meneruskannya kepada Anda untuk keputusan akhir.`;
    }

    if (
      actionType === 'PROJECT_CLOSURE_REVISION' ||
      rawTitle.includes('REVISI') ||
      rawTitle.includes('PERBAIK')
    ) {
      if (item.returnedByName) {
        return `${item.returnedByName} mengembalikan pengajuan penutupan ${proj} untuk diperbaiki. Silakan lihat catatan reviewer, lakukan perbaikan, lalu ajukan kembali.`;
      }
      return `Pengajuan penutupan ${proj} dikembalikan untuk diperbaiki. Silakan lihat catatan reviewer, lakukan perbaikan, lalu ajukan kembali.`;
    }
  }

  return item?.description || '';
}

/**
 * 8. Priority Label Normalization
 * Translates technical priority badges into professional Indonesian.
 */
export function formatPriorityName(priority?: string | null): string {
  if (!priority) return '';
  switch (String(priority).trim().toUpperCase()) {
    case 'URGENT':
      return 'Mendesak';
    case 'HIGH':
      return 'Tinggi';
    case 'NORMAL':
    case 'MEDIUM':
      return 'Normal';
    case 'LOW':
      return 'Rendah';
    default:
      return priority;
  }
}

/**
 * 9. Context-Specific CTA Button Label
 * Replaces generic "Buka" with descriptive action verbs (Section 10).
 */
export function formatContextualCta(item: {
  actionType?: string | null;
  entityType?: string | null;
  title?: string | null;
  actionTarget?: string | null;
}): string {
  const actionType = String(item.actionType || '').toUpperCase();
  const entityType = String(item.entityType || '').toUpperCase();
  const title = String(item.title || '').toUpperCase();

  // Project Closure CTAs
  if (
    actionType === 'PROJECT_CLOSURE_HOO_REVIEW' ||
    (entityType === 'PROJECT_CLOSURE' && (title.includes('HOO') || title.includes('PENINJAUAN'))) ||
    title.includes('PENUTUPAN PROYEK MENUNGGU PENINJAUAN')
  ) {
    return 'Tinjau Pengajuan';
  }

  if (
    actionType === 'PROJECT_CLOSURE_DIRECTOR_APPROVAL' ||
    (entityType === 'PROJECT_CLOSURE' && (title.includes('DIRECTOR') || title.includes('PERSETUJUAN'))) ||
    title.includes('PENUTUPAN PROYEK MENUNGGU PERSETUJUAN')
  ) {
    return 'Tinjau & Beri Keputusan';
  }

  if (
    actionType === 'PROJECT_CLOSURE_REVISION' ||
    (entityType === 'PROJECT_CLOSURE' && (title.includes('REVISI') || title.includes('PERBAIK'))) ||
    title.includes('PENUTUPAN PROYEK PERLU DIPERBAIKI')
  ) {
    return 'Lihat Catatan & Perbaiki';
  }

  // Approvals & Reviews
  if (
    actionType === 'GO_NOGO_APPROVAL' ||
    actionType === 'MANAGEMENT_REVIEW' ||
    actionType === 'PURCHASE_REQUEST_APPROVAL' ||
    actionType === 'LEGAL_REVIEW' ||
    actionType === 'PAYMENT_APPROVAL' ||
    actionType === 'SERVICE_CLAIM_VERIFICATION' ||
    actionType === 'SERVICE_CLAIM_COMMERCIAL_APPROVAL' ||
    title.includes('PERSETUJUAN') ||
    title.includes('PENINJAUAN') ||
    title.includes('VERIFIKASI')
  ) {
    return 'Tinjau';
  }

  // Revisions
  if (
    actionType === 'GO_NOGO_REVISION' ||
    actionType === 'PM_REVISION' ||
    actionType === 'LEGAL_DOCUMENT_REVISION' ||
    actionType === 'PAYMENT_REQUEST_REVISION' ||
    actionType === 'SERVICE_CLAIM_REVISION' ||
    title.includes('REVISI')
  ) {
    return 'Tinjau Revisi';
  }

  // Assignments
  if (actionType === 'PMO_ASSIGN_PM' || title.includes('PENUGASAN')) {
    return 'Tugaskan PM';
  }

  // Payment execution
  if (actionType === 'PROCESS_PAYMENT') {
    return 'Proses Pembayaran';
  }

  // Procurement RFQ creation
  if (actionType === 'CREATE_RFQ' || title.includes('BUAT RFQ')) {
    return 'Buat RFQ';
  }

  // Finance Invoice creation
  if (actionType === 'CREATE_INVOICE' || title.includes('BUAT INVOICE')) {
    return 'Buat Invoice';
  }

  // Entity specific views
  if (entityType === 'PROJECT' || entityType === 'PROYEK') {
    return 'Lihat Proyek';
  }
  if (entityType === 'CONTRACT' || entityType === 'KONTRAK LEGAL') {
    return 'Lihat Kontrak';
  }
  if (entityType === 'PAYMENT_REQUEST' || entityType === 'PEMBAYARAN') {
    return 'Lihat Pembayaran';
  }
  if (entityType === 'PURCHASE_REQUEST' || entityType === 'PERMINTAAN PEMBELIAN') {
    return 'Lihat PR';
  }
  if (entityType === 'SERVICE_CLAIM' || entityType === 'KLAIM JASA') {
    return 'Lihat Klaim Jasa';
  }
  if (entityType === 'PROJECT_CLOSURE' || entityType === 'PENUTUPAN PROYEK') {
    return 'Tinjau Pengajuan';
  }
  if (entityType === 'TENDER') {
    return 'Lihat Tender';
  }

  return 'Tinjau';
}

/**
 * 8. Domain Resolver for Status Presentation
 * Determines the StatusDomain for an item so that domain-specific Indonesian status labels
 * are resolved without machine enum leaks.
 */
export function resolveItemStatusDomain(item?: {
  entityType?: string | null;
  sourceType?: string | null;
  actionType?: string | null;
}): StatusDomain {
  if (!item) return 'workflow';
  const entity = (item.entityType || '').toUpperCase();
  const source = (item.sourceType || '').toUpperCase();
  const action = (item.actionType || '').toUpperCase();

  if (
    source === 'DOMAIN_SERVICE_CLAIM' ||
    entity === 'SERVICE_CLAIM' ||
    entity === 'KLAIM_JASA' ||
    entity === 'KLAIM JASA' ||
    action.includes('SERVICE_CLAIM')
  ) {
    return 'service_claim';
  }

  if (
    source === 'DOMAIN_PROJECT_CLOSURE' ||
    entity === 'PROJECT_CLOSURE' ||
    entity === 'PENUTUPAN_PROYEK' ||
    entity === 'PENUTUPAN PROYEK' ||
    action.includes('PROJECT_CLOSURE')
  ) {
    return 'project_closure';
  }

  if (
    source === 'DOMAIN_PAYMENT_REQUEST' ||
    source === 'DOMAIN_INVOICE' ||
    entity === 'PAYMENT_REQUEST' ||
    entity === 'PAYMENT' ||
    entity === 'PEMBAYARAN' ||
    entity === 'INVOICE' ||
    action.includes('PAYMENT') ||
    action === 'CREATE_INVOICE'
  ) {
    return 'payment';
  }

  if (
    source === 'DOMAIN_PURCHASE_REQUEST' ||
    entity === 'PURCHASE_REQUEST' ||
    entity === 'PR' ||
    entity === 'PERMINTAAN PEMBELIAN' ||
    action.includes('PURCHASE_REQUEST')
  ) {
    return 'pr';
  }

  if (entity === 'CONTRACT' || entity === 'KONTRAK' || entity === 'KONTRAK LEGAL' || action.includes('LEGAL')) {
    return 'legal';
  }

  if (entity === 'PROJECT' || entity === 'PROYEK') {
    return 'project';
  }

  if (entity === 'TENDER' || action.includes('GO_NOGO')) {
    return 'tender';
  }

  return 'workflow';
}
