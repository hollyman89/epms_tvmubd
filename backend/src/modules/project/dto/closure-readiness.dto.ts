export interface ClosureBlocker {
  domain: string;
  code: string;
  message: string;
  count?: number;
  amount?: number;
  entityIds?: number[];
}

export interface ClosureWarning {
  domain: string;
  code: string;
  message: string;
  count?: number;
}

export interface ClosureReadinessProject {
  id: number;
  code: string;
  name: string;
  status: string;
  eligible: boolean;
  contract?: {
    contractId: number | null;
    contractNumber?: string | null;
    status?: string | null;
    customer?: {
      id: number;
      name: string;
    } | null;
  };
}

export interface ClosurePhysicalReadiness {
  overallProgress: number;
  requiredProgress: number;
  isComplete: boolean;
}

export interface ClosureTaskReadiness {
  totalLeafTasks: number;
  completedLeafTasks: number;
  incompleteLeafTasks: number;
  missingActualFinishCount: number;
  pendingVerificationCount: number;
}

export interface ClosureIssueReadiness {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  closedIssues: number;
  cancelledIssues: number;
  blockingIssueCount: number;
}

export interface ClosureRiskReadiness {
  totalRisks: number;
  activeRiskCount: number;
  materializedRiskCount: number;
  unresolvedMaterializedRiskCount: number;
  clearedRiskCount: number;
}

export interface ClosureMaterialProcurementReadiness {
  openPRCount: number;
  openRFQCount: number;
  unfulfilledMaterialPOCount: number;
  pendingGRCount: number;
}

export interface ClosureServiceProcurementReadiness {
  openPRCount?: number;
  openRFQCount?: number;
  servicePOCount: number;
  openServiceOrderCount: number;
  totalServiceCommitted: number;
  approvedClaimedValue: number;
  remainingServiceScope: number;
  serviceScopeClearanceSupported: boolean;
}

export interface ClosureServiceClaimReadiness {
  totalClaims: number;
  pendingClaimCount: number;
  approvedUninvoicedCount: number;
  approvedUninvoicedValue: number;
}

export interface ClosureVendorAPReadiness {
  totalVendorInvoices: number;
  unverifiedVendorInvoiceCount: number;
  unpaidVendorInvoiceCount: number;
  pendingPaymentRequestCount: number;
  outstandingVendorPayable: number;
}

export interface ClosureDocumentReadiness {
  customerBastPresent: boolean;
  customerBastDocumentId?: number | null;
  finalReportPresent: boolean;
  finalReportDocumentId?: number | null;
  internalHandoverPresent: boolean;
  internalHandoverDocumentId?: number | null;
  activeDocumentsCount: number;
  authoritativeLimitationNotes: string;
}

export interface ClosureReadinessResult {
  project: ClosureReadinessProject;
  ready: boolean;
  summary: {
    blockerCount: number;
    warningCount: number;
  };
  physical: ClosurePhysicalReadiness;
  tasks: ClosureTaskReadiness;
  issues: ClosureIssueReadiness;
  risks: ClosureRiskReadiness;
  procurement: {
    material: ClosureMaterialProcurementReadiness;
    service: ClosureServiceProcurementReadiness;
  };
  serviceClaims: ClosureServiceClaimReadiness;
  finance: {
    vendorAP: ClosureVendorAPReadiness;
    customerAR: {
      modeled: boolean;
      blocking: boolean;
    };
  };
  documents: ClosureDocumentReadiness;
  physicalActualFinishCandidate: string | null;
  blockers: ClosureBlocker[];
  warnings: ClosureWarning[];
}
