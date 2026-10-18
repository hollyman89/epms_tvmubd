import { apiClient } from '@/lib/axios';
import type { CanonicalCostItem } from './project.service';

export interface ProcurementCostItemAvailability extends Omit<CanonicalCostItem, 'quantity'> {
  quantity?: number;
  categoryKey: string;
  baselineQty: number;
  reservedQty: number;
  prCommittedQty: number;
  orderedQty: number;
  availableQty: number;
  availabilityStatus: 'AVAILABLE' | 'FULLY_ALLOCATED';
  unavailableReason: string | null;
  [key: string]: any;
}

// --- DTOs & INTERFACES ---

export interface PurchaseRequestItem {
  id?: number;
  prId?: number;
  itemName: string;
  quantity: number;
  uom?: string;
  estimatedUnitPrice: number;
  rabItemKey?: string;
}

export interface ProjectRelation {
  id: number;
  code?: string;
  name: string;
  status?: string;
  siteName?: string;
}

export interface PurchaseRequest {
  id: number;
  prId?: string | number;
  prNumber: string;
  totalEstimatedAmount: number;
  status: string;
  createdAt: string;
  projectId?: number;
  project_id?: number;
  projectName?: string;
  project_name?: string;
  projectCode?: string;
  project_code?: string;
  customerName?: string;
  customer_name?: string;
  items?: PurchaseRequestItem[];
  project?: ProjectRelation;
}

export interface RfqCreator {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface RfqComparisonSummary {
  comparisonId: string;
  rfqId: number;
  rfqNumber?: string;
  prNumber?: string;
  projectId?: number;
  projectName?: string;
  budgetCeiling?: number;
  selectedWinnerVendorId: number;
  selectedWinnerVendorCode?: string;
  selectedWinnerVendorName: string;
  winnerTotalOfferedAmount?: number;
  winnerLeadTimeDays?: number | null;
  comparedAt?: string;
  status: 'EVALUATED';
}

export interface RfqRecord {
  id: number;
  prId: number;
  rfqNumber: string;
  status: 'OPEN' | 'CLOSED' | 'EVALUATED' | 'AWARDED' | 'CANCELLED' | string;
  closingDate?: string | null;
  createdBy?: number;
  creator?: RfqCreator | null;
  comparison?: RfqComparisonSummary | null;
  createdAt: string;
  updatedAt?: string;
  purchaseRequest?: PurchaseRequest;
}


export interface VendorDataDto {
  vendorId: number;
  offeredAmount: number;
  isWinner: boolean;
}

export interface PoItemDto {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export type PaymentTermType =
  | 'DOWN_PAYMENT'
  | 'PROGRESS'
  | 'FINAL_DELIVERY'
  | 'RETENTION';

export interface CreatePoPaymentTermPayload {
  sequence: number;
  term_name: string;
  term_type: PaymentTermType;
  percentage: number;
  trigger_condition?: string;
  is_retention?: boolean;
  retention_days?: number;
  amount?: number;
}

export interface PoPaymentTermRecord {
  id?: number;
  poId?: number;
  sequence: number;
  termName: string;
  termType: PaymentTermType;
  percentage: number;
  amount: number;
  triggerCondition?: string;
  isRetention?: boolean;
  retentionDays?: number;
  status?: string;
}

export type PurchaseOrderType = 'MATERIAL' | 'SERVICE' | 'LEGACY_MIXED';

export type ServiceOrderDocumentType = 'SPK' | 'WORK_ORDER';
export type ServiceOrderStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface ServiceOrder {
  id: number;
  serviceOrderNumber: string;
  purchaseOrderId: number;
  poId?: number;
  projectId: number;
  vendorId: number;
  documentType: ServiceOrderDocumentType;
  status: ServiceOrderStatus;
  scopeOfWork: string;
  workLocation?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  issuedAt?: string | null;
  issuedBy?: number | null;
  cancelledAt?: string | null;
  cancelledBy?: number | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: PurchaseOrder;
  po?: PurchaseOrder;
  vendor?: MasterVendor;
  project?: {
    id: number;
    code?: string;
    name?: string;
    status?: string;
  };
}

export interface CreateServiceOrderPayload {
  purchaseOrderId?: number;
  poId?: number;
  documentType?: ServiceOrderDocumentType;
  scopeOfWork: string;
  workLocation?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface UpdateServiceOrderPayload {
  documentType?: ServiceOrderDocumentType;
  scopeOfWork?: string;
  workLocation?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface CancelServiceOrderPayload {
  reason: string;
}

export interface QueryServiceOrderPayload {
  projectId?: number;
  purchaseOrderId?: number;
  poId?: number;
  vendorId?: number;
  status?: ServiceOrderStatus;
  documentType?: ServiceOrderDocumentType;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  totalAmount: number;
  status: string;
  orderType?: PurchaseOrderType;
  deliveryLocation?: string;
  deliveryDate?: string;
  notes?: string;
  paymentTerms?: PoPaymentTermRecord[];
  items?: any[];
  serviceOrders?: ServiceOrder[];
  vendorId?: number;
  vendor?: MasterVendor;
  vendorName?: string;
  vendorCode?: string;
  purchaseRequestId?: number;
  purchaseRequest?: PurchaseRequest;
  projectName?: string;
  projectCode?: string;
  projectId?: number;
  createdAt: string;
}

export interface GoodsReceiptItemDto {
  poItemId: number;
  receivedQuantity: number;
  remarks?: string;
}

export interface CreatePRPayload {
  projectId: number;
  totalEstimatedAmount: number;
  items: PurchaseRequestItem[];
}

export interface CreateRfqPayload {
  purchaseRequestId: number;
  closingDate?: string;
}

export interface SubmitVendorComparisonPayload {
  rfqId: number;
  vendors: VendorDataDto[];
  remarks?: string;
}

export interface QuotationItemDto {
  id?: number;
  quotationId?: number;
  prItemId?: number;
  itemName: string;
  quantity: number;
  uom?: string;
  unitPrice: number;
  totalAmount?: number;
  remarks?: string;
}

export interface QuotationRecord {
  id: number;
  rfqId: number;
  vendorId: number;
  quotationNumber: string;
  vendorRef?: string;
  quotationDate: string;
  validUntil?: string;
  leadTimeDays: number;
  totalAmount: number;
  status: string;
  notes?: string;
  createdAt: string;
  vendor?: MasterVendor;
  items?: QuotationItemDto[];
  rfq?: RfqRecord;
}

export interface CreateQuotationPayload {
  rfqId: number;
  vendorId: number;
  vendorRef?: string;
  quotationDate?: string;
  validUntil?: string;
  leadTimeDays?: number;
  notes?: string;
  items: Array<{
    prItemId: number;
    itemName: string;
    quantity: number;
    uom?: string;
    unitPrice: number;
    remarks?: string;
  }>;
}

export interface CreatePOPayload {
  purchase_request_id: number;
  vendor_id: number;
  payment_terms: CreatePoPaymentTermPayload[];
  delivery_location?: string;
  delivery_date?: string;
  notes?: string;
  po_items?: PoItemDto[];
}

export interface CreateGRPayload {
  purchaseOrderId: number;
  receiptDate: string;
  remarks?: string;
  items: GoodsReceiptItemDto[];
}

// --- PROCUREMENT PACKAGE TYPES (PHASE 2 CANONICAL) ---

export type ProcurementPackageStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'PR_CREATED'
  | 'CANCELLED'
  | 'CLOSED';

export interface ProcurementPackageItem {
  id?: number;
  packageId?: number;
  costItemId: number;
  wbsId?: number | null;
  itemName: string;
  uom: string;
  baselineQty?: number;
  requestedQty: number;
  estimatedUnitPrice: number;
  estimatedTotal?: number;
  requiredDate?: string;
  status?: string;
  costItem?: {
    id: number;
    itemName: string;
    quantity?: number;
    unitPrice?: number;
    subtotal?: number;
    categoryKey?: string;
    entryMode?: string;
    uom?: string;
  };
  wbs?: {
    id: number;
    wbs_code?: string;
    task_name?: string;
  };
}

export interface ProcurementPackage {
  id: number;
  packageNumber: string;
  projectId: number;
  title: string;
  description?: string | null;
  requiredDate?: string | null;
  totalEstimatedAmount: number;
  status: ProcurementPackageStatus;
  requestedBy: number;
  submittedAt?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  rejectionNotes?: string | null;
  rejectionReason?: string | null;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  project?: {
    id: number;
    name: string;
    code?: string;
    status?: string;
    managerId?: number;
    customerName?: string;
  };
  requester?: {
    id: number;
    fullName: string;
    email: string;
  };
  reviewer?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  items?: ProcurementPackageItem[];
  purchaseRequest?: PurchaseRequest | null;
}

export interface CreatePackageItemDto {
  costItemId: number;
  requestedQty: number;
  requiredDate?: string;
}

export interface CreatePackageDraftPayload {
  projectId: number;
  title: string;
  description?: string;
  requiredDate?: string;
  items: CreatePackageItemDto[];
}

export interface UpdatePackageDraftPayload {
  title?: string;
  description?: string;
  requiredDate?: string;
  items?: CreatePackageItemDto[];
}

export interface ReturnPackagePayload {
  reason: string;
}

export interface CancelPackagePayload {
  reason?: string;
}

export interface QueryPackagePayload {
  projectId?: number;
  status?: ProcurementPackageStatus;
  search?: string;
}

// --- RECONCILIATION TYPES (PHASE 3 CANONICAL) ---

export interface UnresolvedReconciliationItem {
  id: number;
  prId: number;
  packageItemId?: number;
  costItemId?: number;
  wbsId?: number;
  itemName: string;
  quantity: number;
  uom?: string;
  estimatedUnitPrice: number;
  origin?: 'LEGACY' | 'PACKAGE' | 'AD_HOC';
  unresolvedCount?: number;
  purchaseRequest?: {
    id: number;
    prNumber: string;
    projectId: number;
    origin: 'LEGACY' | 'PACKAGE' | 'AD_HOC';
    status: string;
    project?: {
      id: number;
      name: string;
      code?: string;
    };
  };
}

export interface ReconciliationCandidateCostItem {
  costItem: {
    id: number;
    estimateId?: number;
    itemName: string;
    uom: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    categoryKey: string;
    wbs?: {
      id: number;
      task_name?: string;
      wbs_code?: string;
    };
  };
  rawRemainingQty: number;
  availableQty: number;
  rawRemainingAmount: number;
  availableAmount: number;
  reservedQty: number;
  prCommittedQty: number;
  orderedQty: number;
}

export interface ReconciliationDetailResponse {
  success: boolean;
  prItem: UnresolvedReconciliationItem;
  currentEstimate: any;
  candidateCostItems: ReconciliationCandidateCostItem[];
  reconciliation?: any;
}

export interface ReconcileItemPayload {
  targetCostItemId: number;
  mappedQuantity?: number;
  mappedAmount?: number;
  matchType?: string;
  notes?: string;
}

export interface ExcludeItemPayload {
  reason: string;
  notes?: string;
}

export interface QueryReconciliationPayload {
  projectId?: number;
  status?: string;
  origin?: 'LEGACY' | 'AD_HOC';
}

// --- PROCUREMENT SERVICE SSOT ---

export interface MasterVendor {
  id: number;
  code: string;
  name: string;
  vendorType?: string;
  address?: string;
  taxId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  createdBy?: number;
  updatedBy?: number;
  deletedBy?: number;
}

export interface CreateVendorPayload {
  code?: string;
  name: string;
  address?: string;
  taxId?: string;
  vendorType?: string;
}

export interface UpdateVendorPayload {
  name?: string;
  address?: string;
  taxId?: string;
  vendorType?: string;
}

export interface VendorQueryPayload {
  page?: number;
  limit?: number;
  search?: string;
  vendorType?: string;
}

export interface PaginatedVendorsResponse {
  data: MasterVendor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProcurementDashboardSummary {
  packageQueueCount: number | null;
  reconciliationCount: number | null;
  purchaseRequestCount: number;
  purchaseOrderCount: number;
  goodsReceiptCount: number;
}

export class ProcurementService {
  // --- DASHBOARD SUMMARY (EPMS — PROCUREMENT-SUMMARY-LAZYLOAD-R1) ---
  static async getDashboardSummary(): Promise<ProcurementDashboardSummary> {
    const res = await apiClient.get('/procurement/summary');
    return res.data?.data || res.data;
  }

  // --- VENDOR MASTER (LEGACY & SSOT LIST) ---
  static async getVendors(): Promise<MasterVendor[]> {
    const res = await apiClient.get('/procurement/vendors');
    const rawList = res.data?.data || res.data || [];
    return Array.isArray(rawList)
      ? rawList.map((v: any) => ({
          ...v,
          id: Number(v.id),
        }))
      : [];
  }

  static async getVendorsPaginated(query?: VendorQueryPayload): Promise<PaginatedVendorsResponse> {
    const res = await apiClient.get('/procurement/vendors', { params: query });
    const responseBody = res.data?.data || res.data;
    if (responseBody && Array.isArray(responseBody.data)) {
      return {
        data: responseBody.data.map((v: any) => ({ ...v, id: Number(v.id) })),
        total: Number(responseBody.total || responseBody.data.length),
        page: Number(responseBody.page || 1),
        limit: Number(responseBody.limit || 10),
        totalPages: Number(responseBody.totalPages || 1),
      };
    }
    const rawList = Array.isArray(responseBody) ? responseBody : [];
    return {
      data: rawList.map((v: any) => ({ ...v, id: Number(v.id) })),
      total: rawList.length,
      page: 1,
      limit: rawList.length || 10,
      totalPages: 1,
    };
  }

  static async getVendorById(id: number): Promise<MasterVendor> {
    const res = await apiClient.get(`/procurement/vendors/${id}`);
    const data = res.data?.data || res.data;
    return {
      ...data,
      id: Number(data.id),
    };
  }

  static async createVendor(payload: CreateVendorPayload): Promise<MasterVendor> {
    const res = await apiClient.post('/procurement/vendors', payload);
    const data = res.data?.data || res.data;
    return {
      ...data,
      id: Number(data.id),
    };
  }

  static async updateVendor(id: number, payload: UpdateVendorPayload): Promise<MasterVendor> {
    const res = await apiClient.patch(`/procurement/vendors/${id}`, payload);
    const data = res.data?.data || res.data;
    return {
      ...data,
      id: Number(data.id),
    };
  }

  static async softDeleteVendor(id: number): Promise<any> {
    const res = await apiClient.delete(`/procurement/vendors/${id}`);
    return res.data?.data || res.data;
  }

  // --- PURCHASE REQUEST ---
  static async getPurchaseRequests(): Promise<PurchaseRequest[]> {
    const res = await apiClient.get('/procurement/pr');
    return res.data?.data || res.data || [];
  }

  static async getPurchaseRequestById(id: number): Promise<PurchaseRequest> {
    const res = await apiClient.get(`/procurement/pr/${id}`);
    return res.data?.data || res.data;
  }

  /**
   * @deprecated Direct PR creation is blocked on IN_PROGRESS projects in Phase 3.
   * All project procurements must go through ProcurementPackage (createPrFromPackage).
   */
  static async createPurchaseRequest(payload: CreatePRPayload): Promise<PurchaseRequest> {
    const res = await apiClient.post('/procurement/pr', payload);
    return res.data?.data || res.data;
  }

  static async cancelPurchaseRequest(id: number, reason: string): Promise<any> {
    const res = await apiClient.post(`/procurement/pr/${id}/cancel`, { reason });
    return res.data?.data || res.data;
  }

  // --- PURCHASE ORDER ---
  static async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const res = await apiClient.get('/procurement/purchase-orders');
    return res.data?.data || res.data || [];
  }

  static async getPurchaseOrderById(id: number): Promise<PurchaseOrder> {
    const res = await apiClient.get(`/procurement/purchase-orders/${id}`);
    return res.data?.data || res.data;
  }

  static async createPurchaseOrder(payload: CreatePOPayload): Promise<PurchaseOrder> {
    const res = await apiClient.post('/procurement/purchase-orders', payload);
    return res.data?.data || res.data;
  }

  // --- RFQ ---
  static async getRfqs(): Promise<RfqRecord[]> {
    const res = await apiClient.get('/procurement/rfqs');
    return res.data?.data || res.data || [];
  }

  static async getRfqById(id: number): Promise<RfqRecord> {
    const res = await apiClient.get(`/procurement/rfqs/${id}`);
    return res.data?.data?.data || res.data?.data || res.data;
  }

  static async createRfq(payload: CreateRfqPayload): Promise<RfqRecord> {
    const res = await apiClient.post('/procurement/rfqs', payload);
    return res.data?.data || res.data;
  }

  static async cancelRfq(id: number, reason: string): Promise<RfqRecord> {
    const res = await apiClient.post(`/procurement/rfqs/${id}/cancel`, { reason });
    return res.data?.data || res.data;
  }

  // --- QUOTATIONS ---
  static async getQuotationsByRfq(rfqId: number): Promise<QuotationRecord[]> {
    const res = await apiClient.get(`/procurement/rfqs/${rfqId}/quotations`);
    return res.data?.data || res.data || [];
  }

  static async getQuotationById(id: number): Promise<QuotationRecord> {
    const res = await apiClient.get(`/procurement/quotations/${id}`);
    return res.data?.data || res.data;
  }

  static async createQuotation(payload: CreateQuotationPayload): Promise<QuotationRecord> {
    const sanitizedPayload = {
      ...payload,
      rfqId: Number(payload.rfqId),
      vendorId: Number(payload.vendorId),
      leadTimeDays: payload.leadTimeDays !== undefined ? Number(payload.leadTimeDays) : undefined,
      items: Array.isArray(payload.items)
        ? payload.items.map((it) => ({
            ...it,
            prItemId: Number(it.prItemId),
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          }))
        : [],
    };
    const res = await apiClient.post('/procurement/quotations', sanitizedPayload);
    return res.data?.data || res.data;
  }

  // --- VENDOR COMPARISON ---
  // Returns any because Vendor Comparison result interface is not defined yet
  static async submitVendorComparison(payload: SubmitVendorComparisonPayload): Promise<any> {
    const res = await apiClient.post('/procurement/vendor-comparison', payload);
    return res.data?.data || res.data;
  }

  // --- GOODS RECEIPT ---
  static async getGoodsReceipts(): Promise<any[]> {
    const res = await apiClient.get('/procurement/goods-receipts');
    return res.data?.data || res.data || [];
  }

  static async createGoodsReceipt(payload: CreateGRPayload): Promise<any> {
    const res = await apiClient.post('/procurement/goods-receipts', payload);
    return res.data?.data || res.data;
  }

  static async getGoodsReceiptById(id: number): Promise<any> {
    const res = await apiClient.get(`/procurement/goods-receipts/${id}`);
    return res.data?.data || res.data;
  }

  // --- PROCUREMENT PACKAGES (PHASE 2 CANONICAL) ---

  static async getPackages(query?: QueryPackagePayload): Promise<ProcurementPackage[]> {
    // When status is omitted (e.g. ALL), do not send status param
    const params: Record<string, any> = {};
    if (query?.projectId) params.projectId = query.projectId;
    if (query?.status) params.status = query.status;
    if (query?.search && query.search.trim()) params.search = query.search.trim();

    const res = await apiClient.get('/procurement/packages', { params });
    const list = res.data?.data || res.data || [];
    return Array.isArray(list) ? list : [];
  }

  static async getPackageById(id: number): Promise<ProcurementPackage> {
    const res = await apiClient.get(`/procurement/packages/${id}`);
    return res.data?.data || res.data;
  }

  static async getEligibleCostItems(projectId: number): Promise<ProcurementCostItemAvailability[]> {
    const res = await apiClient.get(`/procurement/projects/${projectId}/eligible-cost-items`);
    return res.data?.data || res.data;
  }

  static async saveAndSubmitPackage(payload: CreatePackageDraftPayload | UpdatePackageDraftPayload, id?: number): Promise<ProcurementPackage> {
    const url = id ? `/procurement/packages/${id}/update-and-submit` : '/procurement/packages/create-and-submit';
    const res = await apiClient.post(url, payload);
    return res.data?.data || res.data;
  }

  static async createPackageDraft(payload: CreatePackageDraftPayload): Promise<ProcurementPackage> {
    const res = await apiClient.post('/procurement/packages', payload);
    return res.data?.data || res.data;
  }

  static async updatePackageDraft(id: number, payload: UpdatePackageDraftPayload): Promise<ProcurementPackage> {
    // Verified: Controller uses @Put('packages/:id')
    const res = await apiClient.put(`/procurement/packages/${id}`, payload);
    return res.data?.data || res.data;
  }

  static async deletePackageDraft(id: number): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete(`/procurement/packages/${id}`);
    return res.data?.data || res.data;
  }

  static async submitPackage(id: number): Promise<ProcurementPackage> {
    const res = await apiClient.post(`/procurement/packages/${id}/submit`);
    return res.data?.data || res.data;
  }

  static async resubmitPackage(id: number): Promise<ProcurementPackage> {
    const res = await apiClient.post(`/procurement/packages/${id}/resubmit`);
    return res.data?.data || res.data;
  }

  static async returnPackage(id: number, payload: ReturnPackagePayload): Promise<ProcurementPackage> {
    const res = await apiClient.post(`/procurement/packages/${id}/return`, payload);
    return res.data?.data || res.data;
  }

  static async cancelPackage(id: number, payload: CancelPackagePayload = {}): Promise<ProcurementPackage> {
    const res = await apiClient.post(`/procurement/packages/${id}/cancel`, payload);
    return res.data?.data || res.data;
  }

  static async createPrFromPackage(id: number): Promise<{ success: boolean; message: string; purchaseRequest: PurchaseRequest }> {
    const res = await apiClient.post(`/procurement/packages/${id}/create-pr`);
    return res.data;
  }

  // --- RECONCILIATIONS (PHASE 3 CANONICAL) ---

  static async getUnresolvedReconciliations(query?: QueryReconciliationPayload): Promise<UnresolvedReconciliationItem[]> {
    const params: Record<string, any> = {};
    if (query?.projectId) params.projectId = query.projectId;
    if (query?.status) params.status = query.status;
    if (query?.origin) params.origin = query.origin;

    const res = await apiClient.get('/procurement/reconciliations/unresolved', { params });
    // Endpoint returns { success: true, count: N, data: [...] }
    const list = res.data?.data || res.data || [];
    return Array.isArray(list) ? list : [];
  }

  static async getReconciliationDetail(prItemId: number): Promise<ReconciliationDetailResponse> {
    const res = await apiClient.get(`/procurement/reconciliations/items/${prItemId}`);
    return res.data;
  }

  static async reconcileItem(prItemId: number, payload: ReconcileItemPayload): Promise<{ success: boolean; message: string; reconciliation: any }> {
    const res = await apiClient.post(`/procurement/reconciliations/items/${prItemId}/reconcile`, payload);
    return res.data;
  }

  static async excludeItem(prItemId: number, payload: ExcludeItemPayload): Promise<{ success: boolean; message: string; reconciliation: any }> {
    const res = await apiClient.post(`/procurement/reconciliations/items/${prItemId}/exclude`, payload);
    return res.data;
  }

  // --- SERVICE ORDERS (SPK / WORK ORDER - PHASE 20 CANONICAL) ---

  static async getServiceOrders(query?: QueryServiceOrderPayload): Promise<ServiceOrder[]> {
    const params: Record<string, any> = {};
    if (query?.projectId) params.projectId = query.projectId;
    if (query?.poId) params.poId = query.poId;
    if (query?.vendorId) params.vendorId = query.vendorId;
    if (query?.status) params.status = query.status;
    if (query?.documentType) params.documentType = query.documentType;

    const res = await apiClient.get('/procurement/service-orders', { params });
    const list = res.data?.data || res.data || [];
    return Array.isArray(list) ? list : [];
  }

  static async getServiceOrdersByPo(poId: number): Promise<ServiceOrder[]> {
    const res = await apiClient.get(`/procurement/service-orders/by-po/${poId}`);
    const list = res.data && 'data' in res.data ? res.data.data : res.data;
    if (Array.isArray(list)) return list;
    if (list && typeof list === 'object') return [list];
    return [];
  }

  static async getServiceOrderByPo(poId: number): Promise<ServiceOrder | null> {
    const list = await this.getServiceOrdersByPo(poId);
    return list[0] ?? null;
  }

  static async getServiceOrderById(id: number): Promise<ServiceOrder> {
    const res = await apiClient.get(`/procurement/service-orders/${id}`);
    return res.data?.data || res.data;
  }

  static async createServiceOrder(payload: CreateServiceOrderPayload): Promise<ServiceOrder> {
    const body = {
      purchaseOrderId: Number(payload.purchaseOrderId || payload.poId),
      documentType: payload.documentType || 'SPK',
      scopeOfWork: payload.scopeOfWork,
      workLocation: payload.workLocation || payload.location || undefined,
      startDate: payload.startDate || undefined,
      endDate: payload.endDate || undefined,
      notes: payload.notes || undefined,
    };
    const res = await apiClient.post('/procurement/service-orders', body);
    return res.data?.data || res.data;
  }

  static async updateServiceOrder(id: number, payload: UpdateServiceOrderPayload): Promise<ServiceOrder> {
    const body = {
      documentType: payload.documentType,
      scopeOfWork: payload.scopeOfWork,
      workLocation: payload.workLocation || payload.location || undefined,
      startDate: payload.startDate || undefined,
      endDate: payload.endDate || undefined,
      notes: payload.notes || undefined,
    };
    const res = await apiClient.patch(`/procurement/service-orders/${id}`, body);
    return res.data?.data || res.data;
  }

  static async issueServiceOrder(id: number): Promise<ServiceOrder> {
    const res = await apiClient.post(`/procurement/service-orders/${id}/issue`);
    return res.data?.data || res.data;
  }

  static async cancelServiceOrder(id: number, payload: CancelServiceOrderPayload): Promise<ServiceOrder> {
    const res = await apiClient.post(`/procurement/service-orders/${id}/cancel`, payload);
    return res.data?.data || res.data;
  }

  // --- SERVICE CLAIMS ---

  static async getServiceClaims(query?: { poId?: number; projectId?: number; vendorId?: number; status?: string }): Promise<ServiceClaimRecord[]> {
    const params: Record<string, any> = {};
    if (query?.poId) params.poId = query.poId;
    if (query?.projectId) params.projectId = query.projectId;
    if (query?.vendorId) params.vendorId = query.vendorId;
    if (query?.status) params.status = query.status;

    const res = await apiClient.get('/procurement/service-claims', { params });
    const list = res.data?.data || res.data || [];
    return Array.isArray(list) ? list : [];
  }

  static async getServiceClaimById(id: number): Promise<ServiceClaimRecord> {
    const res = await apiClient.get(`/procurement/service-claims/${id}`);
    return res.data?.data || res.data;
  }

  static async getPoServiceClaimBalance(poId: number): Promise<PoServiceClaimBalance> {
    const res = await apiClient.get(`/procurement/service-claims/po/${poId}/balance`);
    return res.data?.data || res.data;
  }

  static async createServiceClaim(payload: CreateServiceClaimPayload): Promise<ServiceClaimRecord> {
    const { poId, ...rest } = payload;
    const body: any = {
      ...rest,
      purchaseOrderId: Number(payload.purchaseOrderId || poId),
    };
    Object.keys(body).forEach((k) => {
      if (body[k] === undefined) delete body[k];
    });
    const res = await apiClient.post('/procurement/service-claims', body);
    return res.data?.data || res.data;
  }

  static async updateServiceClaim(id: number, payload: UpdateServiceClaimPayload): Promise<ServiceClaimRecord> {
    const body: any = { ...payload };
    Object.keys(body).forEach((k) => {
      if (body[k] === undefined) delete body[k];
    });
    const res = await apiClient.patch(`/procurement/service-claims/${id}`, body);
    return res.data?.data || res.data;
  }

  static async submitServiceClaim(id: number): Promise<ServiceClaimRecord> {
    const res = await apiClient.post(`/procurement/service-claims/${id}/submit`);
    return res.data?.data || res.data;
  }

  static async verifyTechnicalServiceClaim(id: number, payload: TechnicalVerificationPayload): Promise<ServiceClaimRecord> {
    const res = await apiClient.post(`/procurement/service-claims/${id}/verify-technical`, payload);
    return res.data?.data || res.data;
  }

  static async verifyCommercialServiceClaim(id: number, payload: CommercialVerificationPayload): Promise<ServiceClaimRecord> {
    const res = await apiClient.post(`/procurement/service-claims/${id}/verify-commercial`, payload);
    return res.data?.data || res.data;
  }

  static async cancelServiceClaim(id: number, payload: CancelServiceClaimPayload): Promise<ServiceClaimRecord> {
    const res = await apiClient.post(`/procurement/service-claims/${id}/cancel`, payload);
    return res.data?.data || res.data;
  }
}

export interface ServiceClaimItemRecord {
  id: number;
  serviceClaimId: number;
  poItemId: number;
  itemNameSnapshot: string;
  uomSnapshot?: string;
  contractQuantitySnapshot: number;
  contractUnitRateSnapshot: number;
  contractValueSnapshot: number;
  previousApprovedQuantity: number;
  currentClaimQuantity: number;
  cumulativeApprovedQuantity: number;
  remainingQuantity: number;
  previousApprovedAmount: number;
  currentClaimAmount: number;
  cumulativeApprovedAmount: number;
  remainingContractValue: number;
  workLocation?: string | null;
  notes?: string | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceClaimRecord {
  id: number;
  claimNumber: string;
  poId: number;
  serviceOrderId?: number | null;
  projectId: number;
  vendorId: number;
  claimPeriodStart?: string | null;
  claimPeriodEnd?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_REVISION' | 'PM_VERIFIED' | 'APPROVED_FOR_INVOICE' | 'REJECTED' | 'CANCELLED';
  totalClaimAmount: number;
  approvedClaimAmount: number;
  acceptanceType?: string | null;
  acceptanceReference?: string | null;
  acceptanceDate?: string | null;
  notes?: string | null;
  createdBy: number;
  submittedBy?: number | null;
  submittedAt?: string | null;
  pmVerifierId?: number | null;
  pmVerifiedAt?: string | null;
  commercialVerifierId?: number | null;
  commercialVerifiedAt?: string | null;
  revisionNotes?: string | null;
  rejectionReason?: string | null;
  cancelledBy?: number | null;
  cancelledAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items?: ServiceClaimItemRecord[];
  purchaseOrder?: any;
  serviceOrder?: any;
  project?: any;
  vendor?: any;
  invoices?: any[];
}

export interface PoServiceClaimBalance {
  poId: number;
  contractTotalAmount: number;
  totalApprovedClaimAmount: number;
  remainingContractValue: number;
  items: Array<{
    poItemId: number;
    itemName: string;
    uom: string;
    contractQuantity: number;
    contractUnitPrice: number;
    contractTotalPrice: number;
    approvedQuantity: number;
    remainingQuantity: number;
    approvedAmount: number;
    remainingAmount: number;
  }>;
}

export interface CreateServiceClaimPayload {
  poId?: number;
  purchaseOrderId?: number;
  serviceOrderId?: number;
  claimPeriodStart?: string;
  claimPeriodEnd?: string;
  acceptanceType?: string;
  acceptanceReference?: string;
  acceptanceDate?: string;
  notes?: string;
  items: Array<{
    poItemId: number;
    currentClaimQuantity: number;
    workLocation?: string;
    notes?: string;
  }>;
}

export interface UpdateServiceClaimPayload {
  serviceOrderId?: number;
  claimPeriodStart?: string;
  claimPeriodEnd?: string;
  acceptanceType?: string;
  acceptanceReference?: string;
  acceptanceDate?: string;
  notes?: string;
  items?: Array<{
    poItemId: number;
    currentClaimQuantity: number;
    workLocation?: string;
    notes?: string;
  }>;
}

export interface TechnicalVerificationPayload {
  decision: 'APPROVE' | 'RETURN' | 'REJECT';
  revisionNotes?: string;
  rejectionReason?: string;
}

export interface CommercialVerificationPayload {
  decision: 'APPROVE' | 'RETURN' | 'REJECT';
  revisionNotes?: string;
  rejectionReason?: string;
}

export interface CancelServiceClaimPayload {
  reason: string;
}

export default ProcurementService;
