'use client';

import React from 'react';
import { Card, Button, Space, Typography, Tag, Tooltip, Badge, Dropdown, MenuProps} from 'antd';
import {
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FormOutlined,
  SendOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  MoreOutlined,
  FireOutlined,
  BankOutlined,
  ProjectOutlined,
  DollarOutlined,
} from '@ant-design/icons';

import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';

const { Title, Text } = Typography;

interface LegalWorkstationHeaderProps {
  contractNumber?: string;
  customerName?: string;
  projectName?: string;
  nominal?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  slaDeadline?: string;
  status?: string;
  isFormValid?: boolean;
  autosaveStatus?: 'saved' | 'saving' | 'dirty';
  lastSavedTime?: string;
  onSaveDraft: () => void;
  onApprove: () => void;
  onApproveWithNotes: () => void;
  onRequestRevision: () => void;
  onEscalate: () => void;
  onForward: () => void;
  onCancel: () => void;
  onReject?: () => void;
  canReview?: boolean;
}

export const LegalWorkstationHeader: React.FC<LegalWorkstationHeaderProps> = ({
  contractNumber = 'CONT-20260724-0001',


  customerName = 'J&T Express',
  projectName = 'Pengadaan Server & Infrastructure EPMS',
  nominal = 50000000,
  priority = 'HIGH',
  slaDeadline = 'SLA: 2 Jam Sisa',
  status = 'WAITING',
  isFormValid = false,
  autosaveStatus = 'saved',
  lastSavedTime,
  onSaveDraft,
  onApprove,
  onApproveWithNotes,
  onRequestRevision,
  onEscalate,
  onForward,
  onCancel,
  onReject,
  canReview = true,
}) => {
  const moreMenuItems: MenuProps['items'] = [
    {
      key: 'approve_notes',
      icon: <FormOutlined style={{ color: '#3370ff' }} />,
      label: 'Setujui dengan Catatan Khusus',
      onClick: onApproveWithNotes,
    },
    {
      key: 'forward',
      icon: <SendOutlined style={{ color: '#722ed1' }} />,
      label: 'Teruskan ke Senior Legal',
      onClick: onForward,
    },
    {
      key: 'escalate',
      icon: <WarningOutlined style={{ color: '#ff8800' }} />,
      label: 'Eskalasi ke Direksi / Manajemen',
      onClick: onEscalate,
    },
    {
      type: 'divider',
    },
    {
      key: 'reject',
      icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
      label: 'Tolak Kontrak (Reject)',
      danger: true,
      onClick: onReject || onCancel,
    },
    {
      key: 'cancel',
      label: 'Batalkan Peninjauan Dokumen',
      onClick: onCancel,
    },
  ];

  const renderAutosaveBadge = () => {
    switch (autosaveStatus) {
      case 'saving':
        return <Badge status="processing" text={<Text type="secondary" style={{ fontSize: 11, color: '#8f959e' }}>Menyimpan draft...</Text>} />;
      case 'dirty':
        return <Badge status="warning" text={<Text type="warning" style={{ fontSize: 11 }}>Ada perubahan</Text>} />;
      case 'saved':
      default:
        return (
          <span style={{ fontSize: 11, color: '#8f959e', backgroundColor: '#f2f3f5', padding: '2px 8px', borderRadius: 10 }}>
            Tersimpan {lastSavedTime || '1m lalu'}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. RINGKASAN KONTRAK */}
      <div style={{
        background: '#ffffff',
        borderRadius: 10,
        border: '1px solid #dee0e3',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '10px 14px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Ringkasan Kontrak
          </span>
          {priority === 'HIGH' ? (
            <Tag style={{ borderRadius: 10, color: '#f53f3f', backgroundColor: '#ffece6', border: 'none', fontWeight: 700, fontSize: 10, margin: 0 }}>HIGH</Tag>
          ) : (
            <Tag style={{ borderRadius: 10, color: '#0284c7', backgroundColor: '#e0f2fe', border: 'none', fontWeight: 600, fontSize: 10, margin: 0 }}>{priority || 'MEDIUM'}</Tag>
          )}
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>No. Kontrak</Text>
            <Text strong style={{ color: '#0f172a', fontSize: 12 }}>{contractNumber}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>SLA</Text>
            <Tag color="cyan" style={{ borderRadius: 4, margin: 0, fontSize: 11, fontWeight: 600, border: 'none' }}>
              {slaDeadline || '24 Jam Sisa'}
            </Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>Disimpan</Text>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {lastSavedTime ? `${lastSavedTime} WIB` : '09:06 WIB'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>Klien</Text>
            <Text strong style={{ color: '#334155', fontSize: 12, maxWidth: 180, textAlign: 'right' }} ellipsis={{ tooltip: customerName }}>
              {customerName}
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>Proyek</Text>
            <Text style={{ color: '#334155', fontSize: 12, maxWidth: 180, textAlign: 'right' }} ellipsis={{ tooltip: projectName }}>
              {projectName}
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>Status Dokumen</Text>
            <StatusBadge domain="legal" status={status} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>Nilai</Text>
            <Text strong style={{ fontSize: 13, color: '#059669' }}>
              {formatCurrency(nominal)}
            </Text>
          </div>
        </div>
      </div>

      {/* 2. AKSI REVIEW */}
      <div style={{
        background: '#ffffff',
        borderRadius: 10,
        border: '1px solid #dee0e3',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '10px 14px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Aksi Review
          </span>
          {renderAutosaveBadge()}
        </div>

        {canReview ? (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Tooltip title="Simpan draft sementara (Ctrl+S)">
                <Button size="middle" style={{ borderRadius: 6, fontSize: 12, fontWeight: 500 }} icon={<SaveOutlined />} onClick={onSaveDraft}>
                  Simpan
                </Button>
              </Tooltip>

              <Tooltip title="Minta revisi klausul/dokumen ke tim Marketing">
                <Button
                  size="middle"
                  style={{ borderRadius: 6, fontSize: 12, color: '#d97706', borderColor: '#fcd34d', backgroundColor: '#fffbe6', fontWeight: 600 }}
                  icon={<CloseCircleOutlined style={{ color: '#d97706' }} />}
                  onClick={onRequestRevision}
                >
                  Revisi
                </Button>
              </Tooltip>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {(() => {
                const isRevisionPending = status === 'REVISION' || status === 'REVISION_NEEDED' || status === 'REVISION_REQUESTED';
                const tooltipTitle = isRevisionPending
                  ? 'Menunggu dokumen revisi dari Marketing'
                  : !isFormValid
                  ? 'Selesaikan seluruh 10 checklist terlebih dahulu'
                  : 'Setujui Kontrak (Ctrl+Enter)';
                const canApprove = isFormValid && !isRevisionPending;

                return (
                  <Tooltip title={tooltipTitle} style={{ flex: 1 }}>
                    <Button
                      size="middle"
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      disabled={!canApprove}
                      onClick={onApprove}
                      style={{
                        flex: 1,
                        backgroundColor: canApprove ? '#00b578' : undefined,
                        borderColor: canApprove ? '#00b578' : undefined,
                        fontWeight: 600,
                        borderRadius: 6,
                        fontSize: 12,
                        boxShadow: canApprove ? '0 2px 6px rgba(0, 181, 120, 0.25)' : undefined,
                      }}
                    >
                      Setujui & Rilis
                    </Button>
                  </Tooltip>
                );
              })()}

              <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
                <Button size="middle" style={{ borderRadius: 6 }} icon={<MoreOutlined />} />
              </Dropdown>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 14px', textAlign: 'center' }}>
            <Tag color="default" style={{ width: '100%', padding: '6px 0', fontSize: 11, margin: 0 }}>
              Mode Observasi (Read-Only)
            </Tag>
          </div>
        )}
      </div>
    </div>
  );
};
