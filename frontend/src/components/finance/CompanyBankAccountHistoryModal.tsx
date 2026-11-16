"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Timeline, Typography, Tag, Spin, Empty, Button } from 'antd';
import { HistoryOutlined, CheckCircleOutlined, CloseCircleOutlined, StopOutlined, StarOutlined, EditOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { FinanceService, CompanyBankAccountDto } from '@/services/finance.service';
import { formatDateTime } from '@/lib/formatters';

const { Text } = Typography;

interface CompanyBankAccountHistoryModalProps {
  open: boolean;
  onClose: () => void;
  account: CompanyBankAccountDto | null;
}

export const CompanyBankAccountHistoryModal: React.FC<CompanyBankAccountHistoryModalProps> = ({
  open,
  onClose,
  account,
}) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['finance', 'company-bank-account-history', account?.id],
    queryFn: () => (account ? FinanceService.getCompanyBankAccountHistory(account.id) : Promise.resolve([])),
    enabled: open && Boolean(account?.id),
    staleTime: 5000,
  });

  const getActionTag = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Tag color="green" icon={<PlusCircleOutlined />}>BUAT BARU</Tag>;
      case 'UPDATE':
        return <Tag color="blue" icon={<EditOutlined />}>PEMBARUAN</Tag>;
      case 'ACTIVATE':
        return <Tag color="success" icon={<CheckCircleOutlined />}>AKTIVASI</Tag>;
      case 'DEACTIVATE':
        return <Tag color="warning" icon={<CloseCircleOutlined />}>NONAKTIF</Tag>;
      case 'BLOCK':
        return <Tag color="error" icon={<StopOutlined />}>BLOKIR</Tag>;
      case 'SET_DEFAULT':
        return <Tag color="gold" icon={<StarOutlined />}>REKENING UTAMA</Tag>;
      default:
        return <Tag>{action}</Tag>;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HistoryOutlined style={{ color: '#0284c7' }} />
          <span>
            Riwayat Audit Perubahan — {account?.bankName} ({account?.accountNumber})
          </span>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose} style={{ borderRadius: 6 }}>
          Tutup
        </Button>,
      ]}
      width={680}
      destroyOnClose
    >
      <div style={{ padding: '12px 0' }}>
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
          <div><strong>Entitas:</strong> {account?.companyCode === 'TVM' ? 'PT TVM' : 'PT UBD'}</div>
          <div><strong>Nama Bank &amp; Rekening:</strong> {account?.bankName} — {account?.accountNumber} (a/n {account?.accountHolderName})</div>
          <div><strong>Status Saat Ini:</strong> {account?.status} {account?.isDefault ? '(Rekening Utama)' : ''}</div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin tip="Memuat riwayat perubahan..." />
          </div>
        ) : logs.length === 0 ? (
          <Empty description="Belum ada riwayat audit yang tercatat untuk rekening ini." />
        ) : (
          <Timeline
            mode="left"
            style={{ marginTop: 20 }}
            items={logs.map((log: any) => {
              const changeReason = log.new_value?.changeReason || log.new_value?.lastChangeReason || '—';
              return {
                key: log.id,
                label: (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatDateTime(log.created_at)}
                  </Text>
                ),
                children: (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {getActionTag(log.action)}
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        oleh User #{log.created_by || 'Sistem'}
                      </Text>
                    </div>
                    <div style={{ fontSize: 12, color: '#334155', background: '#f1f5f9', padding: '6px 10px', borderRadius: 4, marginTop: 4 }}>
                      <strong>Alasan Perubahan:</strong> {changeReason}
                    </div>
                  </div>
                ),
              };
            })}
          />
        )}
      </div>
    </Modal>
  );
};
