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
  action?: string;
  notes?: string;
  checklist?: any;
  proposalId?: number;
  legalStatus?: string;
  legalNotes?: string;
}

export interface LegalServiceOptions {
  idempotencyKey?: string;
}

export interface PdfStatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string;
  url?: string;
  jobId?: string;
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

  // --- PDF GENERATION & BULLMQ ---
  /**
   * Checks BullMQ PDF rendering job status and retrieves S3 URL.
   */
  static async getPdfStatus(contractId: number): Promise<PdfStatusResponse> {
    const res = await apiClient.get(`/legal/contracts/${contractId}/pdf-generation-status`);
    return res.data?.data || res.data;
  }
}

export default LegalService;
