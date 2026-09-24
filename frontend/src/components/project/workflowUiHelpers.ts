/**
 * Workflow UI Presentation & Capability Helpers (Phase 2C SSOT Pure Presentation)
 * 
 * Strict Rules:
 * 1. Helpers are UX presentation/capability helpers only.
 * 2. Helpers MUST NOT calculate next stage, sequence, transition, or owner progression.
 * 3. Backend remains the authoritative SSOT.
 */

export interface CanonicalWorkflowCurrentLike {
  nodeKey?: string;
  stage?: number;
  totalStages?: number;
  ownerRole?: string;
  ownerName?: string;
  label?: string;
  position?: string;
  nextStep?: string;
  headerBadge?: string;
  status?: 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'REVISION_REQUESTED' | 'UNKNOWN' | string;
}

/**
 * Returns true only if the canonical workflow state permits Project Manager planning edits.
 * Canonical PM editable states are strictly PM_PLANNING (Draft / Initial) and PM_REVISION (Needs Revision).
 * Any downstream review, completed, missing, or unknown state returns false (fail-closed).
 */
export function isPmEditableWorkflowState(current?: CanonicalWorkflowCurrentLike | null): boolean {
  if (!current) return false;
  return current.nodeKey === 'PM_PLANNING' || current.nodeKey === 'PM_REVISION';
}

export interface CanonicalStatusColor {
  tagColor: 'success' | 'processing' | 'default' | 'warning' | 'error';
  bg: string;
  border: string;
  text: string;
}

/**
 * Maps canonical step/node status to Ant Design tag color and subtle container styling.
 * Strictly maps status only. Does NOT map roles or stages (HOPS, Procurement, Finance, Director) to colors.
 */
export function getCanonicalStatusColor(status?: string): CanonicalStatusColor {
  switch (status) {
    case 'COMPLETED':
      return { tagColor: 'success', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };
    case 'ACTIVE':
      return { tagColor: 'processing', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };
    case 'WAITING':
      return { tagColor: 'default', bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' };
    case 'REVISION_REQUESTED':
      return { tagColor: 'warning', bg: '#fffbeb', border: '#fde68a', text: '#b45309' };
    case 'UNKNOWN':
    default:
      return { tagColor: 'error', bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
  }
}
