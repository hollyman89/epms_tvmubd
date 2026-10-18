'use client';

import React, { useState } from 'react';
import {
  Modal,
  Typography,
  Descriptions,
  Table,
  Button,
  Space,
  Form,
  Input,
  InputNumber,
  Radio,
  Tabs,
  Alert,
  Spin,
  Tag,
  Divider,
  message,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ExclamationCircleFilled,
  CheckCircleOutlined,
  StopOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ProcurementService,
  UnresolvedReconciliationItem,
  ReconciliationCandidateCostItem,
} from '@/services/procurement.service';
import { useAuth } from '@/context/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export interface ReconciliationItemModalProps {
  open: boolean;
  onClose: () => void;
  prItemId: number | null;
  onSuccess?: () => void;
}

export const ReconciliationItemModal: React.FC<ReconciliationItemModalProps> = ({
  open,
  onClose,
  prItemId,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { user, isProcurement } = useAuth();
  // Mutation roles following actual backend controller: PROCUREMENT, PURCHASING
  const userRoles = (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
  const canMutate =
    isProcurement ||
    userRoles.includes('PURCHASING');

  const [activeTab, setActiveTab] = useState<'reconcile' | 'exclude'>('reconcile');
  const [selectedCostItemId, setSelectedCostItemId] = useState<number | null>(null);
  const [reconcileForm] = Form.useForm();
  const [excludeForm] = Form.useForm();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['procurement', 'reconciliation-item', prItemId],
    queryFn: () => ProcurementService.getReconciliationDetail(prItemId!),
    enabled: Boolean(open && prItemId && prItemId > 0),
    staleTime: 10 * 1000,
  });

  const prItem = detail?.prItem;
  const candidates: ReconciliationCandidateCostItem[] = detail?.candidateCostItems || [];

  const handleReconcileSubmit = async () => {
    if (!prItemId || !selectedCostItemId) {
      message.error('Silakan pilih salah satu target CostItem dari RAB aktif.');
      return;
    }

    try {
      const values = await reconcileForm.validateFields();
      setSubmitting(true);
      await ProcurementService.reconcileItem(prItemId, {
        targetCostItemId: selectedCostItemId,
        mappedQuantity: values.mappedQuantity !== undefined ? Number(values.mappedQuantity) : undefined,
        mappedAmount: values.mappedAmount !== undefined ? Number(values.mappedAmount) : undefined,
        matchType: values.matchType || 'MANUAL_MAPPING',
        notes: values.notes,
      });

      message.success(`Item PR #${prItemId} berhasil direkonsiliasi ke CostItem #${selectedCostItemId}!`);
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliations'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliation-item', prItemId] });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal merekonsiliasi item.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcludeSubmit = async () => {
    if (!prItemId) return;
    try {
      const values = await excludeForm.validateFields();
      setSubmitting(true);
      await ProcurementService.excludeItem(prItemId, {
        reason: values.reason.trim(),
        notes: values.notes?.trim(),
      });

      message.success(`Item PR #${prItemId} berhasil dieksklusi dari quota RAB proyek!`);
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliations'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliation-item', prItemId] });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengeksklusi item.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const candidateColumns = [
    {
      title: 'Pilih',
      key: 'select',
      width: 60,
      align: 'center' as const,
      render: (_: any, r: ReconciliationCandidateCostItem) => (
        <Radio
          checked={selectedCostItemId === r.costItem.id}
          onChange={() => setSelectedCostItemId(r.costItem.id)}
          disabled={!canMutate}
        />
      ),
    },
    {
      title: 'Item RAB',
      key: 'itemName',
      render: (_: any, r: ReconciliationCandidateCostItem) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.costItem.itemName}</div>
          <Space size={4} style={{ marginTop: 2 }}>
            <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>ID #{r.costItem.id}</Tag>
            <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>{r.costItem.categoryKey}</Tag>
          </Space>
        </div>
      ),
    },
    {
      title: 'WBS',
      key: 'wbs',
      width: 140,
      render: (_: any, r: ReconciliationCandidateCostItem) => (
        <span style={{ fontSize: 11.5, color: '#475569' }}>
          {r.costItem.wbs?.task_name || r.costItem.wbs?.wbs_code || '—'}
        </span>
      ),
    },
    {
      title: 'Baseline RAB',
      key: 'baseline',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: ReconciliationCandidateCostItem) => (
        <span style={{ fontSize: 12 }}>
          {Number(r.costItem.quantity || 0).toLocaleString('id-ID')} {r.costItem.uom}
        </span>
      ),
    },
    {
      title: 'Sisa Kuota (Available)',
      key: 'available',
      width: 130,
      align: 'right' as const,
      render: (_: any, r: ReconciliationCandidateCostItem) => {
        const avail = Number(r.availableQty || 0);
        const rawRem = Number(r.rawRemainingQty || 0);
        const hasOverrun = rawRem < 0;

        return (
          <div>
            <div style={{ fontWeight: 700, color: avail > 0 ? '#059669' : '#dc2626' }}>
              {avail.toLocaleString('id-ID')} {r.costItem.uom}
            </div>
            {hasOverrun && (
              <Tag color="volcano" style={{ fontSize: 9.5, margin: 0 }}>
                Overrun: {Math.abs(rawRem).toLocaleString('id-ID')}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Harga Satuan',
      key: 'unitPrice',
      width: 120,
      align: 'right' as const,
      render: (_: any, r: ReconciliationCandidateCostItem) => (
        <span style={{ fontSize: 11.5 }}>
          Rp {Number(r.costItem.unitPrice || 0).toLocaleString('id-ID')}
        </span>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(920px, 95vw)"
      centered
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            Rekonsiliasi Item Pengadaan #{prItemId}
          </span>
        </Space>
      }
      footer={null}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" tip="Memuat rincian item & kandidat RAB..." />
        </div>
      ) : isError ? (
        <Alert
          type="error"
          message="Gagal memuat rincian rekonsiliasi"
          description={(error as any)?.response?.data?.message || (error as any)?.message}
          action={<Button size="small" onClick={() => refetch()}>Coba Lagi</Button>}
        />
      ) : !detail ? (
        <Alert type="warning" message="Data tidak ditemukan." />
      ) : (
        <div>
          {!canMutate && (
            <Alert
              type="info"
              message="Mode Read-Only"
              description="Hanya tim Procurement / Purchasing dan Super Admin / Admin yang memiliki wewenang untuk melakukan mutasi rekonsiliasi atau eksklusi."
              showIcon
              style={{ marginBottom: 14 }}
            />
          )}

          {/* Historical PR Item Card */}
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            style={{ marginBottom: 16 }}
            title={<span style={{ fontSize: 13, fontWeight: 700 }}>Rincian Item PR Historis</span>}
          >
            <Descriptions.Item label="Nomor PR">
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                {prItem?.purchaseRequest?.prNumber || `PR-${prItem?.prId}`}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Origin PR">
              <Tag color={prItem?.purchaseRequest?.origin === 'LEGACY' ? 'purple' : 'orange'} style={{ fontWeight: 700 }}>
                {prItem?.purchaseRequest?.origin || 'AD_HOC'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status PR">
              <Tag color="blue">{prItem?.purchaseRequest?.status || 'SUBMITTED'}</Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Nama Item" span={2}>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{prItem?.itemName}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Proyek">
              {prItem?.purchaseRequest?.project?.name || `Project #${prItem?.purchaseRequest?.projectId}`}
            </Descriptions.Item>

            <Descriptions.Item label="Jumlah Permintaan">
              <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
                {Number(prItem?.quantity || 0).toLocaleString('id-ID')} {prItem?.uom || 'Unit'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Estimasi Harga Satuan">
              Rp {Number(prItem?.estimatedUnitPrice || 0).toLocaleString('id-ID')}
            </Descriptions.Item>
            <Descriptions.Item label="Subtotal PR">
              <span style={{ fontWeight: 700, color: '#059669' }}>
                Rp {Number((prItem?.quantity || 0) * (prItem?.estimatedUnitPrice || 0)).toLocaleString('id-ID')}
              </span>
            </Descriptions.Item>
          </Descriptions>

          {/* Action Tabs: Reconcile vs Exclude */}
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as any)}
            items={[
              {
                key: 'reconcile',
                label: (
                  <Space>
                    <CheckCircleOutlined />
                    <span>Petakan ke Item RAB (Reconcile)</span>
                  </Space>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 10 }}>
                      <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                        Pilih Target CostItem dari RAB Aktif yang Disetujui:
                      </Text>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                        *Kandidat item hanya menampilkan item ber-mode ITEMIZED dengan kategori eligible pengadaan. Nilai Sisa Kuota diambil secara otoritatif dari server.
                      </div>
                    </div>

                    <Table
                      size="small"
                      columns={candidateColumns}
                      dataSource={candidates}
                      rowKey={(r) => r.costItem.id}
                      pagination={candidates.length > 5 ? { pageSize: 5 } : false}
                      style={{ marginBottom: 16 }}
                      onRow={(record) => ({
                        onClick: () => {
                          if (canMutate) {
                            setSelectedCostItemId(record.costItem.id);
                          }
                        },
                        style: {
                          cursor: canMutate ? 'pointer' : 'default',
                          background: selectedCostItemId === record.costItem.id ? '#f0fdf4' : undefined,
                        },
                      })}
                    />

                    {selectedCostItemId && (
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                        <Form
                          form={reconcileForm}
                          layout="vertical"
                          initialValues={{
                            mappedQuantity: prItem?.quantity,
                            mappedAmount: (prItem?.quantity || 0) * (prItem?.estimatedUnitPrice || 0),
                            matchType: 'MANUAL_MAPPING',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                            <Form.Item
                              label="Kuantitas Dipetakan"
                              name="mappedQuantity"
                              rules={[{ required: true, message: 'Kuantitas wajib diisi' }]}
                            >
                              <InputNumber min={0.0001} style={{ width: '100%' }} disabled={!canMutate} />
                            </Form.Item>

                            <Form.Item
                              label="Nilai Nominal Dipetakan (Rp)"
                              name="mappedAmount"
                            >
                              <InputNumber min={0} style={{ width: '100%' }} disabled={!canMutate} />
                            </Form.Item>

                            <Form.Item
                              label="Tipe Pencocokan"
                              name="matchType"
                            >
                              <Input disabled style={{ color: '#0f172a' }} />
                            </Form.Item>
                          </div>

                          <Form.Item label="Catatan Rekonsiliasi" name="notes">
                            <TextArea rows={2} placeholder="Tambahkan catatan justifikasi pemetaan item ke RAB..." disabled={!canMutate} />
                          </Form.Item>
                        </Form>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Button onClick={onClose}>Batal</Button>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        disabled={!selectedCostItemId || !canMutate}
                        loading={submitting}
                        onClick={handleReconcileSubmit}
                        style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                      >
                        Konfirmasi Rekonsiliasi ke RAB
                      </Button>
                    </div>
                  </div>
                ),
              },
              {
                key: 'exclude',
                label: (
                  <Space>
                    <StopOutlined />
                    <span>Eksklusi dari Kuota RAB (Exclude)</span>
                  </Space>
                ),
                children: (
                  <div>
                    <Alert
                      type="warning"
                      showIcon
                      message="Perhatian: Eksklusi dari Kuota Proyek"
                      description="Tindakan ini menandai item PR sebagai pengeluaran non-RAB (misalnya pengeluaran administratif atau perbaikan non-proyek). Item tidak akan memotong kuota CostItem proyek, namun Safety Gate akan terbuka."
                      style={{ marginBottom: 16 }}
                    />

                    <Form form={excludeForm} layout="vertical">
                      <Form.Item
                        label="Alasan Eksklusi (Wajib Diisi)"
                        name="reason"
                        rules={[{ required: true, message: 'Alasan eksklusi wajib diisi!' }]}
                      >
                        <TextArea
                          rows={3}
                          placeholder="Jelaskan alasan mengapa item ini tidak dibebankan pada kuota RAB proyek..."
                          disabled={!canMutate}
                        />
                      </Form.Item>

                      <Form.Item label="Catatan Tambahan (Opsional)" name="notes">
                        <Input placeholder="Contoh: Disetujui Head of Operations" disabled={!canMutate} />
                      </Form.Item>
                    </Form>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Button onClick={onClose}>Batal</Button>
                      <Button
                        danger
                        type="primary"
                        icon={<StopOutlined />}
                        disabled={!canMutate}
                        loading={submitting}
                        onClick={handleExcludeSubmit}
                      >
                        Konfirmasi Eksklusi dari Kuota
                      </Button>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </Modal>
  );
};
