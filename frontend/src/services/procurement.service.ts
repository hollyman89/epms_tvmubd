import { apiClient } from '@/lib/axios';

// --- DTOs & INTERFACES ---

export interface PurchaseRequestItem {
  itemName: string;
  quantity: number;
  estimatedUnitPrice: number;
}

export interface PurchaseRequest {
  id: number;
  prNumber: string;
  totalEstimatedAmount: number;
  status: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
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
}

export interface CreatePOPayload {
  purchase_request_id: number;
  vendor_id: number;
  po_items: PoItemDto[];
}

export interface CreateGRPayload {
  purchaseOrderId: number;
  receiptDate: string;
  remarks?: string;
  items: GoodsReceiptItemDto[];
}

// --- PROCUREMENT SERVICE SSOT ---

export class ProcurementService {
  // --- PURCHASE REQUEST ---
  static async getPurchaseRequests(): Promise<PurchaseRequest[]> {
    const res = await apiClient.get('/procurement/pr');
    return res.data?.data || res.data || [];
  }

  static async createPurchaseRequest(payload: CreatePRPayload): Promise<PurchaseRequest> {
    const res = await apiClient.post('/procurement/pr', payload);
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
  // Returns any because RFQ interface is not defined yet in frontend (only payload is clear)
  static async createRfq(payload: CreateRfqPayload): Promise<any> {
    const res = await apiClient.post('/procurement/rfqs', payload);
    return res.data?.data || res.data;
  }

  // --- VENDOR COMPARISON ---
  // Returns any because Vendor Comparison result interface is not defined yet
  static async submitVendorComparison(payload: SubmitVendorComparisonPayload): Promise<any> {
    const res = await apiClient.post('/procurement/vendor-comparison', payload);
    return res.data?.data || res.data;
  }

  // --- GOODS RECEIPT ---
  // Returns any because Goods Receipt interface is not defined yet
  static async createGoodsReceipt(payload: CreateGRPayload): Promise<any> {
    const res = await apiClient.post('/procurement/goods-receipts', payload);
    return res.data?.data || res.data;
  }

  // Returns any because Goods Receipt interface is not defined yet

  static async getGoodsReceiptById(id: number): Promise<any> {
    const res = await apiClient.get(`/procurement/goods-receipts/${id}`);
    return res.data?.data || res.data;
  }
}

export default ProcurementService;
