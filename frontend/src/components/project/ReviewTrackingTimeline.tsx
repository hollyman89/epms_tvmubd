'use client';

import React, { useState } from 'react';
import { Card, Tag, Typography, Space, Tooltip, Row, Col, Button, Divider } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  MinusCircleOutlined,
  HistoryOutlined,
  UpOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { getCanonicalStatusColor } from './workflowUiHelpers';

const { Text } = Typography;

export interface PrApprovalStateLike {
  prId?: string | number;
  prNumber?: string;
  projectId?: string | number;
  projectName?: string;
  totalAmount?: number;
  status?: 'SUBMITTED' | 'FINANCE_REVIEW' | 'DIRECTOR_APPROVAL' | 'APPROVED' | 'REJECTED_TO_PROCUREMENT' | string;
  submittedBy?: string;
  submittedAt?: string;
  financeReviewedBy?: string;
  financeReviewedAt?: string;
  financeComments?: string;
  directorApprovedBy?: string;
  directorApprovedAt?: string;
  directorComments?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  rejectedByRole?: 'FINANCE' | 'DIRECTOR';
  revisionHistory?: any[];
  workflowInstance?: any;
}

export interface CanonicalStepItem {
  key: 'pm' | 'hoa' | 'proc' | 'fin' | 'dir' | string;
  nodeKey: string;
  stage: number;
  role: string;
  roleTitle?: string;
  stageName: string;
  status: 'COMPLETED' | 'ACTIVE' | 'WAITING' | 'REVISION_REQUESTED';
  stateLabel: string;
  actor?: string;
  completedAt?: string;
  notes?: string;
}

export interface CanonicalWorkflowCurrent {
  nodeKey: string;
  stage: number;
  totalStages: number;
  ownerRole: string;
  ownerName: string;
  label: string;
  position: string;
  nextStep: string;
  headerBadge: string;
  status: 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'REVISION_REQUESTED' | 'UNKNOWN';
}

export interface CanonicalWorkflowProjection {
  workflowInstanceId?: number | null;
  runtimeStatus?: string;
  businessStatus?: string;
  current?: CanonicalWorkflowCurrent;
  steps?: CanonicalStepItem[];
  history?: Array<{
    id: number;
    taskId: number | null;
    fromNode: string;
    toNode: string;
    action: string;
    actorId: number | null;
    actorName: string;
    actorRole: string;
    comments: string | null;
    createdAt: string;
  }>;
  lastApprovedBy?: { id: number; name: string; role: string } | null;
  lastApprovedRole?: string | null;
  lastApprovedAt?: string | null;
}

export interface ReviewTrackingTimelineProps {
  gateRecord?: {
    status?: 'NOT_SUBMITTED' | 'REVIEW_PENDING' | 'READY_FOR_PROCUREMENT' | 'REVIEW_FINANCE' | 'REVIEW_DIRECTOR' | 'READY_FOR_KICKOFF' | 'NEEDS_REVISION' | string;
    decidedAt?: string;
    decidedBy?: string | number;
    decidedByName?: string;
    revisionNotes?: string;
    submittedAt?: string;
    submittedBy?: string | number;
    submittedByName?: string;
    revisionDraftSavedAt?: string;
    resubmittedAt?: string;
    lastApprovedBy?: { id: number; name: string; role: string } | null;
    lastApprovedAt?: string | null;
    approvalHistory?: any[];
    workflow?: CanonicalWorkflowProjection | null;
    confirmedChecklist?: {
      costComplete: boolean;
      wbsComplete: boolean;
      scheduleComplete: boolean;
      costAssignmentComplete: boolean;
      crossValidationValid: boolean;
    };
  } | null;
  projectId?: string | number;
  projectStatus?: string;
  prApprovalState?: PrApprovalStateLike | null;
  completenessScore?: number;
  isPmOnly?: boolean;
  compact?: boolean;
  showActivityHistory?: boolean;
  defaultExpandedHistory?: boolean;
}

interface WorkflowStage {
  key: string;
  order: number;
  roleTitle: string;
  stageName: string;
  state: 'COMPLETED' | 'CURRENT' | 'PENDING' | 'REVISION_REQUESTED';
  stateLabel: string;
  timestamp?: string;
  description?: string;
}

export const ReviewTrackingTimeline: React.FC<ReviewTrackingTimelineProps> = ({
  gateRecord,
  projectId,
  projectStatus,
  prApprovalState,
  completenessScore = 4,
  isPmOnly = false,
  compact = false,
  showActivityHistory = true,
  defaultExpandedHistory = false,
}) => {
  const status = gateRecord?.status;

  // Progressive Disclosure State for History only
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(defaultExpandedHistory);

  // Resolve PR Approval State (strictly from SSOT prop, never fallback to stale localStorage)
  const activePr: PrApprovalStateLike | null = React.useMemo(() => {
    if (prApprovalState) return prApprovalState;
    return null;
  }, [prApprovalState]);

  // 1. Derive Summary Info (WHO, WHERE, STATUS, NEXT)
  const trackingSummary = React.useMemo(() => {
    // 1. Primary: Authoritative Canonical Workflow Projection from SSOT Engine
    if (gateRecord?.workflow) {
      const current = gateRecord.workflow.current;
      if (current && current.status !== 'UNKNOWN' && gateRecord.workflow.businessStatus !== 'UNKNOWN_WORKFLOW_STATE') {
        const colorInfo = getCanonicalStatusColor(current.status);

        return {
          currentOwner: current.ownerName || 'Unknown',
          currentPosition: current.position || 'Unknown State',
          statusBadge: (
            <Tag
              color={colorInfo.tagColor}
              style={{
                fontWeight: 700,
                borderRadius: 4,
                margin: 0,
                fontSize: 11,
                background: colorInfo.bg,
                borderColor: colorInfo.border,
                color: colorInfo.text,
              }}
            >
              {current.headerBadge || current.label || 'STATUS WORKFLOW TIDAK DIKENALI'}
            </Tag>
          ),
          nextStep: current.nextStep || 'Periksa alur kerja di Workflow Engine',
        };
      }

      // Workflow exists but current is missing, unknown, or invalid -> Fail-safe UNKNOWN UI (Phase 2C.14)
      return {
        currentOwner: '-',
        currentPosition: 'Status Workflow Tidak Dikenali',
        statusBadge: (
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
            STATUS WORKFLOW TIDAK DIKENALI
          </Tag>
        ),
        nextStep: 'Periksa alur kerja di Workflow Engine atau hubungi administrator sistem',
      };
    }

    // 2. Legacy Fallback (ONLY if workflow instance does not exist)
    // Project Governance Completion Gate
    if (status === 'READY_FOR_KICKOFF') {
      const isProjectActive = projectStatus === 'IN_PROGRESS';
      return {
        currentOwner: 'Project Manager',
        currentPosition: isProjectActive
          ? 'Kickoff Selesai (Proyek Berjalan / In Progress)'
          : 'Ready for Kickoff (Persetujuan Governance Lengkap)',
        statusBadge: isProjectActive ? (
          <Tag
            color="success"
            style={{
              fontWeight: 700,
              borderRadius: 4,
              margin: 0,
              fontSize: 11,
              background: '#f0fdf4',
              borderColor: '#bbf7d0',
              color: '#15803d',
            }}
          >
            PROYEK BERJALAN
          </Tag>
        ) : (
          <Tag
            color="purple"
            style={{
              fontWeight: 700,
              borderRadius: 4,
              margin: 0,
              fontSize: 11,
              background: '#f5f3ff',
              borderColor: '#ddd6fe',
              color: '#6d28d9',
            }}
          >
            READY FOR KICKOFF
          </Tag>
        ),
        nextStep: isProjectActive
          ? 'Eksekusi pekerjaan operasional & pelaporan progress WBS'
          : 'Kickoff Resmi oleh Project Manager (Handover ke PM)',
      };
    }

    // 1. Downstream PR Approval States (if PR exists and upstream is ready)
    if (status === 'READY_FOR_PROCUREMENT' && activePr) {
      const prStatus = activePr.status;

      if (prStatus === 'APPROVED') {
        const isProjectActive = projectStatus === 'IN_PROGRESS';
        return {
          currentOwner: 'Project Manager',
          currentPosition: isProjectActive
            ? 'Kickoff Selesai (Proyek Berjalan / In Progress)'
            : 'Ready for Kickoff (5 dari 5 Tahap Selesai)',
          statusBadge: isProjectActive ? (
            <Tag
              color="success"
              style={{
                fontWeight: 700,
                borderRadius: 4,
                margin: 0,
                fontSize: 11,
                background: '#f0fdf4',
                borderColor: '#bbf7d0',
                color: '#15803d',
              }}
            >
              PROYEK BERJALAN
            </Tag>
          ) : (
            <Tag
              color="purple"
              style={{
                fontWeight: 700,
                borderRadius: 4,
                margin: 0,
                fontSize: 11,
                background: '#f5f3ff',
                borderColor: '#ddd6fe',
                color: '#6d28d9',
              }}
            >
              READY FOR KICKOFF
            </Tag>
          ),
          nextStep: isProjectActive
            ? 'Eksekusi pekerjaan operasional & pelaporan progress WBS'
            : 'Kickoff Resmi oleh Project Manager (Handover ke PM)',
        };
      }

      if (prStatus === 'DIRECTOR_APPROVAL') {
        return {
          currentOwner: 'Director',
          currentPosition: 'Final Approval (Tahap 5 dari 5)',
          statusBadge: (
            <Tag color="purple" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11, background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9' }}>
              FINAL APPROVAL DIRECTOR
            </Tag>
          ),
          nextStep: 'Persetujuan akhir penerbitan pengadaan oleh Director',
        };
      }

      if (prStatus === 'FINANCE_REVIEW' || prStatus === 'SUBMITTED') {
        return {
          currentOwner: 'Finance Team',
          currentPosition: `Financial Review (Tahap 4 dari 5)${activePr.prNumber ? ` • ${activePr.prNumber}` : ''}`,
          statusBadge: (
            <Tag color="processing" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
              REVIEW FINANCE
            </Tag>
          ),
          nextStep: 'Review anggaran & kelayakan harga oleh Finance Team (Next Gate: Director Approval)',
        };
      }

      if (prStatus === 'REJECTED_TO_PROCUREMENT') {
        return {
          currentOwner: 'Procurement Team',
          currentPosition: 'Perbaikan Purchase Request',
          statusBadge: (
            <Tag color="error" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
              PERBAIKAN PR
            </Tag>
          ),
          nextStep: 'Procurement memperbaiki dan submit kembali',
        };
      }
    }

    // 2. Upstream Operational Plan Gate States
    if (status === 'READY_FOR_PROCUREMENT') {
      return {
        currentOwner: 'Procurement Team',
        currentPosition: 'Procurement Gate (Tahap 3 dari 5)',
        statusBadge: (
          <Tag color="gold" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}>
            READY FOR PROCUREMENT
          </Tag>
        ),
        nextStep: 'Pengadaan barang & jasa oleh Procurement Team',
      };
    }

    if (status === 'REVIEW_PENDING') {
      return {
        currentOwner: 'Head of Operations',
        currentPosition: 'Management Review (Tahap 2 dari 5)',
        statusBadge: (
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
            SEDANG DITINJAU
          </Tag>
        ),
        nextStep: 'Keputusan Review dari Head of Operations',
      };
    }

    if (status === 'NEEDS_REVISION') {
      return {
        currentOwner: 'Project Manager',
        currentPosition: 'Perbaikan Operasional (Tahap 1 dari 5)',
        statusBadge: (
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
            PERBAIKAN OPERASIONAL
          </Tag>
        ),
        nextStep: 'Ajukan Ulang ke Head of Operations',
      };
    }

    if (completenessScore === 4) {
      return {
        currentOwner: 'Project Manager',
        currentPosition: 'Penyusunan Plan (Tahap 1 dari 5)',
        statusBadge: (
          <Tag color="success" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
            SIAP DIAJUKAN
          </Tag>
        ),
        nextStep: 'Ajukan ke Management Review (Head of Operations)',
      };
    }

    return {
      currentOwner: 'Project Manager',
      currentPosition: 'Penyusunan Plan (Tahap 1 dari 5)',
      statusBadge: (
        <Tag color="warning" style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
          DRAF ({completenessScore}/4 Pilar)
        </Tag>
      ),
      nextStep: 'Lengkapi 4 Pilar Operasional (Cost, WBS, Schedule, Kondisi Awal)',
    };
  }, [status, completenessScore, activePr]);

  // 2. Derive 5-Stage Stepper
  const stages: WorkflowStage[] = React.useMemo(() => {
    // 1. Primary: Authoritative Canonical Steps from Workflow Engine SSOT
    if (gateRecord?.workflow) {
      if (gateRecord.workflow.steps && gateRecord.workflow.steps.length > 0) {
        return gateRecord.workflow.steps.map((step) => {
          let state: WorkflowStage['state'] = 'PENDING';
          if (step.status === 'COMPLETED') state = 'COMPLETED';
          else if (step.status === 'ACTIVE') state = 'CURRENT';
          else if (step.status === 'REVISION_REQUESTED') state = 'REVISION_REQUESTED';
          else state = 'PENDING';

          let description = '';
          if (step.key === 'pm') description = 'Cost, WBS, Schedule, Kondisi Awal';
          else if (step.key === 'hoa') description = 'Review & Endorsement Operasional';
          else if (step.key === 'proc') description = 'Review Rencana Pengadaan & Vendor';
          else if (step.key === 'fin') description = 'Review Anggaran & Kelayakan Finansial';
          else if (step.key === 'dir') description = 'Approval Akhir Rencana Proyek';

          return {
            key: step.key,
            order: step.stage,
            roleTitle: step.roleTitle || step.role,
            stageName: step.stageName,
            state,
            stateLabel: step.stateLabel,
            timestamp: step.completedAt,
            description: step.notes ? `Catatan: ${step.notes}` : description,
          };
        });
      }
      return [];
    }

    // 2. Legacy Fallback (ONLY if workflow instance does not exist)
    let pmState: WorkflowStage['state'] = 'CURRENT';
    let pmLabel = 'Penyusunan';
    let pmTime = gateRecord?.submittedAt;

    let gmState: WorkflowStage['state'] = 'PENDING';
    let gmLabel = 'Menunggu';
    let gmTime = gateRecord?.decidedAt;

    let procState: WorkflowStage['state'] = 'PENDING';
    let procLabel = 'Menunggu';
    let procTime: string | undefined;

    let finState: WorkflowStage['state'] = 'PENDING';
    let finLabel = 'Menunggu';
    let finTime: string | undefined;

    let dirState: WorkflowStage['state'] = 'PENDING';
    let dirLabel = 'Menunggu';
    let dirTime: string | undefined;

    // Upstream Gate Evaluation
    if (status === 'READY_FOR_KICKOFF') {
      pmState = 'COMPLETED';
      pmLabel = 'Selesai';
      gmState = 'COMPLETED';
      gmLabel = 'Disetujui';
      procState = 'COMPLETED';
      procLabel = 'Disetujui';
      finState = 'COMPLETED';
      finLabel = 'Disetujui';
      dirState = 'COMPLETED';
      dirLabel = 'Disetujui Final';
      dirTime = gateRecord?.decidedAt;
    } else if (status === 'READY_FOR_PROCUREMENT') {
      pmState = 'COMPLETED';
      pmLabel = 'Selesai';
      gmState = 'COMPLETED';
      gmLabel = 'Disetujui';
      procState = 'CURRENT';
      procLabel = 'Siap Diproses';

      // Downstream PR Evaluation
      if (activePr) {
        const prStatus = activePr.status;
        procTime = activePr.submittedAt;
        finTime = activePr.financeReviewedAt;
        dirTime = activePr.directorApprovedAt;

        if (prStatus === 'APPROVED') {
          procState = 'COMPLETED';
          procLabel = 'PR Disubmit';
          finState = 'COMPLETED';
          finLabel = 'Disetujui';
          dirState = 'COMPLETED';
          dirLabel = 'Disetujui Final';
        } else if (prStatus === 'DIRECTOR_APPROVAL') {
          procState = 'COMPLETED';
          procLabel = 'PR Disubmit';
          finState = 'COMPLETED';
          finLabel = 'Disetujui';
          dirState = 'CURRENT';
          dirLabel = 'Final Approval';
        } else if (prStatus === 'FINANCE_REVIEW' || prStatus === 'SUBMITTED') {
          procState = 'COMPLETED';
          procLabel = 'PR Disubmit';
          finState = 'CURRENT';
          finLabel = 'Sedang Review';
          dirState = 'PENDING';
          dirLabel = 'Menunggu';
        } else if (prStatus === 'REJECTED_TO_PROCUREMENT') {
          procState = 'REVISION_REQUESTED';
          procLabel = 'Perlu Perbaikan';
          procTime = activePr.rejectedAt;
          finState = activePr.rejectedByRole === 'DIRECTOR' ? 'COMPLETED' : 'PENDING';
          finLabel = activePr.rejectedByRole === 'DIRECTOR' ? 'Disetujui' : 'Menunggu';
          dirState = 'PENDING';
          dirLabel = 'Menunggu';
        }
      }
    } else if (status === 'REVIEW_PENDING') {
      pmState = 'COMPLETED';
      pmLabel = 'Diajukan';
      gmState = 'CURRENT';
      gmLabel = 'Sedang Review';
      procState = 'PENDING';
      procLabel = 'Menunggu';
    } else if (status === 'NEEDS_REVISION') {
      pmState = 'CURRENT';
      pmLabel = 'Perbaikan';
      gmState = 'REVISION_REQUESTED';
      gmLabel = 'Revision Requested';
      procState = 'PENDING';
      procLabel = 'Menunggu';
    } else if (completenessScore === 4) {
      pmState = 'CURRENT';
      pmLabel = 'Siap Ajukan';
      gmState = 'PENDING';
      gmLabel = 'Menunggu';
    }

    return [
      {
        key: 'pm',
        order: 1,
        roleTitle: 'Project Manager',
        stageName: 'Penyusunan Plan',
        state: pmState,
        stateLabel: pmLabel,
        timestamp: pmTime,
        description: 'Cost, WBS, Schedule, Kondisi Awal',
      },
      {
        key: 'hoa',
        order: 2,
        roleTitle: 'Head of Operations',
        stageName: 'HOPS Review',
        state: gmState,
        stateLabel: gmLabel,
        timestamp: gmTime,
        description: 'Review & Endorsement Operasional',
      },
      {
        key: 'proc',
        order: 3,
        roleTitle: 'Procurement Team',
        stageName: 'Procurement Review',
        state: procState,
        stateLabel: procLabel,
        timestamp: procTime,
        description: 'Review Rencana Pengadaan & Vendor',
      },
      {
        key: 'fin',
        order: 4,
        roleTitle: 'Finance Team',
        stageName: 'Finance Review',
        state: finState,
        stateLabel: finLabel,
        timestamp: finTime,
        description: 'Review Anggaran & Kelayakan Finansial',
      },
      {
        key: 'dir',
        order: 5,
        roleTitle: 'Director',
        stageName: 'Director Approval',
        state: dirState,
        stateLabel: dirLabel,
        timestamp: dirTime,
        description: 'Approval Akhir Rencana Proyek',
      },
    ];
  }, [status, completenessScore, gateRecord, activePr]);

  // 3. Derive Provable Activity Events
  const activityEvents = React.useMemo(() => {
    // 1. Primary: Authoritative Chronological Transition History from Workflow Engine
    if (gateRecord?.workflow) {
      const wfHistory = gateRecord.workflow.history;
      if (wfHistory && wfHistory.length > 0) {
        return wfHistory.map((h: any) => {
          let tag = h.action;
          let color = '#2563eb';
          let title = `Peralihan Alur: ${h.action}`;
          if (h.action === 'APPROVE') {
            color = '#059669';
            title = `Persetujuan oleh ${h.actorRole || 'Reviewer'}`;
          } else if (h.action === 'RETURN' || h.action === 'REJECT') {
            color = '#dc2626';
            title = `Permintaan Revisi oleh ${h.actorRole || 'Reviewer'}`;
          } else if (h.action === 'RESUBMIT') {
            color = '#0891b2';
            title = 'Pengajuan Ulang oleh Project Manager';
          } else if (h.action === 'START') {
            color = '#2563eb';
            title = 'Operational Plan Diajukan ke Management Review';
          }
          return {
            id: `wf-${h.id}`,
            title,
            actor: h.actorName || (h.actorId ? `User #${h.actorId}` : 'System'),
            time: dayjs(h.createdAt).format('DD MMM YYYY HH:mm'),
            tag,
            note: h.comments || undefined,
            color,
          };
        });
      }
      return [];
    }

    // 2. Legacy Fallback (ONLY if workflow history is not available)
    const events: { id: string; title: string; actor: string; time: string; tag?: string; note?: string; color: string }[] = [];

    // 1. Upstream Gate Activity
    if (gateRecord?.submittedAt) {
      events.push({
        id: 'submitted',
        title: 'Operational Plan Diajukan ke Management Review',
        actor: gateRecord.submittedByName || 'Project Manager',
        time: dayjs(gateRecord.submittedAt).format('DD MMM YYYY HH:mm'),
        tag: 'SUBMITTED',
        color: '#2563eb',
      });
    }

    if (gateRecord?.decidedAt && gateRecord.status === 'NEEDS_REVISION') {
      events.push({
        id: 'revision',
        title: 'Permintaan Revisi Operasional',
        actor: gateRecord.decidedByName || 'Head of Operations',
        time: dayjs(gateRecord.decidedAt).format('DD MMM YYYY HH:mm'),
        tag: 'REVISION',
        note: gateRecord.revisionNotes,
        color: '#dc2626',
      });
    }

    if (gateRecord?.revisionDraftSavedAt) {
      events.push({
        id: 'draft_saved',
        title: 'Draf Perbaikan Disimpan oleh PM',
        actor: 'Project Manager',
        time: dayjs(gateRecord.revisionDraftSavedAt).format('DD MMM YYYY HH:mm'),
        tag: 'DRAFT SAVED',
        color: '#d97706',
      });
    }

    if (gateRecord?.resubmittedAt) {
      events.push({
        id: 'resubmitted',
        title: 'Operational Plan Hasil Revisi Diajukan Ulang',
        actor: 'Project Manager',
        time: dayjs(gateRecord.resubmittedAt).format('DD MMM YYYY HH:mm'),
        tag: 'RESUBMITTED',
        color: '#059669',
      });
    }

    if (gateRecord?.decidedAt && gateRecord.status === 'READY_FOR_PROCUREMENT') {
      events.push({
        id: 'approved',
        title: 'Operational Plan Disetujui & Dialihkan ke Procurement',
        actor: gateRecord.decidedByName || 'Head of Operations',
        time: dayjs(gateRecord.decidedAt).format('DD MMM YYYY HH:mm'),
        tag: 'APPROVED',
        color: '#d97706',
      });
    }

    // 2. Downstream PR Activity
    if (activePr?.submittedAt) {
      events.push({
        id: 'pr_submitted',
        title: `Purchase Request (${activePr.prNumber || `PR-${activePr.prId}`}) Dibuat & Disubmit`,
        actor: activePr.submittedBy || 'Procurement Team',
        time: dayjs(activePr.submittedAt).format('DD MMM YYYY HH:mm'),
        tag: 'PR SUBMITTED',
        color: '#2563eb',
      });
    }

    if (activePr?.financeReviewedAt && (activePr.status === 'DIRECTOR_APPROVAL' || activePr.status === 'APPROVED')) {
      events.push({
        id: 'pr_finance_approved',
        title: 'Financial Review Disetujui & Diteruskan ke Director',
        actor: activePr.financeReviewedBy || 'Finance Team',
        time: dayjs(activePr.financeReviewedAt).format('DD MMM YYYY HH:mm'),
        tag: 'FINANCE REVIEWED',
        note: activePr.financeComments ? `Evaluasi: "${activePr.financeComments}"` : undefined,
        color: '#059669',
      });
    }

    if (activePr?.directorApprovedAt && activePr.status === 'APPROVED') {
      events.push({
        id: 'pr_director_approved',
        title: 'Purchase Request Disetujui Final oleh Director',
        actor: activePr.directorApprovedBy || 'Director',
        time: dayjs(activePr.directorApprovedAt).format('DD MMM YYYY HH:mm'),
        tag: 'PR APPROVED',
        note: activePr.directorComments ? `Catatan: "${activePr.directorComments}"` : undefined,
        color: '#059669',
      });
    }

    if (activePr?.rejectedAt && activePr.status === 'REJECTED_TO_PROCUREMENT') {
      events.push({
        id: 'pr_rejected',
        title: `Purchase Request Dikembalikan ke Procurement oleh ${activePr.rejectedByRole === 'DIRECTOR' ? 'Director' : 'Finance Team'}`,
        actor: activePr.rejectedBy || (activePr.rejectedByRole === 'DIRECTOR' ? 'Director' : 'Finance Team'),
        time: dayjs(activePr.rejectedAt).format('DD MMM YYYY HH:mm'),
        tag: 'PR REJECTED',
        note: activePr.rejectionReason ? `Catatan: "${activePr.rejectionReason}"` : undefined,
        color: '#dc2626',
      });
    }

    if (activePr?.status === 'DIRECTOR_APPROVAL') {
      events.push({
        id: 'pr_director_pending',
        title: 'Menunggu Final Approval Director',
        actor: 'Director (Final Authority)',
        time: 'Sedang Berjalan',
        tag: 'FINAL APPROVAL PENDING',
        note: 'Menunggu otorisasi penerbitan pengadaan oleh Director',
        color: '#7c3aed',
      });
    }

    if (activePr && (activePr.status === 'SUBMITTED' || activePr.status === 'FINANCE_REVIEW') && !activePr.financeReviewedAt) {
      events.push({
        id: 'pr_finance_pending',
        title: 'Menunggu Financial Review',
        actor: 'Finance Team',
        time: 'Sedang Berjalan',
        tag: 'REVIEW PENDING',
        note: 'Menunggu review anggaran & kelayakan harga oleh Finance',
        color: '#2563eb',
      });
    }

    return events;
  }, [gateRecord, activePr]);

  const renderStageIcon = (state: WorkflowStage['state']) => {
    switch (state) {
      case 'COMPLETED':
        return <CheckCircleFilled style={{ color: '#059669', fontSize: 13 }} />;
      case 'CURRENT':
        return <ClockCircleFilled style={{ color: '#2563eb', fontSize: 13 }} />;
      case 'REVISION_REQUESTED':
        return <ExclamationCircleFilled style={{ color: '#dc2626', fontSize: 13 }} />;
      default:
        return <MinusCircleOutlined style={{ color: '#94a3b8', fontSize: 11 }} />;
    }
  };

  return (
    <Card
      size="small"
      style={{
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
      bodyStyle={{ padding: '8px 12px' }}
    >
      {/* 1. COMPACT STATUS & NEXT SUMMARY LINE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
          fontSize: 11.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#475569' }}>Posisi:</span>
          <span style={{ fontWeight: 700, color: '#1e40af' }}>{trackingSummary.currentPosition}</span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span style={{ fontWeight: 700, color: '#475569' }}>Owner:</span>
          <span style={{ fontWeight: 700, color: '#0f766e' }}>{trackingSummary.currentOwner}</span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span style={{ fontWeight: 700, color: '#475569' }}>Next:</span>
          <span style={{ color: '#334155', fontWeight: 500 }}>{trackingSummary.nextStep}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {trackingSummary.statusBadge}

          {showActivityHistory && activityEvents.length > 0 && (
            <Button
              size="small"
              type="text"
              icon={isHistoryExpanded ? <UpOutlined /> : <HistoryOutlined />}
              onClick={() => setIsHistoryExpanded((prev) => !prev)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#475569',
                background: '#f1f5f9',
                borderRadius: 4,
                padding: '0 8px',
                height: 24,
              }}
            >
              {isHistoryExpanded ? 'Tutup Riwayat' : `Lihat Riwayat (${activityEvents.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* 2. PRIMARY 5-STAGE WORKFLOW STEPPER (ALWAYS VISIBLE) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          gap: 6,
          flexWrap: 'nowrap',
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {stages.map((stg, idx) => {
          const isCurrent = stg.state === 'CURRENT';
          const isCompleted = stg.state === 'COMPLETED';
          const isRevision = stg.state === 'REVISION_REQUESTED';

          return (
            <React.Fragment key={stg.key}>
              <div
                style={{
                  flex: '1 1 0',
                  minWidth: 120,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: isCurrent
                    ? '1.5px solid #2563eb'
                    : isRevision
                    ? '1.5px solid #dc2626'
                    : isCompleted
                    ? '1px solid #86efac'
                    : '1px solid #e2e8f0',
                  background: isCurrent
                    ? '#eff6ff'
                    : isRevision
                    ? '#fef2f2'
                    : isCompleted
                    ? '#f0fdf4'
                    : '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: isCurrent ? '#1d4ed8' : isRevision ? '#b91c1c' : '#475569' }}>
                      {idx + 1}. {stg.roleTitle}
                    </span>
                    {renderStageIcon(stg.state)}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', lineHeight: 1.2 }}>{stg.stageName}</div>
                </div>

                <div style={{ marginTop: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag
                    color={
                      isCompleted ? 'success' : isCurrent ? 'processing' : isRevision ? 'error' : 'default'
                    }
                    style={{ fontSize: 8.5, fontWeight: 700, margin: 0, padding: '0 4px', borderRadius: 3, lineHeight: '13px' }}
                  >
                    {stg.stateLabel}
                  </Tag>
                  {stg.timestamp && (
                    <span style={{ fontSize: 8.5, color: '#94a3b8' }}>
                      {dayjs(stg.timestamp).format('DD/MM HH:mm')}
                    </span>
                  )}
                </div>
              </div>

              {idx < stages.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', color: '#cbd5e1', fontSize: 11 }}>
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 3. PROGRESSIVE DISCLOSURE: ACTIVITY HISTORY (COLLAPSED BY DEFAULT) */}
      {showActivityHistory && isHistoryExpanded && activityEvents.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <HistoryOutlined style={{ color: '#2563eb', fontSize: 11 }} />
            <Text strong style={{ fontSize: 10.5, color: '#334155' }}>
              Riwayat Aktivitas & Jejak Keputusan
            </Text>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activityEvents.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  fontSize: 10.5,
                  padding: '3px 6px',
                  borderRadius: 4,
                  background: '#f8fafc',
                }}
              >
                <div>
                  <Space size={6}>
                    <span style={{ color: evt.color, fontWeight: 700 }}>•</span>
                    <Text strong style={{ fontSize: 10.5, color: '#1e293b' }}>
                      {evt.title}
                    </Text>
                    <span style={{ color: '#64748b', fontSize: 10 }}>oleh {evt.actor}</span>
                  </Space>
                  {evt.note && (
                    <div style={{ margin: '2px 0 2px 14px', fontSize: 10, fontStyle: 'italic', color: '#b91c1c' }}>
                      Catatan: &ldquo;{evt.note}&rdquo;
                    </div>
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                  {evt.time}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
