'use client';

import React from 'react';
import { Card, Button, Space, Typography, Tag, Tooltip, Badge, Dropdown, MenuProps, Divider } from 'antd';
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
      key: 'cancel',
      label: 'Batalkan Peninjauan Dokumen',
      danger: true,
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
    <Card
      style={{
        borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        position: 'sticky',
        top: 0,
        zIndex: 25,
        border: '1px solid #dee0e3',
        backgroundColor: '#ffffff',
      }}
      bodyStyle={{ padding: '12px 18px' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Metadata Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Title level={5} style={{ margin: 0, color: '#1f2329', fontWeight: 700 }}>
              {contractNumber}
            </Title>
            {priority === 'HIGH' && (
              <Tag style={{ borderRadius: 12, color: '#f53f3f', backgroundColor: '#ffece6', border: 'none', fontWeight: 700, fontSize: 10 }}>HIGH</Tag>
            )}
            <Tag style={{ borderRadius: 12, color: '#3370ff', backgroundColor: '#e8f3ff', border: 'none', fontWeight: 600, fontSize: 11 }}>{slaDeadline}</Tag>
            {renderAutosaveBadge()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#646a73', fontSize: 12 }}>
            <span>🏢 <strong>Klien:</strong> <Text style={{ color: '#1f2329' }}>{customerName}</Text></span>
            <span>📦 <strong>Proyek:</strong> <Text style={{ color: '#1f2329' }}>{projectName}</Text></span>
            <span>💰 <strong>Nilai:</strong>{' '}
              <Text strong style={{ fontSize: 13, color: '#00b578' }}>
                Rp {Number(nominal || 0).toLocaleString('id-ID')}
              </Text>
            </span>
          </div>

        </div>

        {/* Action Buttons Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Space size={6} style={{ width: '100%' }}>
            <Tooltip title="Simpan draft sementara (Ctrl+S)">
              <Button size="middle" style={{ borderRadius: 6, fontSize: 12, width: '100%' }} icon={<SaveOutlined />} onClick={onSaveDraft}>
                Simpan
              </Button>
            </Tooltip>

            <Button
              size="middle"
              style={{ borderRadius: 6, fontSize: 12, color: '#d97706', borderColor: '#fcd34d', backgroundColor: '#fffbe6', fontWeight: 600, width: '100%' }}
              icon={<CloseCircleOutlined style={{ color: '#d97706' }} />}
              onClick={onRequestRevision}
            >
              Revisi
            </Button>
          </Space>

          <Space size={6} style={{ width: '100%', marginTop: 4 }}>
            <Tooltip title={!isFormValid ? 'Selesaikan 10 checklist terlebih dahulu' : 'Setujui Kontrak (Ctrl+Enter)'}>
              <Button
                size="middle"
                type="primary"
                block
                icon={<CheckCircleOutlined />}
                disabled={!isFormValid}
                onClick={onApprove}
                style={{
                  backgroundColor: isFormValid ? '#00b578' : undefined,
                  borderColor: isFormValid ? '#00b578' : undefined,
                  fontWeight: 600,
                  borderRadius: 6,
                  fontSize: 12,
                  boxShadow: isFormValid ? '0 2px 6px rgba(0, 181, 120, 0.25)' : undefined,
                }}
              >
                Setujui & Rilis
              </Button>
            </Tooltip>

            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
              <Button size="middle" style={{ borderRadius: 6 }} icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        </div>

      </div>
    </Card>
  );
};
