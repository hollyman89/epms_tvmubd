import { apiClient } from '@/lib/axios';

// --- DTOs & INTERFACES ---

export interface LegalContractItem {
  id: number;
  contract_number?: string;
  contractNumber?: string;
  contract_value?: number;
  contractValue?: number;
  legal_status?: string;
  legalStatus?: string;
  spk_file_url?: string;
  customer?: { id: number; name: string };
  customerName?: string;
  projectName?: string;
  title?: string;
  created_at?: string;
  [key: string]: any;
}

export interface SubmitLegalReviewPayload {
  contractId: number;
  action: string;
  notes?: string;
  checklist?: any;
  proposalId?: number;
  legalStatus?: string;
  legalNotes?: string;
}

export interface RequestGraceExtensionPayload {
  daysToAdd: number;
  reason: string;
}

export interface LegalServiceOptions {
  idempotencyKey?: string;
}

export interface LegalGraceItem {
  contractId: number;
  contractNumber: string;
  extensionCount: number;
  maxLimit: number;
  graceDeadline: string;
  extendedAt: string;
  status: string;
}

export interface LegalDocumentItem {
  id?: number;
  fileName?: string;
  file_name?: string;
  fileType?: string;
  entityType?: string;
  fileSize?: number;
  fileUrl?: string;
  filePath?: string;
}

export interface PdfStatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string;
  url?: string;
  jobId?: string;
}

export interface StartProjectResponse {
  success: boolean;
  message?: string;
  projectId?: number;
  projectCode?: string;
}

// --- LEGAL SERVICE SSOT ---

export class LegalService {

  // --- CONTRACT MANAGEMENT ---
  /**
   * Fetches list of all contracts for governance dashboard.
   */
  static async getContracts(): Promise<LegalContractItem[]> {
    const res = await apiClient.get('/contracts');
    return res.data?.data || res.data;
  }

  /**
   * Fetches list of pending legal contracts for review queue.
   */
  static async getPendingContracts(signal?: AbortSignal): Promise<LegalContractItem[]> {
    const res = await apiClient.get('/legal/contracts?status=ALL', { signal });
    return res.data?.data || res.data;
  }

  /**
   * Fetches single contract details by contract ID.
   */
  static async getContract(id: number): Promise<LegalContractItem> {
    const res = await apiClient.get(`/legal/contracts/${id}`);
    return res.data?.data || res.data;
  }

  // --- REVIEW & APPROVAL WORKFLOW ---
  /**
   * Submits a legal review decision (Approve, Reject, Revise, etc.).
   */
  static async submitReview(
    payload: SubmitLegalReviewPayload,
    options?: LegalServiceOptions
  ): Promise<any> {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    const res = await apiClient.post('/legal/contracts/review', payload, { headers });
    return res.data?.data || res.data;
  }

  /**
   * @deprecated TODO(v2): Deprecate after backend consolidates all review decisions into POST /legal/contracts/review.
   */
  static async submitReviewLegacy(payload: SubmitLegalReviewPayload): Promise<any> {
    const res = await apiClient.post('/legal/review', payload);
    return res.data?.data || res.data;
  }

  /**
   * Requests document revision on a contract.
   */
  static async requestRevision(contractId: number, notes: string): Promise<any> {
    return this.submitReview({
      contractId,
      action: 'REVISION_REQUESTED',
      notes,
    });
  }

  /**
   * Approves a legal contract.
   */
  static async approve(contractId: number, notes?: string): Promise<any> {
    return this.submitReview({
      contractId,
      action: 'APPROVED',
      notes,
    });
  }

  /**
   * Rejects a legal contract.
   */
  static async reject(contractId: number, notes?: string): Promise<any> {
    return this.submitReview({
      contractId,
      action: 'REJECTED',
      notes,
    });
  }

  // --- DOCUMENTS & ATTACHMENTS ---
  /**
   * Fetches dynamic documents and attachments for a contract.
   */
  static async getDocuments(contractId: number): Promise<LegalDocumentItem[]> {
    const res = await apiClient.get(`/documents?contractId=${contractId}`);
    return res.data?.data || res.data;
  }

  /**
   * Fetches version history for a contract.
   */
  static async getVersionHistory(contractId: number): Promise<any[]> {
    const res = await apiClient.get(`/legal/contracts/${contractId}/versions`);
    return res.data?.data || res.data;
  }

  // --- PDF GENERATION & BULLMQ ---
  /**
   * Checks BullMQ PDF rendering job status and retrieves S3 URL.
   */
  static async getPdfStatus(contractId: number): Promise<PdfStatusResponse> {
    const res = await apiClient.get(`/legal/contracts/${contractId}/pdf-generation-status`);
    return res.data?.data || res.data;
  }

  /**
   * Triggers asynchronous PDF rendering job for a contract.
   */
  static async triggerPdfGeneration(contractId: number): Promise<PdfStatusResponse> {
    const res = await apiClient.get(`/contracts/${contractId}/pdf`);
    return res.data?.data || res.data;
  }

  // --- SLA & GRACE EXTENSION ---
  /**
   * Fetches SLA Grace Extension widget monitor data.
   */
  static async getSlaGrace(): Promise<LegalGraceItem[]> {
    const res = await apiClient.get('/legal/sla/grace-widget');
    return res.data?.data || res.data;
  }

  /**
   * Requests SLA Grace Extension (+3 days) for a contract.
   */
  static async requestGraceExtension(
    contractId: number,
    payload: RequestGraceExtensionPayload
  ): Promise<any> {
    const res = await apiClient.post(`/legal/contracts/${contractId}/grace-extension`, payload);
    return res.data?.data || res.data;
  }

  // --- PROJECT INITIATION ---
  /**
   * Initiates operational project from a verified legal contract.
   */
  static async startProject(tenderId: number): Promise<StartProjectResponse> {
    const res = await apiClient.post('/legal/start-project', { tenderId });
    return res.data?.data || res.data;
  }
}

export default LegalService;
