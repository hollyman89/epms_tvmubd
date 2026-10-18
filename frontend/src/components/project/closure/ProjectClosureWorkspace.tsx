'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Tag,
  Modal,
  Input,
  Progress,
  Skeleton,
  Alert,
  Tooltip,
  message,
  Timeline,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  ReloadOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { ProjectCharter } from '../../ProjectOperationTab';
import {
  ProjectService,
  ClosureReadinessResult,
  ProjectClosure,
  ClosureBlocker,
  ClosureWarning,
} from '@/services/project.service';
import {
  formatClosureDate,
  resolveDomainLabel,
  resolveClosureStageInfo,
  resolveClosureActionability,
  formatCurrencyValue,
} from './project-closure.utils';
import styles from './ProjectClosureWorkspace.module.css';

const { TextArea } = Input;

export interface ProjectClosureWorkspaceProps {
  projectId: number;
  project?: ProjectCharter | null;
  onNavigateToDocuments?: () => void;
  onRefetchProject?: () => void;
}

export const ProjectClosureWorkspace: React.FC<ProjectClosureWorkspaceProps> = ({
  projectId,
  project,
  onNavigateToDocuments,
  onRefetchProject,
}) => {
  const { user } = useAuth();
  const userRoles = useMemo(() => user?.roles || [], [user]);

  // Remote Closure state
  const [readiness, setReadiness] = useState<ClosureReadinessResult | null>(null);
  const [currentClosure, setCurrentClosure] = useState<ProjectClosure | null>(null);
  const [closureHistory, setClosureHistory] = useState<ProjectClosure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // PM Submission Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [submissionNotes, setSubmissionNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fetch authoritative closure data
  const fetchData = useCallback(async () => {
    if (!projectId || isNaN(Number(projectId)) || Number(projectId) <= 0) return;

    setLoading(true);
    setFetchError(null);

    try {
      const [readinessRes, currentRes, historyRes] = await Promise.all([
        ProjectService.getClosureReadiness(projectId),
        ProjectService.getCurrentClosure(projectId),
        ProjectService.getClosureHistory(projectId),
      ]);

      setReadiness(readinessRes);
      setCurrentClosure(currentRes);
      setClosureHistory(historyRes || []);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message || err?.message || 'Gagal memuat status penutupan proyek.';
      setFetchError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Project effective attributes
  const projectStatus = project?.status || readiness?.project?.status || 'IN_PROGRESS';
  const isProjectClosed = projectStatus === 'CLOSED';
  const actualFinishAt = (project as any)?.actual_finish_at || readiness?.physicalActualFinishCandidate;
  const closedAt = (project as any)?.closed_at;

  // Resolve actionability for PM
  const actionability = useMemo(() => {
    return resolveClosureActionability({
      userId: (user as any)?.id || user?.sub,
      userRoles,
      projectManagerId: (project as any)?.manager_id || (project as any)?.managerId,
      pmName: project?.pmName,
      userFullName: user?.fullName || (user as any)?.name,
      projectStatus,
      currentClosure,
      readinessReady: readiness?.ready ?? false,
    });
  }, [user, userRoles, project, projectStatus, currentClosure, readiness]);

  // Handle PM Submit / Resubmit
  const handleSubmitClosure = async () => {
    if (submitting) return; // Prevent double click
    setSubmitting(true);

    try {
      await ProjectService.submitClosure(projectId, {
        submissionNotes: submissionNotes.trim() || undefined,
      });

      message.success(
        actionability.canResubmit
          ? 'Pengajuan ulang penutupan proyek berhasil dikirim ke Head of Operations.'
          : 'Pengajuan penutupan proyek berhasil dikirim ke Head of Operations.'
      );

      setIsSubmitModalOpen(false);
      setSubmissionNotes('');
      await fetchData();
      if (onRefetchProject) onRefetchProject();
    } catch (err: any) {
      const status = err?.response?.status;
      const errMsg =
        err?.response?.data?.message || err?.message || 'Gagal mengajukan penutupan proyek.';

      if (status === 409) {
        message.error(`Konflik Status: ${errMsg}`);
        // Refresh authoritative state on 409 conflict
        await fetchData();
      } else if (status === 403) {
        message.error(`Akses Ditolak: ${errMsg}`);
      } else {
        message.error(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Loading Skeleton State
  if (loading && !readiness) {
    return (
      <div className={styles.closureContainer} data-testid="closure-workspace-loading">
        <div className={styles.cardSection}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </div>
    );
  }

  // Error State
  if (fetchError && !readiness) {
    return (
      <div className={styles.closureContainer} data-testid="closure-workspace-error">
        <Alert
          type="error"
          showIcon
          message="Gagal Memuat Data Penutupan Proyek"
          description={fetchError}
          action={
            <Button size="small" type="primary" onClick={fetchData} icon={<ReloadOutlined />}>
              Coba Lagi
            </Button>
          }
        />
      </div>
    );
  }

  const stageInfo = resolveClosureStageInfo(currentClosure, projectStatus);
  const isReady = readiness?.ready ?? false;

  return (
    <div className={styles.closureContainer} data-testid="project-closure-workspace">
      {/* 1. Header Card with Project & Closure Status */}
      <div className={styles.cardSection}>
        <div className={styles.headerRow}>
          <div className={styles.titleArea}>
            <h2>
              <AuditOutlined style={{ color: '#2563EB' }} />
              Project Closure & Serah Terima
            </h2>
            <p>
              Tata kelola penutupan proyek, validasi kesiapan lintas fungsi, dan riwayat persetujuan manajemen.
            </p>
          </div>

          <div className={styles.badgeRow}>
            {/* Project Status */}
            <Tag color={isProjectClosed ? 'green' : 'blue'} style={{ fontWeight: 600, padding: '4px 10px' }}>
              Status Proyek: {projectStatus}
            </Tag>

            {/* Cycle Status (Only rendered when an active or historical closure cycle exists) */}
            {currentClosure && currentClosure.cycleNumber && stageInfo.stageKey !== 'NONE' && (
              <Tag
                color={
                  stageInfo.statusBadgeTone === 'success'
                    ? 'success'
                    : stageInfo.statusBadgeTone === 'warning'
                    ? 'warning'
                    : stageInfo.statusBadgeTone === 'processing'
                    ? 'processing'
                    : 'default'
                }
                style={{ fontWeight: 600, padding: '4px 10px' }}
                data-testid="closure-stage-badge"
              >
                {`Siklus #${currentClosure.cycleNumber}: `}
                {stageInfo.label}
              </Tag>
            )}

            <Button size="small" icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Closed Terminal Banner (Shown when Project is CLOSED) */}
      {isProjectClosed && (
        <div className={styles.closedBanner} data-testid="closed-terminal-banner">
          <div className={styles.closedBannerTitle}>
            <SafetyCertificateOutlined />
            <span>Proyek Resmi Ditutup (Project Closed)</span>
          </div>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Proyek ini telah melalui seluruh siklus persetujuan dan berada dalam status terminal tertutup. Seluruh aksi
            eksekusi operasional telah dinonaktifkan.
          </p>

          <div className={styles.closedDatesGrid}>
            {/* Operational Completion Candidate / actual_finish_at */}
            <div className={styles.closedDateItem}>
              <span className={styles.closedDateLabel}>Penyelesaian Operasional</span>
              <span className={styles.closedDateValue} data-testid="label-actual-finish-at">
                {formatClosureDate(actualFinishAt)}
              </span>
            </div>

            {/* Formal Approval / closed_at */}
            <div className={styles.closedDateItem}>
              <span className={styles.closedDateLabel}>Persetujuan Penutupan Formal</span>
              <span className={styles.closedDateValue} data-testid="label-closed-at">
                {formatClosureDate(closedAt)}
              </span>
            </div>

            {/* Closed By / Approver */}
            {currentClosure?.directorApprover && (
              <div className={styles.closedDateItem}>
                <span className={styles.closedDateLabel}>Disetujui Oleh Direktur</span>
                <span className={styles.closedDateValue}>
                  {currentClosure.directorApprover.fullName || currentClosure.directorApprover.email}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Current Active Cycle Banner / Notice */}
      {currentClosure && !isProjectClosed && (
        <div className={styles.cardSection} data-testid="current-cycle-status-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentClosure.status === 'PENDING_HOO_REVIEW' && (
              <Alert
                type="info"
                showIcon
                icon={<ClockCircleOutlined />}
                message={`Siklus #${currentClosure.cycleNumber} Sedang Ditinjau`}
                description="Menunggu tinjauan Head of Operations (Waiting for Head of Operations review). Tim operasional sedang mengevaluasi kepatuhan teknis dan dokumen."
                data-testid="pending-hoo-alert"
              />
            )}

            {currentClosure.status === 'PENDING_DIRECTOR_APPROVAL' && (
              <Alert
                type="info"
                showIcon
                icon={<ClockCircleOutlined />}
                message={`Siklus #${currentClosure.cycleNumber} Menunggu Persetujuan Direktur`}
                description="Menunggu persetujuan akhir Direktur (Waiting for Director final approval). Head of Operations telah menyetujui dan meneruskan ke Direktur."
                data-testid="pending-director-alert"
              />
            )}

            {currentClosure.status === 'RETURNED' && (
              <div data-testid="returned-closure-alert">
                <Alert
                  type="warning"
                  showIcon
                  icon={<ExclamationCircleOutlined />}
                  message={`Siklus #${currentClosure.cycleNumber} Dikembalikan (Returned)`}
                  description={
                    <div>
                      <p style={{ margin: '4px 0 8px 0' }}>
                        Pengajuan penutupan dikembalikan oleh <strong>{currentClosure.returnRole || 'Manajemen'}</strong> pada{' '}
                        {formatClosureDate(currentClosure.returnTimestamp)}.
                      </p>
                      <div className={styles.returnedReasonBox} data-testid="returned-reason-box">
                        <strong>Alasan Pengembalian:</strong> {currentClosure.returnReason || 'Tidak ada catatan alasan.'}
                      </div>
                      <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#64748b' }}>
                        Silakan lengkapi kendala yang disampaikan. Setelah kesiapan terpenuhi, Project Manager dapat melakukan
                        pengajuan ulang untuk membentuk siklus penutupan baru.
                      </p>
                    </div>
                  }
                />
              </div>
            )}

            {currentClosure.submissionNotes && (
              <div style={{ fontSize: 12, color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                <strong>Catatan Pengajuan PM:</strong> {currentClosure.submissionNotes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Empty State if No Closure Cycle Yet */}
      {!currentClosure && !isProjectClosed && (
        <Alert
          type="info"
          showIcon
          message="Project Belum Diajukan untuk Closure"
          description="Project belum pernah diajukan untuk penutupan formal. Evaluasi seluruh kriteria kesiapan di bawah ini sebelum mengajukan penutupan."
          data-testid="no-closure-empty-state"
        />
      )}

      {/* 5. Authoritative Readiness Banner & Action Button */}
      {readiness && (
        <div
          className={`${styles.readinessCard} ${isReady ? styles.readinessReady : styles.readinessNotReady}`}
          data-testid="closure-readiness-banner"
        >
          <div>
            <div
              className={`${styles.readinessStatusTitle} ${
                isReady ? styles.readinessStatusReadyTitle : styles.readinessStatusNotReadyTitle
              }`}
            >
              {isReady ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              <span data-testid="readiness-verdict-text">
                {isReady ? 'SIAP UNTUK DITUTUP (READY FOR CLOSURE)' : 'BELUM SIAP UNTUK DITUTUP (NOT READY FOR CLOSURE)'}
              </span>
            </div>
            <p className={styles.readinessDesc}>
              {isReady
                ? 'Seluruh prasyarat fisik, tugas, kendala, risiko, pengadaan, keuangan, dan dokumen resmi telah terpenuhi.'
                : `Terdapat ${readiness.summary.blockerCount} blocker yang harus diselesaikan sebelum penutupan dapat diajukan.`}
            </p>
          </div>

          {/* PM Action Button: Submit / Resubmit */}
          {!isProjectClosed && (actionability.canSubmit || actionability.canResubmit || actionability.isAssignedPm) && (
            <div>
              <Tooltip title={actionability.disabledReason}>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  size="middle"
                  disabled={!isReady || (!actionability.canSubmit && !actionability.canResubmit)}
                  onClick={() => setIsSubmitModalOpen(true)}
                  style={{
                    backgroundColor: isReady ? '#16A34A' : undefined,
                    fontWeight: 600,
                  }}
                  data-testid="pm-submit-closure-btn"
                >
                  {actionability.canResubmit ? 'Ajukan Ulang Penutupan (Resubmit)' : 'Ajukan Penutupan Proyek (Submit)'}
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      )}

      {/* 6. Blockers List (if any) */}
      {readiness && readiness.blockers && readiness.blockers.length > 0 && (
        <div className={styles.cardSection} data-testid="closure-blockers-section">
          <div className={styles.titleArea}>
            <h2 style={{ color: '#DC2626' }}>
              <CloseCircleOutlined />
              Kendala Penutupan (Blockers) — {readiness.blockers.length} Item
            </h2>
            <p>Seluruh blocker berikut wajib diselesaikan sebelum penutupan proyek dapat diajukan secara resmi.</p>
          </div>

          <div className={styles.issueList}>
            {readiness.blockers.map((blocker, idx) => (
              <div key={`blocker-${idx}`} className={styles.blockerItem} data-testid="closure-blocker-item">
                <CloseCircleOutlined style={{ color: '#EF4444', marginTop: 2 }} />
                <div className={styles.issueContent}>
                  <div>
                    <Tag color="red">{resolveDomainLabel(blocker.domain)}</Tag>
                    <span className={styles.issueCode}>{blocker.code}</span>
                  </div>
                  <div className={styles.issueMessage}>{blocker.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Warnings List (if any) */}
      {readiness && readiness.warnings && readiness.warnings.length > 0 && (
        <div className={styles.cardSection} data-testid="closure-warnings-section">
          <div className={styles.titleArea}>
            <h2 style={{ color: '#D97706' }}>
              <WarningOutlined />
              Peringatan Kepatuhan (Warnings) — {readiness.warnings.length} Item
            </h2>
            <p>
              Peringatan ini bersifat informatif dan tidak menggugurkan kelayakan penutupan jika seluruh kriteria utama
              terpenuhi.
            </p>
          </div>

          <div className={styles.issueList}>
            {readiness.warnings.map((warning, idx) => (
              <div key={`warning-${idx}`} className={styles.warningItem} data-testid="closure-warning-item">
                <ExclamationCircleOutlined style={{ color: '#F59E0B', marginTop: 2 }} />
                <div className={styles.issueContent}>
                  <div>
                    <Tag color="warning">{resolveDomainLabel(warning.domain)}</Tag>
                    <span className={styles.issueCode}>{warning.code}</span>
                  </div>
                  <div className={styles.issueMessage}>{warning.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Required Documents Evidence (BAST & Final Report) */}
      {readiness && (
        <div className={styles.cardSection} data-testid="closure-document-evidence-section">
          <div className={styles.headerRow}>
            <div className={styles.titleArea}>
              <h2>
                <FileTextOutlined style={{ color: '#2563EB' }} />
                Bukti Dokumen Persyaratan Penutupan
              </h2>
              <p>
                Sistem secara otomatis memverifikasi keberadaan dokumen sah serah terima dari repositori dokumen proyek.
              </p>
            </div>

            {onNavigateToDocuments && (
              <Button icon={<FolderOpenOutlined />} onClick={onNavigateToDocuments}>
                Buka Menu Dokumen Proyek
              </Button>
            )}
          </div>

          <div className={styles.evidenceGrid}>
            {/* Customer BAST Evidence */}
            <div className={styles.evidenceCard} data-testid="evidence-card-bast">
              <div className={styles.evidenceHeader}>
                <span className={styles.evidenceTitle}>
                  <FileTextOutlined />
                  Berita Acara Serah Terima (CUSTOMER_BAST)
                </span>
                <Tag
                  color={readiness.documents.customerBastPresent ? 'green' : 'red'}
                  data-testid="evidence-status-bast"
                >
                  {readiness.documents.customerBastPresent ? 'Tersedia' : 'Belum Ada'}
                </Tag>
              </div>

              <div className={styles.evidenceMeta}>
                {readiness.documents.customerBastPresent ? (
                  <div>
                    <div>Status: Dokumen resmi telah diverifikasi di repositori proyek.</div>
                    {readiness.documents.customerBastDocumentId && (
                      <div>ID Dokumen: #{readiness.documents.customerBastDocumentId}</div>
                    )}
                    {currentClosure?.acceptanceDocument?.name && (
                      <div>Nama File: {currentClosure.acceptanceDocument.name}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#DC2626' }}>
                    Dokumen BAST Klien belum diunggah. Unggah dokumen kategori CUSTOMER_BAST melalui menu Dokumen Proyek.
                  </div>
                )}
              </div>
            </div>

            {/* Final Report Evidence */}
            <div className={styles.evidenceCard} data-testid="evidence-card-final-report">
              <div className={styles.evidenceHeader}>
                <span className={styles.evidenceTitle}>
                  <FileTextOutlined />
                  Laporan Akhir Proyek (FINAL_REPORT)
                </span>
                <Tag
                  color={readiness.documents.finalReportPresent ? 'green' : 'red'}
                  data-testid="evidence-status-final-report"
                >
                  {readiness.documents.finalReportPresent ? 'Tersedia' : 'Belum Ada'}
                </Tag>
              </div>

              <div className={styles.evidenceMeta}>
                {readiness.documents.finalReportPresent ? (
                  <div>
                    <div>Status: Dokumen laporan akhir telah diverifikasi di repositori proyek.</div>
                    {readiness.documents.finalReportDocumentId && (
                      <div>ID Dokumen: #{readiness.documents.finalReportDocumentId}</div>
                    )}
                    {currentClosure?.finalReportDocument?.name && (
                      <div>Nama File: {currentClosure.finalReportDocument.name}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#DC2626' }}>
                    Laporan Akhir belum diunggah. Unggah dokumen kategori FINAL_REPORT melalui menu Dokumen Proyek.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Domain Readiness Grid (Pure Authoritative Read-Only) */}
      {readiness && (
        <div className={styles.cardSection} data-testid="closure-domain-readiness-grid">
          <div className={styles.titleArea}>
            <h2>
              <AuditOutlined style={{ color: '#2563EB' }} />
              Kesiapan Lintas Fungsi (Readiness Domains)
            </h2>
            <p>Status agregasi langsung dari domain operasional, keuangan, dan pengadaan proyek.</p>
          </div>

          <div className={styles.domainGrid}>
            {/* 1. Physical Progress */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Progress Fisik</span>
                <Tag color={readiness.physical.isComplete ? 'green' : 'orange'}>
                  {readiness.physical.isComplete ? '100% Selesai' : 'Belum 100%'}
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>{readiness.physical.overallProgress}%</div>
              <div className={styles.domainBoxSub}>Target wajib: {readiness.physical.requiredProgress}%</div>
            </div>

            {/* 2. Tasks / WBS */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Tugas & WBS</span>
                <Tag color={readiness.tasks.incompleteLeafTasks === 0 ? 'green' : 'orange'}>
                  {readiness.tasks.completedLeafTasks}/{readiness.tasks.totalLeafTasks} Selesai
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>
                {readiness.tasks.incompleteLeafTasks === 0 ? 'Lengkap' : `${readiness.tasks.incompleteLeafTasks} Belum Selesai`}
              </div>
              <div className={styles.domainBoxSub}>
                Tanpa tgl selesai: {readiness.tasks.missingActualFinishCount}
              </div>
            </div>

            {/* 3. Issues */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Kendala (Issues)</span>
                <Tag color={readiness.issues.blockingIssueCount === 0 ? 'green' : 'red'}>
                  {readiness.issues.blockingIssueCount === 0 ? 'Bersih' : `${readiness.issues.blockingIssueCount} Blocking`}
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>
                {readiness.issues.openIssues + readiness.issues.inProgressIssues} Aktif
              </div>
              <div className={styles.domainBoxSub}>Total terdaftar: {readiness.issues.totalIssues}</div>
            </div>

            {/* 4. Risks */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Risiko (Risks)</span>
                <Tag color={readiness.risks.unresolvedMaterializedRiskCount === 0 ? 'green' : 'red'}>
                  {readiness.risks.unresolvedMaterializedRiskCount === 0 ? 'Aman' : 'Ada Risiko Aktif'}
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>{readiness.risks.activeRiskCount} Aktif</div>
              <div className={styles.domainBoxSub}>
                Materialized belum tuntas: {readiness.risks.unresolvedMaterializedRiskCount}
              </div>
            </div>

            {/* 5. Material Procurement */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Pengadaan Material</span>
                <Tag
                  color={
                    readiness.procurement.material.openPRCount === 0 &&
                    readiness.procurement.material.unfulfilledMaterialPOCount === 0
                      ? 'green'
                      : 'orange'
                  }
                >
                  {readiness.procurement.material.openPRCount === 0 ? 'Selesai' : 'Pending'}
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>
                {readiness.procurement.material.openPRCount} PR / {readiness.procurement.material.pendingGRCount} Pending GR
              </div>
              <div className={styles.domainBoxSub}>
                PO belum terpenuhi: {readiness.procurement.material.unfulfilledMaterialPOCount}
              </div>
            </div>

            {/* 6. Service Procurement */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Pengadaan Jasa</span>
                <Tag color={readiness.procurement.service.remainingServiceScope === 0 ? 'green' : 'blue'}>
                  {readiness.procurement.service.servicePOCount} PO Jasa
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>
                SO Terbuka: {readiness.procurement.service.openServiceOrderCount}
              </div>
              <div className={styles.domainBoxSub}>
                Sisa Scope: {formatCurrencyValue(readiness.procurement.service.remainingServiceScope)}
              </div>
            </div>

            {/* 7. Service Claims */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Klaim Jasa (Claims)</span>
                <Tag color={readiness.serviceClaims.pendingClaimCount === 0 ? 'green' : 'orange'}>
                  {readiness.serviceClaims.pendingClaimCount === 0 ? 'Lengkap' : 'Ada Pending'}
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>{readiness.serviceClaims.pendingClaimCount} Pending Klaim</div>
              <div className={styles.domainBoxSub}>
                Belum diinvoicing: {readiness.serviceClaims.approvedUninvoicedCount}
              </div>
            </div>

            {/* 8. Vendor AP */}
            <div className={styles.domainBox}>
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Hutang Vendor (AP)</span>
                <Tag color={readiness.finance.vendorAP.unpaidVendorInvoiceCount === 0 ? 'green' : 'orange'}>
                  {readiness.finance.vendorAP.unpaidVendorInvoiceCount === 0 ? 'Lunas' : 'Belum Lunas'}
                </Tag>
              </div>
              <div className={styles.domainBoxMain}>
                {readiness.finance.vendorAP.unpaidVendorInvoiceCount} Tagihan Belum Lunas
              </div>
              <div className={styles.domainBoxSub}>
                Outstanding: {formatCurrencyValue(readiness.finance.vendorAP.outstandingVendorPayable)}
              </div>
            </div>

            {/* 9. Customer AR (Strictly NOT MODELED) */}
            <div className={styles.domainBox} data-testid="domain-customer-ar">
              <div className={styles.domainBoxHeader}>
                <span className={styles.domainBoxTitle}>Piutang Klien (AR)</span>
                <Tag color="default">N/A</Tag>
              </div>
              <div className={styles.domainBoxMain} style={{ color: '#64748B' }}>
                Belum dimodelkan / N/A
              </div>
              <div className={styles.domainBoxSub}>Tidak dihitung sebagai blocker sistem</div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Closure Historical Cycles */}
      {closureHistory.length > 0 && (
        <div className={styles.cardSection} data-testid="closure-history-section">
          <div className={styles.titleArea}>
            <h2>
              <ClockCircleOutlined style={{ color: '#2563EB' }} />
              Riwayat Siklus Penutupan Proyek ({closureHistory.length} Siklus)
            </h2>
            <p>Daftar seluruh riwayat pengajuan, tinjauan Head of Operations, dan keputusan Direktur.</p>
          </div>

          <div style={{ marginTop: 16 }}>
            <Timeline
              items={[...closureHistory]
                .reverse() // Descending order for user display (latest cycle on top)
                .map((cycle) => ({
                  color:
                    cycle.status === 'APPROVED'
                      ? 'green'
                      : cycle.status === 'RETURNED'
                      ? 'red'
                      : 'blue',
                  children: (
                    <div key={`cycle-${cycle.id}`} className={styles.historyCycleCard} data-testid="history-cycle-card">
                      <div className={styles.historyHeader}>
                        <div className={styles.historyCycleTitle}>
                          Siklus #{cycle.cycleNumber} — {cycle.status}
                        </div>
                        <Tag
                          color={
                            cycle.status === 'APPROVED'
                              ? 'green'
                              : cycle.status === 'RETURNED'
                              ? 'red'
                              : 'blue'
                          }
                        >
                          {cycle.status}
                        </Tag>
                      </div>

                      <div className={styles.historyGrid}>
                        <div>
                          <strong>Diajukan Oleh:</strong> {cycle.submittedBy?.fullName || cycle.submittedBy?.email || 'PM'}
                          <br />
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            {formatClosureDate(cycle.submittedAt)}
                          </span>
                        </div>

                        {cycle.hooReviewer && (
                          <div>
                            <strong>Review HOO:</strong> {cycle.hooReviewer?.fullName || cycle.hooReviewer?.email}
                            <br />
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {formatClosureDate(cycle.hooReviewedAt)}
                            </span>
                            {cycle.hooNotes && (
                              <div style={{ fontStyle: 'italic', marginTop: 2 }}>"{cycle.hooNotes}"</div>
                            )}
                          </div>
                        )}

                        {cycle.directorApprover && (
                          <div>
                            <strong>Persetujuan Direktur:</strong>{' '}
                            {cycle.directorApprover?.fullName || cycle.directorApprover?.email}
                            <br />
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {formatClosureDate(cycle.directorApprovedAt)}
                            </span>
                            {cycle.directorNotes && (
                              <div style={{ fontStyle: 'italic', marginTop: 2 }}>"{cycle.directorNotes}"</div>
                            )}
                          </div>
                        )}
                      </div>

                      {cycle.submissionNotes && (
                        <div style={{ fontSize: 12, marginTop: 8, color: '#475569' }}>
                          <strong>Catatan Pengajuan:</strong> {cycle.submissionNotes}
                        </div>
                      )}

                      {cycle.status === 'RETURNED' && cycle.returnReason && (
                        <div className={styles.returnedReasonBox} data-testid="history-returned-reason">
                          <strong>Alasan Pengembalian ({cycle.returnRole || 'Manajemen'}):</strong> {cycle.returnReason}
                        </div>
                      )}
                    </div>
                  ),
                }))}
            />
          </div>
        </div>
      )}

      {/* PM Submit / Resubmit Confirmation Modal */}
      <Modal
        title={
          actionability.canResubmit
            ? 'Konfirmasi Pengajuan Ulang Penutupan Proyek'
            : 'Konfirmasi Pengajuan Penutupan Proyek'
        }
        open={isSubmitModalOpen}
        onCancel={() => {
          if (!submitting) {
            setIsSubmitModalOpen(false);
            setSubmissionNotes('');
          }
        }}
        confirmLoading={submitting}
        okButtonProps={{ disabled: submitting }}
        cancelButtonProps={{ disabled: submitting }}
        onOk={handleSubmitClosure}
        okText={actionability.canResubmit ? 'Kirim Pengajuan Ulang' : 'Kirim Pengajuan'}
        cancelText="Batal"
        width={560}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Alert
            type="info"
            showIcon
            message="Alur Persetujuan Manajemen"
            description={
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                <li>Pengajuan penutupan akan diteruskan terlebih dahulu ke Head of Operations untuk peninjauan teknis.</li>
                <li>Setelah disetujui HOO, pengajuan akan diteruskan ke Direktur untuk persetujuan formal akhir.</li>
                <li>Proyek tetap berada dalam status IN_PROGRESS hingga Direktur menyetujui penutupan secara definitif.</li>
              </ul>
            }
          />

          {actionability.canResubmit && currentClosure?.returnReason && (
            <div className={styles.returnedReasonBox}>
              <strong>Alasan Pengembalian Siklus Sebelumnya:</strong>
              <div>{currentClosure.returnReason}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: '#475569' }}>
                Pengajuan ulang ini akan membentuk siklus baru (Cycle #{(currentClosure.cycleNumber || 1) + 1}).
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Catatan Pengajuan (Opsional)
            </label>
            <TextArea
              rows={3}
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Tambahkan catatan ringkasan atau keterangan penyelesaian pekerjaan..."
              maxLength={1000}
              showCount
              disabled={submitting}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectClosureWorkspace;
