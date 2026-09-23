import { apiClient } from '@/lib/axios';

// ==========================================
// 1. MISMATCH CODES & DEFINITIONS
// ==========================================

export enum MismatchCode {
  PO_NOT_FOUND = 'PO_NOT_FOUND',
  PO_NOT_ACTIVE = 'PO_NOT_ACTIVE',
  VENDOR_MISMATCH = 'VENDOR_MISMATCH',
  TERM_NOT_FOUND = 'TERM_NOT_FOUND',
  TERM_ALREADY_INVOICED = 'TERM_ALREADY_INVOICED',
  TERM_ALREADY_VERIFIED = 'TERM_ALREADY_VERIFIED',
  TERM_STATUS_INVALID = 'TERM_STATUS_INVALID',
  AMOUNT_EXCEEDED_TERM = 'AMOUNT_EXCEEDED_TERM',
  CUMULATIVE_AMOUNT_EXCEEDED_PO = 'CUMULATIVE_AMOUNT_EXCEEDED_PO',
  INVALID_TERM_PERCENTAGE = 'INVALID_TERM_PERCENTAGE',
  PAYMENT_TERM_INCOMPLETE = 'PAYMENT_TERM_INCOMPLETE',
  INVALID_SEQUENCE = 'INVALID_SEQUENCE',
  INVOICE_ALREADY_VERIFIED = 'INVOICE_ALREADY_VERIFIED',
  INVOICE_ALREADY_PAID = 'INVOICE_ALREADY_PAID',
  EVIDENCE_REQUIRED = 'EVIDENCE_REQUIRED',
  RETENTION_PO_NOT_COMPLETED = 'RETENTION_PO_NOT_COMPLETED',
  THREE_WAY_MISMATCH = 'THREE_WAY_MISMATCH',
  OTHER = 'OTHER',
}

export interface MatchingMismatch {
  code: MismatchCode;
  message: string;
}

export interface MismatchMeta {
  label: string;
  severity: 'error' | 'warning';
  badgeColor: string;
  fallbackMessage: string;
}

export const MISMATCH_DEFINITIONS: Record<MismatchCode, MismatchMeta> = {
  [MismatchCode.PO_NOT_FOUND]: {
    label: 'PO Tidak Ditemukan',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Data Purchase Order terkait tidak ditemukan pada sistem.',
  },
  [MismatchCode.PO_NOT_ACTIVE]: {
    label: 'PO Tidak Aktif',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Status Purchase Order belum aktif atau dibatalkan.',
  },
  [MismatchCode.VENDOR_MISMATCH]: {
    label: 'Vendor Tidak Sesuai',
    severity: 'error',
    badgeColor: 'volcano',
    fallbackMessage: 'Vendor penagih berbeda dengan vendor pemenang kontrak PO.',
  },
  [MismatchCode.TERM_NOT_FOUND]: {
    label: 'Termin Tidak Ditemukan',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Jadwal termin pembayaran tidak terdaftar pada PO.',
  },
  [MismatchCode.TERM_ALREADY_INVOICED]: {
    label: 'Termin Sudah Ditagihkan',
    severity: 'warning',
    badgeColor: 'orange',
    fallbackMessage: 'Termin pembayaran ini telah memiliki tagihan faktur aktif.',
  },
  [MismatchCode.TERM_ALREADY_VERIFIED]: {
    label: 'Termin Sudah Diverifikasi',
    severity: 'warning',
    badgeColor: 'gold',
    fallbackMessage: 'Termin pembayaran ini sudah pernah diverifikasi sebelumnya.',
  },
  [MismatchCode.TERM_STATUS_INVALID]: {
    label: 'Status Termin Tidak Valid',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Status termin tidak mengizinkan proses verifikasi faktur.',
  },
  [MismatchCode.AMOUNT_EXCEEDED_TERM]: {
    label: 'Nominal Melebihi Termin',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Nominal tagihan melebihi batas plafon nilai termin yang ditentukan.',
  },
  [MismatchCode.CUMULATIVE_AMOUNT_EXCEEDED_PO]: {
    label: 'Akumulasi Melebihi Total PO',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Total akumulasi penagihan invoice melebihi nilai kontrak PO.',
  },
  [MismatchCode.INVALID_TERM_PERCENTAGE]: {
    label: 'Persentase Termin Tidak Valid',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Nilai persentase termin tidak sesuai dengan spesifikasi PO.',
  },
  [MismatchCode.PAYMENT_TERM_INCOMPLETE]: {
    label: 'Termin Belum Lengkap',
    severity: 'warning',
    badgeColor: 'orange',
    fallbackMessage: 'Data konfigurasi jadwal termin pembayaran belum lengkap.',
  },
  [MismatchCode.INVALID_SEQUENCE]: {
    label: 'Urutan Termin Tidak Valid',
    severity: 'error',
    badgeColor: 'volcano',
    fallbackMessage: 'Termin sebelumnya harus diselesaikan dan diverifikasi terlebih dahulu.',
  },
  [MismatchCode.INVOICE_ALREADY_VERIFIED]: {
    label: 'Invoice Sudah Diverifikasi',
    severity: 'warning',
    badgeColor: 'blue',
    fallbackMessage: 'Invoice ini telah berstatus terverifikasi oleh Finance.',
  },
  [MismatchCode.INVOICE_ALREADY_PAID]: {
    label: 'Invoice Sudah Dibayar',
    severity: 'warning',
    badgeColor: 'green',
    fallbackMessage: 'Invoice ini telah dilunasi melalui modul pembayaran.',
  },
  [MismatchCode.EVIDENCE_REQUIRED]: {
    label: 'Dokumen Bukti Diperlukan',
    severity: 'warning',
    badgeColor: 'purple',
    fallbackMessage: 'Verifikasi invoice termin memerlukan referensi dokumen (BAST / Surat Jalan).',
  },
  [MismatchCode.RETENTION_PO_NOT_COMPLETED]: {
    label: 'PO Belum 100% Selesai (Retensi)',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Tagihan termin retensi hanya dapat diproses setelah pekerjaan PO 100% selesai.',
  },
  [MismatchCode.THREE_WAY_MISMATCH]: {
    label: 'Ketidaksesuaian 3-Way Match',
    severity: 'error',
    badgeColor: 'red',
    fallbackMessage: 'Terdapat diskrepansi nilai atau kuantitas antara PO, GR, dan Invoice.',
  },
  [MismatchCode.OTHER]: {
    label: 'Ketidaksesuaian Lainnya',
    severity: 'warning',
    badgeColor: 'default',
    fallbackMessage: 'Ditemukan anomali verifikasi pada invoice.',
  },
};

// ==========================================
// 2. DTO & INTERFACES
// ==========================================

export interface MatchingResult {
  invoiceId: number;
  poId: number;
  termId?: number;
  status: 'MATCHED' | 'MISMATCH' | 'VERIFIED' | 'REJECTED';
  poTotal: number;
  termPercentage?: number;
  termAmount?: number;
  invoicedAmount: number;
  remainingTermAmount?: number;
  cumulativeInvoicedAmount: number;
  remainingPoAmount: number;
  cumulativePaidAmount: number;
  goodsReceiptId?: number;
  goodsReceiptNumber?: string;
  mismatches: MatchingMismatch[];
}

export interface VerifyInvoiceDto {
  approved: boolean;
  goodsReceiptId?: number;
  evidenceRef?: string;
  notes?: string;
}

export interface InvoiceItemDto {
  id: number;
  invoiceId: number;
  poItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  poItem?: {
    id: number;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    uom?: string;
  };
}

export interface PoPaymentTermDto {
  id: number;
  poId: number;
  sequence: number;
  termName: string;
  termType: string;
  percentage: number;
  amount: number;
  triggerCondition?: string;
  status: string;
}

export interface PurchaseOrderDto {
  id: number;
  poNumber: string;
  totalAmount: number;
  status: string;
  vendorId: number;
  vendor?: {
    id: number;
    name: string;
    code: string;
  };
  purchaseRequestId?: number;
  purchaseRequest?: {
    id: number;
    prNumber: string;
    projectId?: number;
    project?: {
      id: number;
      name: string;
      code?: string;
    };
  };
}

export interface InvoiceDto {
  id: number;
  poId: number;
  paymentTermId?: number;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  matchStatus: string;
  paymentStatus: string;
  status: string;
  createdBy?: number;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  purchaseOrder?: PurchaseOrderDto;
  paymentTerm?: PoPaymentTermDto;
  items?: InvoiceItemDto[];
  payments?: any[];
}

export interface PaymentDto {
  id: number;
  invoiceId: number;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  bankName?: string;
  notes?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  invoice?: InvoiceDto;
  paymentStatus?: string;
  remainingAmount?: number;
  isFullyPaid?: boolean;
}

export interface CreatePaymentPayload {
  invoiceId: number;
  paymentDate: string;
  paymentAmount: number;
  amount?: number;
  paymentMethod: string;
  referenceNumber: string;
  bankName?: string;
  notes?: string;
}

export interface CreateInvoiceItemPayload {
  poItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CreateInvoicePayload {
  purchaseOrderId: number;
  paymentTermId?: number;
  invoiceDate: string;
  items?: CreateInvoiceItemPayload[];
}

// ==========================================
// 3. FINANCE CENTRALIZED API SERVICE
// ==========================================

export class FinanceService {
  /**
   * Helper to unwrap standard backend TransformInterceptor + controller response wrapper:
   * res.data = { meta, data: { message, data: T } } => extracts T
   */
  private static unwrapData<T>(res: any): T {
    if (res?.data?.data?.data !== undefined) {
      return res.data.data.data;
    }
    if (res?.data?.data !== undefined) {
      return res.data.data;
    }
    return res?.data;
  }

  /**
   * Create a new Invoice (Term-Based or Full PO)
   * Endpoint: POST /finance/invoices
   */
  static async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDto> {
    const res = await apiClient.post('/finance/invoices', payload);
    return this.unwrapData<InvoiceDto>(res);
  }

  /**
   * Fetch all invoices from backend (SSOT)
   */
  static async getInvoices(): Promise<InvoiceDto[]> {
    const res = await apiClient.get('/finance/invoices');
    return this.unwrapData<InvoiceDto[]>(res) || [];
  }

  /**
   * Fetch a single invoice by ID
   */
  static async getInvoiceById(id: number): Promise<InvoiceDto> {
    const res = await apiClient.get(`/finance/invoices/${id}`);
    return this.unwrapData<InvoiceDto>(res);
  }

  /**
   * Get Authoritative Read-Only Invoice Matching and Verification Preview
   * SSOT Endpoint: GET /finance/invoices/:id/matching
   */
  static async getInvoiceMatching(
    id: number,
    vendorId?: number,
    goodsReceiptId?: number,
    evidenceRef?: string,
  ): Promise<MatchingResult> {
    const params: Record<string, any> = {};
    if (vendorId !== undefined) params.vendorId = vendorId;
    if (goodsReceiptId !== undefined) params.goodsReceiptId = goodsReceiptId;
    if (evidenceRef !== undefined && evidenceRef.trim() !== '') params.evidenceRef = evidenceRef.trim();

    const res = await apiClient.get(`/finance/invoices/${id}/matching`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return this.unwrapData<MatchingResult>(res);
  }

  /**
   * Submit Finance Verification for Invoice (Approve or Reject)
   * Endpoint: POST /finance/invoices/:id/verify
   */
  static async verifyInvoice(id: number, payload: VerifyInvoiceDto): Promise<any> {
    const res = await apiClient.post(`/finance/invoices/${id}/verify`, payload);
    return this.unwrapData<any>(res);
  }

  /**
   * Fetch all payments from backend
   */
  static async getPayments(): Promise<PaymentDto[]> {
    const res = await apiClient.get('/finance/payments');
    return this.unwrapData<PaymentDto[]>(res) || [];
  }

  /**
   * Process Payment for an Invoice (Authoritative Phase 7E-D-4 Payment Engine)
   * Endpoint: POST /finance/payments
   */
  static async createPayment(payload: CreatePaymentPayload): Promise<PaymentDto> {
    const res = await apiClient.post('/finance/payments', payload);
    return this.unwrapData<PaymentDto>(res);
  }

  /**
   * Get PO Payment Summary (Read-Only)
   * Endpoint: GET /finance/purchase-orders/:id/payment-summary
   */
  static async getPoPaymentSummary(poId: number): Promise<{
    poId: number;
    poTotal: number;
    totalPaid: number;
    outstanding: number;
    paidPercentage: number;
  }> {
    const res = await apiClient.get(`/finance/purchase-orders/${poId}/payment-summary`);
    return this.unwrapData(res);
  }
}
