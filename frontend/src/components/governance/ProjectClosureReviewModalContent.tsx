'use client';

import React from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Alert,
  Space,
  Button,
  Divider,
} from 'antd';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { EnrichedGovernanceTask } from './ProjectGovernanceTaskCenter';
import { ClosureStageInfo, resolveClosureModalReadiness } from './projectGovernanceClosure.utils';

const { Text, Title } = Typography;

export interface ProjectClosureReviewModalContentProps {
  task: EnrichedGovernanceTask;
  closureData: any;
  closureReadiness: any;
  stageInfo: ClosureStageInfo | null;
  canUserDecideTask: boolean;
  userRoles: string[];
}

export const ProjectClosureReviewModalContent: React.FC<
  ProjectClosureReviewModalContentProps
> = ({
  task,
  closureData,
  closureReadiness,
  stageInfo,
  canUserDecideTask,
  userRoles,
}) => {
  const model = resolveClosureModalReadiness({
    closureReadiness,
    closureData,
    task,
  });

  const {
    isReady,
    verdictLabel,
    overallProgress,
    isPhysicalComplete,
    bastPresent,
    finalReportPresent,
    customerName,
    cycleNumber,
    pmSubmitter,
    submittedAt,
    submissionNotes,
    returnedReason,
    effectiveBastDoc,
    effectiveFinalReportDoc,
    openMaterialPRCount,
    unfulfilledMaterialPOCount,
    isProcurementClear,
    pendingServiceClaimCount,
    isClaimsClear,
    unpaidVendorInvoiceCount,
    isInvoicesClear,
    pendingPaymentRequestCount,
    isPaymentsClear,
    openIssuesCount,
    activeRisksCount,
    isIssuesRisksClear,
    blockers,
    warnings,
  } = model;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
      {/* 1. Status Alert Banner with Stage and Deep-Link */}
      <Alert
        type="info"
        showIcon
        message={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span>
              <strong>Tahap Alur Kerja:</strong> {stageInfo?.label || task.nodeId}
            </span>
            <Button
              type="primary"
              size="small"
              icon={<ApartmentOutlined />}
              href={`/project-delivery?view=workspace&projectId=${task.projectId}&section=closure`}
              style={{ fontWeight: 600, borderRadius: 4 }}
            >
              Buka Project Closure
            </Button>
          </div>
        }
        description={
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            <div>
              Tahap selanjutnya setelah disetujui:{' '}
              <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>
                {stageInfo?.nextNodeLabel || 'Tahap Berikutnya'}
              </Tag>
            </div>
            {submissionNotes && (
              <div style={{ marginTop: 4, fontStyle: 'italic', color: '#475569' }}>
                Catatan Pengajuan PM: &quot;{submissionNotes}&quot;
              </div>
            )}
          </div>
        }
        style={{ borderRadius: 6 }}
      />

      {/* 2. Read-Only Notice for Monitoring Roles */}
      {!canUserDecideTask && (
        <Alert
          type="warning"
          showIcon
          message="Akses Pemantauan (Read-Only)"
          description={`Anda login dengan peran [${userRoles.join(
            ', ',
          )}]. Tugas ini berada pada tahap ${stageInfo?.label} yang memerlukan wewenang peran ${
            stageInfo?.requiredRoleLabel || stageInfo?.requiredRole
          }. Anda dapat meninjau seluruh data penutupan, namun keputusan persetujuan/perbaikan hanya dapat dilakukan oleh peran yang berwenang.`}
          style={{ borderRadius: 6 }}
        />
      )}

      {/* 3. SECTION 1: Context & Closure Cycle Information */}
      <Card
        size="small"
        title={
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
            Konteks Proyek & Pengajuan Penutupan
          </span>
        }
        style={{
          borderRadius: 6,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <Row gutter={[16, 10]}>
          <Col span={8}>
            <Text type="secondary">Kode Proyek:</Text>{' '}
            <Tag
              color="blue"
              style={{ fontFamily: 'monospace', fontSize: 11, margin: 0 }}
            >
              {task.projectCode}
            </Tag>
          </Col>
          <Col span={8}>
            <Text type="secondary">Ref ID Proyek:</Text>{' '}
            <strong>#{task.projectId}</strong>
          </Col>
          <Col span={8}>
            <Text type="secondary">Siklus Penutupan:</Text>{' '}
            <Tag color="cyan" style={{ fontWeight: 600, fontSize: 11, margin: 0 }}>
              Siklus #{cycleNumber}
            </Tag>
          </Col>
          <Col span={8}>
            <Text type="secondary">Diajukan Oleh:</Text>{' '}
            <strong>
              <UserOutlined style={{ marginRight: 4, color: '#64748b' }} />
              {pmSubmitter}
            </strong>
          </Col>
          <Col span={8}>
            <Text type="secondary">Waktu Pengajuan:</Text>{' '}
            <strong>
              <ClockCircleOutlined style={{ marginRight: 4, color: '#64748b' }} />
              {submittedAt
                ? dayjs(submittedAt).format('DD MMM YYYY · HH:mm')
                : 'Belum tersedia'}
            </strong>
          </Col>
          <Col span={8}>
            <Text type="secondary">Customer:</Text>{' '}
            <strong>{customerName}</strong>
          </Col>
        </Row>
      </Card>

      {/* 4. Previous Return Banner if present */}
      {returnedReason && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Catatan Pengembalian / Revisi Sebelumnya"
          description={returnedReason}
          style={{ borderRadius: 6 }}
        />
      )}

      {/* 5. Authoritative Live Readiness Snapshot */}
      <Card
        size="small"
        title={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>
              Status Kesiapan Penutupan (Authoritative Backend Verdict)
            </span>
            <Tag
              color={isReady ? 'success' : 'error'}
              style={{ fontWeight: 700, fontSize: 11.5, padding: '2px 8px' }}
            >
              {verdictLabel}
            </Tag>
          </div>
        }
        style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Evaluasi authoritative live backend terhadap 9 domain bisnis penutupan proyek:
          </Text>
        </div>

        {/* 9-Domain Grid Summary */}
        <Row gutter={[12, 12]}>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                1. Operasional (Progress Fisik):
              </Text>
              <div>
                {isPhysicalComplete ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Selesai {overallProgress}%
                  </Tag>
                ) : (
                  <Tag color="warning">
                    <ClockCircleOutlined /> Progress {overallProgress}%
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                2. BAST Dokumen:
              </Text>
              <div>
                {bastPresent ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Tersedia (BAST)
                  </Tag>
                ) : (
                  <Tag color="error">
                    <CloseCircleOutlined /> Belum Ada BAST
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                3. Final Report:
              </Text>
              <div>
                {finalReportPresent ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Tersedia (Laporan)
                  </Tag>
                ) : (
                  <Tag color="error">
                    <CloseCircleOutlined /> Belum Ada Laporan
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                4. Pengadaan Material & PO:
              </Text>
              <div>
                {isProcurementClear ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Semua PO/PR Terpenuhi
                  </Tag>
                ) : (
                  <Tag color="warning">
                    {unfulfilledMaterialPOCount} PO Terbuka / {openMaterialPRCount} PR
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                5. Klaim Jasa:
              </Text>
              <div>
                {isClaimsClear ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Semua Klaim Selesai
                  </Tag>
                ) : (
                  <Tag color="warning">
                    {pendingServiceClaimCount} Klaim Belum Selesai
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                6. Tagihan Vendor (AP):
              </Text>
              <div>
                {isInvoicesClear ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Semua Lunas
                  </Tag>
                ) : (
                  <Tag color="warning">
                    {unpaidVendorInvoiceCount} Belum Lunas
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                7. Pembayaran Vendor:
              </Text>
              <div>
                {isPaymentsClear ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Selesai
                  </Tag>
                ) : (
                  <Tag color="warning">
                    {pendingPaymentRequestCount} Menunggu Pembayaran
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                8. Masalah & Risiko:
              </Text>
              <div>
                {isIssuesRisksClear ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> 0 Terbuka / Aman
                  </Tag>
                ) : (
                  <Tag color="warning">
                    {openIssuesCount} Isu, {activeRisksCount} Risiko
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Text strong style={{ fontSize: 11.5 }}>
                9. Piutang Pelanggan (Customer AR):
              </Text>
              <div>
                <Tag color="default">Belum dimodelkan / N/A</Tag>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Blockers & Warnings */}
        {blockers && blockers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type="error"
              showIcon
              message={`Penghalang Penutupan (${blockers.length} Item)`}
              description={
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {blockers.map((b: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      <strong>{b.domain || b.code}:</strong> {b.message || b.reason}
                    </li>
                  ))}
                </ul>
              }
              style={{ borderRadius: 6 }}
            />
          </div>
        )}

        {warnings && warnings.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Alert
              type="warning"
              showIcon
              message={`Peringatan (${warnings.length} Item)`}
              description={
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {warnings.map((w: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      <strong>{w.domain || w.code}:</strong> {w.message || w.reason}
                    </li>
                  ))}
                </ul>
              }
              style={{ borderRadius: 6 }}
            />
          </div>
        )}
      </Card>

      {/* 6. Document Evidence Cards */}
      <Card
        size="small"
        title={
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
            Bukti Dokumen Wajib (Evidence Documents)
          </span>
        }
        style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card
              size="small"
              style={{
                background: effectiveBastDoc ? '#f0fdf4' : '#fff7ed',
                borderColor: effectiveBastDoc ? '#bbf7d0' : '#fed7aa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined
                  style={{ fontSize: 20, color: effectiveBastDoc ? '#16a34a' : '#ea580c' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    Berita Acara Serah Terima (CUSTOMER_BAST)
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {effectiveBastDoc?.fileName || effectiveBastDoc?.name || 'Dokumen belum diunggah'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {effectiveBastDoc ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Dokumen Tersedia
                  </Tag>
                ) : (
                  <Tag color="error">
                    <CloseCircleOutlined /> Wajib Diunggah
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card
              size="small"
              style={{
                background: effectiveFinalReportDoc ? '#f0fdf4' : '#fff7ed',
                borderColor: effectiveFinalReportDoc ? '#bbf7d0' : '#fed7aa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined
                  style={{
                    fontSize: 20,
                    color: effectiveFinalReportDoc ? '#16a34a' : '#ea580c',
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    Laporan Akhir Proyek (FINAL_REPORT)
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {effectiveFinalReportDoc?.fileName ||
                      effectiveFinalReportDoc?.name ||
                      'Dokumen belum diunggah'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {effectiveFinalReportDoc ? (
                  <Tag color="success">
                    <CheckCircleOutlined /> Dokumen Tersedia
                  </Tag>
                ) : (
                  <Tag color="error">
                    <CloseCircleOutlined /> Wajib Diunggah
                  </Tag>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ProjectClosureReviewModalContent;
